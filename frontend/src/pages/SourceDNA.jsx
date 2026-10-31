import { lazy, Suspense, useMemo, useState } from 'react'
import { Beaker, Dna, Fingerprint, FolderOpen, Info, Network, Plus, Trash2, Users, Wand2 } from 'lucide-react'
import { TYPE_COLORS } from '../domain/status'
import { useLite } from '../hooks/a11y'
import { sampleResult } from '../data/sample'
import { analyse, EXAMPLE_SOURCES } from '../domain/dna'
import { CredBadge, PageHero, SampleBadge, SourceAvatar } from '../components/common/ui'

const DnaHelix = lazy(() => import('../three/DnaHelix.jsx'))

const RELATION = {
  copied: { label: 'Likely copied', tone: 'copied' },
  overlap: { label: 'Shares passages', tone: 'overlap' },
  independent: { label: 'Independent', tone: 'independent' },
}
const TYPE_HEX = { Primary: '#2f6fd6', Institutional: '#7a4fd1', Secondary: '#e08a1e', Pasted: '#1f9e93', Unverified: '#d0546b' }

/** Node graph: one node per readable source (coloured by type); thick edge = likely copied, thin dashed = shares passages. */
function DnaGraph({ sources, dna }) {
  const [hover, setHover] = useState(null)
  const nodes = sources.filter((s) => s.state !== 'Blocked')
  const W = 420
  const H = 300
  const r = Math.min(W, H) / 2 - 52
  const pos = Object.fromEntries(nodes.map((s, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
    return [s.id, { x: W / 2 + Math.cos(a) * r * 1.25, y: H / 2 + Math.sin(a) * r }]
  }))
  const edges = dna.pairs.filter((p) => p.relation !== 'independent' && pos[p.a] && pos[p.b])
  const byId = Object.fromEntries(nodes.map((s) => [s.id, s]))
  const label = (p) => `${byId[p.a]?.name} ↔ ${byId[p.b]?.name}: ${p.overlap}% shared text (${RELATION[p.relation].label.toLowerCase()})`
  return <figure className="dna-graph">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Source graph: ${nodes.length} sources, ${edges.length} links. ${edges.map(label).join('. ')}`}>
      {edges.map((p) => { const a = pos[p.a]; const b = pos[p.b]; const key = `${p.a}-${p.b}`
        return <g key={key} className={`dna-edge ${p.relation} ${hover === key ? 'hot' : ''}`} tabIndex={0} aria-label={label(p)}
          onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(key)} onBlur={() => setHover(null)}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge-hit" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge-line" />
          {hover === key && <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}><rect x="-34" y="-14" width="68" height="28" rx="8" /><text textAnchor="middle" dy="5">{p.overlap}%</text></g>}
          <title>{label(p)}</title>
        </g> })}
      {nodes.map((s) => { const p = pos[s.id]; return <g key={s.id} className="dna-node" transform={`translate(${p.x} ${p.y})`}>
        <circle r="24" fill={TYPE_HEX[s.type] || TYPE_HEX.Unverified} />
        <text textAnchor="middle" dy="5" className="node-id">{s.id}</text>
        <text textAnchor="middle" dy="42" className="node-name">{s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}</text>
        <title>{`${s.name} · ${s.type}`}</title>
      </g> })}
    </svg>
    <figcaption className="dna-key"><span><i className="rung copied" />thick: likely copied</span><span><i className="rung overlap" />thin: shares passages</span><span>hover a line for %</span></figcaption>
  </figure>
}

const readableCount = (c) => (c?.sources || []).filter((s) => s.state !== 'Blocked').length
const hasDna = (c) => Boolean(c?.source_dna) && readableCount(c) >= 2

function caseLabel(c) {
  const title = c.title.length > 60 ? `${c.title.slice(0, 60).replace(/\s+\S*$/, '')}…` : c.title
  return `${title}${c.mode === 'demo' ? ' (sample)' : ''} · ${readableCount(c)} readable`
}

/** Verdict, helix, voices and pairs: shared by real cases and the lab. */
function DnaResults({ sources, dna, illustrative }) {
  const lite = useLite()
  const [shape, setShape] = useState('graph')
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]))
  const clustered = new Set(dna.clusters.flat())
  const readable = sources.filter((s) => s.state !== 'Blocked')
  const voices = readable.length - dna.clusters.reduce((n, c) => n + c.length - 1, 0)
  return <>
    <div className={`dna-verdict ${dna.clusters.length ? 'has-copies' : ''}`} role="status">
      <Users size={22} aria-hidden="true" />
      <div>
        <b>{readable.length} sources → <em>{voices} independent voice{voices === 1 ? '' : 's'}</em></b>
        <span>{dna.clusters.length ? `${dna.clusters.length} group${dna.clusters.length > 1 ? 's' : ''} of pages copy each other. Agreement inside a group counts once.` : 'No page copies another, so their agreement is genuinely independent.'}</span>
      </div>
      {illustrative && <SampleBadge />}
    </div>

    <div className="dna-stage">
      <div className="dna-helix-frame">
        {!lite && <div className="dna-shape-toggle" role="group" aria-label="Picture">
          <button aria-pressed={shape === 'graph'} onClick={() => setShape('graph')}><Network size={14} aria-hidden="true" /> Graph</button>
          <button aria-pressed={shape === 'helix'} onClick={() => setShape('helix')}><Dna size={14} aria-hidden="true" /> Helix</button>
        </div>}
        {shape === 'helix' && !lite ? <>
          <Suspense fallback={null}><DnaHelix sources={sources} dna={dna} /></Suspense>
          <div className="dna-key" aria-hidden="true"><span><i className="rung copied" />copied</span><span><i className="rung overlap" />shares passages</span></div>
        </> : <DnaGraph sources={sources} dna={dna} />}
      </div>
      <div className="voice-col">
        <h2>Voices</h2>
        {dna.clusters.map((group) => <div className="voice voice-group" key={group.join('-')}>
          <span className="voice-tag">One voice · {group.length} pages</span>
          {group.map((id) => <div className="voice-src" key={id}><SourceAvatar id={id} sources={sources} /><b>{byId[id]?.name}</b><CredBadge type={byId[id]?.type} /></div>)}
        </div>)}
        {readable.filter((s) => !clustered.has(s.id)).map((s) => <div className="voice" key={s.id}>
          <div className="voice-src"><SourceAvatar id={s.id} sources={sources} /><b>{s.name}</b><CredBadge type={s.type} /></div>
        </div>)}
        {sources.some((s) => s.state === 'Blocked') && <p className="dna-sub"><Info size={13} aria-hidden="true" /> Not compared (unreadable): {sources.filter((s) => s.state === 'Blocked').map((s) => s.host).join(', ')}</p>}
      </div>
    </div>

    <section className="dna-pairs" aria-labelledby="pairs-title">
      <h2 id="pairs-title">Every pair, compared</h2>
      <ul>
        {dna.pairs.filter((p) => p.relation !== 'independent').map((p) => {
          const rel = RELATION[p.relation]
          return <li key={`${p.a}-${p.b}`} className={`dna-pair rel-${rel.tone}`}>
            <div className="pair-head">
              <span className="pair-ids"><SourceAvatar id={p.a} sources={sources} /><span aria-hidden="true">↔</span><SourceAvatar id={p.b} sources={sources} /></span>
              <span className="pair-names">{byId[p.a]?.name} <i>and</i> {byId[p.b]?.name}</span>
              <span className={`pair-rel ${rel.tone}`}>{rel.label}</span>
            </div>
            <div className="pair-meter" role="img" aria-label={`${p.overlap}% shared text`}><i style={{ width: `${Math.max(p.overlap, 2)}%` }} /><span>{p.overlap}% shared text</span></div>
            {p.shared_sentences.length > 0 && <details className="more"><summary>{p.shared_count} identical sentence{p.shared_count === 1 ? '' : 's'}</summary>
              {p.shared_sentences.slice(0, 3).map((s) => <blockquote key={s}>“{s}”</blockquote>)}
            </details>}
          </li>
        })}
      </ul>
      {dna.pairs.some((p) => p.relation === 'independent') && <details className="more"><summary>{dna.pairs.filter((p) => p.relation === 'independent').length} independent pair{dna.pairs.filter((p) => p.relation === 'independent').length === 1 ? '' : 's'} (written separately)</summary>
        <p>{dna.pairs.filter((p) => p.relation === 'independent').map((p) => `${byId[p.a]?.name} ↔ ${byId[p.b]?.name} (${p.overlap}%)`).join(' · ')}</p>
      </details>}
    </section>
  </>
}

let entryId = 0
const entry = (e = {}) => ({ key: `e${(entryId += 1)}`, name: '', type: 'Secondary', text: '', ...e })

function DnaLab() {
  const [entries, setEntries] = useState(() => EXAMPLE_SOURCES.map((e) => entry(e)))
  const [isExample, setIsExample] = useState(true)
  const update = (key, patch) => { setIsExample(false); setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e))) }
  const sources = useMemo(() => entries.map((e, i) => ({ id: `S${i + 1}`, name: e.name.trim() || `Source ${i + 1}`, host: 'pasted text', type: e.type, state: e.text.trim() ? 'Pasted' : 'Blocked', color: TYPE_COLORS[e.type], text: e.text })), [entries])
  const dna = useMemo(() => analyse(sources.filter((s) => s.state === 'Pasted')), [sources])
  const shown = sources.filter((s) => s.state === 'Pasted')

  return <div className="dna-lab">
    <section className="lab-inputs" aria-labelledby="lab-title">
      <div className="lab-head">
        <h2 id="lab-title">Paste 2 to 5 pages</h2>
        <div className="lab-actions">
          <button type="button" className="secondary-button" onClick={() => { setEntries(EXAMPLE_SOURCES.map((e) => entry(e))); setIsExample(true) }}><Wand2 size={14} aria-hidden="true" /> Load example</button>
          <button type="button" className="secondary-button" onClick={() => { setEntries([entry(), entry()]); setIsExample(false) }}><Trash2 size={14} aria-hidden="true" /> Clear</button>
        </div>
      </div>
      <p className="dna-sub">Results update as you type. Nothing is sent anywhere: the comparison runs in your browser.</p>
      <div className="lab-grid">
        {entries.map((e, i) => <div className="lab-entry" key={e.key}>
          <div className="lab-entry-head">
            <span className={`source-avatar ${TYPE_COLORS[e.type]}`}>{i + 1}</span>
            <input value={e.name} onChange={(ev) => update(e.key, { name: ev.target.value })} placeholder={`Source ${i + 1} name`} aria-label={`Source ${i + 1} name`} />
            <select value={e.type} onChange={(ev) => update(e.key, { type: ev.target.value })} aria-label={`Source ${i + 1} type`}>
              <option value="Primary">Official</option><option value="Institutional">Institution</option><option value="Secondary">Blog / news</option>
            </select>
            {entries.length > 2 && <button type="button" className="icon-button" onClick={() => setEntries((prev) => prev.filter((x) => x.key !== e.key))} aria-label={`Remove source ${i + 1}`}><Trash2 size={14} aria-hidden="true" /></button>}
          </div>
          <textarea rows="4" value={e.text} onChange={(ev) => update(e.key, { text: ev.target.value })} placeholder="Paste the page text here…" aria-label={`Source ${i + 1} text`} />
        </div>)}
        {entries.length < 5 && <button type="button" className="lab-add" onClick={() => setEntries((prev) => [...prev, entry()])}><Plus size={16} aria-hidden="true" /> Add a page</button>}
      </div>
    </section>
    {shown.length >= 2 ? <DnaResults sources={sources} dna={dna} illustrative={isExample} />
      : <p className="lab-empty"><Beaker size={18} aria-hidden="true" /> Paste at least two pages to see their DNA.</p>}
  </div>
}

export default function SourceDNA({ result, history, onPick, onNew }) {
  const cases = useMemo(() => {
    const all = [...(result ? [result] : []), ...history.filter((h) => h.investigation_id !== result?.investigation_id)]
    if (!all.some((c) => c.investigation_id === sampleResult.investigation_id)) all.push(sampleResult)
    return all
  }, [result, history])
  // Always show a real picture: the open case if it can be compared, otherwise the sample case (labelled).
  const [mode, setMode] = useState('case')
  const [picked, setPicked] = useState(null)
  const fallback = result && !hasDna(result)
  const current = (picked && hasDna(picked) && picked) || (hasDna(result) ? result : sampleResult)

  return <div className="dna-page">
    <PageHero icon={Fingerprint} tone="teal" title="Source DNA" lede="Five blogs repeating one claim are one voice, not five. Source DNA finds pages that copy each other.">
      <div className="dna-tabs" role="group" aria-label="Source DNA mode">
        <button aria-pressed={mode === 'lab'} onClick={() => setMode('lab')}><Beaker size={15} aria-hidden="true" /> DNA lab</button>
        <button aria-pressed={mode === 'case'} onClick={() => setMode('case')}><FolderOpen size={15} aria-hidden="true" /> Your cases</button>
      </div>
    </PageHero>

    {mode === 'case' && fallback && !picked && <p className="dna-thin" role="note"><Info size={14} aria-hidden="true" /> Showing the sample case: your case needs 2+ readable sources (it has {readableCount(result)}). Pick another case, or try the DNA lab.</p>}

    {mode === 'lab' ? <DnaLab /> : <>
      <label className="dna-pick">Case
        <select value={current.investigation_id} onChange={(e) => { const c = cases.find((x) => x.investigation_id === e.target.value); setPicked(c); onPick(c) }}>
          {cases.map((c) => <option key={c.investigation_id} value={c.investigation_id} disabled={!hasDna(c)}>{caseLabel(c)}</option>)}
        </select>
      </label>
      <DnaResults sources={current.sources} dna={current.source_dna} illustrative={current.source_dna.illustrative} />
      {!cases.some((c) => hasDna(c) && c.mode !== 'demo') && <p className="dna-sub"><Info size={13} aria-hidden="true" /> None of your own cases has two readable pages yet. <button className="text-link" onClick={onNew}>Run one</button> or use the lab.</p>}
    </>}

    <details className="more dna-how-more"><summary>How Source DNA works</summary>
      <p>Plain code, not AI. For each pair of pages it breaks the text into overlapping five-word phrases and measures how much of the smaller page appears in the other. At 50% or more they are treated as copies (one voice); at 15% they share passages. It also lists sentences copied word for word.</p>
    </details>
  </div>
}
