import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.jsx'
import ErrorBoundary from './components/common/ErrorBoundary'
import { LangProvider } from './i18n/LangProvider'
import { reportError } from './utils/logger'
import './styles/base.css'
import './styles/theme.css'
import './styles/print.css'
import './styles/polish.css'

// Anything that escapes React (a rejected promise, a script error) is logged in one place instead of vanishing.
window.addEventListener('unhandledrejection', (event) => reportError('promise', event.reason))
window.addEventListener('error', (event) => reportError('window', event.error || event.message))

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary scope="app">
      <LangProvider>
        <App />
      </LangProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
