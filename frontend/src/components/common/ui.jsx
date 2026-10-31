import { lazy, Suspense } from 'react'
import { useLite } from '../../hooks/a11y'
import { useLang } from '../../i18n/LangProvider'
import { evidenceStrength } from '../../domain/strength'
import { BadgeCheck, CalendarX2, FlaskConical, Info, Quote, Sparkles } from 'lucide-react'
import { STATUS, STATUS_ORDER, statusMeta } from '../../domain/status'

export function StatusPill({ status, small = false, weak = false }) {
  const { t } = useLang()
  const meta = statusMeta(status)
  const Icon = meta.icon
  const label = weak && status === 'supported' ? t('status.supported_weak') : t(`status.${status}`)
  return <span className={`status-pill ${meta.tone} ${small ? 'small' : ''} ${weak ? 'weak' : ''}`}><Icon size={small ? 11 : 13} strokeWidth={2.4} aria-hidden="true" />{label}</span>
}

const TIER_NAME = { Primary: 'Official', Institutional: 'Institution', Secondary: 'Blog / news', Pasted: 'Pasted text', Unverified: 'Unverified' }

/** "N sources · M independent" + strongest authority + a 0-3 dot strength meter. */
export function StrengthBadge({ finding, result, compact = false }) {
  const { t } = useLang()
  const s = evidenceStrength(finding, result)
  const label = !s.sources ? t('strength.none') : s.sources === 1 ? t('strength.label_one') : t('strength.label', { n: s.sources, m: s.independent })
  const title = `${label}${s.strongest ? ` · ${t('strength.strongest', { tier: TIER_NAME[s.strongest] || s.strongest })}` : ''} · strength ${s.dots}/3`
  return <span className={`strength ${compact ? 'compact' : ''} dots-${s.dots}`} title={title} aria-label={title}>
    <span className="strength-dots" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= s.dots ? 'on' : ''} />)}</span>
    {!compact && <span className="strength-text">{label}{s.strongest && <em> · {TIER_NAME[s.strongest]}</em>}</span>}
  </span>
}

export function CriticalTag() {
  const { t } = useLang()
  return <span className="critical-chip">{t('common.critical')}</span>
}

export function SampleBadge({ compact = false }) {
  return <span className="sample-badge" title="Sample data, illustrative. Quotes, URLs and dates are not real scholarship guidance."><FlaskConical size={13} aria-hidden="true" />{compact ? 'Sample data' : 'Sample data, illustrative'}</span>
}

export function AiNote({ children, label = 'AI suggestion · may be wrong' }) {
  if (!children) return null
  return <div className="ai-note"><div className="ai-note-label"><Sparkles size={13} aria-hidden="true" /> {label}</div><div className="ai-note-body">{children}</div></div>
}

export function AiChip({ text = 'AI suggestion · may be wrong' }) {
  return <span className="ai-chip"><Sparkles size={11} aria-hidden="true" />{text}</span>
}

export function QuoteStamp({ match }) {
  return <span className="quote-stamp" title="The quote was found in the fetched page text by fuzzy matching. This shows the source says it, not that it is true."><BadgeCheck size={13} aria-hidden="true" />QUOTE FOUND IN SOURCE{typeof match === 'number' ? ` · ${match}%` : ''}</span>
}

export function UndatedBadge() {
  return <span className="undated-badge" title="No visible date or application cycle for this claim or source."><CalendarX2 size={12} aria-hidden="true" />Undated</span>
}

export function CredBadge({ type }) {
  return <span className={`cred-badge cred-${(type || 'Unverified').toLowerCase()}`}>{type || 'Unverified'}</span>
}

export function SourceAvatar({ id, sources }) {
  const source = sources.find((item) => item.id === id)
  return <span className={`source-avatar ${source?.color || 'blue'}`} title={source ? `${source.name} (${source.type})` : id}>{id?.replace('S', '') || '?'}</span>
}

export function CoverageRing({ value, size = 'normal' }) {
  const { t } = useLang()
  return <div className={`coverage-ring ${size}`} style={{ '--coverage': `${value}%` }} role="img" aria-label={`${value}% ${t('verdict.coverage')}`}><div className="coverage-ring-inner"><b>{value}%</b><span>{t('verdict.coverage')}</span></div></div>
}

export function VerdictChip({ verdict }) {
  const { t } = useLang()
  const tone = { 'Ready to decide': 'ready', 'Proceed with caution': 'caution', 'Insufficient evidence': 'insufficient' }[verdict] || 'blocked'
  return <span className={`verdict-chip ${tone}`}>{t(`verdict.${verdict}`)}</span>
}

export function Legend() {
  const { t } = useLang()
  return <details className="legend-card legend-details">
    <summary>
      <span className="legend-title">{t('legend.title')}</span>
      <span className="legend-pills">{STATUS_ORDER.map((key) => <StatusPill key={key} status={key} small />)}</span>
    </summary>
    <div className="legend-grid">
      <div className="legend-row"><span className="legend-swatch source"><Quote size={13} aria-hidden="true" /></span><div><b>{t('legend.sourced')}</b><span>{t('legend.sourced_text')}</span></div></div>
      <div className="legend-row"><span className="legend-swatch ai"><Sparkles size={13} aria-hidden="true" /></span><div><b>{t('legend.ai')}</b><span>{t('legend.ai_text')}</span></div></div>
      <div className="legend-row"><span className="legend-swatch unsure"><Info size={13} aria-hidden="true" /></span><div><b>{t('legend.uncertain')}</b><span>{t('legend.uncertain_text')}</span></div></div>
    </div>
    <ul className="legend-statuses">
      {STATUS_ORDER.map((key) => <li key={key}><StatusPill status={key} small /><span>{STATUS[key].blurb}</span></li>)}
    </ul>
  </details>
}

export function MetricCard({ label, value, foot, icon: Icon, tone = '' }) {
  return <div className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span>{Icon && <span className="metric-icon"><Icon size={16} aria-hidden="true" /></span>}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return <div className="empty-state">{Icon && <Icon size={22} aria-hidden="true" />}<b>{title}</b>{children && <p>{children}</p>}{action}</div>
}

/** Page header with a chunky 3D icon tile: says what the page is for in one line. */
const MascotBadge = lazy(() => import('../../three/MascotBadge.jsx'))

export function PageHero({ icon: Icon, tone = 'sun', title, lede, children, mascot = '' }) {
  const lite = useLite()
  return <header className={`page-hero tone-${tone} ${mascot && !lite ? 'has-mascot' : ''}`}>
    <span className="hero-burst" aria-hidden="true" />
    {mascot && !lite ? <div className="hero-mascot" aria-hidden="true"><Suspense fallback={<div className="mascot-badge" style={{ width: 150, height: 150 }} />}><MascotBadge size={150} /></Suspense><span className="hero-bubble">{mascot}</span></div>
      : <div className="tile3d" aria-hidden="true"><span className="tile3d-face">{Icon && <Icon size={34} strokeWidth={2.4} />}</span></div>}
    <div className="page-hero-copy"><h1>{title}</h1><p>{lede}</p></div>
    {children && <div className="page-hero-actions">{children}</div>}
  </header>
}
