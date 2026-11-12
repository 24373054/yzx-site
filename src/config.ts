/**
 * Site identity and chrome. Device: everything visible on the site comes from
 * here or from CSS — no placeholder copy, no invented projects, no sample post.
 * The content layer (works, writing, about) returns when real copy exists.
 */
export const site = {
  /** Production URL. Keep in sync with `site` in astro.config.mjs. */
  url: 'https://yzx.example.com',
  /** Short brand: the mark in the header and the document title. */
  title: 'YZX',
  /** Used in the footer copyright line. */
  name: 'YZX',
  /** Meta description only — never rendered on the page. */
  description: 'YZX 的个人网站。',
  socials: [{ label: 'GitHub', href: 'https://github.com/24373054' }],
  /** Section navigation: the page is one document, so these are anchors. */
  nav: [
    { label: '\u4f5c\u54c1', href: '#work' },
    { label: '\u8054\u7cfb', href: '#contact' },
  ] as ReadonlyArray<{ label: string; href: string }>,
} as const

export type Site = typeof site
