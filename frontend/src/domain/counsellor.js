// Counsellor board logic: group cases by student and sort by what needs attention first. Pure functions.
import { isBlocker } from './status'

// Sample names for the bundled demo runs, so the board is not empty in Demo mode. Clearly shown as sample.
const SAMPLE_STUDENTS = { 'INV-jQCjYhDKOX': 'Priya (sample)', 'INV-2k9icojSyX': 'Rahul (sample)', 'INV-7xslFzgM2z': 'Asha (sample)', 'INV-lvFIA2kQJd': 'Priya (sample)' }

const URGENCY = { 'Not ready to decide': 0, 'Insufficient evidence': 1, 'Proceed with caution': 2, 'Ready to decide': 3 }

export const studentOf = (c, labels) => labels[c.investigation_id] || SAMPLE_STUDENTS[c.investigation_id] || ''

export function summarise(c) {
  const blockers = (c.findings || []).filter(isBlocker)
  return { blockers: blockers.length, open: blockers.map((f) => f.title), urgency: URGENCY[c.verdict] ?? 1 }
}

/** Groups cases by student. Students with the most urgent case first; "Unassigned" last. */
export function groupByStudent(cases, labels) {
  const groups = new Map()
  cases.forEach((c) => {
    const name = studentOf(c, labels) || 'Unassigned'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(c)
  })
  return [...groups.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => summarise(a).urgency - summarise(b).urgency)
    return { name, cases: sorted, urgency: summarise(sorted[0]).urgency, blockers: sorted.reduce((n, c) => n + summarise(c).blockers, 0) }
  }).sort((a, b) => (a.name === 'Unassigned') - (b.name === 'Unassigned') || a.urgency - b.urgency || b.blockers - a.blockers)
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function boardCsv(groups) {
  const rows = [['Student', 'Case', 'Verdict', 'Coverage %', 'Critical blockers', 'Open items', 'Case ID']]
  groups.forEach((g) => g.cases.forEach((c) => { const s = summarise(c); rows.push([g.name, c.title, c.verdict, c.coverage, s.blockers, s.open.join('; '), c.investigation_id]) }))
  return rows.map((r) => r.map(csv).join(',')).join('\r\n')
}
