import { useCallback, useEffect, useState } from 'react'

// Hash routes: #/, #/new, #/analyzing/:id, #/report/:id, #/history, #/saved, #/dna.
// Hash routing needs no server config, so refresh and back/forward work on any static host.
const SEGMENT_TO_PAGE = { '': 'overview', new: 'investigation', analyzing: 'analyzing', report: 'report', history: 'history', saved: 'saved', dna: 'dna', counsellor: 'counsellor' }
const PAGE_TO_PATH = { overview: '/', investigation: '/new', analyzing: '/analyzing', report: '/report', history: '/history', saved: '/saved', dna: '/dna', counsellor: '/counsellor' }

function parseHash(hash = window.location.hash) {
  const path = hash.replace(/^#/, '') || '/'
  const [, segment = '', id = ''] = path.split('/')
  return { page: SEGMENT_TO_PAGE[segment] || 'overview', id: decodeURIComponent(id) }
}

export function pathFor(page, id) {
  return (PAGE_TO_PATH[page] || '/') + (id ? `/${encodeURIComponent(id)}` : '')
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((path, { replace = false } = {}) => {
    const hash = `#${path}`
    if (window.location.hash === hash) { setRoute(parseHash(hash)); return }
    if (replace) { window.history.replaceState(null, '', hash); setRoute(parseHash(hash)) } else window.location.hash = hash
  }, [])
  return [route, navigate]
}
