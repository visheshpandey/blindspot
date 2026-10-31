import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpen, CalendarClock, ChevronDown, ClipboardPaste, Clock3, FileText, Globe2, Landmark, Link2, LoaderCircle, LockKeyhole, Microscope, Plus, X, Zap } from 'lucide-react'
import { PageHero } from '../components/common/ui'
import { useLite } from '../hooks/a11y'
import VoiceInput from '../components/input/VoiceInput'
import { expectedTier, normaliseUrl, suggestedSources, toPayload, validUrl } from '../domain/sources'

const CaseStreet = lazy(() => import('../three/CaseStreet.jsx'))

const YEARS = ['2026–27', '2025–26', '2027–28']
const STATES = ['Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra', 'Rajasthan', 'Bihar', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'India-wide']
const CATEGORIES = ['Undergraduate student', 'Postgraduate student', 'School student (Class 11–12)', 'Diploma / ITI student', 'Job seeker', 'Parent / guardian']

const DEFAULT_QUESTION = 'What should I verify before applying for the post-matric scholarship?'

const TOPICS = [
  { label: 'Scholarship', q: 'What should I verify before applying for the post-matric scholarship?' },
  { label: 'University admission', q: 'What are the eligibility rules and documents for this university admission?' },
  { label: 'Internship offer', q: 'What should I check before accepting this internship offer?' },
]

let rowId = 0
const newRow = (url = '', pasted = false, text = '') => ({ id: `row-${(rowId += 1)}`, url, pasted, text })

function validate({ question, rows }) {
  const errors = {}
  const q = question.trim()
  if (q.length < 10) errors.question = 'Write your question in a full sentence (at least 10 characters).'
  else if (q.length > 500) errors.question = 'Keep your question under 500 characters.'
  rows.forEach((row) => {
    const url = row.url.trim()
    if (row.pasted) {
      if (row.text.trim().length < 80) errors[row.id] = 'Paste at least a paragraph of the page text (80+ characters).'
      if (url && !validUrl(url)) errors[`${row.id}-url`] = 'Use a full web address starting with https://, or leave it blank.'
    } else if (url && !validUrl(url)) {
      errors[row.id] = 'Use a full web address starting with https://'
    }
  })
  const usable = rows.filter((r) => (r.pasted ? r.text.trim() : r.url.trim()))
  if (!usable.length) errors.sources = 'Add at least one source: a URL, or pasted page text.'
  const urls = usable.map((r) => validUrl(r.url)).filter(Boolean).map(normaliseUrl)
  if (new Set(urls).size !== urls.length) errors.sources = 'Each source should be a different page.'
  return errors
}

/** `draft` (optional) pre-fills the form: { question, year, location, category, rows: [{url, pasted, text}], focusPaste } */
export default function NewInvestigation({ onRun, onSample, busy, error, draft = null }) {
  const [question, setQuestion] = useState(draft?.question ?? 'What should I verify before applying for the post-matric scholarship?')
  const [year, setYear] = useState(draft?.year ?? '2026–27')
  const [location, setLocation] = useState(draft?.location ?? 'Madhya Pradesh')
  const [category, setCategory] = useState(draft?.category ?? 'Undergraduate student')
  const [rows, setRows] = useState(() => (draft?.rows?.length ? draft.rows.map((r) => newRow(r.url, r.pasted, r.text))
    : [newRow('https://scholarships.gov.in/'), newRow('https://socialjustice.gov.in/schemes/25'), newRow()]))
  const [errors, setErrors] = useState({})
  const lite = useLite()
  const [touched, setTouched] = useState(false)
  // Re-run from a report: put the cursor in the paste box of the page that couldn't be read.
  useEffect(() => {
    if (!draft?.focusPaste) return
    const box = document.querySelector('.source-block.pasted .paste-area:placeholder-shown') || document.querySelector('.source-block.pasted .paste-area')
    box?.focus()
    box?.scrollIntoView({ block: 'center' })
  }, [draft])

  const suggestions = useMemo(() => suggestedSources(location, category, rows.map((r) => r.url)), [location, category, rows])
  const hasRoom = rows.length < 5 || rows.some((r) => !r.url.trim() && !r.pasted)
  const addUrl = (url) => setRows((prev) => {
    const empty = prev.find((r) => !r.url.trim() && !r.pasted)
    if (empty) return prev.map((r) => (r.id === empty.id ? { ...r, url } : r))
    return prev.length >= 5 ? prev : [...prev, newRow(url)]
  })
  const addPaste = () => {
    setRows((prev) => {
      const empty = prev.find((r) => !r.url.trim() && !r.pasted)
      if (empty) return prev.map((r) => (r.id === empty.id ? { ...r, pasted: true } : r))
      return prev.length >= 5 ? prev : [...prev, newRow('', true)]
    })
    window.setTimeout(() => document.querySelector('.source-block.pasted .paste-area:placeholder-shown')?.focus(), 0)
  }

  const update = (id, patch) => setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const remove = (id) => setRows((prev) => prev.filter((row) => row.id !== id))
  const add = () => setRows((prev) => (prev.length >= 5 ? prev : [...prev, newRow()]))

  const submit = (event) => {
    event.preventDefault()
    const form = { question, year, location, category, rows }
    const found = validate(form)
    setErrors(found)
    setTouched(true)
    if (Object.keys(found).length) {
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    onRun(toPayload(form))
  }
  // Errors appear when you leave a field (not while typing), so nothing jumps under your cursor.
  const recheck = () => {
    const found = validate({ question, year, location, category, rows })
    if (!touched) delete found.sources
    setErrors(found)
  }

  // One slot per possible source; filled slots become houses on the street below the form.
  const slots = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const row = rows[i]
    if (!row) return null
    if (row.pasted && row.text.trim()) {
      let host = 'pasted text'
      try { if (row.url.trim()) host = new URL(row.url.trim()).hostname } catch { /* keep default */ }
      return { host, tier: 'Pasted' }
    }
    const tier = expectedTier(row.url)
    if (!tier) return null
    return { host: validUrl(row.url).hostname, tier: tier.type }
  }), [rows])
  const ready = slots.filter(Boolean).length

  return <div className="ni-page">
    <PageHero icon={Microscope} tone="sun" mascot="Paste your links. I'll check every quote!" title="New investigation" lede="Ask your question, lock the context, add the pages you found. Blindspot reads them and checks every quote.">
      <button type="button" className="secondary-button" onClick={onSample}><Zap size={14} aria-hidden="true" /> Try the sample case</button>
    </PageHero>

    <div className="ni-grid">
      <form className="ni-form" onSubmit={submit} onBlur={recheck} noValidate>
        <section className="ni-card" aria-labelledby="ni-q">
          <h2 id="ni-q"><span className="ni-num" aria-hidden="true">1</span> What do you need to decide?</h2>
          <textarea id="question" className="question-input" rows="2" value={question} onChange={(e) => setQuestion(e.target.value)}
            aria-labelledby="ni-q" aria-invalid={Boolean(errors.question)} aria-describedby={errors.question ? 'question-error' : undefined}
            placeholder="e.g. What should I verify before applying for this scholarship?" maxLength={500} />
          <VoiceInput onText={(text) => setQuestion((prev) => (prev.trim() && prev !== DEFAULT_QUESTION ? `${prev.trim()} ${text}` : text).slice(0, 500))} />
          <div className="q-meta">
            <p className="field-error src-helper" id="question-error" aria-live="polite">{errors.question && <><AlertCircle size={13} aria-hidden="true" />{errors.question}</>}</p>
            <span className={`char-count ${question.length > 450 ? 'near' : ''}`} aria-label={`${question.length} of 500 characters`}>{question.length}/500</span>
          </div>
          <div className="topic-chips" role="group" aria-label="Example questions">
            <span>Try:</span>
            {TOPICS.map((t) => <button type="button" key={t.label} className={`topic-chip ${question === t.q ? 'on' : ''}`} onClick={() => setQuestion(t.q)} aria-label={`Use example question: ${t.q}`}>{t.label}</button>)}
          </div>

          <fieldset className="context-lock">
            <legend><span className="ni-num" aria-hidden="true">2</span> <LockKeyhole size={14} aria-hidden="true" /> Lock the context</legend>
            <p className="ni-hint">Rules from another year or state are flagged, not mixed in.</p>
            <div className="ni-context">
              <div className="field-block"><label htmlFor="year">Year / cycle</label><div className="select-wrap"><CalendarClock size={15} aria-hidden="true" /><select id="year" value={year} onChange={(e) => setYear(e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></div>
              <div className="field-block"><label htmlFor="location">State</label><div className="select-wrap"><Globe2 size={15} aria-hidden="true" /><select id="location" value={location} onChange={(e) => setLocation(e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></div>
              <div className="field-block"><label htmlFor="category">Who is applying</label><div className="select-wrap"><BookOpen size={15} aria-hidden="true" /><select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></div>
            </div>
          </fieldset>
        </section>

        <section className="ni-card" aria-labelledby="ni-s">
          <h2 id="ni-s"><span className="ni-num" aria-hidden="true">3</span> Add the pages you found <span className="source-count" aria-label={`${ready} of 5 pages ready`}><b>{ready}</b>/5</span></h2>
          <p className="ni-hint">Official portals, college notices, blogs.</p>
          {suggestions.length > 0 && <div className="suggest-chips" role="group" aria-label={`Suggested official sources for ${location}`}>
            <span><Landmark size={13} aria-hidden="true" /> Official sources{location === 'India-wide' ? '' : ` for ${location}`}:</span>
            {suggestions.map((s) => <button type="button" key={s.url} className="suggest-chip" onClick={() => addUrl(s.url)} disabled={!hasRoom} title={s.url}>
              <Plus size={12} aria-hidden="true" />{s.label}</button>)}
          </div>}
          <div className="paste-callout">
            <ClipboardPaste size={18} aria-hidden="true" />
            <span><b>Page won't load, or needs a login?</b> Copy its text and paste it. Pasted text is checked like any page and labelled as pasted.</span>
            <button type="button" className="secondary-button compact" onClick={addPaste} disabled={!hasRoom}><FileText size={13} aria-hidden="true" /> Paste page text</button>
          </div>
          <div className="source-input-list">
            {rows.map((row, index) => <div className={`source-block ${row.pasted ? 'pasted' : ''}`} key={row.id}>
              <div className={`source-input-row ${errors[row.id] || errors[`${row.id}-url`] ? 'invalid' : ''}`}>
                <span className="source-number">{String(index + 1).padStart(2, '0')}</span>
                <Link2 size={15} className="source-link-icon" aria-hidden="true" />
                <input value={row.url} onChange={(e) => update(row.id, { url: e.target.value })} inputMode="url" autoComplete="off"
                  placeholder={row.pasted ? 'Page address (optional, for the "Open source" link)' : 'https://…'} aria-label={`Source ${index + 1} web address`}
                  aria-invalid={Boolean(errors[row.id] && !row.pasted) || Boolean(errors[`${row.id}-url`])} />
                <button type="button" className={`paste-toggle ${row.pasted ? 'on' : ''}`} onClick={() => update(row.id, { pasted: !row.pasted })} aria-pressed={row.pasted}>
                  <FileText size={13} aria-hidden="true" />{row.pasted ? 'Use URL' : 'Paste text'}
                </button>
                {rows.length > 1 && <button type="button" className="remove-source" onClick={() => remove(row.id)} aria-label={`Remove source ${index + 1}`}><X size={14} aria-hidden="true" /></button>}
              </div>

              {row.pasted && <textarea className="paste-area" rows="3" value={row.text} onChange={(e) => update(row.id, { text: e.target.value })}
                aria-label={`Pasted text for source ${index + 1}`} aria-invalid={Boolean(errors[row.id])} placeholder="Paste the page's text here: copy everything from the page and paste it." />}
              {/* One reserved line per source: an error, else the detected type, else empty. Fixed height, so nothing jumps. */}
              {(() => {
                const err = errors[row.id] || errors[`${row.id}-url`]
                const tier = !row.pasted && expectedTier(row.url)
                if (err) return <p className="src-helper field-error" aria-live="polite"><AlertCircle size={13} aria-hidden="true" />{err}</p>
                if (tier) return <p className={`src-helper tier-preview cred-${tier.type.toLowerCase()}`}>Looks like: <b>{tier.label}</b> ({tier.type})</p>
                return <p className="src-helper" aria-hidden="true" />
              })()}
            </div>)}
            <div className="source-list-footer"><button type="button" className="add-source" onClick={add} disabled={rows.length >= 5}><Plus size={14} aria-hidden="true" /> Add another page</button></div>
            <p className="field-error sources-error" aria-live="polite">{errors.sources && <><AlertCircle size={13} aria-hidden="true" />{errors.sources}</>}</p>
          </div>
          {error && <div className="form-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
          <div className="ni-submit">
            <p><span className="eta"><Clock3 size={13} aria-hidden="true" /> Takes about 30–60 seconds.</span> A page that can't be read is marked "Could not verify", never "missing".</p>
            <button type="submit" className="primary-button big" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> Starting…</> : <>Investigate sources <ArrowRight size={16} aria-hidden="true" /></>}</button>
          </div>
        </section>
      </form>

      <aside className="ni-rail" aria-labelledby="traps-title">
        <h2 id="traps-title">Three traps it catches</h2>
        <div className="trap trap-stale"><b>Last year's date</b><p>A deadline from an earlier cycle is flagged possibly outdated.</p></div>
        <div className="trap trap-gap"><b>Missing fine print</b><p>Renewal rules nobody mentions become a potential gap.</p></div>
        <div className="trap trap-clash"><b>Conflicting guidance</b><p>A forum vs the official notice: both quotes, side by side.</p></div>
        <p className="ni-rail-foot">AI reads the pages; plain code checks every quote and decides each status.</p>
      </aside>
    </div>

    <section className="case-street" aria-label="Preview of your case">
      {lite ? <div className="street-flat" aria-hidden="true">{slots.map((s, i) => <span key={i} className={`street-lot ${s ? `t-${s.tier.toLowerCase()}` : 'empty'}`}>{s ? s.host : '+'}</span>)}</div>
        : <Suspense fallback={null}><CaseStreet slots={slots} /></Suspense>}
      <div className="case-street-caption">
        <b>Your case, live</b>
        <span>“{question.trim() || 'Type your question above'}”</span>
        <em>{ready} of 5 pages ready · {year} · {location}</em>
      </div>
      <p className="case-street-hint" aria-hidden="true">Each page you add becomes a house. Blue = official, violet = institution, amber = blog, teal = pasted text.</p>
    </section>
  </div>
}
