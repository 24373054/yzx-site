/** Project entries rendered on the home page and /work. */
export interface Project {
  /** Stable anchor id. */
  slug: string
  title: string
  /** Short description of what the thing is. */
  summary: string
  /** What I did on it. */
  role: string
  year: string
  tags: string[]
  href?: string
  /** Shown as a small status chip when set. */
  status?: '进行中' | '已上线' | '开源' | '实验'
  /** Highlighted on the home page. */
  featured?: boolean
}

export const projects: Project[] = [
  {
    slug: 'harness-console',
    title: 'Harness 控制台',
    summary:
      '为 AI 编程助手设计的桌面级工作台界面：三栏布局、流式会话、工具调用可视化，一套令牌同时支撑明暗两套主题。',
    role: '产品设计 · 前端实现',
    year: '2025',
    tags: ['TypeScript', 'React', 'CSS Modules'],
    status: '已上线',
    featured: true,
  },
  {
    slug: 'atlas-docs',
    title: 'Atlas 文档站',
    summary:
      '面向 40 万行代码库的文档系统。搜索索引、版本切换、国际化全部在构建期完成，运行时只发 HTML 和一份 8 KB 脚本。',
    role: '架构 · 实现',
    year: '2025',
    tags: ['Astro', 'MDX', 'Pagefind'],
    status: '开源',
    featured: true,
  },
  {
    slug: 'pulse-monitor',
    title: 'Pulse 监测面板',
    summary:
      '边缘函数加时序可视化的轻量监控：冷启动低于 5 ms，首屏 12 KB，告警走 Webhook 而不是常驻轮询。',
    role: '全栈',
    year: '2024',
    tags: ['Cloudflare Workers', 'D1', 'Canvas'],
    status: '实验',
    featured: true,
  },
  {
    slug: 'kerning-lab',
    title: 'Kerning Lab',
    summary:
      '浏览器里的可变字体排版实验：测量字距、对比渲染结果、一键导出可复用的 CSS 变量。',
    role: '设计工程',
    year: '2024',
    tags: ['Variable Fonts', 'Canvas', 'Web Audio'],
    status: '实验',
  },
]

export const featuredProjects = projects.filter(project => project.featured)
