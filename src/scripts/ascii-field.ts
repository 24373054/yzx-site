/**
 * ASCII wind field — a canvas 2D art layer with no dependencies.
 *
 * The visual language is borrowed from github.com/yusen-dev/living-ascii (MIT):
 * a field of short strokes whose angle follows a wind function, a palette read
 * per cell, film grain on top. Here it is drawn on a 2D canvas instead of a
 * WebGL shader: at portfolio-header size the cell count stays around 10–14k,
 * which one canvas repaint per 33 ms handles comfortably.
 *
 * Rules this file keeps:
 * - It is decorative: the canvas is aria-hidden and the static fallback image
 *   behind it is the same artwork, so a no-JS or reduced-motion visitor sees art
 *   rather than an empty box.
 * - The loop stops when the page is hidden, when the field scrolls off-screen
 *   (`contentvisibilityautostatechange`, with IntersectionObserver as the older
 *   fallback) and never starts under `prefers-reduced-motion: reduce`.
 * - Nothing here decides the theme: the palette is read from CSS custom
 *   properties, so light/dark stays a stylesheet concern.
 */

const ANGLE_BINS = 8
const WEIGHT_STEPS = 4
const TONE_STEPS = 14

/** The stills are generated at this time; the animation starts here too so the
 *  swap from the fallback image to the live canvas is invisible. */
export const STATIC_TIME = 11.5

const FRAME_MS = 33 // 30 fps is plenty for a slow drift and half the paint cost
const MAX_CELLS = 14000
/** Width-to-height of the coordinate space the wind is sampled in, so a narrow
 *  panel samples the same landscape instead of stretching it. */
const WORLD_ASPECT = 2.8

type RGB = readonly [number, number, number]

interface Palette {
  tones: RGB[]
  alpha: number
  grain: string
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Stable pseudo-random value for a cell — no state, same input same output. */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const parseHex = (value: string): RGB => {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value.trim())
  if (!match) return [120, 150, 255]
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

/** Tone ramp: tone-1 → tone-2 at the middle → tone-3 at the end. */
const toneAt = (tones: RGB[], t: number): RGB => {
  const scaled = clamp(t, 0, 1) * (tones.length - 1)
  const i = Math.min(tones.length - 2, Math.floor(scaled))
  return mix(tones[i], tones[i + 1], scaled - i)
}

const readPalette = (root: HTMLElement): Palette => {
  const cs = getComputedStyle(root)
  const tones = [1, 2, 3].map((i) => parseHex(cs.getPropertyValue(`--field-tone-${i}`)))
  const alpha = Number.parseFloat(cs.getPropertyValue('--field-alpha')) || 0.75
  const grain = cs.getPropertyValue('--field-grain').trim() || 'rgba(255, 255, 255, 0.5)'
  return { tones, alpha, grain }
}

/**
 * Stroke sprite factory. Building all 14 tones × 4 weights × 8 angles up front
 * means 448 tiny canvases before the first frame — a visible long task on a
 * throttled phone. Instead each (tone, weight, bin) sprite is drawn the first
 * time a cell asks for it and cached; one frame only uses a fraction of them.
 */
const createAtlas = (cell: number, palette: Palette) => {
  const w = cell
  const h = Math.round(cell * 1.35)
  const cache = new Map<number, HTMLCanvasElement | null>()

  const make = (toneIndex: number, weight: number, bin: number): HTMLCanvasElement | null => {
    const sprite = document.createElement('canvas')
    sprite.width = w
    sprite.height = h
    const ctx = sprite.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = `rgb(${toneAt(palette.tones, toneIndex / (TONE_STEPS - 1)).join(' ')})`
    ctx.strokeStyle = ctx.fillStyle
    // Weight 0 is a single dot: sparse cells read as dust, not as gaps.
    if (weight === 0) {
      ctx.fillRect(Math.floor(w / 2), Math.floor(h / 2), cell > 8 ? 2 : 1, cell > 8 ? 2 : 1)
      return sprite
    }
    const t = weight / (WEIGHT_STEPS - 1)
    const angle = (bin / ANGLE_BINS) * Math.PI
    // A blade reaches ~20–55% of a cell: short enough to stay grain, long
    // enough to hold a direction once thousands of them agree.
    const half = (0.2 + 0.34 * t) * w
    const thickness = Math.max(1, Math.round((1 + 1.6 * t) * (w / 12)))
    ctx.lineWidth = thickness
    ctx.beginPath()
    ctx.moveTo(w / 2 - Math.cos(angle) * half, h / 2 - Math.sin(angle) * half)
    ctx.lineTo(w / 2 + Math.cos(angle) * half, h / 2 + Math.sin(angle) * half)
    ctx.stroke()
    return sprite
  }

  return (toneIndex: number, weight: number, bin: number): HTMLCanvasElement | null => {
    const key = (toneIndex * WEIGHT_STEPS + weight) * ANGLE_BINS + bin
    let sprite = cache.get(key)
    if (sprite === undefined) {
      sprite = make(toneIndex, weight, bin)
      cache.set(key, sprite)
    }
    return sprite
  }
}

interface WindSample {
  angle: number
  density: number
  tone: number
}

/**
 * The whole look lives in four lines: a travelling sway for the angle, a slow
 * dune band for density, a drifting light pool that lifts the tone, and per-cell
 * hash so neighbouring cells never form a visible lattice.
 *
 * The field is sampled in a fixed 2.8 × 1 world so a phone and a desktop see
 * the same number of dunes (just smaller ones on the phone) instead of the
 * phone getting one giant band.
 */
const sampleWind = (
  u: number,
  v: number,
  time: number,
  pointer: { u: number; v: number } | null,
): WindSample => {
  const x = u * WORLD_ASPECT
  const y = v

  // Large-scale direction: two slow waves crossing so the field bends in broad
  // fronts instead of shimmering cell by cell.
  let dir =
    0.62 * Math.sin(x * 1.15 + time * 0.21) +
    0.38 * Math.sin(y * 1.9 - time * 0.16 + x * 0.55) +
    0.2 * Math.sin((x - y) * 0.9 + time * 0.12)
  // A local wake: enough to break straight lines, not enough to scatter.
  dir += 0.14 * Math.sin(x * 3.1 + y * 2.3 + time * 0.55)

  const lightX = 0.64 + 0.14 * Math.sin(time * 0.05)
  const lightY = 0.3 + 0.12 * Math.cos(time * 0.045)
  const light = Math.exp(-(((u - lightX) ** 2) * 3.2 + ((v - lightY) ** 2) * 5.4))

  let tone =
    0.38 +
    0.26 * Math.sin(x * 1.05 + v * 0.8 + time * 0.05) +
    0.16 * Math.sin(v * 3.1 - x * 1.4 - time * 0.04) +
    light * 0.24

  if (pointer) {
    const dx = u - pointer.u
    const dy = v - pointer.v
    const pull = Math.exp(-(dx * dx * 70 + dy * dy * 70))
    dir += pull * (dy < 0 ? -0.8 : 0.8)
    tone += pull * 0.3
  }

  // Dune density: two crossing waves, sharpened around the middle so the crests
  // hold dense grass while the troughs keep real air.
  const d1 = 0.5 + 0.5 * Math.sin(x * 0.92 + v * 1.18 + time * 0.06)
  const d2 = 0.5 + 0.5 * Math.sin(x * 0.48 - v * 1.9 + time * 0.04 + 1.7)
  const dune = 0.58 * d1 + 0.42 * d2
  const jitter = (hash(u * 913.4, v * 771.3) - 0.5) * 0.12

  return {
    angle: -0.12 + dir * 0.62,
    density: clamp((dune - 0.42) * 2.2 + jitter, 0, 1),
    tone: clamp(tone, 0, 1),
  }
}

export interface MountOptions {
  /** Optional extra mask, e.g. a big "404": dense strokes inside the glyphs. */
  mask?: (u: number, v: number) => number
}

export const mountAsciiField = (
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  options: MountOptions = {},
): (() => void) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let palette = readPalette(document.body)
  let dpr = 1
  let cell = 7 // CSS pixels per cell (grain makes sub-7px cells read as noise)
  let cellPx = 7 // device pixels per cell
  let cols = 1
  let rows = 1
  let atlas = createAtlas(cellPx, palette)
  // Per-cell constants (offset x/y, angle wobble, density wobble), rebuilt on
  // resize. Baking them keeps the frame loop free of extra hashing.
  let cellRand = new Float32Array(0)
  let pointer: { u: number; v: number } | null = null

  let raf = 0
  let running = false
  let onScreen = true
  // Time is accumulated across pauses so resuming never makes the field jump.
  let elapsed = 0
  let userPaused = false
  let hostRendered = true
  let lastDraw = 0
  let startedAt = 0

  const draw = (time: number) => {
    const w = canvas.width
    const h = canvas.height
    if (!w || !h) return
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = palette.alpha

    for (let row = 0; row < rows; row++) {
      const v = (row + 0.5) / rows
      for (let col = 0; col < cols; col++) {
        const u = (col + 0.5) / cols
        const rand = (row * cols + col) * 4
        const sample = sampleWind(u, v, time, pointer)
        // Fade the strokes out before the panel edge; clipped glyphs would
        // otherwise leave a crisp dotted line along the border.
        const edge =
          Math.min(1, Math.min(u, 1 - u) / 0.022) * Math.min(1, Math.min(v, 1 - v) / 0.05)
        let density = (sample.density + cellRand[rand + 3]) * edge
        let tone = sample.tone
        if (options.mask) {
          const mask = options.mask(u, v)
          density = clamp(density * 0.25 + mask, 0, 1)
          tone = clamp(tone * (1 - mask * 0.4) + mask * 0.55, 0, 1)
        }
        // Air between the crests is what makes the dense bands read as shape.
        if (density < 0.22) continue
        const weight = Math.min(WEIGHT_STEPS - 1, 1 + Math.floor(density * 2.6))
        const angle = sample.angle + cellRand[rand + 2]
        const bin =
          ((Math.round((angle / Math.PI) * ANGLE_BINS) % ANGLE_BINS) + ANGLE_BINS) % ANGLE_BINS
        const toneIndex = Math.min(TONE_STEPS - 1, Math.max(0, Math.floor(tone * TONE_STEPS)))
        const sprite = atlas(toneIndex, weight, bin)
        if (!sprite) continue
        ctx.drawImage(
          sprite,
          Math.round(col * cellPx + cellRand[rand]),
          Math.round(row * cellPx + cellRand[rand + 1]),
        )
      }
    }

    // Film grain, re-keyed every frame: the axis that keeps the still textural.
    const grains = Math.round(cols * rows * 0.035)
    ctx.globalAlpha = 1
    ctx.fillStyle = palette.grain
    for (let i = 0; i < grains; i++) {
      const gx = Math.floor(hash(i * 1.7, time * 0.31) * w)
      const gy = Math.floor(hash(time * 0.23, i * 2.3) * h)
      ctx.fillRect(gx, gy, 1, 1)
    }
    ctx.globalAlpha = 1
  }

  const measure = () => {
    const rect = host.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    dpr = Math.min(devicePixelRatio || 1, 2)
    const cssWidth = rect.width
    const cssHeight = rect.height
    // Grow the cell until the field fits the paint budget.
    cell = 6
    while (true) {
      const c = Math.ceil(cssWidth / cell)
      const r = Math.ceil(cssHeight / cell)
      if (c * r <= MAX_CELLS) break
      cell += 1
    }
    cols = Math.ceil(cssWidth / cell)
    rows = Math.ceil(cssHeight / cell)
    cellPx = Math.ceil(cell * dpr)
    canvas.width = cols * cellPx
    canvas.height = rows * cellPx
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    palette = readPalette(document.body)
    atlas = createAtlas(cellPx, palette)
    cellRand = new Float32Array(cols * rows * 4)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = (row * cols + col) * 4
        cellRand[i] = (hash(col * 1.31 + 11, row * 2.17 + 7) - 0.5) * cellPx * 1.6
        cellRand[i + 1] = (hash(col * 3.71 + 3, row * 1.13 + 19) - 0.5) * cellPx * 1.6
        cellRand[i + 2] = (hash(col * 5.17, row * 7.31) - 0.5) * 0.4
        cellRand[i + 3] = (hash(col * 9.41 + 5, row * 4.53) - 0.5) * 0.16
      }
    }
    draw(STATIC_TIME)
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now - lastDraw < FRAME_MS) return
    lastDraw = now
    draw(STATIC_TIME + elapsed + (now - startedAt) / 1000)
  }

  const sync = () => {
    const shouldRun =
      onScreen && hostRendered && !document.hidden && !reducedMotion.matches && !userPaused
    if (shouldRun && !running) {
      running = true
      startedAt = performance.now()
      lastDraw = 0
      raf = requestAnimationFrame(tick)
    } else if (!shouldRun && running) {
      running = false
      elapsed += (performance.now() - startedAt) / 1000
      cancelAnimationFrame(raf)
    }
  }

  // WCAG 2.2.2: an ambient animation that runs next to other content needs a
  // visible way to stop it. The button only toggles the loop; the current frame
  // stays painted, so pausing never blanks the artwork.
  const toggle = host.querySelector<HTMLButtonElement>('[data-field-toggle]')
  const setPaused = (paused: boolean) => {
    userPaused = paused
    host.toggleAttribute('data-field-paused', paused)
    toggle?.setAttribute('aria-label', paused ? '播放动画' : '暂停动画')
    sync()
  }
  const onToggle = () => setPaused(!userPaused)
  toggle?.addEventListener('click', onToggle)

  const observer = new IntersectionObserver(
    (entries) => {
      onScreen = entries[0]?.isIntersecting ?? true
      sync()
    },
    { rootMargin: '160px' },
  )
  observer.observe(host)

  // content-visibility lets the browser skip the paint entirely; the event says
  // when it does, which is the honest signal for stopping the loop.
  const onContentVisibility = (event: Event) => {
    hostRendered = !(event as Event & { skipped?: boolean }).skipped
    sync()
  }
  host.addEventListener('contentvisibilityautostatechange', onContentVisibility)

  const onVisibility = () => sync()
  document.addEventListener('visibilitychange', onVisibility)

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const rect = host.getBoundingClientRect()
    pointer = {
      u: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    }
  }
  const clearPointer = () => {
    pointer = null
  }
  host.addEventListener('pointermove', onPointer, { passive: true })
  host.addEventListener('pointerleave', clearPointer, { passive: true })

  const onThemeChange = () => {
    palette = readPalette(document.body)
    atlas = createAtlas(cellPx, palette)
    draw(STATIC_TIME)
  }
  const themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  const onMotionChange = () => {
    if (!reducedMotion.matches) sync()
  }
  reducedMotion.addEventListener('change', onMotionChange)

  const resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(host)

  if (!reducedMotion.matches) {
    measure()
    requestAnimationFrame(() => host.classList.add('is-live'))
    sync()
  }

  // Returning a disposer keeps the page clean if the layout ever swaps.
  return () => {
    observer.disconnect()
    resizeObserver.disconnect()
    themeObserver.disconnect()
    reducedMotion.removeEventListener('change', onMotionChange)
    document.removeEventListener('visibilitychange', onVisibility)
    host.removeEventListener('contentvisibilityautostatechange', onContentVisibility)
    host.removeEventListener('pointermove', onPointer)
    host.removeEventListener('pointerleave', clearPointer)
    toggle?.removeEventListener('click', onToggle)
    cancelAnimationFrame(raf)
  }
}
