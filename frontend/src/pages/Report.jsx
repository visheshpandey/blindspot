import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronRight, MessageCircle, RefreshCw, UsersRound, Clock3, Download, Globe2, Info, Languages, LayoutGrid, ListChecks, Mail, Map as MapIcon, RotateCcw, StickyNote, Target, TriangleAlert, UserRound } from 'lucide-react'
import { VERDICTS, isBlocker, statusMeta } from '../domain/status'
import { formatWhen } from '../domain/cases'
import { useLang } from '../i18n/LangProvider'
import { useTr } from '../hooks/reportTranslationContext'
import { useLite } from '../hooks/a11y'
import { useReportView } from '../state/useReportView'
import { LADDER, explainVerdict } from '../domain/explain'
import { evidenceStrength } from '../domain/strength'
import { isTrapLab } from '../domain/traplab'
import { shareText, whatsappUrl } from '../domain/share'
import { TrapScorecard, WhatChanged } from '../components/traplab/Showcase'
import { AiChip, CoverageRing, CriticalTag, Legend, SampleBadge, StrengthBadge, VerdictChip } from '../components/common/ui'
import { BlockersPanel, CaseBoard, FindingPill, FindingsTable, KeyFacts, SourceRegister, UnansweredQuestions, VerifyNext } from '../components/report/ReportSections'

const TownScene = lazy(() => import('../three/TownScene.jsx'))

const VIEWS = [
  { id: 'board', key: 'report.view_board', icon: StickyNote },
  { id: 'town', key: 'report.view_town', icon: MapIcon },
  { id: 'table', key: 'report.view_table', icon: LayoutGrid },
]
// One fixed icon per status, the same in the 3D town, the 2D town and the legend.
const TOWN_ICONS = { supported: '★', conflict: '⚡', outdated: '🕸', missing: '???', unverified: '☁' }

function ViewTabs({ view, setView, townFailed }) {
  const { t } = useLang()
  const refs = useRef({})
  const enabled = VIEWS.filter((v) => !(v.id === 'town' && townFailed))
  const onKey = (event) => {
    const i = enabled.findIndex((v) => v.id === view)
    let next = null
    if (event.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length]
    if (event.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length]
    if (event.key === 'Home') next = enabled[0]
    if (event.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    event.preventDefault()
    setView(next.id)
    refs.current[next.id]?.focus()
  }
  return <div className="view-toggle" role="tablist" aria-label={t('report.views')} onKeyDown={onKey}>
    {VIEWS.map(({ id, key, icon: Icon }) => <button key={id} ref={(el) => { refs.current[id] = el }} role="tab" id={`tab-${id}`} aria-controls="report-view-panel"
      aria-selected={view === id} tabIndex={view === id ? 0 : -1} className={view === id ? 'selected' : ''} onClick={() => setView(id)} disabled={id === 'town' && townFailed}>
      <Icon size={15} aria-hidden="true" /> {t(key)}
    </button>)}
  </div>
}

function TownLegend() {
  const { t } = useLang()
  return <div className="town-legend" aria-label={t('legend.town')}>
    <b>{t('legend.town')}</b>
    <ul>{Object.entries(TOWN_ICONS).map(([status, icon]) => <li key={status}><span className={`tl-icon s-${status}`} aria-hidden="true">{icon}</span>{t(`status.${status}`)}</li>)}</ul>
  </div>
}

function HouseList({ result, selectedId, onOpen }) {
  const { tr } = useTr()
  return <nav className="house-list" aria-label="Houses in the town (one per finding)">
    <div className="section-kicker">HOUSES · ONE PER FINDING</div>
    <ul>{result.findings.map((f) => <li key={f.id}>
      <button className={selectedId === f.id ? 'selected' : ''} onClick={() => onOpen(f)} aria-current={selectedId === f.id ? 'true' : undefined}>
        <span className="house-title"><span className={`tl-icon s-${f.status}`} aria-hidden="true">{TOWN_ICONS[f.status]}</span>{tr(`title:${f.id}`, f.title)}{f.critical && <CriticalTag />}</span>
        <span className="house-meta"><FindingPill finding={f} result={result} /><StrengthBadge finding={f} result={result} compact /></span>
      </button>
    </li>)}</ul>
  </nav>
}

/** The town without WebGL: flat house tiles in the same order, with the same icons (phones, reduced motion, no GPU). */
function FlatTown({ result, onOpen, selectedId }) {
  const { tr } = useTr()
  return <div className="flat-town" role="list" aria-label="Town: one house per finding">
    {result.findings.map((f) => <button key={f.id} role="listitem" className={`flat-house s-${f.status} ${selectedId === f.id ? 'selected' : ''}`} onClick={() => onOpen(f)}>
      <span className="flat-roof" aria-hidden="true" />
      <span className="flat-icon" aria-hidden="true">{TOWN_ICONS[f.status]}</span>
      <b>{tr(`title:${f.id}`, f.title)}</b>
      <FindingPill finding={f} result={result} />
    </button>)}
  </div>
}

function VerdictCard({ result, onOpen, onNew }) {
  const { t } = useLang()
  const { tr } = useTr()
  const meta = VERDICTS[result.verdict] || VERDICTS['Not ready to decide']
  const blockers = result.findings.filter(isBlocker)
  const why = explainVerdict(result, t, tr)
  return <section className={`verdict-card v-${meta.tone}`} aria-label={`${t('verdict.label')}: ${t(`verdict.${result.verdict}`)}`}>
    <div className="verdict-main">
      <span className="verdict-kicker">{t('verdict.label')}</span>
      <b className="verdict-word">{t(`verdict.${result.verdict}`)}</b>
      <span className="verdict-short">{t(`verdict.short.${result.verdict}`)}</span>
    </div>
    <div className="verdict-stats">
      <CoverageRing value={result.coverage} size="small" />
      <span className="verdict-count">{blockers.length === 1 ? t('verdict.blocker') : t('verdict.blockers', { n: blockers.length })}</span>
    </div>
    {blockers.length > 0 && <div className="verdict-chips" aria-label="Critical blockers: open one to see its evidence">
      {blockers.map((b) => { const Icon = statusMeta(b.status).icon; return <button key={b.id} className={`verdict-chip-btn s-${b.status}`} onClick={() => onOpen(b)}><Icon size={13} aria-hidden="true" />{tr(`title:${b.id}`, b.title)}</button> })}
    </div>}
    {result.verdict === 'Insufficient evidence' && <button className="primary-button" onClick={onNew}>{t('verdict.paste_retry')}</button>}
    <ol className="verdict-ladder" aria-label={t('ladder.title')}>
      {LADDER.map((step) => <li key={step} className={step === result.verdict ? 'current' : ''} aria-current={step === result.verdict ? 'step' : undefined}>
        <b>{t(`verdict.${step}`)}</b><small>{t(`ladder.${step}`)}</small>
      </li>)}
    </ol>
    <details className="more verdict-more">
      <summary>{t('verdict.why')}</summary>
      <ul className="why-list">{why.reasons.map((r, i) => <li key={i}>
        {r.finding ? <button className="why-link" onClick={() => onOpen(r.finding)}><span className={`tl-icon s-${r.finding.status}`} aria-hidden="true">{TOWN_ICONS[r.finding.status]}</span>{r.text}<ChevronRight size={13} aria-hidden="true" /></button> : r.text}
      </li>)}</ul>
      <div className="why-fix"><b>{t('fix.what_changes')}</b>{why.fixIntro && <span>{why.fixIntro}</span>}
        <ul>{why.fixes.map((f, i) => <li key={i}>{f.finding ? <button className="why-link" onClick={() => onOpen(f.finding)}>{f.text}<ChevronRight size={13} aria-hidden="true" /></button> : f.text}</li>)}</ul>
      </div>
      {result.mode === 'demo' && !result.demo_run && <p className="run-note"><SampleBadge compact /> This sample's quotes, URLs and dates are illustrative, not real guidance.</p>}
    </details>
  </section>
}

function LimitedNotice({ warnings }) {
  const { t } = useLang()
  if (!warnings.length) return null
  return <details className="limited-notice">
    <summary><TriangleAlert size={14} aria-hidden="true" /> {t('report.limited', { n: warnings.length })}</summary>
    <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
    <p>Quotes are still checked against the page text by code.</p>
  </details>
}

function TranslationStatus() {
  const { t, lang, setLang } = useLang()
  const { status, reason, elapsed } = useTr()
  if (lang !== 'hi' || status === 'off') return null
  if (status === 'loading') return <div className="translate-progress" role="status" aria-live="polite"><span>{t('report.translating')}</span><div className="translate-bar"><i /></div></div>
  if (status === 'error') return <div className="inline-note error" role="alert"><Info size={14} aria-hidden="true" /> {t('report.translate_failed', { reason })} <button className="text-link" onClick={() => setLang('en')}>{t('report.english')}</button></div>
  return <div className="inline-note hindi"><AiChip text={t('report.translated_note')} />{elapsed > 0 && <small className="muted-small"> {elapsed.toFixed(1)} s</small>}</div>
}

/** Paper version of the report, shown only when printing / saving as PDF. */
function PrintReport({ result }) {
  const { t } = useLang()
  const { tr } = useTr()
  const byId = Object.fromEntries(result.sources.map((s) => [s.id, s]))
  const blockers = result.findings.filter(isBlocker)
  const gaps = result.findings.filter((f) => f.status === 'missing' || f.status === 'unverified')
  return <article className="print-report" aria-hidden="true">
    <header>
      <small>Blindspot · {t('report.case_file')} {result.investigation_id}{result.mode === 'demo' && !result.demo_run ? ' · Sample data, illustrative' : ''}{result.demo_run ? ' · Saved demo run' : ''}</small>
      <h1>{tr('case:title', result.title)}</h1>
      {result.question && <p>“{tr('case:question', result.question)}”</p>}
      <p>{result.context?.year} · {result.context?.location} · {result.context?.category}</p>
    </header>
    <section className="pr-verdict"><b>{t('verdict.label')}: {t(`verdict.${result.verdict}`)}</b> · {result.coverage}% {t('verdict.coverage')} · {blockers.length === 1 ? t('verdict.blocker') : t('verdict.blockers', { n: blockers.length })}
      {blockers.length > 0 && <p>{t('sec.blockers')}: {blockers.map((b) => `${tr(`title:${b.id}`, b.title)} (${t(`status.${b.status}`)})`).join('; ')}</p>}
    </section>
    <h2>{t('sec.what_found')}</h2>
    {result.findings.map((f) => { const s = evidenceStrength(f, result); return <section key={f.id} className="pr-finding">
      <h3>{tr(`title:${f.id}`, f.title)} — {s.weak ? t('status.supported_weak') : t(`status.${f.status}`)}{f.critical ? ` · ${t('common.critical')}` : ''}</h3>
      <p><b>{tr(`value:${f.id}`, f.value)}</b></p>
      <p>{tr(`sum:${f.id}`, f.summary)}</p>
      <p className="pr-strength">{s.sources ? (s.sources === 1 ? t('strength.label_one') : t('strength.label', { n: s.sources, m: s.independent })) : t('strength.none')}</p>
      {(f.sources || []).map((e, i) => <blockquote key={i}>“{e.quote}” — {byId[e.source]?.name || e.source} ({byId[e.source]?.type || 'Unverified'}, {e.date || 'undated'}){e.confirmed_live ? ` · ${t('drawer.confirmed_live')}` : ''}<br /><span className="pr-url">{e.url || 'Pasted text'}</span></blockquote>)}
      {f.note && <p className="pr-ai">AI suggestion · may be wrong: {tr(`note:${f.id}`, f.note)}</p>}
    </section> })}
    {gaps.length > 0 && <><h2>{t('sec.gaps')}</h2><ul>{gaps.map((f) => <li key={f.id}>{tr(`title:${f.id}`, f.title)} — {t(`status.${f.status}`)}</li>)}</ul></>}
    <h2>{t('sec.verify')} <small>({t('sec.verify_ai')})</small></h2>
    <ol>{[...(result.checklist || [])].sort((a, b) => Number(b.critical) - Number(a.critical)).map((c) => <li key={c.id}>{tr(`chk:${c.id}`, c.text)} — {t('sec.check')}: {tr(`where:${c.id}`, c.where)}</li>)}</ol>
    <h2>{t('sec.sources')}</h2>
    <ul>{result.sources.map((s) => <li key={s.id}>{s.id} · {s.name} · {s.type} · {s.state} · {s.url || s.host}</li>)}</ul>
    <footer><p>{t('drawer.quotes_original')}</p><p>{t('report.disclaimer')}</p><p>{t('report.generated')}: {formatWhen(result.generated_at)} · printed {new Date().toLocaleString()}</p></footer>
  </article>
}

export default function Report({ result, viewRequest, onOpen, selectedId, onEmail, onNew, onRerun, onRecheck, onSimulate, student = '', onStudent }) {
  const { t, lang, setLang } = useLang()
  const { tr } = useTr()
  const lite = useLite()
  const [view, setView, showView] = useReportView(VIEWS.map((v) => v.id))
  const [townFailed, setTownFailed] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const handleTownFail = useCallback(() => setTownFailed(true), [])
  useEffect(() => { if (viewRequest) showView(viewRequest.view) }, [viewRequest])

  const findings = result.findings
  const blockers = useMemo(() => findings.filter(isBlocker), [findings])
  const demo = result.mode === 'demo'
  const warnings = (result.warnings || []).filter((w) => !w.startsWith('Sample data'))

  const exportReport = () => {
    const before = document.title
    const day = new Date().toISOString().slice(0, 10)
    document.title = `blindspot-${result.investigation_id}-${day}`
    const restore = () => { document.title = before; window.removeEventListener('afterprint', restore) }
    window.addEventListener('afterprint', restore)
    window.print()
    window.setTimeout(restore, 1500)
  }
  const scrollToVerify = () => document.getElementById('verify-next')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return <div className="report-page" lang={lang === 'hi' ? 'hi' : undefined}>
    <div className="report-screen">
      <div className="report-title-row">
        <div>
          <div className="section-kicker">{t('report.case_file').toUpperCase()} / {result.investigation_id} {demo && !result.demo_run && <SampleBadge />}{result.demo_run && <span className="demo-run-badge">Saved demo run</span>}</div>
          <h1>{tr('case:title', result.title)}</h1>
          {result.question && result.question !== result.title && <p className="report-question">“{tr('case:question', result.question)}”</p>}
          {onStudent && <label className="student-tag no-print"><UsersRound size={13} aria-hidden="true" /><span>Student</span>
            <input key={result.investigation_id} defaultValue={student.replace(' (sample)', '')} placeholder="Tag a name (counsellor board)" maxLength={60} onBlur={(e) => onStudent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} aria-label="Student name for the counsellor board" /></label>}
          <div className="report-meta" aria-label="Context lock">
            <span><CalendarClock size={13} aria-hidden="true" /> {result.context?.year}</span>
            <span><Globe2 size={13} aria-hidden="true" /> {result.context?.location}</span>
            <span><UserRound size={13} aria-hidden="true" /> {result.context?.category}</span>
            <span><Clock3 size={13} aria-hidden="true" /> {formatWhen(result.generated_at)}</span>
          </div>
        </div>
        <div className="report-title-actions">
          <button className={`secondary-button ${lang === 'hi' ? 'pressed' : ''}`} onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} aria-pressed={lang === 'hi'}>
            <Languages size={14} aria-hidden="true" />{lang === 'hi' ? t('report.english') : <span lang="hi">{t('report.hindi')}</span>}
          </button>
          {!demo && !result.demo_run && onRecheck && <button className="secondary-button" onClick={() => onRecheck(result)}><RefreshCw size={14} aria-hidden="true" /> {t('report.recheck')}</button>}
          <a className="secondary-button whatsapp-button" href={whatsappUrl(shareText(result, t, tr))} target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" /> {t('report.whatsapp')}<span className="sr-only"> (opens WhatsApp)</span></a>
          <button className="secondary-button" onClick={exportReport}><Download size={14} aria-hidden="true" /> {t('report.export')}</button>
          <button className="primary-button compact" onClick={() => onEmail(null)}><Mail size={14} aria-hidden="true" /> {t('report.email')}</button>
        </div>
      </div>
      <TranslationStatus />
      <LimitedNotice warnings={warnings} />
      <VerdictCard result={result} onOpen={onOpen} onNew={onNew} />
      {result.changes && <WhatChanged changes={result.changes} simulated={isTrapLab(result)} onOpen={onOpen} result={result} />}
      {isTrapLab(result) && <TrapScorecard result={result} onSimulate={!result.demo_run ? onSimulate : null} />}

      <ViewTabs view={view} setView={setView} townFailed={townFailed && !lite} />
      <div id="report-view-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {view === 'town' ? <section className="town-report" aria-label={t('report.view_town')}>
          <p className="town-line">{t('report.town_line')}</p>
          <div className="town-stage">
            {lite || townFailed ? <FlatTown result={result} onOpen={onOpen} selectedId={selectedId} /> : <Suspense fallback={<div className="world3d-loading"><span className="spinner-dot" /> Building the town…</div>}>
              <TownScene findings={findings} selectedId={selectedId} onSelect={(id) => { const f = findings.find((x) => x.id === id); if (f) onOpen(f) }} resetSignal={resetSignal} onFail={handleTownFail} />
            </Suspense>}
            <TownLegend />
            {!lite && !townFailed && <div className="town-hud" aria-label="Investigation summary">
              <CoverageRing value={result.coverage} size="small" />
              <div className="hud-stats">
                <span className="hud-blockers"><TriangleAlert size={14} aria-hidden="true" /> {blockers.length === 1 ? t('verdict.blocker') : t('verdict.blockers', { n: blockers.length })}</span>
                <VerdictChip verdict={result.verdict} />
              </div>
              <button className="hud-button" onClick={scrollToVerify}><ListChecks size={14} aria-hidden="true" /> {t('report.verify_next')}</button>
              <button className="hud-icon" onClick={() => setResetSignal((n) => n + 1)} aria-label={t('report.reset_camera')}><RotateCcw size={14} aria-hidden="true" /></button>
            </div>}
          </div>
          <HouseList result={result} selectedId={selectedId} onOpen={onOpen} />
        </section> : view === 'board' ? <CaseBoard result={result} onOpen={onOpen} onEmail={onEmail} />
          : <div className="report-content-grid">
            <FindingsTable result={result} onOpen={onOpen} />
            <aside className="report-side-stack"><BlockersPanel result={result} onOpen={onOpen} /></aside>
          </div>}
      </div>

      <div className="report-two-col">
        <KeyFacts result={result} onOpen={onOpen} />
        <UnansweredQuestions result={result} onOpen={onOpen} />
      </div>
      <VerifyNext checklist={result.checklist || []} />
      <div className="report-two-col">
        <SourceRegister sources={result.sources} dna={result.source_dna} onRerun={onRerun} />
        <Legend />
      </div>
      <div className="report-disclaimer"><Info size={14} aria-hidden="true" /><span>{t('report.disclaimer')}</span></div>
      <div className="report-end-actions no-print"><button className="secondary-button" onClick={onNew}><Target size={14} aria-hidden="true" /> {t('report.start_another')}</button></div>
    </div>
    <PrintReport result={result} />
  </div>
}
