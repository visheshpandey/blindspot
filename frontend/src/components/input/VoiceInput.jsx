import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useLang } from '../../i18n/LangProvider'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const voiceSupported = Boolean(Recognition)

/** Speak your question in Hindi or English. Uses the browser's own speech service; Blindspot never receives the audio. */
export default function VoiceInput({ onText }) {
  const { lang: uiLang } = useLang()
  const [speech, setSpeech] = useState(uiLang === 'hi' ? 'hi-IN' : 'en-IN')
  const [listening, setListening] = useState(false)
  const [note, setNote] = useState('')
  const recRef = useRef(null)
  useEffect(() => () => recRef.current?.abort?.(), [])
  if (!Recognition) return null

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return }
    setNote('')
    const rec = new Recognition()
    rec.lang = speech
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (event) => { const text = event.results[0]?.[0]?.transcript; if (text) onText(text.trim()) }
    rec.onerror = (event) => setNote(event.error === 'not-allowed' ? 'Microphone access is blocked in this browser.' : event.error === 'no-speech' ? 'Nothing heard. Try again.' : 'Voice input is not available right now.')
    rec.onend = () => setListening(false)
    recRef.current = rec
    try { rec.start(); setListening(true) } catch { setNote('Voice input is not available right now.') }
  }

  return <div className="voice-input">
    <button type="button" className={`voice-button ${listening ? 'on' : ''}`} onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak your question'}>
      {listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}{listening ? 'Listening…' : 'Speak'}
    </button>
    <div className="voice-lang" role="group" aria-label="Spoken language">
      <button type="button" aria-pressed={speech === 'hi-IN'} onClick={() => setSpeech('hi-IN')} lang="hi">हिंदी</button>
      <button type="button" aria-pressed={speech === 'en-IN'} onClick={() => setSpeech('en-IN')}>English</button>
    </div>
    {note && <span className="voice-note" role="status">{note}</span>}
  </div>
}
