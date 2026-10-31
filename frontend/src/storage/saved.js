// Saved findings live only in this browser, like case history.
import { KEYS } from './keys'
import { readList, readText, writeJson, writeText } from './safeStorage'

const MAX = 100

function write(items) {
  writeJson(KEYS.saved, items.slice(0, MAX))
  return items
}

export const savedKey = (result, finding) => `${result.investigation_id}:${finding.id}`

export const listSaved = () => readList(KEYS.saved)

const snapshot = (result, finding, extra = {}) => {
  const cited = new Set(finding.sources.map((s) => s.source))
  return {
    key: savedKey(result, finding),
    saved_at: new Date().toISOString(),
    note: '',
    case: { investigation_id: result.investigation_id, title: result.title, context: result.context, mode: result.mode },
    finding,
    sources: result.sources.filter((s) => cited.has(s.id)),
    ...extra,
  }
}

/** Saves a snapshot of the finding with the sources it cites, so it stays readable after the case is gone. */
export function toggleSaved(result, finding) {
  const key = savedKey(result, finding)
  const items = listSaved()
  if (items.some((item) => item.key === key)) return write(items.filter((item) => item.key !== key))
  return write([snapshot(result, finding), ...items])
}

export const updateNote = (key, note) => write(listSaved().map((item) => (item.key === key ? { ...item, note } : item)))

export const removeSaved = (key) => write(listSaved().filter((item) => item.key !== key))

/** First visit only: one sample saved finding (marked Sample) so the page shows what it is for. */
export function seedSampleSaved(sample) {
  if (readText(KEYS.savedSeeded) === '1') return listSaved()
  if (!writeText(KEYS.savedSeeded, '1')) return listSaved()
  const items = listSaved()
  if (items.length) return items
  const finding = sample.findings.find((f) => f.status === 'conflict') || sample.findings[0]
  return write([snapshot({ ...sample, mode: 'demo' }, finding, {
    sample: true,
    note: 'Example note: call the scholarship helpline to confirm which income document they accept.',
  })])
}

/** "Clear demo data": removes sample and demo-run items, keeps everything you saved from live cases. */
export function removeDemoSaved(demoIds) {
  const ids = new Set(demoIds)
  return write(listSaved().filter((item) => !item.sample && item.case.mode !== 'demo' && !ids.has(item.case.investigation_id)))
}
