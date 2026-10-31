import { hasBackend } from '../config/env'

/**
 * The header badge. LIVE means the AI is actually answering (not just that a key exists); a recorded run or the sample
 * says so; otherwise the app is in limited mode, with the reason.
 * @returns {{kind: 'demo'|'sample'|'live'|'limited', reason?: string}}
 */
export function statusBadge(health, { page, result }) {
  if (page === 'report' && result?.demo_run) return { kind: 'demo' }
  const sample = (page === 'report' && result?.mode === 'demo') || !hasBackend || health.offline || health.mode === 'demo'
  if (sample) return { kind: 'sample' }
  if (health.llm_ok) return { kind: 'live', reason: health.llm_model ? `AI model: ${health.llm_model.replace('gemini:', '')}` : '' }
  return { kind: 'limited', reason: health.llm_reason || 'The AI service is not answering right now.' }
}
