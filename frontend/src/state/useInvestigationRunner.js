import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelAnalysis, demoCopy, getResult, hasBackend, replayDemo, startAnalysis, streamEvents, traplabUpdate } from '../api'
import { pathFor } from '../app/router'
import { demoCaseFor } from '../domain/demoCases'
import { diffResults } from '../domain/diff'
import { rowsFromPayload } from '../domain/sources'
import { TRAPLAB_CASE, TRAPLAB_RUN } from '../domain/traplab'
import { sampleResult } from '../data/sample'

const formDraft = (payload, extra = {}) => ({ question: payload.question, year: payload.year, location: payload.location, category: payload.category, rows: rowsFromPayload(payload, extra.pasteUrl), ...extra.flags })

/** The request body that re-runs an existing report (pasted text is only kept for the current session). */
const payloadFor = (sessionPayloads, r) => sessionPayloads[r.investigation_id] || {
  question: r.question || r.title, ...r.context, sources: r.sources.filter((s) => s.url).map((s) => s.url), pasted_text: {},
}

/**
 * Running an investigation: start, stream progress, finish, cancel, re-check and the "paste and re-run" form draft.
 * @param {object} deps
 * @param {(path: string, opts?: object) => void} deps.navigate
 * @param {(message: string, action?: object) => void} deps.notify
 * @param {object} deps.health  from useHealth
 * @param {() => void} deps.refreshHealth
 * @param {boolean} deps.demoMode
 * @param {{current: object|null}} deps.resultRef  the report currently open
 * @param {(data: object) => void} deps.onFinished  called with each finished report (App stores and shows it)
 */
export function useInvestigationRunner({ navigate, notify, health, refreshHealth, demoMode, resultRef, onFinished }) {
  const [events, setEvents] = useState([])
  const [runError, setRunError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [runIsDemo, setRunIsDemo] = useState(false)
  const [draft, setDraft] = useState(null) // form inputs kept for cancel and re-run
  const [draftKey, setDraftKey] = useState(0) // changing it remounts the form with the new draft
  const stopStream = useRef(null) // cancels the running stream or replay
  const runId = useRef(null) // id of the live run, for the server-side cancel
  const recheckOf = useRef(null) // the earlier report while a re-check runs
  const sessionPayloads = useRef({}) // request bodies by case id (this session only)

  useEffect(() => () => stopStream.current?.(), [])

  const finishRun = useCallback(async (id, demo, demoCase = null) => {
    try {
      let data = demoCase ? structuredClone(demoCase) : demo ? demoCopy() : await getResult(id)
      if (!data) throw new Error('The report is not ready yet. Please try again.')
      if (recheckOf.current && !demoCase) { data = { ...data, changes: diffResults(recheckOf.current, data) }; recheckOf.current = null }
      stopStream.current = null
      runId.current = null
      onFinished(data)
      navigate(pathFor('report', data.investigation_id), { replace: true })
      notify(demoCase ? 'Saved demo run: the AI or network is not available, so this is a recorded real run of a similar case.'
        : data.mode === 'demo' ? 'Showing the sample case: the AI service is not connected, so no live analysis ran.' : 'Investigation complete.')
      refreshHealth()
    } catch (error) {
      setRunError(error.message)
    }
  }, [notify, navigate, refreshHealth, onFinished])

  const follow = useCallback((id) => {
    runId.current = id
    stopStream.current = streamEvents(id, (event) => {
      setEvents((prev) => [...prev, event])
      if (event.step === 'done') finishRun(id, false)
      if (event.step === 'error') setRunError(event.message)
    }, (error) => setRunError(error.message))
  }, [finishRun])

  const replay = useCallback((demoCase) => {
    setRunIsDemo(true)
    navigate(pathFor('analyzing', 'demo'))
    stopStream.current = replayDemo((event) => {
      setEvents((prev) => [...prev, event])
      if (event.step === 'done') finishRun(null, true, demoCase)
    }, 520, (demoCase || sampleResult).sources)
  }, [finishRun, navigate])

  const run = useCallback(async (payload) => {
    stopStream.current?.()
    setEvents([])
    setRunError('')
    setFormError('')
    setDraft(formDraft(payload))
    const offline = !hasBackend || health.offline
    const noAi = offline || health.mode === 'demo' || health.llm_ok === false
    // Trap Lab always works: live when the AI answers, otherwise its recorded real run.
    if (payload.sources[0] === TRAPLAB_CASE.sources[0] && noAi) { replay(TRAPLAB_RUN); return }
    // Demo mode keeps a demo alive: no network or no AI means a recorded real run of the closest case.
    if (demoMode && noAi) { replay(demoCaseFor(payload.question)); return }
    if (offline) { replay(null); return }
    setRunIsDemo(health.mode === 'demo')
    setBusy(true)
    try {
      const id = await startAnalysis(payload)
      sessionPayloads.current[id] = payload
      navigate(pathFor('analyzing', id))
      follow(id)
    } catch (error) {
      if (demoMode) replay(demoCaseFor(payload.question))
      else setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }, [follow, health, navigate, demoMode, replay])

  /** Re-run the same case and show what changed against the earlier report. */
  const recheck = useCallback((report) => {
    recheckOf.current = report
    run(payloadFor(sessionPayloads.current, report))
  }, [run])

  /** Trap Lab only: the authority "updates" its notice, so a re-check has something to find. */
  const simulateUpdate = useCallback(async () => {
    const ok = await traplabUpdate(true)
    notify(ok ? 'Simulation: the official notice now says a new deadline (15 December 2026). Press Re-check to see what changed.' : 'Could not reach the backend to simulate the update.')
  }, [notify])

  /** Stop the run (also on the server), close the stream, return to the form with the inputs kept. */
  const cancelRun = useCallback(() => {
    stopStream.current?.()
    stopStream.current = null
    recheckOf.current = null
    if (runId.current) cancelAnalysis(runId.current)
    runId.current = null
    setEvents([])
    setDraftKey((k) => k + 1)
    navigate(pathFor('investigation'))
    notify('Investigation stopped. Your question and sources are still in the form.')
  }, [navigate, notify])

  /** "Paste this page's text and re-run": the same case in the form, that source switched to a paste box. */
  const rerunWithPaste = useCallback((source) => {
    const report = resultRef.current
    if (!report) return
    const payload = payloadFor(sessionPayloads.current, report)
    setDraft({ ...formDraft(payload, { pasteUrl: source.url }), focusPaste: true })
    setDraftKey((k) => k + 1)
    navigate(pathFor('investigation'))
  }, [navigate, resultRef])

  /** Stop any running stream without navigating (used when something else takes over the screen). */
  const stop = useCallback(() => stopStream.current?.(), [])

  /** Leaving a run for a fresh form: cancel it on the server too, and drop the re-run cursor focus. */
  const leaveRun = useCallback(() => {
    if (stopStream.current && runId.current) cancelAnalysis(runId.current)
    stopStream.current?.()
    stopStream.current = null
    runId.current = null
    setDraft((d) => (d?.focusPaste ? { ...d, focusPaste: false } : d))
  }, [])

  /** Page refreshed mid-run: rejoin the live stream. Sample replays can't be rejoined, so go back to the form. */
  const rejoin = useCallback((id) => {
    if (stopStream.current) return
    if (id && id !== 'demo' && hasBackend) { setEvents([]); setRunError(''); follow(id) } else navigate(pathFor('investigation'), { replace: true })
  }, [follow, navigate])

  return { events, runError, formError, busy, runIsDemo, draft, draftKey, run, recheck, simulateUpdate, cancelRun, rerunWithPaste, stop, leaveRun, rejoin }
}
