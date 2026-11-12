/**
 * Captures the still frames that sit behind the ASCII field for reduced-motion
 * and no-JS visitors. They are the live canvas' own pixels at its very first
 * frame, which starts at STATIC_TIME — so the handover from still to animation
 * is invisible. Reading the bitmap with toDataURL (instead of screenshotting the
 * element) keeps page background and the existing still out of the capture.
 *
 * Usage: node tools/make-field-stills.mjs [url]
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const url = process.argv[2] ?? 'http://127.0.0.1:4321/'
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const browser = await chromium.launch({ executablePath, headless: true })

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  await context.addInitScript(
    (preference) => localStorage.setItem('site-theme', JSON.stringify({ preference })),
    theme,
  )
  const page = await context.newPage()
  await page.goto(url + '?still', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.stage')?.classList.contains('is-live'),
    null,
    { timeout: 20000 },
  )
  const capture = await page.evaluate(() => {
    const canvas = document.querySelector('.stage__canvas')
    return canvas instanceof HTMLCanvasElement
      ? { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
      : null
  })
  if (!capture) throw new Error('canvas not found')
  writeFileSync(`docs/field-${theme}.png`, Buffer.from(capture.data.split(',')[1], 'base64'))
  console.log(theme, `${capture.width}x${capture.height}`)
  await context.close()
}

await browser.close()
