import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' })
await page.waitForSelector('.field.is-live')

const host = page.locator('[data-ascii-field]')
const btn = page.locator('[data-field-toggle]')
const read = () =>
  page.evaluate(() => {
    const host = document.querySelector('[data-ascii-field]')
    const btn = document.querySelector('[data-field-toggle]')
    return {
      paused: host.hasAttribute('data-field-paused'),
      label: btn.getAttribute('aria-label'),
      pressed: btn.getAttribute('aria-pressed'),
    }
  })

const frame = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('.field__canvas')
    const ctx = canvas.getContext('2d')
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let sum = 0
    for (let i = 0; i < data.length; i += 97) sum = (sum + data[i]) % 1e9
    return sum
  })

await btn.click()
const pausedState = await read()
await page.waitForTimeout(120)
const pauseA = await frame()
await page.waitForTimeout(600)
const pauseB = await frame()
const moved = pauseB !== pauseA ? 'changed' : 'static'

await btn.click()
const resumedState = await read()
await page.waitForTimeout(400)
const resumedFrame = await frame()
console.log(
  JSON.stringify(
    {
      pausedState,
      pausedFrame: moved,
      resumedState,
      resumedMoved: resumedFrame !== pauseB,
      errors,
    },
    null,
    1,
  ),
)
await browser.close()
