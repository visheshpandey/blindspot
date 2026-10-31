import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, ClipboardPaste, Globe2, LoaderCircle, ShieldAlert, Sparkles, X } from 'lucide-react'
import { STEPS } from '../domain/status'
import { useFocusTrap, useLite } from '../hooks/a11y'
import { SampleBadge } from '../components/common/ui'

const AnalyzingScene = lazy(() => import('../three/AnalyzingScene.jsx'))

const SPEECH = {
  checklist: 'First, what would a complete answer need?',
  fetch: 'Knock knock! Reading every source…',
  classify: 'Official portal or random blog? Checking!',
  extract: 'Hunting for exact quotes…',
  verify: 'Is that quote really on the page? Let me look.',
  compare: 'Same year? Same state? Who said it?',
  score: 'Counting coverage and blockers…',
  actions: 'Writing what you should verify next!',
  done: 'Case closed! Opening the report…',
  error: 'Oh no, I lost the trail.',
}

const SOURCE_STATE = {
  Fetching: { label: 'fetching', icon: LoaderCircle, spin: true },
  Readable: { label: 'read', icon: Check },
  Pasted: { label: 'pasted', icon: ClipboardPaste },
  Blocked: { label: 'blocked', icon: ShieldAlert },
}
const SLOW_AFTER_S = 90

/** Per-source fetch states, built from the pipeline's fetch events (plan first, then one event per source). */
function sourceStates(events) {
  const map = new Map()
  events.filter((e) => e.step === 'fetch' && e.detail).forEach((e) => {
    ;(e.detail.sources || []).forEach((s) => map.set(s.id, { ...map.get(s.id), ...s }))
    if (e.detail.source) map.set(e.detail.source.id, { ...map.get(e.detail.source.id), ...e.detail.source })
  })
  return [...map.values()]
}

function ConfirmCancel({ onStay, onLeave }) {
  const ref = useRef(null)
  useFocusTrap(ref, true, onStay)
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onStay() }}>
    <div className="confirm-modal" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-text">
      <h2 id="cancel-title">Stop this investigation?</h2>
      <p id="cancel-text">The run stops now. Your question and sources stay in the form so you can change them and try again.</p>
      <div className="confirm-actions">
        <button className="secondary-button" onClick={onStay}>Keep investigating</button>
        <button className="primary-button danger" onClick={onLeave}><X size={14} aria-hidden="true" /> Stop and edit</button>
      </div>
    </div>
  </div>
}

export default function Analyzing({ events, demo, error, onBack, onCancel, onSample }) {
  const lite = useLite()
  const [sceneFailed, setSceneFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const handleFail = useCallback(() => setSceneFailed(true), [])
  const last = events[events.length - 1]
  // The step of the latest event is in progress; every step before it is done.
  const reached = events.reduce((max, e) => Math.max(max, STEPS.findIndex((s) => s.id === e.step)), 0)
  const currentIndex = reached
  const doneCount = last?.step === 'done' ? STEPS.length : reached
  const progress = last?.progress ?? 2
  const failed = Boolean(error) || last?.step === 'error'
  const sources = useMemo(() => sourceStates(events), [events])
  const flat = lite || sceneFailed

  useEffect(() => {
    if (failed || last?.step === 'done') return undefined
    const started = Date.now() - elapsed * 1000
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [failed, last?.step]) // eslint-disable-line react-hooks/exhaustive-deps

  const slow = elapsed >= SLOW_AFTER_S && !failed

  return <div className="analyzing-page">
    <div className={`analyzing-stage ${flat ? 'flat' : ''}`}>
      {!flat && <Suspense fallback={null}><AnalyzingScene activeIndex={Math.max(currentIndex, 0)} doneCount={doneCount} onFail={handleFail} /></Suspense>}
      <div className="speech-bubble" role="status" aria-live="polite">
        <span className="speech-name">Jasoos Jr.</span>
        {failed ? (error || last?.message) : SPEECH[last?.step || 'checklist']}
        {last?.message && !failed && <small>{last.message}</small>}
      </div>
    </div>

    <aside className="analyzing-panel" aria-labelledby="analyzing-title">
      <div className="section-kicker">INVESTIGATION IN PROGRESS {demo && <SampleBadge compact />}</div>
      <h1 id="analyzing-title">{failed ? 'The investigation stopped' : 'Following the clues…'}</h1>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Investigation progress"><i style={{ width: `${progress}%` }} /></div>
      <ol className="step-list">
        {STEPS.map((step, i) => {
          const done = i < doneCount
          const active = !done && i === currentIndex && !failed
          return <li key={step.id} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <span className="crayon-box" aria-hidden="true">{done ? <Check size={16} strokeWidth={3.4} /> : active ? <LoaderCircle size={14} className="spin" /> : null}</span>
            <span className="step-label">{step.label}{step.ai ? <span className="ai-mini" title="This step uses AI">AI</span> : <span className="code-mini" title="This step is deterministic code">CODE</span>}</span>
            <span className="sr-only">{done ? 'done' : active ? 'in progress' : 'waiting'}</span>
          </li>
        })}
      </ol>
      {sources.length > 0 && <ul className="source-progress" aria-label="Sources">
        {sources.map((s) => { const meta = SOURCE_STATE[s.state] || SOURCE_STATE.Fetching; const Icon = meta.icon; return <li key={s.id} className={`sp-${(s.state || 'Fetching').toLowerCase()}`}>
          <span className="sp-id">{s.id}</span><Globe2 size={12} aria-hidden="true" /><span className="sp-host">{s.host}</span>
          <span className="sp-state"><Icon size={12} className={meta.spin && !failed ? 'spin' : ''} aria-hidden="true" />{meta.label}{s.live ? ' · live page checked' : ''}</span>
        </li> })}
      </ul>}
      {failed ? <div className="form-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error || last?.message || 'Something went wrong.'}</span></div>
        : slow ? <div className="slow-note" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" /><span><b>Still working…</b> Some sites are slow to answer. You can wait, or stop and paste the page text instead.</span></div>
          : <p className="analyzing-note"><Sparkles size={13} aria-hidden="true" /> AI only proposes. Code checks every quote against the page and decides each status.</p>}
      <div className="analyzing-actions">
        {failed ? <button className="secondary-button" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" /> Back to the form</button>
          : <button className="secondary-button" onClick={() => setConfirming(true)}><X size={14} aria-hidden="true" /> {slow ? 'Stop and edit' : 'Cancel'}</button>}
        {failed && <button className="primary-button" onClick={onSample}>Open the sample case</button>}
      </div>
    </aside>
    {confirming && <ConfirmCancel onStay={() => setConfirming(false)} onLeave={() => { setConfirming(false); onCancel() }} />}
  </div>
}
