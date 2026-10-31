// Plays the 30-second tour and screenshots each step (docs/screenshots/tour-*.png).
import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(process.env.BASE_URL || 'http://localhost:5173', { waitUntil: 'load' })
await p.waitForTimeout(3500)
await p.screenshot({ path: '../docs/screenshots/18-first-visit.png' })
await p.getByRole('button', { name: 'Start', exact: true }).click()
for (let i = 1; i <= 6; i += 1) {
  await p.waitForTimeout(i === 1 ? 1500 : 2200)
  const title = await p.locator('#tour-title').innerText()
  await p.screenshot({ path: `../docs/screenshots/tour-${i}.png` })
  console.log(i, title)
  if (i < 6) await p.getByRole('button', { name: /^Next/ }).click()
}
await p.getByRole('button', { name: 'Start an investigation' }).last().click()
await p.waitForTimeout(600)
console.log('ended on:', await p.locator('.crumb b').innerText(), '| errors:', errors.length ? errors : 'none')
await b.close()
