// Walks the main flow, saves screenshots to docs/screenshots and fails on any console error.
// Usage: start backend (8000) and frontend (5173), then `npm run screenshots`.
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots')
mkdirSync(OUT, { recursive: true })

const problems = []
// Use the real GPU (d3d11 on Windows); software GL makes the 3D town too slow to drive reliably.
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function newPage(viewport) {
  const page = await browser.newPage({ viewport })
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[console ${viewport.width}] ${msg.text()}`) })
  page.on('pageerror', (err) => problems.push(`[pageerror ${viewport.width}] ${err.message}`))
  return page
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).then(() => console.log('saved', name))

const page = await newPage({ width: 1440, height: 900 })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(4500)
await shot(page, '01-overview')

await page.getByRole('button', { name: 'Start an investigation' }).click()
await page.waitForTimeout(400)
await shot(page, '02-new-investigation')

// Validation: an invalid URL shows an inline error.
const firstUrl = page.getByLabel('Source 3 web address')
await firstUrl.fill('not a url')
await page.getByRole('button', { name: /Investigate sources/ }).click()
await page.waitForTimeout(300)
if (!(await page.getByText('Use a full web address').count())) problems.push('validation error not shown')
await firstUrl.fill('')

await page.getByRole('button', { name: /Investigate sources/ }).click()
await page.waitForTimeout(2200)
await shot(page, '03-analyzing')

// With an AI key the run is live (real pages); without one it replays the labelled sample.
await page.getByRole('tab', { name: /Town view/ }).waitFor({ timeout: 240000 })
await page.waitForTimeout(2500)
if (await page.getByText('LIVE ANALYSIS').count()) {
  await shot(page, '14-live-report-town')
  // The remaining shots use the sample case so they show every status.
  await page.getByRole('button', { name: 'Overview' }).click()
  await page.getByRole('button', { name: 'Open the sample case' }).click()
  await page.waitForTimeout(2500)
}
await shot(page, '04-report-town')

await page.getByRole('navigation', { name: /Houses in the town/ }).getByRole('button', { name: /Required income document/ }).click()
await page.waitForTimeout(1800)
await shot(page, '05-drawer-conflict')
await page.getByRole('button', { name: 'Save finding' }).click()
if (!(await page.getByRole('button', { name: 'Saved' }).count())) problems.push('Save finding did not toggle')
await page.keyboard.press('Escape')
if (await page.getByRole('dialog').count()) problems.push('Escape did not close the drawer')

await page.getByRole('button', { name: /Table view/ }).click()
await page.waitForTimeout(500)
await shot(page, '06-report-table')
await page.getByRole('heading', { name: 'Verify next' }).scrollIntoViewIfNeeded()
await shot(page, '07-report-verify-next')

await page.getByRole('button', { name: /Case board/ }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: /Case board/ }).scrollIntoViewIfNeeded()
await shot(page, '13-case-board')
await page.getByRole('button', { name: /Draft a question to the authority/ }).first().click()
await page.waitForTimeout(800)
await page.keyboard.press('Escape')
await page.getByRole('button', { name: 'Draft query email' }).first().click()
await page.waitForTimeout(800)
await shot(page, '08-email-modal')
await page.keyboard.press('Escape')

await page.getByRole('button', { name: /Saved findings/ }).click()
await page.waitForTimeout(500)
if (!(await page.getByRole('heading', { name: 'Required income document' }).count())) problems.push('saved finding not listed')
await shot(page, '16-saved-findings')
await page.getByRole('button', { name: /^Source DNA/ }).click()
await page.waitForTimeout(500)
if (!(await page.getByText('Likely copied').count())) problems.push('Source DNA did not show the copied pair')
await shot(page, '17-source-dna')

const mobile = await newPage({ width: 375, height: 812 })
await mobile.goto(BASE, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(2000)
await shot(mobile, '09-mobile-overview')
await mobile.getByRole('button', { name: 'Open the sample case' }).click()
await mobile.waitForTimeout(2500)
await shot(mobile, '10-mobile-report')
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
if (overflow > 1) problems.push(`mobile horizontal overflow: ${overflow}px`)

const tablet = await newPage({ width: 768, height: 1024 })
await tablet.goto(BASE, { waitUntil: 'networkidle' })
await tablet.getByRole('button', { name: 'Open the sample case' }).click()
await tablet.waitForTimeout(2500)
await shot(tablet, '11-tablet-report')
const tabletOverflow = await tablet.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
if (tabletOverflow > 1) problems.push(`tablet horizontal overflow: ${tabletOverflow}px`)

await browser.close()
if (problems.length) {
  console.error('\nProblems found:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('\nAll screens captured; console clean.')
