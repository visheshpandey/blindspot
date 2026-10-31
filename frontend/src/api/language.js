// Email drafting and Hindi translation. All best effort: when the backend or the AI is unavailable these return a
// result flagged `available: false` (or a local template) instead of throwing, so the UI can say so inline.
import { hasBackend } from '../config/env'
import { debug } from '../utils/logger'
import { post } from './http'

function localEmailDraft({ topic, year, points = [] }) {
  const list = points.map((p, i) => `${i + 1}. ${p}`).join('\n') || '1. Please confirm the current eligibility rules, documents and deadline.'
  return {
    subject: `Request for clarification: ${topic || 'my application'}`,
    body: `Dear Sir/Madam,\n\nI am preparing my application regarding: ${topic || 'the scheme'}${year ? ` for the ${year} cycle` : ''}. I would be grateful if you could clarify the following:\n\n${list}\n\nCould you also share a link to the latest official guidelines?\n\nThank you for your help.\n\n[Your name]\n[Application / enrolment number, if any]`,
    is_ai: false,
  }
}

export async function draftEmail(payload) {
  if (hasBackend) {
    try {
      return (await post('/email', payload)).body
    } catch (error) {
      debug('api', 'email drafting failed, using the local template', error)
    }
  }
  return localEmailDraft(payload)
}

/** One batched call for a whole report; the backend caches by (case, language, content). */
export async function translateReport(investigationId, items, lang = 'hi') {
  if (!hasBackend) return { translations: {}, available: false, reason: 'no translation service in offline demo' }
  try {
    return (await post('/translate/report', { investigation_id: investigationId, lang, items })).body
  } catch (error) {
    return { translations: {}, available: false, reason: error.message }
  }
}

export async function translateText(text) {
  const unavailable = { translated_text: text, is_ai: false, available: false }
  if (!hasBackend) return unavailable
  try {
    return (await post('/translate', { text, language: 'hi' })).body
  } catch (error) {
    debug('api', 'translation unavailable', error)
    return unavailable
  }
}
