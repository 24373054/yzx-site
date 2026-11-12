// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

/** Replace `site` with your real domain before deploying (used by sitemap + canonical URLs). */
export default defineConfig({
  site: 'https://yzx.example.com',
  integrations: [mdx(), sitemap()],
  compressHTML: true,
  prefetch: true,
  devToolbar: { enabled: false },
  markdown: {
    // `github-dark-high-contrast` over `github-dark-dimmed`: the dimmed
    // comment grey (#768390) and the legacy github-dark comment (#6a737d)
    // both drop under 4.5:1 against their code surface, failing WCAG AA.
    shikiConfig: { theme: 'github-dark-high-contrast', wrap: false },
  },
})
