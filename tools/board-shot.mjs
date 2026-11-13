import { chromium } from 'playwright-core'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base = process.env.BASE || 'http://127.0.0.1:4321'

const browser = await chromium.launch({ executablePath: chrome })

const shoot = async (name, opts) => {
  const context = await browser.newContext(opts)
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.stage.is-live', { timeout: 15000 })
  await page.waitForTimeout(900)
  // Walk the page so view() reveals and lazy prints mount before the shot.
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.6)
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 130))
    }
    scrollTo(0, 0)
    await new Promise((resolve) => setTimeout(resolve, 260))
  })
  await page.waitForTimeout(900)
  // Full-page capture freezes scroll-driven reveals at their scroll-0 state, so
  // flatten them for the shot; the animations themselves are checked separately.
  await page.addStyleTag({
    content:
      '@media (prefers-reduced-motion: no-preference){.sec__head,.sec,.plate,.contact,.card,.stage{animation:none!important;opacity:1!important;translate:0!important;scale:1!important}}',
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `.shots/${name}.png`, fullPage: true })
  const prints = await page.evaluate(() => document.querySelectorAll('.plate__art.is-live').length)
  console.log(name, 'prints', prints)
  const box = await page.locator('.board').boundingBox()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(name, JSON.stringify({ board: box && [Math.round(box.width), Math.round(box.height)], overflow, errors }))
  await context.close()
}

await shoot('v2-light', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5, colorScheme: 'light' })
await shoot('v2-dark', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5, colorScheme: 'dark' })
await shoot('v2-mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' })
await shoot('v2-mobile-dark', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' })

// The viewer: open the first print and let the frozen canvas paint.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 })
  const page = await context.newPage()
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.stage.is-live', { timeout: 15000 })
  await page.locator('[data-print-open]').first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: '.shots/v2-viewer.png' })
  const dialog = await page.evaluate(() => {
    const el = document.querySelector('#print-viewer')
    if (!(el instanceof HTMLDialogElement)) return null
    return { open: el.open, title: document.querySelector('#viewer-title')?.textContent, meta: document.querySelector('[data-viewer-meta]')?.textContent }
  })
  console.log('viewer', JSON.stringify(dialog))
  await context.close()
}

await browser.close()
