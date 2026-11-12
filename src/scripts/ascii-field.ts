/**
 * ASCII wind field — a canvas 2D art layer with no dependencies.
 *
 * The visual language is borrowed from github.com/yusen-dev/living-ascii (MIT):
 * a field of short strokes whose angle follows a wind function, a palette read
 * per cell, film grain on top. Here it is drawn on a 2D canvas instead of a
 * WebGL shader: a full-bleed header runs around 12k cells, which one canvas
 * repaint per frame handles comfortably on a desktop and at 30 fps on a phone.
 *
 * Rules this file keeps:
 * - It is decorative: the canvas is aria-hidden and a low-resolution echo of
 *   the same frame sits behind it, so the artwork never pops in from a blank
 *   rectangle. Reduced-motion and no-JS visitors get the sharp still image.
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

const MAX_CELLS = 6000
/** Width-to-height of the coordinate space the wind is sampled in, so a narrow
 *  viewport samples the same landscape instead of stretching it. */
const WORLD_ASPECT = 2.8
/** Radius of the cursor's wake, in field-heights. */
const POINTER_RADIUS = 0.46

/**
 * The art is full-bleed, so it has to dissolve into the page instead of ending
 * on a ruled line. The top feather is short (the header scrim sits there), the
 * sides are medium, and the bottom is long because that is where the eye lands
 * on the small screens where the stage runs nearly edge to edge.
 */
const EDGE_X = 0.055
const EDGE_TOP = 0.1
const EDGE_BOTTOM = 0.22

type RGB = readonly [number, number, number]

interface Palette {
  tones: RGB[]
  alpha: number
  grain: string
}

interface PointerState {
  u: number
  v: number
  /** Eases in on enter and out on leave, so the wake never appears/vanshes in one frame. */
  strength: number
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const smoothstep = (t: number) => {
  const s = clamp(t, 0, 1)
  return s * s * (3 - 2 * s)
}

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
    // A blade runs from a short tick to a long stroke: length is what makes the
    // dense crests read as grass instead of as evenly spaced dashes.
    const half = (0.18 + 0.56 * t) * w
    const thickness = Math.max(1, Math.round((0.85 + 1.7 * t) * (w / 10)))
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
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
 * phone getting one giant band. The pointer adds a smooth wake: dense grass
 * bends away from the cursor and lifts slightly in tone.
 */
const sampleWind = (
  u: number,
  v: number,
  time: number,
  pointer: PointerState,
  aspect: number,
): WindSample => {
  // Composition before texture. Two currents are laid over the page like brush
  // sweeps: a wide diagonal ribbon and a thin counter-current near the bottom.
  // Everything outside them is paper, with a little travelling dust so the
  // emptiness still breathes.
  // On a portrait viewport the same composition would sink to the bottom edge,
  // so the currents are zoomed toward the middle of the stage.
  const vv = aspect < 1 ? 0.5 + (v - 0.5) * 0.78 : v
  const spine1 = 0.52 + 0.16 * Math.sin(u * 3.6 + 0.4 + time * 0.02) - 0.28 * (u - 0.5)
  // The sweep is asymmetric like a brush: a crisp leading edge, a long feathered
  // tail that dissolves into the paper.
  const drift = vv - spine1
  const width1 = 0.075 + 0.065 * Math.sin(u * 2.2 + 1 + time * 0.03)
  const ribbon1 = Math.exp(-(((drift / (width1 * (drift > 0 ? 1.9 : 0.55))) ** 2)) * 2.6)

  const spine2 = 0.86 - 0.1 * Math.sin(u * 2.0 + 2.2 - time * 0.02)
  const ribbon2 = Math.exp(-(((vv - spine2) / 0.07) ** 2) * 2.2) * 0.55

  // Air is a slow two-dimensional figure that eats holes out of the ribbons, so
  // a dense sweep has eddies and breaks instead of reading as a painted stripe.
  const air =
    0.5 +
    0.5 *
      (0.5 * Math.sin(u * 5.1 + v * 3.7 + time * 0.04) +
        0.5 * Math.sin(u * 2.3 - v * 6.1 + 1.6 - time * 0.03))
  const current = Math.min(1.35, Math.max(ribbon1, ribbon2) * 1.15) * (0.42 + 0.58 * air)

  // Dust: a sparse veil across the rest of the page. It keeps the paper alive
  // without drawing attention, and it dissolves the line between art and page.
  const dust =
    0.13 *
    Math.max(0, hash(u * 13.7 + 2.1, v * 17.3 + 5.3) - 0.35) *
    (1 - Math.min(1, current * 2))

  let density = clamp(current * 1.2 + dust, 0, 1)

  // Strokes follow the current they sit in: slope of the dominant spine, in
  // device space (a field unit on x is `aspect` wide).
  const slope1 = 0.16 * 3.6 * Math.cos(u * 3.6 + 0.4 + time * 0.02) - 0.28
  const slope2 = -0.1 * 2.0 * Math.cos(u * 2.0 + 2.2 - time * 0.02)
  const slope = ribbon1 >= ribbon2 ? slope1 : slope2
  const flow = Math.atan2(slope / Math.max(aspect, 0.4), 1)

  // A slow travelling sway keeps the still and the animation from looking like
  // a frozen screenshot.
  const sway =
    0.16 * Math.sin(u * 4.3 + v * 2.9 + time * 0.35) +
    0.08 * Math.sin(v * 6.2 - time * 0.22)
  let angle = flow + sway

  // Tone: the dense kernel is the darkest ink, the ribbon edges a light wash.
  let tone = clamp(
    0.8 -
      Math.min(1, current * 1.5) * 0.74 +
      0.08 * Math.sin(u * 3.1 - v * 2.7 + time * 0.05),
    0,
    1,
  )

  if (pointer.strength > 0.003) {
    // Work in field-height units so the wake is round on a wide canvas.
    const dx = (u - pointer.u) * aspect
    const dy = v - pointer.v
    const distance = Math.hypot(dx, dy)
    const falloff = clamp(1 - distance / POINTER_RADIUS, 0, 1)
    // Smoothstep: no hard edge at the radius, no spike at the centre.
    const influence = falloff * falloff * (3 - 2 * falloff) * pointer.strength
    // Grass leans away from the cursor with a slight clockwise curl, so the
    // wake reads as wind parting instead of a hole punched into the field.
    const target = Math.atan2(dy, dx) + 0.55
    let delta = target - angle
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    angle += delta * influence * 0.85
    density *= 1 - influence * 0.18
    tone += influence * 0.14
  }

  return { angle, density, tone }
}

export interface MountOptions {
  /** Optional extra mask, e.g. a big "404": dense strokes inside the glyphs. */
  mask?: (u: number, v: number) => number
  /** Paint the still frame only. Used to render the fallback image. */
  frozen?: boolean
}

export const mountAsciiField = (
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  options: MountOptions = {},
): (() => void) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  // A mouse deserves 60 fps; a phone's battery does not.
  const frameMs = matchMedia('(pointer: fine)').matches ? 16 : 33

  let palette = readPalette(document.body)
  let dpr = 1
  let cell = 7 // CSS pixels per cell (grain makes sub-7px cells read as noise)
  let cellPx = 7 // device pixels per cell
  let cols = 1
  let rows = 1
  let lastWidth = 0
  let lastHeight = 0
  let atlas = createAtlas(cellPx, palette)
  // Per-cell constants (offset x/y, angle wobble, density wobble), rebuilt on
  // resize. Baking them keeps the frame loop free of extra hashing.
  let cellRand = new Float32Array(0)
  const pointer: PointerState = { u: 0.5, v: 0.5, strength: 0 }
  let pointerTarget: { u: number; v: number } | null = null

  let raf = 0
  let running = false
  let onScreen = true
  // Time is accumulated across pauses so resuming never makes the field jump.
  let elapsed = 0
  let userPaused = false
  let hostRendered = true
  let lastDraw = 0
  let startedAt = 0

  const timeNow = () =>
    STATIC_TIME + elapsed + (running ? (performance.now() - startedAt) / 1000 : 0)

  const draw = (time: number) => {
    const w = canvas.width
    const h = canvas.height
    if (!w || !h) return
    const aspect = w / h
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = palette.alpha

    for (let row = 0; row < rows; row++) {
      const v = (row + 0.5) / rows
      for (let col = 0; col < cols; col++) {
        const u = (col + 0.5) / cols
        const rand = (row * cols + col) * 4
        const sample = sampleWind(u, v, time, pointer, aspect)
        let density = sample.density + cellRand[rand + 3]
        // Feather the frame edges so the field fades into the paper.
        density *=
          smoothstep(Math.min(u, 1 - u) / EDGE_X) *
          smoothstep(v / EDGE_TOP) *
          smoothstep((1 - v) / EDGE_BOTTOM)
        let tone = sample.tone
        if (options.mask) {
          const mask = options.mask(u, v)
          density = clamp(density * 0.25 + mask, 0, 1)
          tone = clamp(tone * (1 - mask * 0.4) + mask * 0.55, 0, 1)
        }
        // Air between the crests is what makes the dense bands read as shape.
        // Sparse cells still get a dot, so the troughs hold dust rather than
        // turning into holes.
        if (density < 0.09) continue
        // Weight, tone and opacity all rise with density, so the sweep has a
        // dark core, a soft edge and a veil of dust — three depths, not one.
        const weight = density < 0.2 ? 0 : density < 0.45 ? 1 : density < 0.72 ? 2 : 3
        const angle = sample.angle + cellRand[rand + 2]
        const bin =
          ((Math.round((angle / Math.PI) * ANGLE_BINS) % ANGLE_BINS) + ANGLE_BINS) % ANGLE_BINS
        const toneIndex = Math.min(TONE_STEPS - 1, Math.max(0, Math.floor(tone * TONE_STEPS)))
        const sprite = atlas(toneIndex, weight, bin)
        if (!sprite) continue
        ctx.globalAlpha = palette.alpha * clamp(0.24 + density * 0.95, 0, 1)
        ctx.drawImage(
          sprite,
          Math.round(col * cellPx + cellRand[rand]),
          Math.round(row * cellPx + cellRand[rand + 1]),
        )
      }
    }

    ctx.globalAlpha = 1
  }

  const measure = () => {
    const rect = host.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    // The strokes are soft by design, so the backing store does not need a
    // retina-scale pixel grid: one canvas pixel per CSS pixel keeps the per-frame
    // blit cost low enough to hold 60 fps while the field still looks crisp.
    const nextDpr = Math.min(devicePixelRatio || 1, options.frozen ? 2 : 1)
    // ResizeObserver fires once on observe and again on every column change
    // while dragging a window; rebuilding the grid resets nothing, but there is
    // no reason to pay for it when the layout did not actually move.
    if (
      canvas.width &&
      nextDpr === dpr &&
      Math.abs(rect.width - lastWidth) < 1 &&
      Math.abs(rect.height - lastHeight) < 1
    ) {
      return
    }
    dpr = nextDpr
    lastWidth = rect.width
    lastHeight = rect.height
    const cssWidth = rect.width
    const cssHeight = rect.height
    // Keep a similar number of columns on every screen: a phone should not get
    // four pixels of art per stroke just because its viewport is narrow.
    cell = Math.max(cssWidth < 720 ? 14 : 20, Math.min(32, Math.round(cssWidth / 56)))
    let guard = 0
    while (
      Math.ceil(cssWidth / cell) * Math.ceil(cssHeight / cell) > MAX_CELLS &&
      cell < 22 &&
      guard++ < 24
    ) {
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
        cellRand[i] = (hash(col * 1.31 + 11, row * 2.17 + 7) - 0.5) * cellPx * 2.6
        cellRand[i + 1] = (hash(col * 3.71 + 3, row * 1.13 + 19) - 0.5) * cellPx * 2.6
        cellRand[i + 2] = (hash(col * 5.17, row * 7.31) - 0.5) * 0.4
        cellRand[i + 3] = (hash(col * 9.41 + 5, row * 4.53) - 0.5) * 0.16
      }
    }
    // Keep the clock where it was: a resize must not snap the field back to
    // its first frame.
    draw(timeNow())
  }

  const easePointer = () => {
    const targetU = pointerTarget?.u ?? pointer.u
    const targetV = pointerTarget?.v ?? pointer.v
    pointer.u += (targetU - pointer.u) * 0.14
    pointer.v += (targetV - pointer.v) * 0.14
    const targetStrength = pointerTarget ? 1 : 0
    pointer.strength += (targetStrength - pointer.strength) * (pointerTarget ? 0.08 : 0.05)
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now - lastDraw < frameMs) return
    lastDraw = now
    easePointer()
    draw(timeNow())
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
  const toggle =
    host.querySelector<HTMLButtonElement>('[data-field-toggle]') ??
    document.querySelector<HTMLButtonElement>('[data-field-toggle]')
  const setPaused = (paused: boolean) => {
    userPaused = paused
    host.toggleAttribute('data-field-paused', paused)
    toggle?.toggleAttribute('data-field-paused', paused)
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
    pointerTarget = {
      u: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    }
  }
  const onPointerLeave = () => {
    pointerTarget = null
  }
  host.addEventListener('pointermove', onPointer, { passive: true })
  host.addEventListener('pointerleave', onPointerLeave, { passive: true })

  const onThemeChange = () => {
    palette = readPalette(document.body)
    atlas = createAtlas(cellPx, palette)
    draw(timeNow())
  }
  const themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  const onMotionChange = () => {
    if (!reducedMotion.matches) sync()
  }
  reducedMotion.addEventListener('change', onMotionChange)

  const resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(host)

  if (options.frozen) {
    measure()
    draw(STATIC_TIME)
    host.classList.add('is-live')
  } else if (!reducedMotion.matches) {
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
    host.removeEventListener('pointerleave', onPointerLeave)
    toggle?.removeEventListener('click', onToggle)
    cancelAnimationFrame(raf)
  }
}
