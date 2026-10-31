// QA pass checks in a real browser. Usage: node scripts/qa-check.mjs (frontend on :5173, backend on :8000)
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] })
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
async function page(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('blindspot.tour.seen', '1'))
  const p = await ctx.newPage()
  p.errors = []
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()))
  if (opts.limited) await p.route('**/health', (r) => r.fulfill({ json: { status: 'ok', llm: 'gemini', llm_ok: false, llm_reason: 'Quota exhausted for this model (429).', mode: 'live' } }))
  await p.goto(BASE, { waitUntil: 'load' })
  return p
}

// 3. Header badge reflects the real LLM state
let p = await page()
await p.waitForTimeout(1500)
ok('Badge says LIVE ANALYSIS when /health llm_ok is true', (await p.locator('.topbar-actions').innerText()).includes('LIVE ANALYSIS'))
const limited = await page({ limited: true })
await limited.waitForTimeout(1500)
const badgeText = await limited.locator('.topbar-actions').innerText()
ok('Badge says LIMITED MODE (with reason tooltip) when llm_ok is false', badgeText.includes('LIMITED MODE') && !badgeText.includes('LIVE ANALYSIS'),
   await limited.locator('.mode-indicator.limited').getAttribute('title'))

// 4. Invalid sources never count or build houses
await p.getByRole('button', { name: 'New investigation' }).first().click()
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(1500) // let the 3D mascot and web fonts settle before measuring layout
const count = async () => (await p.locator('.ni-card .source-count b').innerText()).trim()
const before = await count()
for (const bad of ['not a url', 'javascript:alert(1)', 'http://plain-http.example']) {
  await p.getByLabel('Source 3 web address').fill(bad)
  await p.waitForTimeout(500)
  ok(`"${bad}" does not raise the ready counter or show a type`, (await count()) === before && !(await p.locator('.source-block').nth(2).locator('.tier-preview').count()), `${before}/5 stays ${await count()}/5`)
}
const caption = await p.locator('.case-street-caption em').innerText()
ok('Live street caption agrees (no house for invalid text)', caption.startsWith(`${before} of 5`), caption)
const layoutY = () => p.evaluate(() => { let el = document.querySelector('.ni-submit'), y = 0; while (el) { y += el.offsetTop; el = el.offsetParent } return { y } })
const y0 = await layoutY()
await p.getByLabel('Source 3 web address').fill('still not a url')
await p.waitForTimeout(300)
const y1 = await layoutY()
ok('Typing does not push fields down (no layout jump)', Math.abs(y0.y - y1.y) < 1, `${Math.round(y0.y)} → ${Math.round(y1.y)}`)
await p.getByLabel('Source 3 web address').blur()
await p.waitForTimeout(300)
const y2 = await layoutY()
const shown = await p.getByText('Use a full web address starting with https://').count()
ok('Error appears on blur, in reserved space', shown > 0 && Math.abs(y0.y - y2.y) < 1, `shown=${shown}, submit y ${Math.round(y0.y)} → ${Math.round(y2.y)}`)
ok('Question has maxLength 500 and a counter', (await p.locator('#question').getAttribute('maxlength')) === '500' && /\/500$/.test(await p.locator('.char-count').innerText()))

// 5. Routing: refresh keeps the report; back/forward work
await p.getByRole('button', { name: 'Overview' }).click()
await p.getByRole('button', { name: 'Open the sample case' }).click()
await p.waitForURL(/#\/report\//, { timeout: 10000 }).catch(() => {})
await p.locator('.verdict-card').waitFor({ timeout: 10000 }).catch(() => {})
const reportUrl = p.url()
ok('Report has its own URL', /#\/report\/INV-/.test(reportUrl), reportUrl)
await p.reload({ waitUntil: 'load' })
await p.locator('.verdict-card').waitFor({ timeout: 10000 }).catch(() => {})
ok('Refresh stays on the report', p.url() === reportUrl && (await p.locator('.verdict-card').count()) === 1)
await p.goBack(); await p.waitForTimeout(800)
ok('Back goes to the previous page', p.url().endsWith('#/') || p.url().endsWith('#/new'), p.url())
await p.goForward(); await p.locator('.verdict-card').waitFor({ timeout: 10000 }).catch(() => {})
ok('Forward returns to the report', p.url() === reportUrl && (await p.locator('.verdict-card').count()) === 1)

// Accessibility: focus returns to the trigger; every button has a name; current nav item is marked
await p.getByRole('tab', { name: /Town view/ }).click(); await p.waitForTimeout(500)
const trigger = p.getByRole('navigation', { name: /Houses in the town/ }).getByRole('button', { name: /Required income document/ })
await trigger.click(); await p.waitForTimeout(600)
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
ok('Drawer: Escape closes and focus returns to the house button', await trigger.evaluate((el) => el === document.activeElement))
const draft = p.getByRole('button', { name: 'Draft query email' }).first()
await draft.click(); await p.waitForTimeout(1500)
const trapped = await p.evaluate(() => document.querySelector('.email-modal').contains(document.activeElement))
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
ok('Modal: focus is trapped inside, Escape returns focus to the trigger', trapped && await draft.evaluate((el) => el === document.activeElement))
const unnamed = await p.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('title'))).map((el) => el.outerHTML.slice(0, 80)))
ok('Every button has an accessible name', unnamed.length === 0, unnamed.join(' | '))
ok('Current nav item has aria-current="page"', (await p.locator('.sidebar [aria-current="page"]').count()) === 1)
ok('No console errors', p.errors.length === 0 && limited.errors.length === 0, [...p.errors, ...limited.errors].join(' | '))

await b.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
