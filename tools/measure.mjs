import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' })

const data = await page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.baseVal === undefined ? el.className : '') || '',
      top: Math.round(r.top + scrollY),
      h: Math.round(r.height),
      pad: cs.paddingTop + ' / ' + cs.paddingBottom,
      margin: cs.marginTop + ' / ' + cs.marginBottom,
      minH: cs.minHeight,
      opacity: cs.opacity,
      display: cs.display,
    }
  }
  const out = []
  out.push(box(document.body))
  for (const sel of ['header', 'main', 'footer', '.hero', '.hero > *', '.section', '.section-head', '.rows', '.site-footer']) {
    document.querySelectorAll(sel).forEach((el) => out.push({ sel, ...box(el) }))
  }
  return {
    out,
    bodyDisplay: getComputedStyle(document.body).display,
    mainDisplay: getComputedStyle(document.querySelector('main')).display,
    scrollH: document.documentElement.scrollHeight,
    anchors: [...document.querySelectorAll('a[href^="#"]')].length,
  }
})
console.log(JSON.stringify(data, null, 1))
await browser.close()
