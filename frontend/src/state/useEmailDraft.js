import { useEffect, useMemo, useState } from 'react'
import { draftEmail, translateText } from '../api'
import { cleanSubject, findContact, mailtoHref, openItems, packForTranslation, unpackTranslation } from '../domain/email'

/**
 * Drafting the email to the authority for a case (or one finding): the AI draft, the optional Hindi version and the
 * mailto link. The UI only renders what this returns. Nothing is ever sent by Blindspot.
 */
export function useEmailDraft(result, finding) {
  const suggestedContact = useMemo(() => findContact(result), [result])
  const [to, setTo] = useState(suggestedContact)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isAi, setIsAi] = useState(false)
  const [busy, setBusy] = useState(true)
  const [hindi, setHindi] = useState(null) // { subject, body } once translated
  const [hindiState, setHindiState] = useState('off') // off | loading | on | error

  useEffect(() => {
    let alive = true
    const question = result.question || result.title
    draftEmail({ topic: question, question, year: result.context?.year, points: openItems(result, finding) })
      .then((draft) => {
        if (!alive) return
        setSubject(cleanSubject(draft.subject, question))
        setBody(draft.body)
        setIsAi(Boolean(draft.is_ai))
      })
      .finally(() => alive && setBusy(false))
    return () => { alive = false }
  }, [result, finding])

  const showHindi = hindiState === 'on' && Boolean(hindi)
  const outSubject = showHindi ? hindi.subject : subject
  const outBody = showHindi ? hindi.body : body

  const toggleHindi = async () => {
    if (hindiState === 'on') { setHindiState('off'); return }
    if (hindi) { setHindiState('on'); return }
    setHindiState('loading')
    const out = await translateText(packForTranslation(subject, body))
    const parts = out.available ? unpackTranslation(out.translated_text) : null
    if (!parts) { setHindiState('error'); return }
    setHindi(parts)
    setHindiState('on')
  }

  return {
    to, setTo, suggestedContact, subject, setSubject, body, setBody, isAi, busy,
    hindi, setHindi, hindiState, showHindi, toggleHindi,
    mailto: mailtoHref(to, outSubject, outBody),
    plainText: `${to ? `To: ${to}\n` : ''}Subject: ${outSubject}\n\n${outBody}`,
  }
}
