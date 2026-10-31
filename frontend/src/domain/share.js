// WhatsApp share: a short plain-text summary of a report, opened through wa.me (no API, nothing is sent by Blindspot).
import { isBlocker } from './status'

const MAX_ITEMS = 4

/** Verdict, blockers and the top things to verify, in the current language. `t` and `tr` come from the i18n and report-translation hooks. */
export function shareText(result, t, tr = (k, v) => v) {
  const title = (f) => tr(`title:${f.id}`, f.title)
  const blockers = result.findings.filter(isBlocker)
  const todo = [...(result.checklist || [])].sort((a, b) => Number(b.critical) - Number(a.critical)).slice(0, MAX_ITEMS)
  const lines = [
    `*Blindspot* · ${tr('case:title', result.title)}`,
    `${t('verdict.label')}: *${t(`verdict.${result.verdict}`)}* (${result.coverage}% ${t('verdict.coverage')})`,
  ]
  if (blockers.length) lines.push('', `${t('sec.blockers')}:`, ...blockers.slice(0, MAX_ITEMS).map((f) => `• ${title(f)} (${t(`status.${f.status}`)})`))
  if (todo.length) lines.push('', `${t('sec.verify')}:`, ...todo.map((c, i) => `${i + 1}. ${tr(`chk:${c.id}`, c.text)}`))
  lines.push('', result.mode === 'demo' && !result.demo_run ? 'Sample data, illustrative.' : 'Checked quote by quote against the pages. A quote shows what a page says, not that it is true.')
  return lines.join('\n')
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`
