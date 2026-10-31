import { useCallback, useState } from 'react'
import { KEYS } from '../storage/keys'
import { readText, writeText } from '../storage/safeStorage'

/**
 * The report's current view (board, town or table), remembered between visits.
 * Returns [view, setView, showView]: setView remembers the choice; showView changes the view without remembering it
 * (used when the guided tour asks for a view).
 */
export function useReportView(allowed, fallback = 'board') {
  const [view, showView] = useState(() => {
    const saved = readText(KEYS.reportView)
    return allowed.includes(saved) ? saved : fallback
  })
  const setView = useCallback((next) => {
    showView(next)
    writeText(KEYS.reportView, next)
  }, [])
  return [view, setView, showView]
}
