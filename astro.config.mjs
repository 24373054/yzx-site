// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

/** Replace `site` with your real domain before deploying (used by sitemap + canonical URLs). */
export default defineConfig({
  site: 'https://yzx.example.com',
  integrations: [sitemap()],
  compressHTML: true,
  prefetch: true,
  devToolbar: { enabled: false },
})
