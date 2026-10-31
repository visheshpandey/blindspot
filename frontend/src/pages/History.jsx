import { useRef, useState } from 'react'
import { ChevronRight, Eye, FileText, Globe2, Microscope, Plus, Search, Trash2 } from 'lucide-react'
import { formatWhen, historyStats } from '../domain/cases'
import { useFocusTrap } from '../hooks/a11y'
import { sampleResult } from '../data/sample'
import { EmptyState, MetricCard, PageHero, SampleBadge, VerdictChip } from '../components/common/ui'

function ConfirmDelete({ item, onCancel, onConfirm }) {
  const ref = useRef(null)
  useFocusTrap(ref, true, onCancel)
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
    <div className="confirm-modal" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-text">
      <h2 id="del-title">Delete this case?</h2>
      <p id="del-text">“{item.title}” will be removed from this browser. Saved findings from it keep their quotes.</p>
      <div className="confirm-actions">
        <button className="secondary-button" onClick={onCancel}>Keep it</button>
        <button className="primary-button danger" onClick={onConfirm}><Trash2 size={14} aria-hidden="true" /> Delete</button>
      </div>
    </div>
  </div>
}

function Row({ item, onOpen, onDelete, tag }) {
  return <li className="history-row">
    <button className="history-open" onClick={() => onOpen(item)}>
      <div className="history-file-icon"><FileText size={18} aria-hidden="true" /></div>
      <div className="history-row-copy"><b>{item.title}</b><span>{tag || <>{item.investigation_id} <i /> {formatWhen(item.saved_at || item.generated_at)}</>} <i /> {item.sources?.length || 0} sources</span></div>
      <div className="history-coverage"><b>{item.coverage}%</b><span>coverage</span></div>
      <VerdictChip verdict={item.verdict} />
      <ChevronRight size={16} aria-hidden="true" />
    </button>
    {onDelete && <button className="icon-button" onClick={() => onDelete(item)} aria-label={`Delete ${item.title} from history`}><Trash2 size={15} aria-hidden="true" /></button>}
  </li>
}

export default function History({ history, demoCases = [], onOpen, onSample, onNew, onRemove }) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(null)
  const stats = historyStats(history)
  const q = query.trim().toLowerCase()
  const match = (item) => !q || `${item.title} ${item.question || ''} ${item.investigation_id} ${item.context?.location || ''} ${item.verdict}`.toLowerCase().includes(q)
  const visible = history.filter(match)
  const demos = demoCases.filter(match)
  return <div className="history-page">
    <PageHero icon={FileText} tone="sky" title="Case history" lede="Every investigation you ran, with its coverage and verdict. Saved in this browser only."><button className="primary-button" onClick={onNew}><Plus size={15} aria-hidden="true" /> New investigation</button></PageHero>
    <div className="history-stats">
      <MetricCard label="CASES" value={stats.cases} foot="Saved in this browser" icon={Microscope} />
      <MetricCard label="SOURCES CHECKED" value={stats.sources} foot="Across your cases" icon={Globe2} />
      <MetricCard label="BLINDSPOTS FOUND" value={stats.blindspots} foot="Items not fully supported" icon={Eye} />
    </div>
    <section className="panel history-table-panel" aria-labelledby="cases-title">
      <div className="table-title">
        <div><h2 id="cases-title">Investigations</h2><p>Most recent first.</p></div>
        <label className="mini-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Search cases</span><input type="search" placeholder="Search cases" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {history.length === 0 && !q && <EmptyState icon={FileText} title="No investigations yet" action={<button className="secondary-button" onClick={onNew}>Start your first case</button>}>Run a live investigation and it will appear here.</EmptyState>}
      {q && !visible.length && !demos.length && <EmptyState icon={Search} title="No case matches">Try a word from the question, a state or a case ID.</EmptyState>}
      <ul className="history-list">
        {visible.map((item) => <Row key={item.investigation_id} item={item} onOpen={onOpen} onDelete={setPending} />)}
        {demos.map((item) => <Row key={item.investigation_id} item={item} onOpen={onOpen} tag={<span className="demo-run-badge">Saved demo run · {item.demo_topic}</span>} />)}
        {match(sampleResult) && <li className="history-row">
          <button className="history-open" onClick={onSample}>
            <div className="history-file-icon"><FileText size={18} aria-hidden="true" /></div>
            <div className="history-row-copy"><b>{sampleResult.title}</b><span><SampleBadge compact /></span></div>
            <div className="history-coverage"><b>{sampleResult.coverage}%</b><span>coverage</span></div>
            <VerdictChip verdict={sampleResult.verdict} />
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>}
      </ul>
    </section>
    {pending && <ConfirmDelete item={pending} onCancel={() => setPending(null)} onConfirm={() => { onRemove(pending.investigation_id); setPending(null) }} />}
  </div>
}
