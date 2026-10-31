import { useCallback, useState } from 'react'
import { getSample } from '../api'
import { pathFor } from '../app/router'
import { readTourSeen, writeTourSeen } from '../storage/settings'

/**
 * The guided tour: whether it is open, the first-visit invitation, and putting the app in the state each step needs
 * (always the labelled sample case). `stillOpen` is checked after every wait, so closing the tour never moves the app.
 */
export function useTourController({ navigate, openResult, resultRef, setSelected, setViewRequest }) {
  const [tourOpen, setTourOpen] = useState(false)
  const [showInvite, setShowInvite] = useState(() => !readTourSeen())

  const prepareTour = useCallback(async (stepName, stillOpen = () => true) => {
    const ensureSample = async () => {
      let r = resultRef.current
      if (!r || r.mode !== 'demo') {
        r = await getSample()
        if (!stillOpen()) return null
        openResult(r)
      } else navigate(pathFor('report', r.investigation_id))
      return r
    }
    if (stepName === 'overview') { setSelected(null); navigate('/'); window.scrollTo(0, 0); return }
    const r = await ensureSample()
    if (!r || !stillOpen()) return
    if (stepName === 'conflict') { setViewRequest({ view: 'town', n: Date.now() }); setSelected(r.findings.find((f) => f.status === 'conflict') || r.findings[0]); return }
    setSelected(null)
    if (stepName === 'town' || stepName === 'sample') setViewRequest({ view: 'town', n: Date.now() })
  }, [openResult, navigate, resultRef, setSelected, setViewRequest])

  // Starting, finishing or skipping the tour all mean "don't invite me again".
  const startTour = useCallback(() => { writeTourSeen(); setShowInvite(false); setTourOpen(true) }, [])
  const closeTour = useCallback(() => { writeTourSeen(); setTourOpen(false); setSelected(null) }, [setSelected])
  const dismissInvite = useCallback(() => { writeTourSeen(); setShowInvite(false) }, [])

  return { tourOpen, showInvite, startTour, closeTour, dismissInvite, prepareTour }
}
