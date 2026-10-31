// The recorded real runs bundled with the app (Demo mode). Regenerate with backend/scripts/demo_cases.py.
import demoCases from '../data/demo-cases.json'

export const DEMO_CASES = demoCases.map((c) => ({ ...c, demo_run: true }))

const words = (text) => (text || '').toLowerCase().match(/[a-z]{4,}/g) || []

/** The recorded run whose question shares the most words with `question` (used when the backend or AI is down). */
export function demoCaseFor(question) {
  const wanted = new Set(words(question))
  let best = DEMO_CASES[0]
  let score = -1
  DEMO_CASES.forEach((c) => {
    const s = words(c.question).filter((w) => wanted.has(w)).length
    if (s > score) { score = s; best = c }
  })
  return best
}
