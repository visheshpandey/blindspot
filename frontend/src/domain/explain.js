// Explains a verdict in plain words: which items cause it, and what would change it. Pure code, no AI.
import { isBlocker } from './status'

export const LADDER = ['Ready to decide', 'Proceed with caution', 'Not ready to decide', 'Insufficient evidence']

/** Returns { reasons: [{finding, text}], fixes: [{finding, text}], fixIntro, next } using the i18n `t` and the report `tr`. */
export function explainVerdict(result, t, tr = (k, v) => v) {
  const findings = result.findings || []
  const title = (f) => tr(`title:${f.id}`, f.title)
  const year = result.context?.year || ''
  const blockers = findings.filter(isBlocker)
  const readable = (result.sources || []).filter((s) => s.state !== 'Blocked').length

  if (result.verdict === 'Insufficient evidence') {
    return {
      reasons: [{ text: t('why.insufficient', { n: (result.sources || []).length || readable }) }],
      fixIntro: '', fixes: [{ text: t('fix.insufficient') }], next: 'Not ready to decide',
    }
  }
  if (blockers.length) {
    return {
      reasons: blockers.map((f) => ({ finding: f, text: t(`why.${f.status}`, { item: title(f) }) })),
      fixIntro: t('fix.to_caution'),
      fixes: blockers.map((f) => ({ finding: f, text: t(`fix.${f.status}`, { item: title(f), year }) })),
      next: 'Proceed with caution',
    }
  }
  const weak = findings.filter((f) => f.status !== 'supported')
  if (weak.length) {
    return {
      reasons: weak.map((f) => ({ finding: f, text: t('why.weak', { item: title(f), status: t(`status.${f.status}`) }) })),
      fixIntro: t('fix.to_ready'),
      fixes: weak.map((f) => ({ finding: f, text: t(`fix.${f.status}`, { item: title(f), year }) })),
      next: 'Ready to decide',
    }
  }
  return { reasons: [{ text: t('why.ready') }], fixIntro: '', fixes: [{ text: t('fix.ready') }], next: null }
}
