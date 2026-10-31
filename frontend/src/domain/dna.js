// Source DNA in the browser: a line-for-line port of backend/app/pipeline/dna.py (plain code, no AI).
// Used by the DNA lab so anyone can try it instantly on pasted text.
const SHINGLE = 5
const COPIED = 50 // % containment: the smaller page is mostly the other page
const OVERLAP = 15 // % containment: they share whole passages
const MIN_SENTENCE_WORDS = 8

/** Same normalisation as backend verify.normalise(). */
function normalise(text) {
  return (text || '')
    .normalize('NFKC')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ')
    .toLowerCase()
    .replace(/(₹|\brs\.?|\binr\b)\s*/gi, 'rs ')
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[^\p{L}\p{N}_\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sentences(text) {
  return (text || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= MIN_SENTENCE_WORDS)
}

function shingles(text, n = SHINGLE) {
  const words = normalise(text).split(' ').filter(Boolean)
  const out = new Set()
  for (let i = 0; i + n <= words.length; i += 1) out.add(words.slice(i, i + n).join(' '))
  return out
}

function containment(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  small.forEach((x) => { if (large.has(x)) shared += 1 })
  return Math.round((100 * shared) / small.size)
}

export const relation = (overlap) => (overlap >= COPIED ? 'copied' : overlap >= OVERLAP ? 'overlap' : 'independent')

/** sources: [{ id, text }] → { pairs, clusters, note } — same shape as the API's source_dna. */
export function analyse(sources, maxShared = 4) {
  const readable = sources.filter((s) => (s.text || '').trim())
  if (readable.length < 2) return { pairs: [], clusters: [], note: 'Source DNA needs at least two readable sources.' }
  const prints = Object.fromEntries(readable.map((s) => [s.id, shingles(s.text)]))
  const sents = Object.fromEntries(readable.map((s) => [s.id, new Map(sentences(s.text).map((x) => [normalise(x), x]))]))
  const pairs = []
  readable.forEach((a, i) => readable.slice(i + 1).forEach((b) => {
    const overlap = containment(prints[a.id], prints[b.id])
    const common = [...sents[a.id].entries()].filter(([k]) => sents[b.id].has(k)).map(([, v]) => v).sort((x, y) => y.length - x.length)
    pairs.push({ a: a.id, b: b.id, overlap, relation: relation(overlap), shared_sentences: common.slice(0, maxShared), shared_count: common.length })
  }))
  // Union-find: "S3 copies S4 copies S5" becomes one group.
  const parent = Object.fromEntries(readable.map((s) => [s.id, s.id]))
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  pairs.filter((p) => p.relation === 'copied').forEach((p) => { parent[find(p.a)] = find(p.b) })
  const groups = {}
  readable.forEach((s) => { (groups[find(s.id)] ||= []).push(s.id) })
  const clusters = Object.values(groups).filter((g) => g.length > 1).map((g) => g.sort())
  pairs.sort((x, y) => y.overlap - x.overlap)
  const note = clusters.length
    ? `${clusters.length} group${clusters.length > 1 ? 's' : ''} of sources look like copies of each other; treat each group as one voice.`
    : 'No source copies another; agreement between them counts as independent.'
  return { pairs, clusters, note }
}

// Illustrative example texts for the lab (sample data, not real scholarship guidance).
export const EXAMPLE_SOURCES = [
  { name: 'Scholarship portal notice', type: 'Primary', text: `Applications for the post-matric scholarship for the 2026-27 session are open on the national portal. The annual income of parents or guardians from all sources should not exceed Rs. 2,50,000. A valid income certificate issued by the competent authority must be uploaded with the application. Fresh and renewal applications must be submitted separately before the closing date announced on the portal. Students must keep their Aadhaar-seeded bank account active to receive the scholarship by direct benefit transfer.` },
  { name: 'Top Scholarship Tips blog', type: 'Secondary', text: `Planning to apply this year? Here is everything you need to know. Students should keep the latest ITR acknowledgement ready during document verification at the college. The last date for submitting the online application is usually 30 November and late forms are not accepted by anyone. Renewal is automatic for students who pass their exams, so there is no need to apply again. Make sure your photo and signature are scanned clearly before you start the form.` },
  { name: 'Student Help Hub blog', type: 'Secondary', text: `Our team made this simple guide for you! Students should keep the latest ITR acknowledgement ready during document verification at the college. The last date for submitting the online application is usually 30 November and late forms are not accepted by anyone. Renewal is automatic for students who pass their exams, so there is no need to apply again. Share this post with your friends who are applying too.` },
  { name: 'Education news report', type: 'Secondary', text: `The ministry said lakhs of students applied last year and urged eligible students to apply early this session. Officials repeated that a valid income certificate issued by the competent authority must be uploaded with the application. They also warned students against agents who charge money for filling scholarship forms. Help desks will be set up at district offices during the application window.` },
]
