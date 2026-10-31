// Case history lives only in this browser (see safeStorage.js for why every access is guarded).
import { DEDUPE_MS, caseFingerprint } from '../domain/cases'
import { KEYS } from './keys'
import { readList, writeJson } from './safeStorage'

const MAX = 10

const write = (items) => writeJson(KEYS.history, items.slice(0, MAX))

export const listHistory = () => readList(KEYS.history)

/** Stores a finished live case. Samples and recorded demo runs are never stored in history. */
export function saveInvestigation(result) {
  if (!result || result.mode === 'demo' || result.demo_run) return listHistory()
  const now = Date.now()
  const entry = { ...result, saved_at: new Date(now).toISOString() }
  const print = caseFingerprint(result)
  // A re-run of the same case within two minutes replaces the earlier entry instead of adding a duplicate.
  const isRepeat = (item) => caseFingerprint(item) === print && now - Date.parse(item.saved_at || item.generated_at || 0) < DEDUPE_MS
  const items = [entry, ...listHistory().filter((item) => item.investigation_id !== result.investigation_id && !isRepeat(item))]
  write(items)
  return items
}

export function removeInvestigation(id) {
  const items = listHistory().filter((item) => item.investigation_id !== id)
  write(items)
  return items
}
