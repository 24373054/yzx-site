import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('.shots', { recursive: true })
const BASE = 'http://127.0.0.1:4321'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const capture = async (name, { theme = 'light', width = 1440, height = 900 } = {}) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1.5,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.stage.is-live', { timeout: 8000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `.shots/${name}-idle.png` })

  // Sweep a pointer across the stage like a hand over grass, then pause and
  // capture the wake.
  const stage = await page.locator('.stage').boundingBox()
  const startX = stage.x + stage.width * 0.18
  const startY = stage.y + stage.height * 0.72
  const endX = stage.x + stage.width * 0.78
  const endY = stage.y + stage.height * 0.34
  await page.mouse.move(startX, startY)
  for (let step = 1; step <= 40; step += 1) {
    const t = step / 40
    await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(60)
  await page.screenshot({ path: `.shots/${name}-wake.png` })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `.shots/${name}-settle.png` })
  const metrics = await page.evaluate(() => {
    const items = performance.getEntriesByType('navigation')
    return { domNodes: document.querySelectorAll('*').length, nav: items.length }
  })
  await context.close()
  return { name, errors, metrics }
}

const results = []
results.push(await capture('30-live-light'))
results.push(await capture('31-live-dark', { theme: 'dark' }))
results.push(await capture('32-live-mobile', { theme: 'light', width: 390, height: 844 }))

console.log(JSON.stringify(results, null, 1))
await browser.close()
