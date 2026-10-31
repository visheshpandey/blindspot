// Environment configuration, read once. Nothing else in the app touches import.meta.env.
// Set VITE_API_BASE_URL in frontend/.env (see .env.example). Leave it empty for the frontend-only sample demo.
import { debug } from '../utils/logger'

const raw = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

if (raw && !isHttpUrl(raw)) debug('config', `VITE_API_BASE_URL is not a valid http(s) URL: "${raw}". Running without a backend.`)

/** Backend base URL without a trailing slash, or '' when none is configured. */
export const apiBase = isHttpUrl(raw) ? raw : ''
export const hasBackend = Boolean(apiBase)
export const isDev = Boolean(import.meta.env.DEV)
