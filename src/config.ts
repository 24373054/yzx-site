/**
 * Single source of truth for site identity, navigation and contact points.
 * Edit this file first when you fork the template.
 */
export const site = {
  /** Production URL. Keep in sync with `site` in astro.config.mjs. */
  url: 'https://yzx.example.com',
  /** Short brand used in the header mark and document titles. */
  title: 'YZX',
  /** Display name used in prose. */
  name: 'YZX',
  role: '独立开发者 · 界面工程师',
  description:
    'YZX 的个人网站：作品、文章，以及关于设计系统、静态优先与界面工程的笔记。',
  /** Home hero statement. Each entry is a visual line. */
  statement: ['把复杂的事，', '做简单。'],
  /** About page copy. Add or remove lines freely. */
  about: [
    '独立开发者，做网站与界面系统。',
    '喜欢静态优先、零多余依赖、细节到像素的实现方式。',
  ],
  email: 'hello@yzx.dev',
  socials: [{ label: 'GitHub', href: 'https://github.com/24373054' }],
  nav: [
    { label: '作品', href: '/work' },
    { label: '文章', href: '/writing' },
    { label: '关于', href: '/about' },
  ],
} as const

export type Site = typeof site
