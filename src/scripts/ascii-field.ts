/**
 * The homepage field.
 *
 * Three currents of short brush strokes sweep across the paper. Each stroke
 * keeps its lane inside its current, so the school has a composition instead of
 * fogging the screen evenly. A pointer is a body moving through the school:
 * lanes part around it, curl into its wake and settle back behind it. Strokes
 * leave fading trails, which is what makes the motion read as liquid ink rather
 * than as sticks rotating in place.
 *
 * No dependencies, one canvas, and no allocation inside the hot loop.
 */

export interface MountOptions {
  /** Paint a representative frame and stop: used to render the fallback still. */
  frozen?: boolean
  /** Multiplier for the number of strokes. Small covers need a denser field. */
  density?: number
  /** Changes the particle seed, so several frozen covers differ. */
  seed?: number
}

interface Palette {
  tones: Array<[number, number, number]>
  alpha: number
}

interface Band {
  weight: number
  speed: number
  halfWidth: number
  alpha: number
  direction: 1 | -1
  /** `shift` bends the current, so each seeded print is a different print. */
  spine: (u: number, shift: number) => number
  slope: (u: number, shift: number) => number
}

interface Stroke {
  band: number
  u: number
  lane: number
  offset: number
  bend: number
  length: number
  depth: number
  tone: number
  speed: number
  phase: number
}

const WARM_STEPS = 130
const LIVE_PREWARM = 10
const FROZEN_EXTRA = 26
const FADE = 0.1
const TONE_BUCKETS = 3
const PASSES = 2
const DUST_SHARE = 0.09

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

/** Deterministic PRNG so every reload starts from the same school. */
const createRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const parseHex = (value: string): [number, number, number] | null => {
  const match = /^#?([\da-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const int = parseInt(match[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

const readPalette = (host: HTMLElement): Palette => {
  const style = getComputedStyle(host)
  const fallback: Array<[number, number, number]> = [
    [27, 35, 64],
    [58, 47, 122],
    [14, 85, 96],
  ]
  const tones = [1, 2, 3].map((index, slot) => {
    const value = style.getPropertyValue(`--field-tone-${index}`).trim()
    return parseHex(value) ?? fallback[slot]
  })
  const alpha = Number.parseFloat(style.getPropertyValue('--field-alpha')) || 0.9
  return { tones, alpha }
}

/**
 * The currents, in stage-height units: u runs 0..1 across the width, the spine
 * gives the vertical centre of the band, the slope its local direction.
 */
const BANDS: Band[] = [
  {
    weight: 0.52,
    speed: 0.2,
    halfWidth: 0.1,
    alpha: 1,
    direction: 1,
    spine: (u, shift) => 0.76 - 0.5 * u + 0.055 * Math.sin(u * 4.1 + 0.5 + shift),
    slope: (u, shift) => -0.5 + 0.2255 * Math.cos(u * 4.1 + 0.5 + shift),
  },
  {
    weight: 0.24,
    speed: 0.135,
    halfWidth: 0.055,
    alpha: 0.78,
    direction: -1,
    spine: (u, shift) => 0.2 + 0.24 * u + 0.045 * Math.sin(u * 5.1 + 2.1 + shift * 1.3),
    slope: (u, shift) => 0.24 + 0.2295 * Math.cos(u * 5.1 + 2.1 + shift * 1.3),
  },
  {
    weight: 0.15,
    speed: 0.1,
    halfWidth: 0.045,
    alpha: 0.5,
    direction: 1,
    spine: (u, shift) => 0.94 - 0.06 * u + 0.03 * Math.sin(u * 3.2 + 1.1 + shift * 0.7),
    slope: (u, shift) => -0.06 + 0.096 * Math.cos(u * 3.2 + 1.1 + shift * 0.7),
  },
]

const mountField = (host: HTMLElement, canvas: HTMLCanvasElement, options: MountOptions) => {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return () => {}

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(pointer: fine)').matches

  const pointer = { x: 0, y: 0, vx: 0, vy: 0, strength: 0, target: 0, active: false }

  let palette = readPalette(host)
  let strokes: Stroke[] = []
  let dust: Stroke[] = []
  let cssWidth = 0
  let cssHeight = 0
  let aspect = 1
  let raf = 0
  let running = false
  let paused = false
  let lastFrame = 0
  let time = 0
  let disposed = false

  const frameMs = finePointer ? 16 : 33
  // Seeded prints share the system but not the composition.
  const bandShift = (options.seed ?? 0) * 2.2
  const scaleDensity = finePointer ? 1 : 0.55

  const makeStroke = (random: () => number, band: number): Stroke => ({
    band,
    u: random(),
    lane: (random() + random() + random()) / 3 - 0.5,
    offset: 0,
    bend: random() * 2 - 1,
    length: 0.012 + random() * 0.042,
    depth: random(),
    tone: random(),
    speed: 0.75 + random() * 0.6,
    phase: random() * Math.PI * 2,
  })

  const build = () => {
    const random = createRandom(
      0x7a11 + Math.round(cssWidth / 60) + (options.seed ?? 0) * 7919,
    )
    const area = cssWidth * cssHeight
    const budget = clamp(
      Math.round((area / 780) * (options.density ?? 1)) * scaleDensity,
      options.density ? 240 : 420,
      2200,
    )
    const dustBudget = Math.round(budget * DUST_SHARE)
    strokes = []
    dust = []
    for (let index = 0; index < budget - dustBudget; index += 1) {
      const roll = random()
      let band = 0
      let acc = BANDS[0].weight
      while (roll > acc && band < BANDS.length - 1) {
        band += 1
        acc += BANDS[band].weight
      }
      strokes.push(makeStroke(random, band))
    }
    for (let index = 0; index < dustBudget; index += 1) dust.push(makeStroke(random, -1))
  }

  /** Offsets start at their lane so the first frame already has its structure. */
  const settle = () => {
    for (const stroke of strokes) {
      const band = BANDS[stroke.band]
      stroke.offset = stroke.lane * band.halfWidth * 1.5
    }
  }

  const update = (dt: number) => {
    time += dt
    const relax = 1 - Math.exp(-dt * 1.5)
    const pointerPower = pointer.strength

    for (const stroke of strokes) {
      const band = BANDS[stroke.band]
      stroke.u += (band.speed * stroke.speed * band.direction * dt) / Math.max(aspect, 0.4)
      if (stroke.u < 0) stroke.u += 1
      else if (stroke.u > 1) stroke.u -= 1

      // Each stroke keeps its lane, with a slow drift so bands breathe.
      const wobble = Math.sin(time * 0.4 + stroke.phase) * band.halfWidth * 0.28
      const target = stroke.lane * band.halfWidth * 1.5 + wobble
      stroke.offset += (target - stroke.offset) * relax

      if (pointerPower > 0.003) {
        const x = stroke.u * aspect
        const y = band.spine(stroke.u, bandShift) + stroke.offset
        const dx = x - pointer.x
        const dy = y - pointer.y
        const distance = Math.hypot(dx, dy)
        if (distance < 0.52) {
          const influence = Math.exp(-((distance / 0.3) ** 2)) * pointerPower
          // Shove the lane out of the way; the drag of the pointer body pulls it
          // along the direction of travel. Together they part and curl the school.
          const push = influence * (0.09 + stroke.depth * 0.05)
          stroke.offset += (dy >= 0 ? 1 : -1) * push * 0.5
          stroke.u += (pointer.vx * influence * 0.05) / Math.max(aspect, 0.4)
          if (stroke.u < 0) stroke.u += 1
          if (stroke.u > 1) stroke.u -= 1
        }
      }
    }

    if (!pointer.active) {
      pointer.target = Math.max(0, pointer.target - dt * 3)
    }
    pointer.strength += (pointer.target - pointer.strength) * (1 - Math.exp(-dt * 5.5))
    pointer.vx *= Math.exp(-dt * 7)
    pointer.vy *= Math.exp(-dt * 7)
  }

  const render = () => {
    const width = canvas.width
    const height = canvas.height
    const scale = cssHeight

    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 1
    ctx.fillStyle = `rgba(0, 0, 0, ${FADE})`
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'

    const paths: Path2D[] = new Array(TONE_BUCKETS * PASSES)
    for (let bucket = 0; bucket < paths.length; bucket += 1) paths[bucket] = new Path2D()

    for (const stroke of strokes) {
      const band = BANDS[stroke.band]
      const center = band.spine(stroke.u, bandShift)
      const slope = band.slope(stroke.u, bandShift)
      const x = stroke.u * aspect
      const y = center + stroke.offset

      // Direction in field units (a unit on x is one stage height, same as y).
      const norm = Math.hypot(aspect, slope)
      const dirX = (band.direction * aspect) / norm
      const dirY = (band.direction * slope) / norm

      const edge = Math.min(1, Math.abs(stroke.offset) / (band.halfWidth * 2.1))
      const length = stroke.length * (1.35 - edge * 0.55) * (0.8 + stroke.depth * 0.5) * scale
      const headX = x * scale
      const headY = y * scale
      const tailX = headX - dirX * length
      const tailY = headY - dirY * length
      const midX = (tailX + headX) / 2 - dirY * length * 0.2 * stroke.bend
      const midY = (tailY + headY) / 2 + dirX * length * 0.2 * stroke.bend

      const coreTone = clamp(0.12 + edge * 0.72 + stroke.tone * 0.22 + (1 - stroke.depth) * 0.12, 0, 0.999)
      const bucket = Math.min(TONE_BUCKETS - 1, Math.floor(coreTone * TONE_BUCKETS))
      for (let pass = 0; pass < PASSES; pass += 1) {
        const path = paths[bucket * PASSES + pass]
        path.moveTo(tailX, tailY)
        path.quadraticCurveTo(midX, midY, headX, headY)
      }
    }

    // Width follows the artwork's height, so a small print keeps the same line
    // weight as the full-stage painting instead of turning into thick worms.
    const baseWidth = clamp(cssHeight / 420, 0.55, 2.2)
    for (let bucket = 0; bucket < TONE_BUCKETS; bucket += 1) {
      const [r, g, b] = palette.tones[bucket]
      for (let pass = 0; pass < PASSES; pass += 1) {
        const path = paths[bucket * PASSES + pass]
        if (pass === 0) {
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.035 * palette.alpha})`
          ctx.lineWidth = baseWidth * 4.2
        } else {
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.26 * palette.alpha})`
          ctx.lineWidth = baseWidth
        }
        ctx.lineCap = 'round'
        ctx.stroke(path)
      }
    }

    // Dust: a few points of light in the still air between the currents.
    for (const mote of dust) {
      const twinkle = 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.9 + mote.phase))
      const x = ((mote.u * 1.2 + 0.02) % 1) * aspect * scale
      const y = (0.06 + mote.lane * 0.88 + 0.5) * scale
      const radius = 0.6 + mote.depth * 1.3
      ctx.fillStyle = `rgba(${palette.tones[2][0]}, ${palette.tones[2][1]}, ${palette.tones[2][2]}, ${twinkle * 0.28 * palette.alpha})`
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const warm = (steps: number, drawFrames: number) => {
    for (let step = 0; step < steps; step += 1) update(1 / 60)
    for (let frame = 0; frame < drawFrames; frame += 1) {
      update(1 / 60)
      render()
    }
  }

  const resize = () => {
    const rect = host.getBoundingClientRect()
    const nextWidth = Math.round(rect.width)
    const nextHeight = Math.round(rect.height)
    if (nextWidth === cssWidth && nextHeight === cssHeight && strokes.length > 0) return
    cssWidth = nextWidth
    cssHeight = nextHeight
    aspect = cssWidth / Math.max(1, cssHeight)
    canvas.width = Math.max(1, cssWidth)
    canvas.height = Math.max(1, cssHeight)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    palette = readPalette(host)
    build()
    settle()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    warm(WARM_STEPS, LIVE_PREWARM)
  }

  const tick = (now: number) => {
    if (!running) return
    raf = requestAnimationFrame(tick)
    if (now - lastFrame < frameMs) return
    const dt = clamp((now - lastFrame) / 1000, 0.008, 0.05)
    lastFrame = now
    update(dt)
    render()
  }

  const start = () => {
    if (running || disposed) return
    running = true
    lastFrame = performance.now()
    raf = requestAnimationFrame(tick)
    host.classList.add('is-live')
  }

  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const setPointerFromEvent = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    const x = (event.clientX - rect.left) / Math.max(1, rect.height)
    const y = (event.clientY - rect.top) / Math.max(1, rect.height)
    if (pointer.active) {
      pointer.vx = (x - pointer.x) * 60
      pointer.vy = (y - pointer.y) * 60
    }
    pointer.x = x
    pointer.y = y
    pointer.active = true
    pointer.target = event.pointerType === 'mouse' ? 1 : 0.9
  }

  const onPointerMove = (event: PointerEvent) => {
    if (paused) return
    setPointerFromEvent(event)
  }
  const onPointerDown = (event: PointerEvent) => {
    setPointerFromEvent(event)
    pointer.target = 1
    pointer.vx *= 1.6
    pointer.vy *= 1.6
  }
  const onPointerUp = () => {
    pointer.active = false
    pointer.target = 0
  }
  const onPointerLeave = onPointerUp

  const onThemeChange = () => {
    palette = readPalette(host)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    warm(Math.round(WARM_STEPS / 2), 6)
  }

  const toggle = options.frozen
    ? null
    : document.querySelector<HTMLButtonElement>('[data-field-toggle]')
  const setPaused = (next: boolean) => {
    paused = next
    host.toggleAttribute('data-field-paused', paused)
    toggle?.toggleAttribute('data-field-paused', paused)
    toggle?.setAttribute('aria-label', paused ? '播放动画' : '暂停动画')
    if (paused) stop()
    else if (!reducedMotion.matches) start()
  }
  const onToggle = () => setPaused(!paused)
  toggle?.addEventListener('click', onToggle)
  host.addEventListener('pointermove', onPointerMove)
  host.addEventListener('pointerdown', onPointerDown)
  host.addEventListener('pointerup', onPointerUp)
  host.addEventListener('pointercancel', onPointerUp)
  host.addEventListener('pointerleave', onPointerLeave)

  const themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  resize()

  if (options.frozen) {
    warm(FROZEN_EXTRA, FROZEN_EXTRA)
    host.classList.add('is-live')
  } else if (!reducedMotion.matches) {
    start()
  }

  const onMotionChange = () => {
    if (reducedMotion.matches) {
      stop()
      host.classList.remove('is-live')
    } else if (!paused) {
      start()
    }
  }
  reducedMotion.addEventListener('change', onMotionChange)

  return () => {
    disposed = true
    stop()
    toggle?.removeEventListener('click', onToggle)
    host.removeEventListener('pointermove', onPointerMove)
    host.removeEventListener('pointerdown', onPointerDown)
    host.removeEventListener('pointerup', onPointerUp)
    host.removeEventListener('pointercancel', onPointerUp)
    host.removeEventListener('pointerleave', onPointerLeave)
    themeObserver.disconnect()
    resizeObserver.disconnect()
    reducedMotion.removeEventListener('change', onMotionChange)
  }
}

export const mountAsciiField = (
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  options: MountOptions = {},
) => mountField(host, canvas, options)
