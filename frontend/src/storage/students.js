// Student names tagged on cases (counsellor board), kept only in this browser. Grouping logic: domain/counsellor.js.
import { KEYS } from './keys'
import { readJson, writeJson } from './safeStorage'

export function readStudents() {
  const value = readJson(KEYS.students, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function writeStudent(caseId, name) {
  const next = { ...readStudents() }
  if (name.trim()) next[caseId] = name.trim().slice(0, 60)
  else delete next[caseId]
  writeJson(KEYS.students, next)
  return next
}
