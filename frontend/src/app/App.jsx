import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { getSample } from '../api'
import { statusBadge } from '../domain/health'
import { studentOf } from '../domain/counsellor'
import { TRAPLAB_CASE } from '../domain/traplab'
import { savedKey } from '../storage/saved'
import { useLang } from '../i18n/LangProvider'
import { ReportTrContext } from '../hooks/reportTranslationContext'
import { useReportTranslation } from '../hooks/useReportTranslation'
import { useHealth } from '../state/useHealth'
import { useInvestigationRunner } from '../state/useInvestigationRunner'
import { useLibrary } from '../state/useLibrary'
import { findDemoCase, useRouteLoader } from '../state/useRouteLoader'
import { useToast } from '../state/useToast'
import { useTourController } from '../state/useTourController'
import { Sidebar, Topbar } from '../components/layout/Shell'
import ErrorBoundary from '../components/common/ErrorBoundary'
import Toast from '../components/common/Toast'
import EvidenceDrawer from '../components/report/EvidenceDrawer'
import EmailModal from '../components/report/EmailModal'
import Tour, { TourInvite } from '../components/tour/Tour'
import Overview from '../pages/Overview'
import NewInvestigation from '../pages/NewInvestigation'
import Analyzing from '../pages/Analyzing'
import Report from '../pages/Report'
import History from '../pages/History'
import Saved from '../pages/Saved'
import SourceDNA from '../pages/SourceDNA'
import Counsellor from '../pages/Counsellor'
import { pathFor, useHashRoute } from './router'

// Page title translation key and the subtitle shown in the top bar.
const TITLES = {
  overview: ['nav.overview', 'Welcome to Detective Town'],
  investigation: ['nav.new', 'Question, context and sources'],
  analyzing: ['nav.new', 'Following the clues'],
  report: ['nav.report', 'Evidence, gaps and what to verify next'],
  history: ['nav.history', 'Saved in this browser'],
  saved: ['nav.saved', 'Pinned evidence and your notes'],
  dna: ['nav.dna', 'Which sources copy each other'],
  counsellor: ['nav.counsellor', 'Who needs attention first'],
}

/** App shell: routing, the open report and its overlays. Logic lives in src/state; screens in src/pages. */
export default function App() {
  const { t, lang } = useLang()
  const [route, navigate] = useHashRoute()
  const page = route.page
  const { toast, notify, dismiss } = useToast()
  const { health, refreshHealth } = useHealth()
  const library = useLibrary(notify)

  // The open report and what is layered on top of it.
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(null) // finding shown in the evidence drawer
  const [savedOpen, setSavedOpen] = useState(null) // saved item shown in the drawer
  const [email, setEmail] = useState(null) // { finding } while the email modal is open
  const [viewRequest, setViewRequest] = useState(null) // the tour asking the report for a view
  const [mobileOpen, setMobileOpen] = useState(false)
  const resultRef = useRef(null)
  resultRef.current = result

  const openResult = useCallback((data) => {
    setResult(data)
    setSelected(null)
    navigate(pathFor('report', data.investigation_id))
  }, [navigate])

  const showFinished = useCallback((data) => {
    library.addToHistory(data)
    setResult(data)
    setSelected(null)
  }, [library.addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  const runner = useInvestigationRunner({ navigate, notify, health, refreshHealth, demoMode: library.demoMode, resultRef, onFinished: showFinished })
  const tour = useTourController({ navigate, openResult, resultRef, setSelected, setViewRequest })
  const translation = useReportTranslation(page === 'report' ? result : null, lang)

  const openSample = useCallback(async () => {
    runner.stop()
    openResult(await getSample())
  }, [openResult, runner.stop]) // eslint-disable-line react-hooks/exhaustive-deps

  useRouteLoader({ route, navigate, notify, resultRef, history: library.history, setResult, setSelected, openResult, openSample, rejoinRun: runner.rejoin })
  useEffect(() => { window.scrollTo(0, 0) }, [page])

  const go = useCallback((target) => {
    if (target === 'investigation') { runner.leaveRun(); navigate(pathFor('investigation')); return }
    // No report open yet: show the latest saved case, or the sample, instead of a dead link.
    if (target === 'report') {
      if (resultRef.current) navigate(pathFor('report', resultRef.current.investigation_id))
      else if (library.history[0]) openResult(library.history[0])
      else openSample()
      return
    }
    navigate(pathFor(target))
  }, [library.history, openResult, openSample, navigate, runner.leaveRun]) // eslint-disable-line react-hooks/exhaustive-deps

  // Opens the case a saved finding came from: a stored live case, a demo run, or the sample.
  const openCase = useCallback(async (item) => {
    const stored = library.history.find((h) => h.investigation_id === item.case.investigation_id) || findDemoCase(item.case.investigation_id)
    if (stored) { openResult(stored); return stored }
    if (item.case.mode === 'demo') { const s = await getSample(); openResult(s); return s }
    notify('That case is no longer in your history. The saved finding still has its quotes.')
    return null
  }, [library.history, openResult, notify])

  const askAuthority = useCallback((finding) => { setSelected(null); setEmail({ finding }) }, [])
  const viewSavedFindings = useCallback(() => { setSelected(null); navigate(pathFor('saved')) }, [navigate])

  const [titleKey, subtitle] = TITLES[page]
  const badge = statusBadge(health, { page, result })
  const reportReady = page === 'report' && result && result.investigation_id === route.id
  const everyCase = [...library.history, ...library.demoCases]

  return <ReportTrContext.Provider value={translation}>
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar page={page} go={go} savedCount={library.saved.length} hasReport={Boolean(result)} reportHint={library.history.length ? 'last case' : 'sample'} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
      <main className="main-shell" id="main" aria-hidden={selected || savedOpen ? 'true' : undefined}>
        <Topbar title={t(titleKey)} subtitle={subtitle} onMenu={() => setMobileOpen(true)} badge={badge} onTour={tour.startTour} demoMode={library.demoMode} onDemoMode={library.setDemoMode} onClearDemo={library.clearDemo} />
        <div className={`page-content page-${page}`}>
          <ErrorBoundary scope={`page:${page}`} resetKey={`${page}:${route.id || ''}`}>
            {page === 'overview' && <Overview history={everyCase} onNew={() => go('investigation')} onSample={openSample} onOpen={openResult} go={go} onTour={tour.startTour} onTrapLab={() => runner.run(TRAPLAB_CASE)} busy={runner.busy} />}
            {page === 'investigation' && <NewInvestigation key={runner.draftKey} draft={runner.draft} onRun={runner.run} onSample={openSample} busy={runner.busy} error={runner.formError} />}
            {page === 'analyzing' && <Analyzing events={runner.events} demo={runner.runIsDemo} error={runner.runError} onBack={() => go('investigation')} onCancel={runner.cancelRun} onSample={openSample} />}
            {reportReady && <Report result={result} viewRequest={viewRequest} onOpen={setSelected} selectedId={selected?.id} onEmail={(finding) => setEmail({ finding })} onNew={() => go('investigation')}
              onRerun={runner.rerunWithPaste} onRecheck={runner.recheck} onSimulate={runner.simulateUpdate}
              student={studentOf(result, library.students)} onStudent={(name) => library.tagStudent(result.investigation_id, name)} />}
            {page === 'report' && !reportReady && <div className="route-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> Opening the case…</div>}
            {page === 'saved' && <Saved saved={library.saved} onOpen={setSavedOpen} onOpenCase={openCase} onRemove={library.removeSavedItem} onNote={library.setSavedNote} onSample={openSample} />}
            {page === 'dna' && <SourceDNA result={result} history={everyCase} onPick={(c) => c && setResult(c)} onNew={() => go('investigation')} />}
            {page === 'counsellor' && <Counsellor cases={everyCase} labels={library.students} onOpen={openResult} onNew={() => go('investigation')} demoMode={library.demoMode} />}
            {page === 'history' && <History history={library.history} demoCases={library.demoCases} onOpen={openResult} onSample={openSample} onNew={() => go('investigation')} onRemove={library.removeFromHistory} />}
          </ErrorBoundary>
        </div>
        <footer className="app-footer"><span>BLINDSPOT · DON'T JUST COLLECT INFORMATION. INVESTIGATE IT.</span><span><span className="footer-dot" /> AI SUGGESTIONS ARE LABELLED · QUOTES ARE CHECKED BY CODE</span></footer>
      </main>
      {result && <EvidenceDrawer finding={selected} sources={result.sources} result={result} demo={result.mode === 'demo'} onClose={() => setSelected(null)} onAsk={askAuthority}
        isSaved={Boolean(selected && library.saved.some((x) => x.key === savedKey(result, selected)))} onToggleSave={(finding) => library.toggleSave(result, finding, viewSavedFindings)} />}
      {savedOpen && <EvidenceDrawer finding={savedOpen.finding} sources={savedOpen.sources} demo={savedOpen.case.mode === 'demo'} onClose={() => setSavedOpen(null)}
        onAsk={async (f) => { const item = savedOpen; setSavedOpen(null); if (await openCase(item)) setEmail({ finding: f }) }}
        isSaved onToggleSave={() => { library.removeSavedItem(savedOpen.key); setSavedOpen(null) }} />}
      {email && result && <EmailModal result={result} finding={email.finding} onClose={() => setEmail(null)} />}
      <Tour open={tour.tourOpen} onClose={tour.closeTour} prepare={tour.prepareTour} onStartCase={() => go('investigation')} />
      {tour.showInvite && !tour.tourOpen && page === 'overview' && <TourInvite onStart={tour.startTour} onDismiss={tour.dismissInvite} />}
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  </ReportTrContext.Provider>
}
