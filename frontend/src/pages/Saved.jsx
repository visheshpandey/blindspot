import { useMemo, useState } from 'react'
import { Bookmark, Copy, ExternalLink, FolderOpen, Trash2 } from 'lucide-react'
import { STATUS_ORDER, statusMeta } from '../domain/status'
import { formatWhen } from '../domain/cases'
import { CredBadge, EmptyState, PageHero, QuoteStamp, SampleBadge, StatusPill } from '../components/common/ui'

function SavedCard({ item, onOpen, onOpenCase, onRemove, onNote }) {
  const { finding, sources } = item
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]))
  const [note, setNote] = useState(item.note || '')
  return <article className={`saved-card tone-${statusMeta(finding.status).tone}`}>
    <header>
      <StatusPill status={finding.status} small />
      {finding.critical && <span className="critical-chip">CRITICAL</span>}
      {item.sample && <span className="sample-tag">Sample</span>}
      <span className="saved-when">Saved {formatWhen(item.saved_at)}</span>
    </header>
    <h3>{finding.title}</h3>
    <p className="saved-value">{finding.value}</p>
    <p className="saved-case">From <b>{item.case.title}</b> · {item.case.context?.year} · {item.case.context?.location} {(item.sample || item.case.mode === 'demo') && <SampleBadge compact />}</p>
    {finding.sources.slice(0, 2).map((e, i) => <figure className="saved-quote" key={`${e.source}-${i}`}>
      <blockquote>“{e.quote}”</blockquote>
      <figcaption>{byId[e.source]?.name || e.source} <CredBadge type={byId[e.source]?.type} /> <QuoteStamp match={e.quote_match} /></figcaption>
    </figure>)}
    {!finding.sources.length && <p className="saved-none">No source mentioned this item.</p>}
    <label className="saved-note">Your note
      <textarea rows="2" value={note} placeholder="e.g. Called the office on Monday; they said income certificate only." onChange={(e) => setNote(e.target.value)} onBlur={() => onNote(item.key, note)} />
    </label>
    <footer>
      <button className="secondary-button" onClick={() => onOpen(item)}><ExternalLink size={14} aria-hidden="true" /> Evidence</button>
      <button className="secondary-button" onClick={() => onOpenCase(item)}><FolderOpen size={14} aria-hidden="true" /> Open case</button>
      <button className="icon-button" onClick={() => onRemove(item.key)} aria-label={`Remove ${finding.title} from saved findings`}><Trash2 size={15} aria-hidden="true" /></button>
    </footer>
  </article>
}

export default function Saved({ saved, onOpen, onOpenCase, onRemove, onNote, onSample }) {
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(false)
  const visible = useMemo(() => saved.filter((s) => filter === 'all' || s.finding.status === filter), [saved, filter])
  const copyAll = async () => {
    const text = visible.map((s) => [`${s.finding.title}: ${s.finding.value} (${statusMeta(s.finding.status).label})`, `Case: ${s.case.title}`,
      ...s.finding.sources.map((e) => `  “${e.quote}” (${e.source}, ${e.date || 'undated'})`), s.note ? `  Note: ${s.note}` : ''].filter(Boolean).join('\n')).join('\n\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }
  return <div className="saved-page">
    <PageHero icon={Bookmark} tone="coral" title="Saved findings" lede="The findings you pinned from any case, with their quotes and your own notes. Your to-check list for calls and emails.">
      {saved.length > 0 && <button className="secondary-button" onClick={copyAll}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy all as text'}</button>}
    </PageHero>
    {saved.length === 0 ? <EmptyState icon={Bookmark} title="Nothing saved yet"
      action={<button className="primary-button" onClick={onSample}>Open the sample case</button>}>
      <span className="empty-steps"><span><b>1</b> Open any report</span><span><b>2</b> Click a finding to see its evidence</span><span><b>3</b> Press <b>Save finding</b></span></span>
      Saved findings keep their quotes and your notes, even after the case is deleted. Useful for the points you still need to check with the authority.
    </EmptyState> : <>
      <div className="finding-tabs saved-filters" role="group" aria-label="Filter saved findings">
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span>{saved.length}</span></button>
        {STATUS_ORDER.filter((s) => saved.some((x) => x.finding.status === s)).map((s) => <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{statusMeta(s).label} <span>{saved.filter((x) => x.finding.status === s).length}</span></button>)}
      </div>
      <div className="saved-grid">{visible.map((item) => <SavedCard key={item.key} item={item} onOpen={onOpen} onOpenCase={onOpenCase} onRemove={onRemove} onNote={onNote} />)}</div>
    </>}
  </div>
}
