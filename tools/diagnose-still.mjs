/** Diagnose what is visible inside the hero field with reduced motion (still only). */
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  await context.addInitScript(
    (preference) => localStorage.setItem('site-theme', JSON.stringify({ preference })),
    theme,
  )
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const field = document.querySelector('.field')
    const still = document.querySelector('.field__still')
    const canvas = document.querySelector('.field__canvas')
    const cs = getComputedStyle(still)
    return {
      field: field?.getBoundingClientRect().toJSON(),
      canvas: { width: canvas?.width, height: canvas?.height, rect: canvas?.getBoundingClientRect().toJSON() },
      stillRect: still?.getBoundingClientRect().toJSON(),
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      opacity: cs.opacity,
      live: field?.classList.contains('is-live'),
    }
  })
  console.log(theme, JSON.stringify(info))
  await page.locator('.field').screenshot({ path: `.shots/still-panel-${theme}.png` })
  await context.close()
}
await browser.close()
