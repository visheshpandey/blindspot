// The only code that touches localStorage. It can be blocked, full or empty (private windows, cleared site data),
// so every access is guarded: reads fall back to a default, writes report whether they worked.
import { debug } from '../utils/logger'

export function readText(key, fallback = null) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch (error) {
    debug('storage', 'read blocked', key, error)
    return fallback
  }
}

export function writeText(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    debug('storage', 'write failed', key, error)
    return false
  }
}

export function readJson(key, fallback) {
  const raw = readText(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) ?? fallback
  } catch (error) {
    debug('storage', 'corrupt JSON ignored', key, error)
    return fallback
  }
}

export const writeJson = (key, value) => writeText(key, JSON.stringify(value))

/** Reads a list, ignoring anything that isn't an array. */
export function readList(key) {
  const value = readJson(key, [])
  return Array.isArray(value) ? value : []
}

export function removeWhere(predicate) {
  try {
    Object.keys(localStorage).filter(predicate).forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    debug('storage', 'remove blocked', error)
  }
}

/** True when localStorage works at all (it can be blocked in private windows or by site settings). */
export function storageAvailable() {
  try {
    const probe = '__blindspot_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
