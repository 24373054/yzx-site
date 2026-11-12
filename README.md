# YZX

个人网站。现在它是一层全幅的生成艺术、四张作品印张、一个联系方式——
**没有任何占位文案**：真实内容还没提供，所以界面先用形状和留白把结构说清楚。

![首页浅色](docs/preview/home-light.jpg)
![首页深色](docs/preview/home-dark.jpg)

| 移动端（浅色） | 移动端（深色） |
| --- | --- |
| ![移动端浅色](docs/preview/mobile-light.jpg) | ![移动端深色](docs/preview/mobile-dark.jpg) |

## 技术栈

| 层 | 选择 | 为什么 |
| --- | --- | --- |
| 框架 | Astro 7（纯静态输出） | 页面是静态的，构建产物只有 HTML/CSS/一个模块脚本；没有运行时框架 |
| 语言 | TypeScript | 一次性写对，改起来放心 |
| 设计系统 | `dsh-ui-kit` 的 tokens + theme 运行时（vendored，MIT） | 颜色、排版、明暗主题都是现成的语义令牌，不引 UI 框架 |
| 艺术层 | Canvas 2D，手写 ~470 行 | 不引入 three.js/动画库；60fps、1.7–4ms/帧 |
| 动效 | CSS scroll-driven + `@view-transition` | 渐进增强，无 JS 也能读 |
| 样式 | 单个全局 `site.css` | 没有 Tailwind：令牌已经提供了设计层 |

字体用系统栈，不下载 webfont；全站 JS ≈ 17 KB，CSS ≈ 26 KB。

## 命令

```bash
pnpm install
pnpm dev        # http://127.0.0.1:4321
pnpm build      # dist/
pnpm preview    # 预览构建产物
pnpm check      # astro check
```

## 目录

```
src/
  config.ts               站点元信息（标题、社交链接、导航）
  layouts/Base.astro      head、首帧主题脚本、skip link
  pages/index.astro       首页：艺术层 + 作品印张 + 联系
  pages/404.astro
  components/             SiteHeader / SiteFooter
  scripts/ascii-field.ts  生成艺术（水流带 + 群游）
  scripts/theme.ts        明暗主题运行时
  design/tokens/          vendored 设计令牌（CSS）
  design/theme/           vendored 主题运行时（DOM-only）
  styles/site.css         站点样式
public/hero-field-*       艺术层静帧（仅 reduced-motion / 无 JS 时下载）
tools/                    截图与静帧生成脚本
```

## 首页的艺术层

不是 ASCII，而是「墨流」：三条水流带（band）承载几百个粒子，沿各自的
spine 曲线游动，`destination-out` 逐帧擦出拖尾，笔画是圆头短线。
指针靠近时，粒子让开、拖出一段，再弹回自己的车道——像鱼群让开鲨鱼。

- **不跳帧**：时间轴 = `STATIC_TIME + elapsed + (now - startedAt)`，resize
  重建时按当前时间重画，不会回到第一帧。
- **性能**：`MAX_CELLS` 已不再是约束；桌面每帧 draw 1.7–4 ms，60fps；
  触屏 30fps。dpr 上限 1（视觉几乎无差，省一半像素）。
- **回退**：`prefers-reduced-motion` 或无 JS 时显示 `public/hero-field-*.avif`
  静帧（约 86–88 KB），静帧由冻结模式渲染，与动画起始帧同刻。
- **暂停**：页脚的 ⏸ 按钮（WCAG 2.2.2），冻结当前帧、恢复时补回暂停时间。
- **生命周期**：离屏 / 隐藏 / `content-visibility` 跳过时停止 rAF；
  `IntersectionObserver` 兜底。

重新生成静帧：

```bash
node tools/make-field-stills.mjs   # 需先 pnpm dev（或在脚本里改 base）
python tools/make-field-webp.py    # 生成 avif/webp + echo 底色 data URI
```

## 作品印张

四张印张是同一套系统的**冻结帧**，用 `seed` 改变流向，所以它们像同一系列
的四幅版画，而不是四张截图；每张在进入视口前 320px 才挂载，避免首屏
一次性 warm 四个 canvas。悬停时轻微放大，边缘用 mask 渐隐，不会露出画布边界。

## 质量检查

| 命令 | 检查什么 |
| --- | --- |
| `pnpm check` | 类型 + Astro 语法 |
| `node tools/theme-check.mjs` | system/light/dark 切换、localStorage、aria-pressed |
| `node tools/nojs-check.mjs` | 关 JS 后画布与文字可读 |
| `node tools/field-pause-check.mjs` | 暂停冻结、恢复继续、aria-label |
| `node tools/live-shot.mjs` | 指针唤醒的前后对比截图 |

Lighthouse 13（移动端模拟，本机 Chrome）：首页
**performance 97 / accessibility 100 / best-practices 100 / SEO 100**，
FCP 0.9 s、LCP 0.9 s、CLS 0、传输约 20 KiB；TBT 约 200 ms，主要是首帧
艺术层的 warm-up，已把印张改为懒挂载降到这个水平。桌面端分数略低一档
（TBT 约 260 ms），因为桌面一次要 warm 的粒子更多。

## 部署

构建产物是纯静态的：`pnpm build` → `dist/`。域名与托管由用户自行决定
（`astro.config.mjs` 里的 `site` 目前是占位值 `https://yzx.example.com`）。

## 已知取舍

- 没有内容：作品标题、文章、关于都等真实内容；现在不写字比写假字好。
- 印张是懒挂载的，第一次滚到那里会有一小段 warm-up 时间（约 100 ms）。
- 艺术层 dpr 限制为 1，在超高 dpi 屏上笔画会略软。

## 致谢

- [dsh-ui-kit](https://github.com/24373054/dsh-ui-kit)：设计令牌与主题运行时（MIT）
- [living-ascii](https://github.com/24373054/living-ascii)：ASCII 草场的视觉语言学
- [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)：现代 Web 规范
