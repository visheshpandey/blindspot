import { useRef, useState } from 'react'
import { BadgeCheck, Bookmark, BookmarkCheck, Check, Copy, ExternalLink, FileQuestion, Info, LockKeyhole, Mail, ShieldAlert, X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/a11y'
import { useLang } from '../../i18n/LangProvider'
import { useTr } from '../../hooks/reportTranslationContext'
import { evidenceStrength } from '../../domain/strength'
import { openableUrl } from '../../domain/traplab'
import { AiNote, CredBadge, CriticalTag, QuoteStamp, SampleBadge, StatusPill, StrengthBadge, UndatedBadge } from '../common/ui'

const STOP = new Set(['with', 'from', 'that', 'this', 'must', 'should', 'will', 'have', 'year', 'needs', 'confirmation'])

/** Highlights the words of the extracted value inside the quote, so the reader sees what the claim rests on. */
export function HighlightedQuote({ quote, value }) {
  const words = [...new Set((value || '').toLowerCase().match(/[\p{L}\p{N}₹.,]{3,}/gu) || [])]
    .map((w) => w.replace(/[.,]+$/, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w))
  if (!words.length) return <blockquote>“{quote}”</blockquote>
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu')
  const parts = quote.split(pattern)
  return <blockquote>“{parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}”</blockquote>
}

function EvidenceCard({ item, source, demo }) {
  const { t } = useLang()
  const undated = !item.date || item.date === 'Not specified'
  return <article className="evidence-card">
    <div className="evidence-source-head">
      <span className={`source-avatar ${source?.color || 'blue'}`}>{item.source.replace('S', '')}</span>
      <div><b>{source?.name || item.source}</b><span>{source?.host || 'Source'}</span></div>
      <CredBadge type={source?.type} />
    </div>
    <div className="evidence-meta"><span>{t('drawer.cycle')}: <b>{undated ? t('drawer.not_stated') : item.date}</b></span>{undated && <UndatedBadge />}</div>
    <div className="evidence-value">{item.value}</div>
    <HighlightedQuote quote={item.quote} value={item.value} />
    <div className="evidence-foot">
      <QuoteStamp match={item.quote_match} />
      {item.confirmed_live && <span className="live-stamp" title="This pasted quote was also found on the live page it claims to come from."><BadgeCheck size={13} aria-hidden="true" />{t('drawer.confirmed_live')}</span>}
      {item.url ? <a href={openableUrl(item.url)} target="_blank" rel="noreferrer">{t('drawer.open_source')} <ExternalLink size={12} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a> : <span className="muted-small">{t('src.pasted')}</span>}
    </div>
    {demo && <div className="evidence-sample"><SampleBadge compact /></div>}
  </article>
}

export default function EvidenceDrawer({ finding, sources, demo, onClose, onAsk, isSaved = false, onToggleSave, result = null }) {
  const { t } = useLang()
  const { tr: caseTr } = useTr()
  // Saved findings open outside their case, so only the open report's translation applies.
  const tr = result ? caseTr : (k, v) => v
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  useFocusTrap(ref, Boolean(finding), onClose)
  if (!finding) return null
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]))
  const evidence = finding.sources || []
  const blocked = sources.filter((s) => s.state === 'Blocked')

  const copy = async () => {
    const lines = [`${finding.title} — ${finding.value}`, ...evidence.map((e) => `“${e.quote}” — ${byId[e.source]?.name || e.source} (${byId[e.source]?.type || ''}, ${e.date || 'undated'}) ${e.url || ''}`)]
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }

  return <div className="detail-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <aside className="detail-drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top">
        <div className="drawer-kicker">{t('drawer.kicker').toUpperCase()} / {finding.category.toUpperCase()}</div>
        <button className="icon-button light-button" onClick={onClose} aria-label={t('drawer.close')}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="drawer-title-row">
        <div className="drawer-tags"><StatusPill status={finding.status} weak={evidenceStrength(finding, { sources, source_dna: result?.source_dna }).weak} />{finding.critical && <CriticalTag />}{finding.undated && <UndatedBadge />}<StrengthBadge finding={finding} result={{ sources, source_dna: result?.source_dna }} /></div>
        <h2 id="drawer-title">{tr(`title:${finding.id}`, finding.title)}</h2>
        <p>{tr(`sum:${finding.id}`, finding.summary)}</p>
      </div>
      <div className="drawer-value"><span>{t('drawer.value').toUpperCase()}</span><b>{tr(`value:${finding.id}`, finding.value)}</b></div>

      {evidence.length ? <>
        <div className="drawer-section-title"><div><b>{finding.status === 'conflict' ? t('drawer.disagree') : t('drawer.evidence')}</b><span>{t('drawer.found_by_code')}</span></div></div>
        {finding.status === 'conflict' && evidence.length >= 2 ? <div className="evidence-versus">
          <EvidenceCard item={evidence[0]} source={byId[evidence[0].source]} demo={demo} />
          <span className="vs-burst" role="img" aria-label="versus">VS</span>
          <div className="evidence-grid">{evidence.slice(1).map((item, i) => <EvidenceCard key={`${item.source}-${i}`} item={item} source={byId[item.source]} demo={demo} />)}</div>
        </div> : <div className={`evidence-grid ${evidence.length > 1 ? 'side-by-side' : ''}`}>
          {evidence.map((item, i) => <EvidenceCard key={`${item.source}-${i}`} item={item} source={byId[item.source]} demo={demo} />)}
        </div>}
        {finding.status === 'conflict' && <div className="compare-foot"><LockKeyhole size={14} aria-hidden="true" /><span>Compared within your locked context. The most authoritative source is listed first; the others stay visible until you confirm.</span></div>}
      </> : <div className="no-evidence-box">
        {finding.status === 'unverified' ? <ShieldAlert size={20} aria-hidden="true" /> : <FileQuestion size={20} aria-hidden="true" />}
        <div>
          <b>{finding.status === 'unverified' ? 'Could not verify' : 'Potential gap: not found in the sources reviewed'}</b>
          <p>{finding.status === 'unverified'
            ? `No readable source covered this.${blocked.length ? ` Blocked: ${blocked.map((s) => s.host).join(', ')}. Paste its text to include it.` : ''}`
            : 'None of the readable sources mention this checklist item. That is a gap in the supplied research, not proof the information does not exist.'}</p>
        </div>
      </div>}

      <AiNote>{tr(`note:${finding.id}`, finding.note)}</AiNote>
      <p className="drawer-disclaimer"><Info size={12} aria-hidden="true" /> {t('drawer.not_proof')} {t('drawer.quotes_original')}</p>
      <div className="drawer-actions">
        <button className="secondary-button" onClick={copy} disabled={!evidence.length}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? t('drawer.copied') : t('drawer.copy')}</button>
        {onToggleSave && <button className={`secondary-button ${isSaved ? 'pressed' : ''}`} aria-pressed={isSaved} onClick={() => onToggleSave(finding)}>{isSaved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}{isSaved ? t('drawer.saved') : t('drawer.save')}</button>}
        <button className="primary-button" onClick={() => onAsk(finding)}><Mail size={14} aria-hidden="true" /> {t('drawer.ask')}</button>
      </div>
    </aside>
  </div>
}
