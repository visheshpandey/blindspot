import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, UsersRound, Play, ChevronRight, CircleHelp, FileCheck2, Fingerprint, History, Home, Languages, Menu, Microscope, Search, Settings, X } from 'lucide-react'
import { SampleBadge } from '../common/ui'
import { useLang } from '../../i18n/LangProvider'
import { useFocusTrap } from '../../hooks/a11y'

const NAV = [
  { id: 'overview', key: 'nav.overview', icon: Home },
  { id: 'investigation', key: 'nav.new', icon: Microscope, hot: true },
  { id: 'report', key: 'nav.report', icon: FileCheck2 },
  { id: 'history', key: 'nav.history', icon: History },
]

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><div className="brand-lens"><Search size={17} strokeWidth={2.8} /></div><span className="brand-spark">✳</span></div>
}

export function Sidebar({ page, go, hasReport, reportHint = 'sample', savedCount = 0, mobileOpen, closeMobile }) {
  const { t } = useLang()
  const ref = useRef(null)
  // On phones the sidebar is a menu sheet opened from the top bar: trap focus while it is open.
  useFocusTrap(ref, mobileOpen, closeMobile)
  return <>
    {mobileOpen && <button className="mobile-scrim" onClick={closeMobile} aria-label="Close navigation" />}
    <aside ref={ref} className={`sidebar ${mobileOpen ? 'mobile-visible' : ''}`} aria-label="Main navigation">
      <div className="brand-lockup"><BrandMark /><div><div className="brand-name" translate="no">blindspot<span>.</span></div><div className="brand-sub">DETECTIVE CLUB · EVIDENCE FIRST</div></div>
        {mobileOpen && <button className="icon-button sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={16} aria-hidden="true" /></button>}</div>
      <div className="nav-label">{t('nav.workspace').toUpperCase()}</div>
      <nav className="side-nav">
        {NAV.map((item) => {
          const Icon = item.icon
          const current = page === item.id || (item.id === 'report' && page === 'analyzing')
          return <button key={item.id} className={`nav-item ${current ? 'active' : ''}`}
            aria-current={current ? 'page' : undefined} title={item.id === 'report' && !hasReport ? `Opens the ${reportHint}` : undefined} onClick={() => { go(item.id); closeMobile() }}>
            <Icon size={17} aria-hidden="true" /><span>{t(item.key)}</span>{item.hot && <span className="nav-hot">{t('nav.new_badge')}</span>}
          </button>
        })}
      </nav>
      <div className="sidebar-divider" />
      <div className="nav-label">{t('nav.tools').toUpperCase()}</div>
      <button aria-label={`${t('nav.saved')}${savedCount ? ` (${savedCount})` : ''}`} className={`nav-item ${page === 'saved' ? 'active' : ''}`} aria-current={page === 'saved' ? 'page' : undefined} onClick={() => { go('saved'); closeMobile() }}><Bookmark size={17} aria-hidden="true" /><span>{t('nav.saved')}</span>{savedCount > 0 && <span className="nav-count" aria-hidden="true">{savedCount}</span>}</button>
      <button className={`nav-item ${page === 'dna' ? 'active' : ''}`} aria-current={page === 'dna' ? 'page' : undefined} onClick={() => { go('dna'); closeMobile() }}><Fingerprint size={17} aria-hidden="true" /><span>{t('nav.dna')}</span></button>
      <button className={`nav-item ${page === 'counsellor' ? 'active' : ''}`} aria-current={page === 'counsellor' ? 'page' : undefined} onClick={() => { go('counsellor'); closeMobile() }}><UsersRound size={17} aria-hidden="true" /><span>{t('nav.counsellor')}</span></button>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><CircleHelp size={16} aria-hidden="true" /></div><b>Agreement isn't truth.</b><p>Blindspot checks quotes against the page, ranks sources by authority, and labels every AI line.</p><button onClick={() => { go('overview'); closeMobile() }}>How it works <ArrowUpRight size={13} aria-hidden="true" /></button></div>
      </div>
    </aside>
  </>
}

function SettingsMenu({ demoMode, onDemoMode, onClearDemo }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return <div className="settings-wrap" ref={ref}>
    <button className="icon-button settings-button" aria-label={t('top.settings')} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}><Settings size={16} aria-hidden="true" /></button>
    {open && <div className="settings-menu" role="group" aria-label={t('top.settings')}>
      <label className="settings-row">
        <span><b>{t('settings.demo')}</b><small>{t('settings.demo_hint')}</small></span>
        <input type="checkbox" role="switch" checked={demoMode} onChange={(e) => onDemoMode(e.target.checked)} />
      </label>
      <button className="settings-row as-button" onClick={() => { onClearDemo(); setOpen(false) }}>
        <span><b>{t('settings.clear')}</b><small>{t('settings.clear_hint')}</small></span>
      </button>
    </div>}
  </div>
}

export function Topbar({ title, subtitle, onMenu, badge = { kind: 'sample' }, onTour, demoMode, onDemoMode, onClearDemo }) {
  const { t, lang, setLang } = useLang()
  return <header className="topbar">
    <div className="topbar-left">
      <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={19} aria-hidden="true" /></button>
      <div><div className="crumb"><span>{t('nav.workspace').toUpperCase()}</span><ChevronRight size={12} aria-hidden="true" /><b>{title.toUpperCase()}</b></div><div className="page-subtitle">{subtitle}</div></div>
    </div>
    <div className="topbar-actions">
      {onTour && <button className="tour-button" onClick={onTour} aria-label={t('top.tour')}><Play size={13} aria-hidden="true" /> <span className="hide-narrow">{t('top.tour')}</span></button>}
      <button className="lang-toggle" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} aria-label={lang === 'hi' ? 'Switch language to English' : t('top.language_label')} aria-pressed={lang === 'hi'}>
        <Languages size={14} aria-hidden="true" /><span lang={lang === 'hi' ? 'en' : 'hi'}>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
      </button>
      {badge.kind === 'demo' ? <span className="mode-indicator demo" title="A recorded real run, bundled with the app so the demo works offline."><span className="mode-dot" />SAVED DEMO RUN</span>
        : badge.kind === 'sample' ? <SampleBadge compact />
        : badge.kind === 'live' ? <span className="mode-indicator live" title={badge.reason || 'The AI is answering.'}><span className="mode-dot" />{t('top.live')}</span>
          : <span className="mode-indicator limited" tabIndex={0} title={`Limited mode: ${badge.reason} Quotes are still checked by code; AI steps use simple templates.`} aria-label={`Limited mode. ${badge.reason}`}><span className="mode-dot" />{t('top.limited')}</span>}
      <SettingsMenu demoMode={demoMode} onDemoMode={onDemoMode} onClearDemo={onClearDemo} />
    </div>
  </header>
}
