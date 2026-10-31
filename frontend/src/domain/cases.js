// Pure helpers about saved cases (no storage, no UI).

const DEDUPE_MS = 2 * 60 * 1000
export { DEDUPE_MS }

/** Same question, same context, same sources: the same case. */
export function caseFingerprint(result) {
  const c = result.context || {}
  const urls = (result.sources || []).map((s) => s.url || s.name || '').sort().join('|')
  return [(result.question || result.title || '').trim().toLowerCase(), c.year, c.location, c.category, urls].join('#')
}

export function historyStats(items) {
  return {
    cases: items.length,
    sources: items.reduce((sum, item) => sum + (item.sources?.length || 0), 0),
    blindspots: items.reduce((sum, item) => sum + (item.findings || []).filter((f) => f.status !== 'supported').length, 0),
  }
}

export function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return iso
  }
}
