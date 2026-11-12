import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('.shots', { recursive: true })
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const BASE = 'http://127.0.0.1:4321'

// Mobile article with a table + code block, so both can be judged at 390px.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/writing/static-first`, { waitUntil: 'networkidle' })
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const offenders = [...document.querySelectorAll('.prose table, .prose pre, .prose img')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      width: Math.round(el.getBoundingClientRect().width),
      scroll: el.scrollWidth,
    }))
    return { pageOverflow: root.scrollWidth - root.clientWidth, offenders }
  })
  console.log('mobile-article', JSON.stringify(overflow))
  await page.screenshot({ path: '.shots/13-mobile-article.png', fullPage: true })
  await page.locator('.prose table').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: '.shots/14-mobile-table.png' })
  await context.close()
}

// No-JavaScript behaviour in both OS schemes.
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1240, height: 860 },
    colorScheme: scheme,
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  const state = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return {
      canvas: getComputedStyle(root).backgroundColor,
      text: getComputedStyle(body).color,
      lede: getComputedStyle(document.querySelector('.lede')).color,
      source: root.dataset.dsThemeSource ?? null,
    }
  })
  console.log('no-js', scheme, JSON.stringify(state))
  await page.screenshot({ path: `.shots/15-nojs-${scheme}.png` })
  await context.close()
}

await browser.close()
