import { useRef, useState } from 'react'
import { Check, Copy, Info, Languages, LoaderCircle, Send, X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/a11y'
import { useEmailDraft } from '../../state/useEmailDraft'
import { AiChip } from '../common/ui'

/** Modal to edit, copy or open the email draft. Logic: state/useEmailDraft.js and domain/email.js. */
export default function EmailModal({ result, finding, onClose }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  const draft = useEmailDraft(result, finding)
  const { busy, hindiState, showHindi, hindi } = draft
  useFocusTrap(ref, true, onClose)

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft.plainText); setCopied(true) } catch { /* clipboard blocked: nothing to do */ }
  }

  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="email-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="email-title">
      <div className="modal-heading">
        <div><div className="section-kicker">ASK THE AUTHORITY</div><h2 id="email-title">Draft a query email</h2><p>Edit it, copy it, and send it yourself. Blindspot never sends anything.</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close email draft"><X size={18} aria-hidden="true" /></button>
      </div>
      {busy ? <div className="modal-loading"><LoaderCircle className="spin" size={18} aria-hidden="true" /> Drafting…</div> : <>
        {draft.isAi && <AiChip text="AI-drafted · may be wrong · review before sending" />}
        <label>TO <small>(optional{draft.to && draft.to === draft.suggestedContact ? ' · found in your sources, check it' : ''})</small><input type="email" value={draft.to} onChange={(e) => draft.setTo(e.target.value)} placeholder="helpdesk@example.gov.in" /></label>
        {showHindi ? <div lang="hi" className="email-hindi">
          <AiChip text="हिंदी अनुवाद AI द्वारा · गलत हो सकता है (AI translation · may be wrong)" />
          <label>विषय<input value={hindi.subject} onChange={(e) => draft.setHindi({ ...hindi, subject: e.target.value })} /></label>
          <label>ईमेल<textarea rows="10" value={hindi.body} onChange={(e) => draft.setHindi({ ...hindi, body: e.target.value })} /></label>
        </div> : <>
          <label>SUBJECT<input value={draft.subject} onChange={(e) => draft.setSubject(e.target.value)} /></label>
          <label>EMAIL BODY<textarea rows="10" value={draft.body} onChange={(e) => draft.setBody(e.target.value)} /></label>
        </>}
        {hindiState === 'error' && <p className="inline-note error" role="alert"><Info size={13} aria-hidden="true" /> The Hindi version needs the AI service, which isn't answering right now.</p>}
      </>}
      <div className="modal-footer">
        <span><Info size={13} aria-hidden="true" /> Add your name and application number before sending.</span>
        <div className="email-actions">
          <button className={`secondary-button ${showHindi ? 'pressed' : ''}`} onClick={draft.toggleHindi} disabled={busy || hindiState === 'loading'} aria-pressed={showHindi}>
            {hindiState === 'loading' ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Languages size={14} aria-hidden="true" />}{showHindi ? 'English' : <span lang="hi">हिंदी</span>}
          </button>
          <a className={`secondary-button ${busy ? 'is-disabled' : ''}`} href={busy ? undefined : draft.mailto} aria-disabled={busy}><Send size={14} aria-hidden="true" /> Open in email app</a>
          <button className="primary-button" onClick={copy} disabled={busy}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy draft'}</button>
        </div>
      </div>
    </div>
  </div>
}
