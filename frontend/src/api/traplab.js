// Trap Lab demo only: simulate the authority changing the official notice (moves the 2026-27 deadline).
import { hasBackend } from '../config/env'
import { debug } from '../utils/logger'
import { post } from './http'

/** Returns true when the backend accepted the change. */
export async function traplabUpdate(updated = true) {
  if (!hasBackend) return false
  try {
    await post(`/traplab/update?updated=${updated}`)
    return true
  } catch (error) {
    debug('api', 'trap lab update failed', error)
    return false
  }
}
