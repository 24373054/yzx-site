import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
const info = await page.evaluate(() => {
  const still = document.querySelector('.field__still')
  const cs = getComputedStyle(still)
  return { opacity: cs.opacity, bg: cs.backgroundImage.slice(0, 60), w: still.getBoundingClientRect().width }
}).catch(e => String(e))
console.log(JSON.stringify(info))
await page.screenshot({ path: '.shots/nojs-home.png' })
await browser.close()
