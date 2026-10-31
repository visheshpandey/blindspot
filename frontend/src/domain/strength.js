// Evidence strength for one finding: how many sources, how many independent (Source DNA groups count once),
// and the strongest authority behind it. Pure functions, used by every view.
const RANK = { Primary: 3, Institutional: 3, Secondary: 2, Pasted: 1, Unverified: 0 }
const ORDER = ['Primary', 'Institutional', 'Secondary', 'Pasted', 'Unverified']

export function evidenceStrength(finding, result) {
  const ids = [...new Set((finding.sources || []).map((e) => e.source))]
  const byId = Object.fromEntries((result.sources || []).map((s) => [s.id, s]))
  const groupOf = {}
  ;(result.source_dna?.clusters || []).forEach((group) => group.forEach((id) => { groupOf[id] = group.join('+') }))
  const independent = new Set(ids.map((id) => groupOf[id] || id)).size
  // A pasted quote confirmed on its live page counts with that page's authority (shown as "confirmed").
  const tiers = (finding.sources || []).map((e) => (e.confirmed_live ? 'Primary' : byId[e.source]?.type || 'Unverified'))
  const strongest = ORDER.find((tier) => tiers.includes(tier)) || null
  const best = strongest ? RANK[strongest] : 0
  let dots = 0
  if (ids.length) {
    if (best === 3 && independent >= 2) dots = 3
    else if (best === 3 || (best === 2 && independent >= 2)) dots = 2
    else dots = 1
  }
  return { sources: ids.length, independent, strongest, dots, weak: finding.status === 'supported' && dots <= 1 }
}
