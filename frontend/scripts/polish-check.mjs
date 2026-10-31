// Polish-list checks in a real browser. Usage: node scripts/polish-check.mjs (frontend :5173, backend :8000)
// Set OFFLINE=1 to block the backend (simulates it being stopped) for the demo-mode check.
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OFFLINE = process.env.OFFLINE === '1'
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] })
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const SAMPLE = 'INV-024'

async function open(viewport = { width: 1440, height: 900 }, init = {}) {
  const ctx = await b.newContext({ viewport, acceptDownloads: true })
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)) } }, { 'blindspot.tour.seen': '1', ...init })
  const p = await ctx.newPage()
  p.errors = []
  p.on('console', (m) => { if (m.type() === 'error' || /context lost/i.test(m.text())) p.errors.push(m.text()) })
  p.on('pageerror', (e) => p.errors.push(e.message))
  if (OFFLINE) await p.route('http://localhost:8000/**', (r) => r.abort())
  return p
}

const ROUTES = ['#/', '#/new', `#/report/${SAMPLE}`, '#/history', '#/saved', '#/dna', '#/counsellor']

if (!OFFLINE) {
  // Every page, desktop and 390px: loads, no console errors, no horizontal scroll, refresh keeps the page.
  for (const vp of process.env.QUICK ? [] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const p = await open(vp)
    for (const r of ROUTES) {
      await p.goto(`${BASE}/${r}`, { waitUntil: 'load' })
      await p.waitForTimeout(1600)
      const scroll = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const crashed = await p.locator('.crash-screen').count()
      await p.reload({ waitUntil: 'load' })
      await p.waitForTimeout(900)
      const kept = p.url().endsWith(r) || (r === '#/' && /#\/?$/.test(p.url()))
      ok(`${vp.width}px ${r}: renders, no h-scroll, refresh keeps page`, !crashed && scroll <= 1 && kept, `scroll+${scroll} url=${p.url().split('#')[1]}`)
    }
    // Back works
    await p.goto(`${BASE}/#/history`); await p.waitForTimeout(500); await p.goto(`${BASE}/#/saved`); await p.waitForTimeout(500)
    await p.goBack(); await p.waitForTimeout(600)
    ok(`${vp.width}px Back returns to previous page`, p.url().endsWith('#/history'))
    ok(`${vp.width}px no console errors across pages`, p.errors.length === 0, p.errors.slice(0, 3).join(' | '))
  }

  // Report: default board view, tablist, persisted view, legend, town icons
  let p = await open()
  await p.goto(`${BASE}/#/report/${SAMPLE}`); await p.waitForSelector('.verdict-card')
  ok('Default view is Case board', await p.locator('[role=tab][aria-selected=true]').innerText().then((t) => t.includes('Case board')))
  await p.locator('.verdict-more summary').click()
  const whyItems = await p.locator('.why-list .why-link').count()
  ok('Why names specific items (linked)', whyItems >= 1, `${whyItems} linked reasons`)
  ok('Verdict ladder highlights current', (await p.locator('.verdict-ladder li.current').count()) === 1)
  await p.locator('[role=tab]', { hasText: 'Table' }).click()
  ok('Table tab responds after Why expanded', await p.locator('.findings-panel').isVisible())
  await p.locator('[role=tab][aria-selected=true]').press('ArrowLeft')
  ok('Arrow keys move between tabs', await p.locator('[role=tab][aria-selected=true]').innerText().then((t) => t.includes('Town')))
  await p.waitForTimeout(2500)
  ok('Town legend visible', await p.locator('.town-legend').isVisible())
  const icons = await p.locator('.house-list .tl-icon').evaluateAll((els) => els.map((e) => [e.className, e.textContent]))
  const map = { 'supported': '★', 'conflict': '⚡', 'outdated': '🕸', 'missing': '???', 'unverified': '☁' }
  ok('House list icons match statuses', icons.every(([c, t]) => map[c.split('s-')[1]] === t), JSON.stringify(icons.map((i) => i[1])))
  await p.reload(); await p.waitForSelector('.verdict-card')
  ok('Last view persisted', await p.locator('[role=tab][aria-selected=true]').innerText().then((t) => t.includes('Town')))
  ok('Strength badges in house list', (await p.locator('.house-list .strength').count()) > 0)
  // Drawer + save toast
  await p.locator('.house-list button').first().click()
  await p.waitForSelector('.detail-drawer')
  ok('Drawer shows strength badge', (await p.locator('.detail-drawer .strength').count()) === 1)
  const saveBtn = p.locator('.detail-drawer button', { hasText: /Save finding|Saved/ })
  if ((await saveBtn.innerText()).includes('Saved')) { await saveBtn.click(); await p.waitForTimeout(200) }
  await saveBtn.click()
  ok('Save toast has link to Saved findings', await p.locator('.toast-message button', { hasText: 'Open Saved findings' }).isVisible())
  await p.keyboard.press('Escape')
  // Export
  const title = await p.evaluate(() => { let t = ''; const orig = window.print; window.print = () => { t = document.title }; [...document.querySelectorAll('.report-title-actions button')].find((b) => /Export/.test(b.textContent)).click(); window.print = orig; return t })
  ok('Export file name blindspot-<id>-<date>', /^blindspot-INV-024-\d{4}-\d{2}-\d{2}$/.test(title), title)
  await p.emulateMedia({ media: 'print' })
  const pr = await p.evaluate(() => ({ screen: getComputedStyle(document.querySelector('.report-screen')).display, print: document.querySelector('.print-report').innerText.length, side: getComputedStyle(document.querySelector('.sidebar')).display }))
  ok('Print shows clean report only', pr.screen === 'none' && pr.print > 500 && pr.side === 'none', JSON.stringify(pr))
  await p.pdf({ path: 'screenshots/export-sample.pdf', format: 'A4' }).catch(() => {})
  await p.emulateMedia({ media: 'screen' })

  // Hindi: static strings switch, report translation (first + second time)
  await p.goto(`${BASE}/#/history`); await p.waitForTimeout(600)
  const live = await p.evaluate(() => JSON.parse(localStorage.getItem('blindspot.history.v1') || '[]')[0]?.investigation_id)
  const target = live || SAMPLE
  await p.goto(`${BASE}/#/report/${target}`); await p.waitForSelector('.verdict-card')
  let t0 = Date.now()
  await p.locator('.lang-toggle').click()
  await p.waitForFunction(() => document.querySelector('.inline-note.hindi, .inline-note.error'), null, { timeout: 30000 }).catch(() => {})
  const first = (Date.now() - t0) / 1000
  const hiOk = await p.locator('.inline-note.hindi').count()
  ok(`Hindi first time (${target})`, hiOk > 0, `${first.toFixed(1)} s ${hiOk ? '' : await p.locator('.inline-note.error').innerText().catch(() => 'no note')}`)
  ok('Static UI strings in Hindi', (await p.locator('.verdict-kicker').innerText()).includes('फ़ैसला') || /[ऀ-ॿ]/.test(await p.locator('.verdict-kicker').innerText()))
  await p.reload(); t0 = Date.now()
  await p.waitForSelector('.inline-note.hindi', { timeout: 10000 }).catch(() => {})
  ok('Hindi second time under 5 s', hiOk > 0 && (Date.now() - t0) / 1000 < 5, `${((Date.now() - t0) / 1000).toFixed(2)} s`)
  await p.locator('.lang-toggle').click()

  // Mobile: board one column, drawer full screen
  const m = await open({ width: 390, height: 844 })
  await m.goto(`${BASE}/#/report/${SAMPLE}`); await m.waitForSelector('.case-board')
  const cols = await m.evaluate(() => getComputedStyle(document.querySelector('.case-board')).gridTemplateColumns.split(' ').length)
  ok('390px case board is one column', cols === 1, `${cols} cols`)
  await m.locator('.board-card .text-link').first().click(); await m.waitForSelector('.detail-drawer')
  const dw = await m.evaluate(() => document.querySelector('.detail-drawer').getBoundingClientRect().width)
  ok('390px drawer is full screen', dw >= 388, `${dw}px`)
  await m.keyboard.press('Escape')
  await m.locator('.mobile-menu').click()
  ok('390px menu opens from top bar', await m.locator('.sidebar.mobile-visible').isVisible())

  // WebGL contexts over 10 page switches
  const g = await open()
  for (let i = 0; i < 10; i += 1) { await g.goto(`${BASE}/${i % 2 ? '#/' : `#/report/${SAMPLE}`}`); await g.waitForTimeout(900); if (i % 2 === 0) await g.locator('[role=tab]', { hasText: 'Town' }).click().catch(() => {}); await g.waitForTimeout(700) }
  ok('No WebGL context-lost warnings over 10 switches', !g.errors.some((e) => /context lost|too many active webgl/i.test(e)), g.errors.slice(0, 2).join(' | '))

  // Tour: invite, escape closes, no navigation after close
  const tp = await open(undefined, { 'blindspot.tour.seen': '0' })
  await tp.goto(`${BASE}/#/`); await tp.waitForTimeout(1200)
  ok('Tour invite asks "Take the 30-second tour?"', await tp.locator('.tour-invite', { hasText: 'Take the 30-second tour?' }).isVisible())
  await tp.locator('.tour-invite button', { hasText: 'Start' }).click(); await tp.waitForTimeout(300)
  await tp.locator('.tour-card .primary-button', { hasText: 'Next' }).click(); await tp.waitForTimeout(100)
  await tp.keyboard.press('Escape')
  const at = tp.url(); await tp.waitForTimeout(3000)
  ok('Escape closes tour and it never navigates after', (await tp.locator('.tour-layer').count()) === 0 && tp.url() === at, `${at} → ${tp.url()}`)

  // Saved: seeded sample
  const sv = await open()
  await sv.goto(`${BASE}/#/saved`); await sv.waitForTimeout(800)
  ok('Saved seeds one Sample finding', (await sv.locator('.saved-card .sample-tag').count()) >= 1)
  // DNA: thin case falls back to sample + graph
  await sv.goto(`${BASE}/#/dna`); await sv.waitForTimeout(1000)
  ok('DNA shows node graph', (await sv.locator('.dna-graph svg .dna-node').count()) >= 2)
} else {
  // Backend stopped: Demo mode runs a saved demo run end to end.
  const p = await open(undefined, { 'blindspot.demoMode': '1' })
  await p.goto(`${BASE}/#/new`); await p.waitForSelector('.ni-form')
  await p.locator('.topic-chip', { hasText: 'Internship' }).click()
  await p.locator('button[type=submit]').click()
  await p.waitForSelector('.source-progress li', { timeout: 8000 }).catch(() => {})
  ok('Offline demo shows per-source progress', (await p.locator('.source-progress li').count()) > 0)
  await p.waitForSelector('.verdict-card', { timeout: 15000 }).catch(() => {})
  ok('Offline demo opens a Saved demo run', (await p.locator('.demo-run-badge').count()) > 0, p.url())
  await p.goto(`${BASE}/#/history`); await p.waitForTimeout(500)
  ok('History lists 4 saved demo runs', (await p.locator('.history-row .demo-run-badge').count()) === 4)
  ok('No uncaught errors offline', !p.errors.some((e) => !/Failed to load resource|ERR_FAILED|net::/.test(e)), p.errors.filter((e) => !/Failed to load resource|net::/.test(e)).slice(0, 3).join(' | '))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
await b.close()
process.exit(failed.length ? 1 : 0)
