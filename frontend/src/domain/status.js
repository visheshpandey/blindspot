import { CheckCircle2, Clock3, FileQuestion, ShieldAlert, TriangleAlert } from 'lucide-react'

// The only place that maps a status to its user-facing label, colour and icon.
// Labels read as signals, not verdicts (see docs/RULES.md §2).
export const STATUS = {
  supported: { label: 'Supported', short: 'Supported', tone: 'green', icon: CheckCircle2, hex: '#3f9b6b', blurb: 'Evidence found; authority shown' },
  conflict: { label: 'Possible conflict', short: 'Conflict', tone: 'yellow', icon: TriangleAlert, hex: '#f2a531', blurb: 'Sources in the same context disagree' },
  outdated: { label: 'Possibly outdated', short: 'Outdated', tone: 'gray', icon: Clock3, hex: '#9a9a9a', blurb: 'Evidence belongs to an earlier cycle' },
  missing: { label: 'Potential gap', short: 'Gap', tone: 'red', icon: FileQuestion, hex: '#2b3157', blurb: 'Not found in the sources reviewed' },
  unverified: { label: 'Could not verify', short: 'Unverified', tone: 'blue', icon: ShieldAlert, hex: '#a9bccb', blurb: 'Source unreadable or evidence too weak' },
}

export const STATUS_ORDER = ['supported', 'conflict', 'outdated', 'missing', 'unverified']
// Same rule as the backend: a critical item that is a possible conflict, possibly outdated, a potential gap, or could not be verified.
export const BLOCKER_STATUSES = ['conflict', 'outdated', 'missing', 'unverified']

// Strictest first. Less evidence never gives a friendlier verdict.
export const VERDICTS = {
  'Insufficient evidence': { tone: 'insufficient', short: 'Nothing could be checked', what: 'None of your sources gave anything Blindspot could check. Paste the page text of each source and run it again.' },
  'Not ready to decide': { tone: 'blocked', short: 'Resolve the blockers first', what: 'Some critical items are unresolved. Check each one before you decide.' },
  'Proceed with caution': { tone: 'caution', short: 'Mostly covered, a few gaps', what: 'No critical blockers, but some items could not be fully supported.' },
  'Ready to decide': { tone: 'ready', short: 'Everything has evidence', what: 'Every checklist item is supported by your sources.' },
}

export const TYPE_COLORS = { Primary: 'blue', Institutional: 'violet', Secondary: 'amber', Pasted: 'teal', Unverified: 'rose' }

export const STEPS = [
  { id: 'checklist', label: 'Build the checklist', house: 'CHECKLIST', ai: true },
  { id: 'fetch', label: 'Visit every source', house: 'SOURCES', ai: false },
  { id: 'classify', label: 'Check who is speaking', house: 'AUTHORITY', ai: false },
  { id: 'extract', label: 'Read for exact quotes', house: 'READING', ai: true },
  { id: 'verify', label: 'Find quotes in the page', house: 'QUOTE LAB', ai: false },
  { id: 'compare', label: 'Compare by context', house: 'COMPARE', ai: false },
  { id: 'score', label: 'Count coverage & blockers', house: 'SCORE', ai: false },
  { id: 'actions', label: 'Write what to verify next', house: 'NEXT STEPS', ai: true },
]

export const statusMeta = (status) => STATUS[status] || STATUS.unverified
export const isBlocker = (f) => f.critical && BLOCKER_STATUSES.includes(f.status)
