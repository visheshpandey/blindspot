import { useCallback, useEffect, useState } from 'react'
import { getHealth, hasBackend } from '../api'

/** Backend and AI status, fetched on load and again after each run. */
export function useHealth() {
  const [health, setHealth] = useState({ mode: hasBackend ? 'live' : 'demo', llm_ok: null })
  const refreshHealth = useCallback(() => getHealth().then(setHealth), [])
  useEffect(() => { refreshHealth() }, [refreshHealth])
  return { health, refreshHealth }
}
