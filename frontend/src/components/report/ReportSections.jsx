import { useMemo, useState } from 'react'
import { AlertCircle, BookOpen, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, ClipboardPaste, ExternalLink, FileQuestion, Globe2, HelpCircle, Search, ShieldAlert, Target, TriangleAlert } from 'lucide-react'
import { STATUS_ORDER, isBlocker, statusMeta } from '../../domain/status'
import { useLang } from '../../i18n/LangProvider'
import { useTr } from '../../hooks/reportTranslationContext'
import { evidenceStrength } from '../../domain/strength'
import { AiChip, CredBadge, CriticalTag, EmptyState, SourceAvatar, StatusPill, StrengthBadge, UndatedBadge } from '../common/ui'

/** Status pill that says "Supported · weak" when only weak evidence backs a supported item. */
export function FindingPill({ finding, result, small = true }) {
  return <StatusPill status={finding.status} small={small} weak={evidenceStrength(finding, result).weak} />
}

export function KeyFacts({ result, onOpen }) {
  const { t } = useLang()
  const { tr } = useTr()
  const facts = result.key_facts?.length ? result.key_facts : result.findings.map((f) => ({ finding_id: f.id, title: f.title, value: f.value, sources: [...new Set(f.sources.map((s) => s.source))] }))
  const byId = Object.fromEntries(result.findings.map((f) => [f.id, f]))
  return <section className="panel key-facts" aria-labelledby="facts-title">
    <div className="side-panel-heading"><div><div className="section-kicker">STRUCTURED SUMMARY</div><h3 id="facts-title">{t('sec.key_facts')}</h3></div><ClipboardList size={18} aria-hidden="true" /></div>
    <ul className="fact-list">
      {facts.map((fact) => {
        const finding = byId[fact.finding_id]
        return <li key={fact.finding_id}>
          <button className="fact-row" onClick={() => finding && onOpen(finding)}>
            <span className="fact-title">{tr(`title:${fact.finding_id}`, fact.title)}</span>
            <span className="fact-value">{tr(`value:${fact.finding_id}`, fact.value)}</span>
            <span className="fact-meta">
              {finding && <FindingPill finding={finding} result={result} />}
              {fact.sources.length ? fact.sources.map((s) => <SourceAvatar key={s} id={s} sources={result.sources} />) : <span className="muted-small">no source</span>}
            </span>
          </button>
        </li>
      })}
    </ul>
  </section>
}

export function UnansweredQuestions({ result, onOpen }) {
  const { t } = useLang()
  const { tr } = useTr()
  const byId = Object.fromEntries(result.findings.map((f) => [f.id, f]))
  const questions = result.unanswered_questions || []
  return <section className="panel gaps-panel" aria-labelledby="gaps-title">
    <div className="side-panel-heading"><div><div className="section-kicker">WHAT NOBODY ANSWERED</div><h3 id="gaps-title">{t('sec.gaps')}</h3></div><HelpCircle size={18} aria-hidden="true" /></div>
    <AiChip text={t('sec.gaps_ai')} />
    {questions.length ? <ul className="question-list">
      {questions.map((q) => { const f = byId[q.finding_id]; return <li key={`${q.finding_id}-${q.question}`}>
        <button onClick={() => f && onOpen(f)}>
          <span className="q-mark" aria-hidden="true">?</span>
          <span><b>{tr(`q:${q.finding_id}`, q.question)}</b>{f && <small>{t(`status.${f.status}`)} · {tr(`title:${f.id}`, f.title)}</small>}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </li> })}
    </ul> : <EmptyState icon={CheckCircle2} title="No open questions">Every checklist item had evidence in your sources.</EmptyState>}
  </section>
}

export function BlockersPanel({ result, onOpen }) {
  const { t } = useLang()
  const { tr } = useTr()
  const blockers = result.findings.filter(isBlocker)
  const icons = { conflict: TriangleAlert, outdated: Clock3, missing: FileQuestion, unverified: ShieldAlert }
  return <section className="panel blockers-panel" aria-labelledby="blockers-title">
    <div className="side-panel-heading"><div><div className="section-kicker">DECISION CHECK</div><h3 id="blockers-title">{t('sec.blockers')}</h3></div><span className="blocker-count" aria-label={`${blockers.length} blockers`}>{blockers.length}</span></div>
    {blockers.length ? <div className="blocker-list">{blockers.map((item) => {
      const Icon = icons[item.status] || ShieldAlert
      return <button key={item.id} className="blocker-item" onClick={() => onOpen(item)}>
        <span className={`blocker-icon ${item.status}`}><Icon size={14} aria-hidden="true" /></span>
        <span><b>{tr(`title:${item.id}`, item.title)}</b><small>{t(`status.${item.status}`)} · {t('common.critical')}</small></span><ChevronRight size={14} aria-hidden="true" />
      </button>
    })}</div> : <EmptyState icon={CheckCircle2} title="No critical blockers">No critical item is unresolved.</EmptyState>}
    <details className="more"><summary>What counts as a blocker?</summary><p>A critical item that is a possible conflict, possibly outdated, a potential gap, or could not verify.</p></details>
  </section>
}

export function SourceRegister({ sources, dna, onRerun }) {
  const { t } = useLang()
  const twin = Object.fromEntries((dna?.clusters || []).flatMap((group) => group.map((id) => [id, group.filter((x) => x !== id)])))
  return <section className="panel source-panel" aria-labelledby="sources-title">
    <div className="side-panel-heading"><div><div className="section-kicker">SOURCE REGISTER</div><h3 id="sources-title">{t('sec.sources')}</h3></div><span className="source-total">{sources.length} / 5</span></div>
    <ul className="source-register">{sources.map((source) => <li className="source-card-row" key={source.id}>
      <SourceAvatar id={source.id} sources={sources} />
      <div className="source-card-copy"><b>{source.name}</b><span>{source.host}</span><small>{source.date || 'No visible date'}</small>
        {source.state === 'Blocked' && source.excerpt && <small className="blocked-reason">{source.excerpt}</small>}
        {source.note && <small className="pasted-note">{source.note}</small>}
        {source.state === 'Blocked' && onRerun && <button className="rerun-button no-print" onClick={() => onRerun(source)}><ClipboardPaste size={13} aria-hidden="true" /> {t('src.rerun')}</button>}
      </div>
      <div className="source-card-right">
        <CredBadge type={source.type} />
        {source.state === 'Blocked' ? <span className="source-state blocked"><AlertCircle size={12} aria-hidden="true" /> {t('src.blocked')}</span>
          : source.state === 'Pasted' ? <span className="source-state pasted"><ClipboardPaste size={12} aria-hidden="true" /> {t('src.pasted')}</span>
          : <span className="source-state readable"><CheckCircle2 size={12} aria-hidden="true" /> {t('src.read')}</span>}
        {source.undated && source.state !== 'Blocked' && <UndatedBadge />}
        {twin[source.id] && <span className="dna-badge" title="Source DNA: these pages share most of their text">{t('src.same_voice', { ids: twin[source.id].join(', ') })}</span>}
      </div>
    </li>)}</ul>
  </section>
}

export function VerifyNext({ checklist, id = 'verify-next' }) {
  const { t } = useLang()
  const { tr } = useTr()
  const [checked, setChecked] = useState([])
  const toggle = (key) => setChecked((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]))
  const sorted = [...checklist].sort((a, b) => Number(b.critical) - Number(a.critical))
  return <section className="verify-section" id={id} aria-labelledby="verify-title">
    <div className="verify-header">
      <div><div className="section-kicker">CLOSE THE GAPS</div><h2 id="verify-title">{t('sec.verify')}</h2><p>{t('sec.verify_sub')} <AiChip text={t('sec.verify_ai')} /></p></div>
      <div className="verify-progress"><b>{checked.length}/{checklist.length}</b><span>{t('sec.done')}</span><div className="verify-progress-bar"><i style={{ width: `${checklist.length ? (checked.length / checklist.length) * 100 : 0}%` }} /></div></div>
    </div>
    {sorted.length ? <div className="verify-grid">{sorted.map((item) => <div key={item.id} className={`verify-item ${checked.includes(item.id) ? 'done' : ''}`}>
      <label className="verify-main">
        <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />
        <span className="custom-check" aria-hidden="true"><Check size={12} /></span>
        <b>{tr(`chk:${item.id}`, item.text)}</b>
      </label>
      {item.critical && <span className="critical-tag">{t('common.critical')}</span>}
      <details className="more"><summary>{t('sec.why_where')}</summary>
        <p>{tr(`why:${item.id}`, item.why)}</p>
        <p className="verify-where"><ExternalLink size={11} aria-hidden="true" /> {t('sec.check')}: {tr(`where:${item.id}`, item.where)}</p>
      </details>
    </div>)}</div> : <EmptyState icon={CheckCircle2} title="Nothing left to verify">No open items were found.</EmptyState>}
  </section>
}

export function FindingsTable({ result, onOpen }) {
  const { t } = useLang()
  const { tr } = useTr()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const findings = result.findings
  const counts = useMemo(() => findings.reduce((acc, f) => ({ ...acc, [f.status]: (acc[f.status] || 0) + 1 }), {}), [findings])
  const visible = findings.filter((f) => (filter === 'all' || f.status === filter) && `${f.title} ${tr(`title:${f.id}`, '')} ${f.category} ${f.value}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="panel findings-panel" aria-labelledby="findings-title">
    <div className="panel-heading report-panel-heading"><div><div className="section-kicker">INVESTIGATION RESULTS</div><h2 id="findings-title">{t('sec.what_found')}</h2><p>One row per checklist item. Select a row to see the evidence.</p></div></div>
    <div className="finding-toolbar">
      <div className="finding-tabs" role="group" aria-label="Filter by status">
        <button aria-pressed={filter === 'all'} className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All <span>{findings.length}</span></button>
        {STATUS_ORDER.map((s) => <button key={s} aria-pressed={filter === s} className={filter === s ? 'selected' : ''} onClick={() => setFilter(s)}>{t(`status.${s}`)} <span>{counts[s] || 0}</span></button>)}
      </div>
      <label className="mini-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Find an item</span><input placeholder="Find an item" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    </div>
    <div className="finding-list-head" aria-hidden="true"><span>CHECKLIST ITEM</span><span>EXTRACTED INFORMATION</span><span>EVIDENCE</span><span>STATUS</span><span /></div>
    <div className="finding-list">
      {visible.length ? visible.map((f) => {
        const refs = [...new Set(f.sources.map((s) => s.source))]
        return <button className="finding-row" key={f.id} onClick={() => onOpen(f)}>
          <div className="finding-main"><span className="finding-pin" aria-hidden="true">{f.critical ? <Target size={15} /> : <BookOpen size={15} />}</span><div><b>{tr(`title:${f.id}`, f.title)}</b><span>{f.category}{f.critical && <i className="critical-mini">{t('common.critical')}</i>}{f.undated && <i className="undated-mini">UNDATED</i>}</span></div></div>
          <div className="finding-value">{tr(`value:${f.id}`, f.value)}</div>
          <div className="finding-sources">{refs.length ? <span className="avatars">{refs.slice(0, 3).map((s) => <SourceAvatar key={s} id={s} sources={result.sources} />)}</span> : null}<StrengthBadge finding={f} result={result} /></div>
          <div className="finding-status"><FindingPill finding={f} result={result} /></div>
          <ChevronRight className="finding-chevron" size={16} aria-hidden="true" />
        </button>
      }) : <EmptyState icon={Search} title="No findings match this filter" />}
    </div>
    <div className="findings-foot"><span><Globe2 size={13} aria-hidden="true" /> {findings.length} checklist items · built before reading any source</span></div>
  </section>
}

const BOARD_TILT = [-0.7, 0.5, -0.3, 0.8, -0.6, 0.35]

/** One sticker card per finding, pinned with tape: the "case board". */
export function CaseBoard({ result, onOpen, onEmail }) {
  const { t } = useLang()
  const { tr } = useTr()
  const ordered = [...result.findings].sort((a, b) => Number(isBlocker(b)) - Number(isBlocker(a)))
  return <section className="case-board" aria-label="Case board: one card per checklist item">
    {ordered.map((f, i) => {
      const meta = statusMeta(f.status)
      const refs = [...new Set(f.sources.map((s) => s.source))]
      const gap = f.status === 'missing'
      return <article key={f.id} className={`board-card tone-${meta.tone} ${gap ? 'is-gap' : ''}`} style={{ '--tilt': `${BOARD_TILT[i % BOARD_TILT.length]}deg` }}>
        <span className="board-tape" aria-hidden="true" />
        <header>
          <span className="board-cat">{f.category}{f.critical && <> · <CriticalTag /></>}</span>
          <FindingPill finding={f} result={result} />
        </header>
        <h3>{tr(`title:${f.id}`, f.title)}</h3>
        <p className="board-value">{tr(`value:${f.id}`, f.value)}</p>
        <StrengthBadge finding={f} result={result} />
        <details className="more"><summary>{t('board.details')}</summary><p className="board-summary">{tr(`sum:${f.id}`, f.summary)}</p></details>
        {gap && <div className="board-alert">
          <b>{t('board.jasoos')}</b>
          <span>{tr(`note:${f.id}`, f.note)}</span>
          <button className="board-alert-btn" onClick={() => onEmail(f)}>{t('board.ask')}</button>
          <AiChip />
        </div>}
        <footer>
          <span className="board-refs">{refs.length ? refs.map((s) => <SourceAvatar key={s} id={s} sources={result.sources} />) : <em>{t('board.no_source')}</em>}</span>
          <button className="text-link" onClick={() => onOpen(f)}>{t('board.inspect')}<span className="sr-only">: {f.title}</span></button>
        </footer>
      </article>
    })}
  </section>
}
