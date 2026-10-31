// Source helpers shared by the form, the case street and the report. Kept out of page components so Fast Refresh works.
import official from '../data/official-sources.json'

/** Same rule as the API: a full https address with a real host name. Returns a URL or null. */
export function validUrl(url) {
  const text = (url || '').trim()
  if (!text || /\s/.test(text)) return null
  try {
    const u = new URL(text)
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u : null
  } catch {
    return null
  }
}

/** For duplicate checks, like the API: lowercase host, no fragment, no trailing slash. */
export const normaliseUrl = (u) => `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`

/** Mirrors backend classify.py so the form can show each source's likely tier while typing. */
export function expectedTier(url) {
  const parsed = validUrl(url)
  if (!parsed) return null
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (/\.(gov\.in|nic\.in|gov)$/.test(host) || host === 'scholarships.gov.in') return { type: 'Primary', label: 'Official portal' }
  if (/\.(ac\.in|edu|edu\.in|res\.in)$/.test(host) || /(university|college|institute|iit|nit)/.test(host)) return { type: 'Institutional', label: 'Institution' }
  return { type: 'Secondary', label: 'Blog or news' }
}

/** 2–3 official portals for this state and applicant category (static list, no internet lookup). */
export function suggestedSources(location, category, already = []) {
  const taken = new Set(already.map((u) => validUrl(u)).filter(Boolean).map(normaliseUrl))
  const list = [...(official.state[location] || []), ...official.national.filter((s) => s.for.includes(category))]
  return list.filter((s) => !taken.has(normaliseUrl(new URL(s.url)))).slice(0, 3)
}

/** The /analyze request body for the form's rows. */
export function toPayload({ question, year, location, category, rows }) {
  const sources = []
  const pasted = {}
  rows.forEach((row, i) => {
    const url = row.url.trim()
    if (row.pasted && row.text.trim()) pasted[url || `pasted://source-${i + 1}`] = row.text.trim()
    if (url) sources.push(url)
  })
  return { question: question.trim(), year, location, category, sources, pasted_text: pasted }
}

/** Form rows rebuilt from a request (for cancel and re-run). `pasteUrl` turns that source into a paste box. */
export function rowsFromPayload(payload, pasteUrl = '') {
  const pasted = payload.pasted_text || {}
  const rows = (payload.sources || []).map((url) => ({ url, pasted: Boolean(pasted[url]) || url === pasteUrl, text: pasted[url] || '' }))
  Object.entries(pasted).forEach(([key, text]) => { if (key.startsWith('pasted://')) rows.push({ url: '', pasted: true, text }) })
  return rows.slice(0, 5)
}
