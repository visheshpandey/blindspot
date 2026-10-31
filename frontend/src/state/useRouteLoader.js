import { useEffect } from 'react'
import { getResult, getSample, hasBackend } from '../api'
import { pathFor } from '../app/router'
import { DEMO_CASES } from '../domain/demoCases'
import { TRAPLAB_RUN } from '../domain/traplab'
import { sampleResult } from '../data/sample'
import { listHistory } from '../storage/history'

export const findDemoCase = (id) => [...DEMO_CASES, TRAPLAB_RUN].find((c) => c.investigation_id === id)

/**
 * Loads whatever the URL points at, so refresh and back/forward keep the page:
 * a report id is looked up in history, recorded runs, the sample, then the backend; a bare #/report opens the latest
 * case; an #/analyzing refresh rejoins the live run.
 */
export function useRouteLoader({ route, navigate, notify, resultRef, history, setResult, setSelected, openResult, openSample, rejoinRun }) {
  const { page } = route
  useEffect(() => {
    let alive = true
    if (page === 'report' && route.id && resultRef.current?.investigation_id !== route.id) {
      (async () => {
        const stored = listHistory().find((h) => h.investigation_id === route.id) || findDemoCase(route.id)
        let data = stored || (route.id === sampleResult.investigation_id ? await getSample() : null)
        if (!data && hasBackend) {
          try { data = await getResult(route.id) } catch { data = null } // expired or unknown id: handled below
        }
        if (!alive) return
        if (data) { setResult(data); setSelected(null) } else { notify("That case isn't available any more. It may have expired."); navigate('/', { replace: true }) }
      })()
    }
    if (page === 'report' && !route.id) {
      if (resultRef.current) navigate(pathFor('report', resultRef.current.investigation_id), { replace: true })
      else if (history[0]) openResult(history[0])
      else openSample()
    }
    if (page === 'analyzing') rejoinRun(route.id)
    return () => { alive = false }
  }, [route]) // eslint-disable-line react-hooks/exhaustive-deps -- deliberately keyed on the route only
}
