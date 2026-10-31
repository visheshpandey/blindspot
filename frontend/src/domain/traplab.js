// Trap Lab: five invented test pages with planted traps (hosted by the backend, never real guidance).
// The case definition mirrors backend/app/traplab.py; the recorded run is a real live run saved for offline demos.
import recorded from '../data/traplab-run.json'
import { apiBase } from '../config/env'

export const TRAPLAB_RUN = { ...recorded, demo_run: true, demo_topic: 'Trap Lab', traplab: true }

const D = 'traplab.example'
export const TRAPLAB_CASE = {
  question: 'Before applying for the post-matric scholarship, what should I verify about eligibility, domicile, income documents, the deadline, the scholarship amount and renewal?',
  year: '2026–27',
  location: 'Madhya Pradesh',
  category: 'Undergraduate student',
  sources: [`https://official.${D}/notice-2026-27`, `https://official.${D}/notice-2025-26`, `https://blog.${D}/scholarship-guide`, `https://news.${D}/scholarship-news`, `https://forum.${D}/thread-domicile`],
  pasted_text: {},
}

const TRAPS = [
  { id: 'conflict', label: 'A blog says self-declaration is enough; the official notice says an income certificate is mandatory', icon: '⚡', check: (r) => r.findings.some((f) => f.status === 'conflict') },
  { id: 'outdated', label: 'The scholarship amount appears only in last year\'s notice', icon: '🕸', check: (r) => r.findings.some((f) => f.status === 'outdated') },
  { id: 'gap', label: 'No page says how the scholarship is renewed', icon: '???', check: (r) => r.findings.some((f) => f.status === 'missing') },
  { id: 'copied', label: 'The news page copies the blog word for word (two pages, one voice)', icon: '🧬', check: (r) => (r.source_dna?.clusters || []).length > 0 },
  { id: 'state', label: 'The domicile rule found is for Rajasthan, not your state', icon: '☁', check: (r) => r.findings.some((f) => f.status === 'unverified') },
]

export const isTrapLab = (r) => Boolean(r?.traplab) || (r?.sources || []).some((s) => (s.host || '').endsWith(D))

/** Which planted traps did this run actually catch? Computed from the real result, nothing hard-coded. */
export function scoreTraps(result) {
  const rows = TRAPS.map((t) => ({ ...t, caught: Boolean(t.check(result)) }))
  return { rows, caught: rows.filter((r) => r.caught).length, total: rows.length }
}

/** The .example hosts don't exist on the internet; open their pages through the backend instead. */
export function openableUrl(url) {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith(D)) return url
    return `${apiBase}/traplab/page/${u.hostname.split('.')[0]}${u.pathname}`
  } catch { return url }
}
