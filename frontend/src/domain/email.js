// Email-to-the-authority logic: what to ask, who to write to, how to word the subject. Pure functions. Blindspot only drafts.
import { BLOCKER_STATUSES } from './status'

const ASK = {
  conflict: (f) => `Sources disagree about ${f.title.toLowerCase()}. Which applies to my case?`,
  outdated: (f) => `I could only find old-cycle information about ${f.title.toLowerCase()}. What is the current rule?`,
  missing: (f) => `I could not find information about ${f.title.toLowerCase()}. Where is it stated?`,
  unverified: (f) => `I could not check ${f.title.toLowerCase()}. Could you confirm it?`,
}

/** Open items for the authority: critical blockers first, then anything that could not be verified. */
export function openItems(result, finding) {
  if (finding) return [ASK[finding.status]?.(finding) || `Please clarify ${finding.title.toLowerCase()}.`]
  const findings = result.findings || []
  const critical = findings.filter((f) => f.critical && BLOCKER_STATUSES.includes(f.status))
  const unverified = findings.filter((f) => f.status === 'unverified' && !critical.includes(f))
  const items = [...critical, ...unverified].map((f) => ASK[f.status]?.(f)).filter(Boolean)
  return items.length ? items : ['Please confirm the current eligibility rules, required documents and deadline.']
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const CONTACT_HINT = /contact|helpdesk|email/i

/** An official contact address found in the case: contact findings first, then any quote from a Primary or Institutional source. */
export function findContact(result) {
  const byId = Object.fromEntries((result.sources || []).map((s) => [s.id, s]))
  const isContact = (f) => Number(CONTACT_HINT.test(f.title + f.category))
  const findings = [...(result.findings || [])].sort((a, b) => isContact(b) - isContact(a))
  for (const f of findings) {
    const official = (f.sources || []).filter((e) => ['Primary', 'Institutional'].includes(byId[e.source]?.type)).map((e) => e.quote)
    for (const text of [f.value, ...official]) {
      const match = (text || '').match(EMAIL_RE)
      if (match) return match[0].replace(/[.,;]+$/, '')
    }
  }
  return ''
}

/** Shorten on a word boundary, without an ellipsis or dangling punctuation. */
function shortSubject(text, limit = 70) {
  const clean = (text || '').replace(/\s+/g, ' ').trim().replace(/[?.!\s]+$/, '')
  if (clean.length <= limit) return clean
  return clean.slice(0, limit).replace(/\s+\S*$/, '').replace(/[,;:–-]+$/, '')
}

/** Replaces a truncated or over-long AI subject with a clean one built from the question. */
export function cleanSubject(draftSubject, question) {
  const bad = !draftSubject || draftSubject.includes('…') || draftSubject.length > 100
  return bad ? `Request for clarification: ${shortSubject(question)}` : draftSubject
}

export const mailtoHref = (to, subject, body) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

// Subject and body travel to the translator as one text, split by this marker.
const TRANSLATE_MARKER = '\n⟦BODY⟧\n'
export const packForTranslation = (subject, body) => `${subject}${TRANSLATE_MARKER}${body}`

/** Splits the translator's answer back into subject and body; null when the marker was lost. */
export function unpackTranslation(text) {
  const [subject, ...rest] = (text || '').split(/\n?⟦BODY⟧\n?/)
  return rest.length ? { subject: subject.trim(), body: rest.join('\n').trim() } : null
}
