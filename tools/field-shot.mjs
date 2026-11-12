/**
 * Focused capture of the homepage ASCII field only — the fast feedback loop
 * while tuning the wind, density and palette.
 *
 * Usage: node tools/field-shot.mjs [light|dark|both]
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4321'
const which = process.argv[2] ?? 'both'
mkdirSync('.shots', { recursive: true })

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

for (const theme of which === 'both' ? ['light', 'dark'] : [which]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
    colorScheme: theme,
  })
  await context.addInitScript(
    (preference) => localStorage.setItem('site-theme', JSON.stringify({ preference })),
    theme,
  )
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const field = page.locator('.field')
  await field.screenshot({ path: `.shots/field-${theme}.png` })
  console.log(theme, 'errors:', errors.length ? errors : 'none')
  await context.close()
}

await browser.close()
