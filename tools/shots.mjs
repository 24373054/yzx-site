import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4321'
const OUT = '.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const report = []

async function pageFor(scheme, width, height, motion) {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width, height },
    deviceScaleFactor: 1.5,
    reducedMotion: motion,
  })
  const page = await context.newPage()
  return { context, page }
}

/** Static (motion reduced) full-page captures — every reveal state is resolved. */
async function capture(name, path, { scheme = 'light', width = 1440, height = 1000 } = {}) {
  const { context, page } = await pageFor(scheme, width, height, 'reduce')
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  const state = await page.evaluate(() => {
    const root = document.documentElement
    const overflowing = [...document.querySelectorAll('main *')]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className?.toString().slice(0, 40)}`)
    return {
      overflowX: root.scrollWidth - root.clientWidth,
      overflowing,
      height: root.scrollHeight,
      canvas: getComputedStyle(root).backgroundColor,
    }
  })
  report.push({ name, errors, ...state })
  await context.close()
}

await capture('01-home-light', '/')
await capture('02-home-dark', '/', { scheme: 'dark' })
await capture('03-work-light', '/work')
await capture('04-writing-light', '/writing')
await capture('05-post-light', '/writing/static-first')
await capture('06-post-dark', '/writing/tokens-not-variables', { scheme: 'dark' })
await capture('07-about-light', '/about')
await capture('08-404-light', '/does-not-exist')
await capture('09-home-mobile', '/', { width: 390, height: 844 })
await capture('10-post-mobile', '/writing/building-with-tokens', { width: 390, height: 844 })
await capture('11-work-mobile', '/work', { width: 390, height: 844, scheme: 'dark' })

/** Above-the-fold frames with motion enabled — how a visitor actually lands. */
for (const [name, scheme, width, height] of [
  ['20-fold-light', 'light', 1440, 900],
  ['21-fold-dark', 'dark', 1440, 900],
  ['22-fold-mobile-light', 'light', 390, 844],
  ['23-fold-mobile-dark', 'dark', 390, 844],
]) {
  const { context, page } = await pageFor(scheme, width, height, 'no-preference')
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  await context.close()
}

await browser.close()
console.log(JSON.stringify(report, null, 1))
