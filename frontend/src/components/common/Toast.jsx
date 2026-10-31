import { Info, X } from 'lucide-react'

/** Presentational toast: `toast` is { message, action?: { label, run } } from useToast. */
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return <div className="toast-message" role="status">
    <Info size={15} aria-hidden="true" /><span>{toast.message}</span>
    {toast.action && <button className="toast-undo" onClick={() => { toast.action.run(); onDismiss() }}>{toast.action.label}</button>}
    <button onClick={onDismiss} aria-label="Dismiss message"><X size={14} aria-hidden="true" /></button>
  </div>
}
