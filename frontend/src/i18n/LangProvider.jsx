import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en.json'
import hi from './hi.json'
import { KEYS } from '../storage/keys'
import { readText, writeText } from '../storage/safeStorage'

// Static UI strings come from these dictionaries; only dynamic report content goes to the AI translator.
const DICTS = { en, hi }

const readLang = () => (readText(KEYS.lang) === 'hi' ? 'hi' : 'en')

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readLang)
  const setLang = useCallback((next) => {
    setLangState(next)
    writeText(KEYS.lang, next)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const t = useCallback((key, vars) => {
    const text = DICTS[lang]?.[key] ?? en[key] ?? key
    return vars ? text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`)) : text
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
