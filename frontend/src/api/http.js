// The one place that talks HTTP to the backend. Every failure becomes an ApiError with a user-safe message.
import { apiBase } from '../config/env'

const OFFLINE_MESSAGE = "Can't reach the investigation server right now."
const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export class ApiError extends Error {
  /** @param {string} message user-safe text  @param {{status?: number, code?: string, offline?: boolean}} [info] */
  constructor(message, { status = 0, code = 'unknown', offline = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.offline = offline
  }
}

/** JSON request. Resolves { status, body } (202 counts as success: "still running"). Rejects with ApiError. */
export async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, { offline: true, code: 'offline' })
  }
  let body = null
  try { body = await response.json() } catch { /* empty or non-JSON body */ }
  if (!response.ok && response.status !== 202) {
    throw new ApiError(body?.error?.message || GENERIC_MESSAGE, { status: response.status, code: body?.error?.code || 'http_error' })
  }
  return { status: response.status, body }
}

export const post = (path, payload) => request(path, { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) })
