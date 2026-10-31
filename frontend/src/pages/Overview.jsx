import { lazy, Suspense } from 'react'
import { ArrowRight, ChevronRight, FileText, Sparkles } from 'lucide-react'
import { formatWhen, historyStats } from '../domain/cases'
import { sampleResult } from '../data/sample'
import { CredBadge, QuoteStamp, SampleBadge, StatusPill } from '../components/common/ui'
import { useLite } from '../hooks/a11y'
import { SummaryVsBlindspot, TrapLabCard } from '../components/traplab/Showcase'
import { HighlightedQuote } from '../components/report/EvidenceDrawer'

const World3D = lazy(() => import('../three/World3D.jsx'))

const PLACES = [
  { id: 'hq', name: 'Police box', role: 'Open a new case', tone: 'sun' },
  { id: 'sources', name: 'Library', role: 'Add your sources', tone: 'coral' },
  { id: 'evidence', name: 'Corner shop', role: 'See a sample case', tone: 'teal' },
  { id: 'report', name: 'School', role: 'Read a report', tone: 'sky' },
  { id: 'archive', name: 'Records tower', role: 'Past cases', tone: 'cream' },
]

function AnatomyOfAFinding() {
  const finding = sampleResult.findings.find((f) => f.id === 'documents')
  const sources = Object.fromEntries(sampleResult.sources.map((s) => [s.id, s]))
  const [official, blog] = finding.sources
  return <section className="anatomy" aria-labelledby="anatomy-title">
    <div className="anatomy-intro">
      <h2 id="anatomy-title">What a finding looks like</h2>
      <p>Every row in a Blindspot report carries its own proof. This one comes from the sample case: two sources disagree about which income document you need.</p>
      <SampleBadge />
    </div>
    <div className="anatomy-stage">
      <article className="anatomy-card" aria-label="Example finding: required income document">
        <header><StatusPill status={finding.status} /><span className="critical-chip">CRITICAL</span></header>
        <h3>{finding.title}</h3>
        <div className="anatomy-pair">
          {[official, blog].map((e) => <div className="anatomy-quote" key={e.source}>
            <div className="anatomy-src"><b>{sources[e.source].name}</b><CredBadge type={sources[e.source].type} /></div>
            <span className="anatomy-cycle">Cycle {e.date}</span>
            <HighlightedQuote quote={e.quote} value={e.value} />
            <QuoteStamp match={e.quote_match} />
          </div>)}
        </div>
        <div className="ai-note"><div className="ai-note-label"><Sparkles size={13} aria-hidden="true" /> AI suggestion · may be wrong</div><div className="ai-note-body">{finding.note}</div></div>
      </article>
      <ul className="anatomy-notes">
        <li className="n-status"><b>A signal, not a verdict.</b> “Possible conflict”, “Potential gap”, “Could not verify”: never “wrong” or “true”.</li>
        <li className="n-authority"><b>Who said it.</b> The government portal outranks a blog, however many blogs agree.</li>
        <li className="n-cycle"><b>Which year.</b> Your context is locked, so last cycle's rule is flagged instead of mixed in.</li>
        <li className="n-quote"><b>Proof on the page.</b> Code finds every quote in the fetched text. Quotes it can't find are thrown out.</li>
        <li className="n-ai"><b>AI is labelled.</b> Advice written by AI sits in a dashed purple box, apart from the evidence.</li>
      </ul>
    </div>
  </section>
}

export default function Overview({ history, onNew, onSample, onOpen, go, onTour, onTrapLab, busy }) {
  const stats = historyStats(history.filter((h) => !h.demo_run))
  const handleZone = (zone) => {
    if (zone === 'hq' || zone === 'sources') onNew()
    else if (zone === 'archive') go('history')
    else onSample()
  }
  const recent = history.slice(0, 3)
  const lite = useLite()
  return <div className="overview-page landing">
    <section className="hero-town" aria-labelledby="hero-title">
      <div className="hero-canvas">
        {lite ? <img className="hero-static" src="/world-scene.svg" alt="" aria-hidden="true" />
          : <Suspense fallback={<div className="world3d-loading"><span className="spinner-dot" /> Building the town…</div>}>
            <World3D hero onZone={handleZone} />
          </Suspense>}
      </div>
      <div className="case-file">
        <span className="case-tape" aria-hidden="true" />
        <p className="case-number">Don't just collect information. Investigate it.</p>
        <h1 id="hero-title">Find what your sources get wrong, before you&nbsp;decide.</h1>
        <p className="who-for"><b>For</b> students and families in India checking scholarships, admissions and internships before they apply.</p>
        <p className="case-lede">Applying for a scholarship, an admission or a job? Add the web pages you found. Blindspot reads them, checks every quote against the page, and shows what's supported, conflicting, out of date or missing.</p>
        <ol className="hero-steps" aria-label="How it works">
          <li><b>Ask</b><span>your decision question</span></li>
          <li><b>Add</b><span>up to 5 links</span></li>
          <li><b>See</b><span>what's wrong, with proof</span></li>
        </ol>
        <p className="impact-stat"><b>93,326</b> <span>scholarship applications were awaiting verification in Maharashtra alone (MahaDBT, 27 Feb 2026). The minister said it is often because students leave out or wrongly upload documents. <a href="https://www.freepressjournal.in/amp/education/over-93000-scholarship-applications-from-students-pending-verification-in-maharashtra" target="_blank" rel="noreferrer">Source: Free Press Journal, 10 Mar 2026<span className="sr-only"> (opens in a new tab)</span></a></span></p>
        <div className="case-actions">
          <button className="primary-button big" onClick={onNew}>Start an investigation <ArrowRight size={16} aria-hidden="true" /></button>
          <button className="secondary-button big" onClick={onTour}>▶ 30-second tour</button>
          <button className="text-link hero-sample" onClick={onSample}>Open the sample case</button>
        </div>
      </div>
      <nav className="place-legend" aria-label="Places in town">
        {PLACES.map((p) => <button key={p.id} className={`place-chip tone-${p.tone}`} aria-label={`${p.name}: ${p.role}`} onClick={() => handleZone(p.id)}><b>{p.name}</b><span>{p.role}</span></button>)}
      </nav>
      {!lite && <p className="hero-hint" aria-hidden="true">Drag to look around · click a building</p>}
    </section>

    <TrapLabCard onRun={onTrapLab} busy={busy} />
    <SummaryVsBlindspot onTry={onTrapLab} />

    <details className="more overview-deep"><summary>See how a finding and a case are built</summary>
    <AnatomyOfAFinding />

    <section className="pipeline-strip" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title">How a case is solved</h2>
      <ol>
        <li><b>List what a full answer needs</b><span>Before reading anything, Blindspot writes the checklist: eligibility, documents, deadline, renewal…</span><em className="ai-mini">AI</em></li>
        <li><b>Read every source</b><span>Each page is checked for exact quotes about each checklist item.</span><em className="ai-mini">AI</em></li>
        <li><b>Find each quote on the page</b><span>Claims whose quote isn't in the page text are dropped.</span><em className="code-mini">CODE</em></li>
        <li><b>Compare and decide</b><span>Year, state and authority decide each status; coverage and blockers follow.</span><em className="code-mini">CODE</em></li>
      </ol>
    </section>
    </details>

    <div className="overview-bottom-grid town-bottom-grid">
      <section className="panel recent-panel" aria-labelledby="recent-title">
        <div className="overview-section-heading"><h3 id="recent-title">Your cases</h3><button className="text-link" onClick={() => go('history')}>See all</button></div>
        <p className="recent-summary">{stats.cases ? `${stats.cases} case${stats.cases === 1 ? '' : 's'} · ${stats.sources} sources checked · ${stats.blindspots} blindspots found, saved in this browser.` : 'No cases yet. Your investigations are saved in this browser.'}</p>
        {recent.map((item) => <button className="recent-row" key={item.investigation_id} onClick={() => onOpen(item)}>
          <div className="recent-icon"><FileText size={16} aria-hidden="true" /></div><div><b>{item.title}</b><span>{item.demo_run ? <span className="demo-run-badge">Saved demo run</span> : formatWhen(item.saved_at || item.generated_at)}</span></div>
          <div className="recent-coverage"><b>{item.coverage}%</b><span>coverage</span></div><ChevronRight size={15} aria-hidden="true" />
        </button>)}
        <button className="recent-row" onClick={onSample}>
          <div className="recent-icon"><FileText size={16} aria-hidden="true" /></div><div><b>{sampleResult.title}</b><span><SampleBadge compact /></span></div>
          <div className="recent-coverage"><b>{sampleResult.coverage}%</b><span>coverage</span></div><ChevronRight size={15} aria-hidden="true" />
        </button>
      </section>
    </div>
  </div>
}
