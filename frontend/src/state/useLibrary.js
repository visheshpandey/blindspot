import { useCallback, useMemo, useState } from 'react'
import { useLang } from '../i18n/LangProvider'
import { DEMO_CASES } from '../domain/demoCases'
import { TRAPLAB_RUN } from '../domain/traplab'
import { sampleResult } from '../data/sample'
import { listHistory, removeInvestigation, saveInvestigation } from '../storage/history'
import { listSaved, removeDemoSaved, removeSaved, savedKey, seedSampleSaved, toggleSaved, updateNote } from '../storage/saved'
import { clearTranslations, readDemoMode, writeDemoMode } from '../storage/settings'
import { readStudents, writeStudent } from '../storage/students'

const DEMO_IDS = [...DEMO_CASES.map((c) => c.investigation_id), TRAPLAB_RUN.investigation_id, sampleResult.investigation_id]

/**
 * Everything the user keeps in this browser: case history, saved findings, student tags and the Demo mode switch.
 * State lives here; persistence is delegated to src/storage. `notify` is the toast function from useToast.
 */
export function useLibrary(notify) {
  const { t } = useLang()
  const [history, setHistory] = useState(listHistory)
  const [saved, setSaved] = useState(() => seedSampleSaved(sampleResult))
  const [students, setStudents] = useState(readStudents)
  const [demoMode, setDemoModeState] = useState(readDemoMode)
  const demoCases = useMemo(() => (demoMode ? [...DEMO_CASES, TRAPLAB_RUN] : []), [demoMode])

  // History
  const addToHistory = useCallback((data) => {
    if (data.mode !== 'demo' && !data.demo_run) setHistory(saveInvestigation(data))
  }, [])

  const removeFromHistory = useCallback((id) => {
    const item = listHistory().find((h) => h.investigation_id === id)
    setHistory(removeInvestigation(id))
    if (item) notify(`Deleted “${item.title}”.`, { label: 'Undo', run: () => setHistory(saveInvestigation(item)) })
  }, [notify])

  // Saved findings. `onViewSaved` lets the toast link to the Saved findings page.
  const toggleSave = useCallback((result, finding, onViewSaved) => {
    const next = toggleSaved(result, finding)
    setSaved(next)
    if (next.some((x) => x.key === savedKey(result, finding))) notify(t('toast.saved', { title: finding.title }), { label: t('toast.open_saved'), run: onViewSaved })
    else notify(`Removed “${finding.title}” from Saved findings.`)
  }, [notify, t])

  const removeSavedItem = useCallback((key) => setSaved(removeSaved(key)), [])
  const setSavedNote = useCallback((key, note) => setSaved(updateNote(key, note)), [])

  // Counsellor board
  const tagStudent = useCallback((caseId, name) => setStudents(writeStudent(caseId, name)), [])

  // Demo mode
  const setDemoMode = useCallback((on) => {
    writeDemoMode(on)
    setDemoModeState(on)
    notify(on ? 'Demo mode on: 4 saved real runs are in Case history, and runs fall back to them if the AI or network fails.' : 'Demo mode off.')
  }, [notify])

  const clearDemo = useCallback(() => {
    writeDemoMode(false)
    setDemoModeState(false)
    setSaved(removeDemoSaved(DEMO_IDS))
    clearTranslations(DEMO_IDS)
    notify('Demo data cleared. Your own cases and saved findings are kept.')
  }, [notify])

  return { history, saved, students, demoMode, demoCases, addToHistory, removeFromHistory, toggleSave, removeSavedItem, setSavedNote, tagStudent, setDemoMode, clearDemo }
}
