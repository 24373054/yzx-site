/**
 * Single source of truth for site identity, navigation and contact points.
 * Everything a visitor can read about "who owns this site" lives here — edit
 * this file first when you fork the template.
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
  /** Hero statement. Two visual lines on desktop. */
  statement: ['把复杂的事，', '做简单。'],
  lede:
    '独立开发者，做网站、工具与界面系统。偏爱静态优先、零多余依赖、细节到像素的实现方式。',
  availability: '可接新的合作',
  email: 'hello@yzx.dev',
  location: '中国 · 远程',
  socials: [
    { label: 'GitHub', href: 'https://github.com/24373054' },
    { label: 'Email', href: 'mailto:hello@yzx.dev' },
    { label: '即刻', href: 'https://okjike.com' },
  ],
  nav: [
    { label: '作品', href: '/work' },
    { label: '文章', href: '/writing' },
    { label: '关于', href: '/about' },
  ],
  /** Stack note shown in the footer colophon. */
  colophon: 'Astro 7 · DSH 设计令牌 · 零框架运行时',
} as const

export type Site = typeof site
