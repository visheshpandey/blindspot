import { ArrowRight, Check, FlaskConical, MessageSquareText, RefreshCw, Search, X } from 'lucide-react'
import { formatWhen } from '../../domain/cases'
import { useLang } from '../../i18n/LangProvider'
import { SampleBadge, StatusPill } from '../common/ui'
import { TRAPLAB_RUN, scoreTraps } from '../../domain/traplab'

// An invented example of what a plain AI summary of the same pages sounds like: smooth, confident, and wrong in the places below.
const SUMMARY = 'To apply for the 2026-27 post-matric scholarship, you need an income certificate or a self-declaration, your mark sheet and caste certificate. Income must be under Rs 2,50,000. Apply on the portal before 31 October. The scholarship pays Rs 1,200 per month for day scholars.'

/** Same five pages, two answers: a typical summary vs what Blindspot found (real recorded run, not mocked). */
export function SummaryVsBlindspot({ onTry }) {
  const run = TRAPLAB_RUN
  const shown = ['conflict', 'outdated', 'unverified', 'missing']
    .map((status) => run.findings.find((f) => f.status === status)).filter(Boolean)
  return <section className="versus-panel" aria-labelledby="versus-title">
    <h2 id="versus-title">Same five pages. Two very different answers.</h2>
    <div className="versus-grid">
      <article className="versus-card plain">
        <header><MessageSquareText size={16} aria-hidden="true" /> A typical AI summary <span className="versus-tag">Illustration</span></header>
        <p className="versus-quote">“{SUMMARY}”</p>
        <ul className="versus-bad">
          <li><X size={14} aria-hidden="true" /> Mixes last year's amount into this year's answer</li>
          <li><X size={14} aria-hidden="true" /> Treats a blog's "no certificate needed" as fact</li>
          <li><X size={14} aria-hidden="true" /> Gives the old deadline and never mentions renewal</li>
          <li><X size={14} aria-hidden="true" /> Sounds sure, shows no proof</li>
        </ul>
        <small className="muted-small">Written by us to show the pattern. It is not output from a specific model.</small>
      </article>
      <article className="versus-card blind">
        <header><Search size={16} aria-hidden="true" /> What Blindspot found <span className="versus-tag real">Real run · Trap Lab pages</span></header>
        <ul className="versus-found">
          {shown.map((f) => <li key={f.id}><StatusPill status={f.status} small /><b>{f.title}</b></li>)}
          <li><span className="status-pill small teal">Same voice</span><b>The news page copies the blog: 2 pages, 1 voice</b></li>
        </ul>
        <p className="versus-verdict"><b>Verdict: {run.verdict}.</b> Every finding has the exact quote, found on the page by code.</p>
        <button className="primary-button" onClick={onTry}>Catch the traps yourself <ArrowRight size={15} aria-hidden="true" /></button>
      </article>
    </div>
  </section>
}

/** The Trap Lab call to action: five invented pages with planted traps, a live investigation in about 30 seconds. */
export function TrapLabCard({ onRun, busy }) {
  const traps = scoreTraps(TRAPLAB_RUN).rows
  return <section className="traplab-card" aria-labelledby="traplab-title">
    <div className="traplab-copy">
      <span className="section-kicker"><FlaskConical size={12} aria-hidden="true" /> TRAP LAB · LIVE TEST IN ABOUT 30 SECONDS</span>
      <h2 id="traplab-title">Don't take our word for it. Catch the traps.</h2>
      <p>We hid five traps in five test pages. One click runs a real investigation: the pages are fetched, the AI reads them, code checks every quote. Watch which traps Blindspot catches.</p>
      <button className="primary-button big" onClick={onRun} disabled={busy}>Catch the traps <ArrowRight size={16} aria-hidden="true" /></button>
      <small className="muted-small">The test pages are invented for this demo and labelled as such. Not real scholarship guidance.</small>
    </div>
    <ol className="traplab-list">
      {traps.map((t, i) => <li key={t.id}><span className="trap-no" aria-hidden="true">{i + 1}</span><span>{t.label}</span></li>)}
    </ol>
  </section>
}

/** Scorecard on a Trap Lab report: each planted trap, caught or missed, computed from the real result. */
export function TrapScorecard({ result, onSimulate }) {
  const { rows, caught, total } = scoreTraps(result)
  return <section className="trap-scorecard" aria-labelledby="score-title">
    <div className="trap-score-head">
      <span className="trap-score-num" aria-label={`${caught} of ${total} traps caught`}>{caught}/{total}</span>
      <div><h2 id="score-title">{caught === total ? 'Every planted trap caught' : `${caught} of ${total} planted traps caught`}</h2>
        <p>Checked against this report's own findings. {result.demo_run ? <>A recorded real run <SampleBadge compact /></> : 'Live run.'}</p></div>
    </div>
    <ul>{rows.map((t) => <li key={t.id} className={t.caught ? 'caught' : 'missed'}>
      <span className="trap-mark" aria-hidden="true">{t.caught ? <Check size={14} /> : <X size={14} />}</span>
      <span className="trap-icon" aria-hidden="true">{t.icon}</span>
      <span>{t.label}</span><span className="sr-only">{t.caught ? 'caught' : 'missed'}</span>
    </li>)}</ul>
    {onSimulate && <div className="trap-simulate"><button className="secondary-button" onClick={onSimulate}><FlaskConical size={14} aria-hidden="true" /> Simulate: the authority updates the notice</button><small className="muted-small">Then press Re-check to see what changed. This is a simulation on our test pages.</small></div>}
  </section>
}

const KIND = { status: 'Status changed', value: 'Value changed', new: 'New item', removed: 'No longer checked' }

/** Banner on a re-checked report: what is different from the earlier run. */
export function WhatChanged({ changes, simulated }) {
  const { t } = useLang()
  const label = (s) => t(`status.${s}`)
  return <section className="what-changed" aria-labelledby="changed-title">
    <div className="changed-head"><RefreshCw size={18} aria-hidden="true" />
      <div><h2 id="changed-title">{changes.unchanged ? 'Re-checked: nothing changed' : `Re-checked: ${changes.items.length} thing${changes.items.length === 1 ? '' : 's'} changed`}</h2>
        <p>Compared with the report from {formatWhen(changes.from_at)}. {simulated && <span className="demo-run-badge">Simulated update</span>}</p></div></div>
    <ul>
      {changes.verdict && <li><b>Verdict</b><span>{t(`verdict.${changes.verdict.from}`)} → <strong>{t(`verdict.${changes.verdict.to}`)}</strong></span></li>}
      {changes.coverage.from !== changes.coverage.to && <li><b>Coverage</b><span>{changes.coverage.from}% → <strong>{changes.coverage.to}%</strong></span></li>}
      {changes.items.map((c, i) => <li key={i}><b>{c.title}</b>
        <span>{KIND[c.kind]}{c.kind === 'status' && <>: {label(c.from)} → <strong>{label(c.to)}</strong></>}
          {c.kind === 'new' && <>: {label(c.to)}</>}</span>
        {c.kind !== 'new' && c.kind !== 'removed' && c.fromValue && c.toValue && c.fromValue !== c.toValue && <em>“{c.fromValue}” → “{c.toValue}”</em>}</li>)}
    </ul>
  </section>
}
