import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ javaScriptEnabled: false, colorScheme: scheme })
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' })
  const r = await page.evaluate(() => {
    const cs = getComputedStyle(document.body)
    const html = getComputedStyle(document.documentElement)
    return {
      canvas: html.backgroundColor,
      text: cs.color,
      titleVisible: getComputedStyle(document.querySelector('h1')).color,
    }
  })
  console.log('no-js', scheme, JSON.stringify(r))
  await page.close()
}

await browser.close()
