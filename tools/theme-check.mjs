import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await browser.newPage({ colorScheme: 'dark' })
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' })
const read = () =>
  page.evaluate(() => ({
    source: document.documentElement.dataset.dsThemeSource,
    darkBody: document.body.hasAttribute('data-ds-dark-theme'),
    canvas: getComputedStyle(document.documentElement).backgroundColor,
    stored: localStorage.getItem('site-theme'),
    pressed: [...document.querySelectorAll('[data-theme-set]')].map((b) => `${b.dataset.themeSet}:${b.getAttribute('aria-pressed')}`).join(','),
  }))
console.log('initial', JSON.stringify(await read()))
await page.click('[data-theme-set="light"]')
await page.waitForTimeout(150)
console.log('light  ', JSON.stringify(await read()))
await page.click('[data-theme-set="dark"]')
await page.waitForTimeout(150)
console.log('dark   ', JSON.stringify(await read()))
await page.reload({ waitUntil: 'load' })
console.log('reload ', JSON.stringify(await read()))
await browser.close()
