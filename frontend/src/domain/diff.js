// "What changed": compares two runs of the same case. Pure code, no AI. Checklist items are matched by title
// (ids differ between runs), and a value only counts as changed when its numbers or dates differ, so rewording is not reported as a change.

const words = (s) => new Set((s || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])
const MONTHS = /january|february|march|april|may|june|july|august|september|october|november|december/gi

function facts(value) {
  // Years and cycles (2026, 2026-27) are the same context in both runs, so they are not changes.
  const text = (value || '').toLowerCase().replace(/20\d\d(?:[-–/]\d\d)?/g, ' ')
  const nums = (text.match(/\d[\d,./]*/g) || []).map((n) => n.replace(/[,.\/]+$/, '').replace(/,/g, ''))
  return new Set([...nums, ...(text.match(MONTHS) || [])])
}

function similarity(a, b) {
  const wa = words(a)
  const wb = words(b)
  const shared = [...wa].filter((w) => wb.has(w)).length
  return shared / Math.max(wa.size + wb.size - shared, 1)
}

function sameFacts(a, b) {
  const fa = facts(a)
  const fb = facts(b)
  return fa.size === fb.size && [...fa].every((x) => fb.has(x))
}

/** Pair each old finding with the new finding that has the same (or most similar) title. */
function pair(oldFindings, newFindings) {
  const used = new Set()
  const pairs = []
  oldFindings.forEach((o) => {
    let best = null
    let score = 0
    newFindings.forEach((n) => {
      if (used.has(n.id)) return
      const s = o.title.toLowerCase() === n.title.toLowerCase() ? 1 : similarity(o.title, n.title)
      if (s > score) { score = s; best = n }
    })
    if (best && score >= 0.5) { used.add(best.id); pairs.push([o, best]) } else pairs.push([o, null])
  })
  return { pairs, added: newFindings.filter((n) => !used.has(n.id)) }
}

export function diffResults(before, after) {
  const { pairs, added } = pair(before.findings, after.findings)
  const items = []
  pairs.forEach(([o, n]) => {
    if (!n) { items.push({ kind: 'removed', title: o.title, from: o.status }); return }
    if (o.status !== n.status) items.push({ kind: 'status', title: n.title, from: o.status, to: n.status, fromValue: o.value, toValue: n.value })
    else if (n.status !== 'missing' && !sameFacts(o.value, n.value)) items.push({ kind: 'value', title: n.title, status: n.status, fromValue: o.value, toValue: n.value })
  })
  added.forEach((n) => items.push({ kind: 'new', title: n.title, to: n.status, toValue: n.value }))
  return {
    from_id: before.investigation_id,
    from_at: before.generated_at,
    verdict: before.verdict !== after.verdict ? { from: before.verdict, to: after.verdict } : null,
    coverage: { from: before.coverage, to: after.coverage },
    items,
    unchanged: !items.length && before.verdict === after.verdict && before.coverage === after.coverage,
  }
}
