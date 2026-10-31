import { useCallback, useState } from 'react'

const SHORT_MS = 5000
const WITH_ACTION_MS = 7000

/** One toast at a time. `notify(message, { label, run })` shows it; an action button runs `run` then closes the toast. */
export function useToast() {
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, action = null) => {
    setToast({ message, action })
    window.setTimeout(() => setToast((current) => (current?.message === message ? null : current)), action ? WITH_ACTION_MS : SHORT_MS)
  }, [])

  const dismiss = useCallback(() => setToast(null), [])
  return { toast, notify, dismiss }
}
