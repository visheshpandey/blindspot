import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { useReducedMotion } from '../../hooks/a11y'

const STEP_MS = 6000


/** Steps of the 30-second tour. `prepare` puts the app in the right state; `target` is what gets the spotlight. */
const TOUR_STEPS = [
  { prepare: 'overview', target: '.case-file', title: 'What Blindspot does',
    body: 'You bring a decision question and the web pages you found. Blindspot tells you what those pages support, where they disagree, what is out of date, and what none of them mention.' },
  { prepare: 'sample', target: '.verdict-card', title: '1. The verdict, in one line',
    body: 'Can you decide yet? For this scholarship: no. Three critical things are unresolved, and each one is listed.' },
  { prepare: 'town', target: '.town-stage', title: '2. One house per question',
    body: 'Each house is one thing a complete answer needs. Lightning means sources disagree, a cobweb means old information, fog with ??? means nobody mentions it.' },
  { prepare: 'conflict', target: '.detail-drawer', placement: 'left', title: '3. Proof, not trust',
    body: 'Every finding shows the exact sentence from each page, and code checks the sentence really is on that page. The official portal outranks the blog. Purple boxes are AI advice, labelled as such.' },
  { prepare: 'verify', target: '#verify-next', title: '4. What to do next',
    body: 'A checklist of what to confirm before deciding, critical items first, plus a ready-to-send email to the authority.' },
  { prepare: 'overview', target: '.case-actions', title: 'Now try it with your own links',
    body: 'Start an investigation with any question and up to five links. Live analysis takes about a minute.' },
]

function waitFor(selector, timeout = 2500) {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      const el = document.querySelector(selector)
      if (el && el.getBoundingClientRect().height > 0) return resolve(el)
      if (performance.now() - start > timeout) return resolve(null)
      setTimeout(tick, 80)
    }
    tick()
  })
}

export default function Tour({ open, onClose, prepare, onStartCase }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const reducedMotion = useReducedMotion()
  // No auto-advance for reduced-motion users: they step through with Next.
  const [playing, setPlaying] = useState(!reducedMotion)
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => { if (open) setPlaying(!reducedMotion) }, [open, reducedMotion])
  const cardRef = useRef(null)
  const targetRef = useRef(null)
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1

  const finish = useCallback(() => { setIndex(0); onClose() }, [onClose])

  // Prepare the app for the step, then spotlight its target.
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    setRect(null)
    ;(async () => {
      // The tour may be closed while a step is still loading: never move the app after that.
      if (!alive || !openRef.current) return
      await prepare(step.prepare, () => alive && openRef.current)
      const el = await waitFor(step.target)
      if (!alive || !openRef.current) return
      targetRef.current = el
      if (el) el.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
      setTimeout(() => alive && el && setRect(el.getBoundingClientRect()), reducedMotion ? 0 : 450)
      cardRef.current?.focus()
    })()
    return () => { alive = false }
  }, [open, index]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the spotlight on its target while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => { if (targetRef.current) setRect(targetRef.current.getBoundingClientRect()) }, 200)
    return () => clearInterval(id)
  }, [open])

  // Autoplay: ~6 seconds per step, six steps.
  useEffect(() => {
    if (!open || !playing || last) return undefined
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1)), STEP_MS)
    return () => clearTimeout(id)
  }, [open, playing, index, last])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish() }
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, finish])

  if (!open) return null
  const pad = 10
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
  const below = hole && hole.top + hole.height + 230 < window.innerHeight
  const sideways = hole && step.placement === 'left' && hole.left > 470
  const cardStyle = !hole || window.innerWidth < 700
    ? { left: '50%', bottom: 20, transform: 'translateX(-50%)' }
    : sideways ? { left: hole.left - 446, top: 140 }
    : { left: Math.min(Math.max(hole.left, 16), window.innerWidth - 436), top: below ? hole.top + hole.height + 14 : Math.max(16, hole.top - 214) }

  return <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    {hole ? <div className="tour-hole" style={hole} /> : <div className="tour-dim" />}
    <div className="tour-card" style={cardStyle} ref={cardRef} tabIndex={-1}>
      <div className="tour-progress" aria-hidden="true">{TOUR_STEPS.map((_, i) => <i key={i} className={i < index ? 'done' : i === index ? `now ${playing && !last ? 'run' : ''}` : ''} style={i === index ? { animationDuration: `${STEP_MS}ms` } : undefined} />)}</div>
      <h2 id="tour-title" aria-live="polite">{step.title}</h2>
      <p>{step.body}</p>
      <div className="tour-actions">
        <button className="icon-button" onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} aria-label="Previous step"><ChevronLeft size={16} aria-hidden="true" /></button>
        {!last && <button className="icon-button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause tour' : 'Play tour'}>{playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>}
        <span className="tour-count">{index + 1} / {TOUR_STEPS.length}</span>
        {last ? <button className="primary-button" onClick={() => { finish(); onStartCase?.() }}>Start an investigation</button>
          : <button className="primary-button" onClick={() => setIndex((i) => i + 1)}>Next <ChevronRight size={15} aria-hidden="true" /></button>}
        <button className="icon-button" onClick={finish} aria-label="Close tour"><X size={16} aria-hidden="true" /></button>
      </div>
    </div>
  </div>
}

/** Small first-visit invitation. */
export function TourInvite({ onStart, onDismiss }) {
  return <div className="tour-invite" role="complementary" aria-label="Guided tour">
    <b>Take the 30-second tour?</b>
    <span>See what Blindspot does with a sample case.</span>
    <div>
      <button className="primary-button" onClick={onStart}><Play size={14} aria-hidden="true" /> Start</button>
      <button className="secondary-button" onClick={onDismiss}>Skip</button>
    </div>
  </div>
}
