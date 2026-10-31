import { useCallback, useEffect, useState } from 'react'
import { translationKey } from '../storage/keys'
import { readJson, writeJson } from '../storage/safeStorage'
import { translateReport } from '../api'

// Every dynamic string of a report, keyed so components can look up their translation.
function reportItems(result) {
  const items = { 'case:title': result.title, 'case:question': result.question || '' }
  ;(result.findings || []).forEach((f) => {
    items[`title:${f.id}`] = f.title
    items[`value:${f.id}`] = f.value
    items[`sum:${f.id}`] = f.summary
    if (f.note) items[`note:${f.id}`] = f.note
  })
  ;(result.checklist || []).forEach((c) => { items[`chk:${c.id}`] = c.text; items[`why:${c.id}`] = c.why; items[`where:${c.id}`] = c.where })
  ;(result.unanswered_questions || []).forEach((q) => { items[`q:${q.finding_id}`] = q.question })
  return Object.fromEntries(Object.entries(items).filter(([, v]) => v && v.trim()))
}


/**
 * Translates a whole report in one batched call. Cached in localStorage (instant the second time) and on the
 * backend by (case, language). Returns { tr, status: 'off'|'loading'|'ready'|'error', reason, elapsed }.
 */
export function useReportTranslation(result, lang) {
  const id = result?.investigation_id
  const [state, setState] = useState({ map: {}, status: 'off', reason: '', started: 0, elapsed: 0 })

  useEffect(() => {
    if (!result || lang !== 'hi') { setState({ map: {}, status: 'off', reason: '', started: 0, elapsed: 0 }); return undefined }
    let alive = true
    const cached = readJson(translationKey(id, lang), null)
    if (cached && Object.keys(cached).length) { setState({ map: cached, status: 'ready', reason: '', started: 0, elapsed: 0 }); return undefined }
    const started = performance.now()
    setState({ map: {}, status: 'loading', reason: '', started, elapsed: 0 })
    translateReport(id, reportItems(result)).then((out) => {
      if (!alive) return
      const elapsed = (performance.now() - started) / 1000
      if (!out.available || !Object.keys(out.translations || {}).length) {
        setState({ map: {}, status: 'error', reason: out.reason || 'the AI service did not answer', started, elapsed })
        return
      }
      writeJson(translationKey(id, lang), out.translations)
      setState({ map: out.translations, status: 'ready', reason: '', started, elapsed })
    })
    return () => { alive = false }
  }, [id, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const tr = useCallback((key, fallback) => (lang === 'hi' && state.map[key]) || fallback, [lang, state.map])
  return { tr, status: state.status, reason: state.reason, elapsed: state.elapsed }
}
