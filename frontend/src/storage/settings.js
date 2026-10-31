// Small preferences: Demo mode, and clearing cached translations.
import { KEYS } from './keys'
import { readText, removeWhere, storageAvailable, writeText } from './safeStorage'

export const readDemoMode = () => readText(KEYS.demoMode) === '1'

/** If storage is blocked the answer can't be remembered, so count the tour as seen instead of nagging on every load. */
export const readTourSeen = () => readText(KEYS.tourSeen) === '1' || !storageAvailable()

export const writeTourSeen = () => writeText(KEYS.tourSeen, '1')

export const writeDemoMode = (on) => writeText(KEYS.demoMode, on ? '1' : '0')

/** Removes cached Hindi translations, optionally only those of the given case ids. */
export const clearTranslations = (caseIds = []) =>
  removeWhere((key) => key.startsWith(KEYS.translationPrefix) && (!caseIds.length || caseIds.some((id) => key.includes(id))))
