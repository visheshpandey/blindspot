// Investigations: start, follow, fetch, cancel. Error policy per function:
//  - reads with a bundled fallback (health, sample) never throw;
//  - startAnalysis / getResult throw ApiError (the caller shows the message);
//  - cancelAnalysis is best effort and never throws.
import { sampleResult } from '../data/sample'
import { STEPS } from '../domain/status'
import { apiBase, hasBackend } from '../config/env'
import { debug } from '../utils/logger'
import { post, request } from './http'

const OFFLINE_HEALTH = { status: 'down', llm: 'none', mode: 'demo', offline: true }

/** A copy of the bundled sample case (used when no backend answers). */
export function demoCopy(id = 'INV-024') {
  return { ...structuredClone(sampleResult), investigation_id: id, mode: 'demo' }
}

export async function getHealth() {
  if (!hasBackend) return { ...OFFLINE_HEALTH, status: 'ok' }
  try {
    return (await request('/health')).body
  } catch (error) {
    debug('api', 'health check failed', error)
    return OFFLINE_HEALTH
  }
}

export async function getSample() {
  if (!hasBackend) return demoCopy()
  try {
    return (await request('/sample')).body
  } catch (error) {
    debug('api', 'sample unavailable, using the bundled copy', error)
    return demoCopy()
  }
}

/** Starts an investigation and returns its id. */
export async function startAnalysis(payload) {
  const { body } = await post('/analyze', payload)
  return body.investigation_id
}

/** The finished result, or null while it is still running. */
export async function getResult(id) {
  const { status, body } = await request(`/analyze/${encodeURIComponent(id)}`)
  return status === 202 ? null : body
}

export async function cancelAnalysis(id) {
  if (!hasBackend || !id) return
  try {
    await post(`/analyze/${encodeURIComponent(id)}/cancel`)
  } catch (error) {
    debug('api', 'cancel ignored (already finished?)', error)
  }
}

/** Streams pipeline events. Falls back to polling if the event stream fails twice. Returns a cancel function. */
export function streamEvents(id, onEvent, onFail) {
  let closed = false
  let failures = 0
  let source = null
  let pollTimer = null

  const poll = async () => {
    if (closed) return
    try {
      const result = await getResult(id)
      if (result) { onEvent({ step: 'done', progress: 100, message: 'Report ready.', detail: { investigation_id: id } }); return }
      pollTimer = setTimeout(poll, 1500)
    } catch (error) {
      onFail?.(error)
    }
  }

  const open = () => {
    source = new EventSource(`${apiBase}/analyze/${encodeURIComponent(id)}/events`)
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data)
        onEvent(event)
        if (event.step === 'done' || event.step === 'error') { source.close(); closed = true }
      } catch { /* keep-alive comments are not JSON */ }
    }
    source.onerror = () => {
      source.close()
      if (closed) return
      failures += 1
      if (failures >= 2) poll()
      else setTimeout(open, 800)
    }
  }
  open()
  return () => { closed = true; source?.close(); clearTimeout(pollTimer) }
}

/** Replays the pipeline steps for a recorded or sample case when no live run is possible. Returns a cancel function. */
export function replayDemo(onEvent, delay = 520, sources = []) {
  const plan = sources.map((s) => ({ id: s.id, host: s.host, state: s.state === 'Pasted' ? 'Pasted' : 'Fetching' }))
  const timers = STEPS.map((step, index) => setTimeout(() => onEvent({
    step: step.id, progress: Math.round(((index + 1) / (STEPS.length + 1)) * 100), message: `${step.label} (replay).`,
    detail: step.id === 'fetch' && plan.length ? { sources: plan } : undefined,
  }), delay * (index + 1)))
  // Each source reports its own state shortly after the fetch step starts, like a live run.
  const fetchAt = delay * (STEPS.findIndex((s) => s.id === 'fetch') + 1)
  sources.forEach((s, i) => timers.push(setTimeout(() => onEvent({
    step: 'fetch', progress: 20, message: `${s.id} · ${s.host}: ${s.state.toLowerCase()}.`, detail: { source: { id: s.id, host: s.host, state: s.state } },
  }), fetchAt + ((i + 1) * delay) / (sources.length + 1))))
  timers.push(setTimeout(() => onEvent({ step: 'done', progress: 100, message: 'Sample case ready.', detail: { mode: 'demo' } }), delay * (STEPS.length + 1)))
  return () => timers.forEach(clearTimeout)
}
