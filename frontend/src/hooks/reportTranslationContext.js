import { createContext, useContext } from 'react'

// The open report's AI translation, shared by the report, the evidence drawer and the print view.
export const ReportTrContext = createContext({ tr: (key, fallback) => fallback, status: 'off', reason: '', elapsed: 0 })
export const useTr = () => useContext(ReportTrContext)
