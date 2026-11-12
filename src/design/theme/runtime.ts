/**
 * Theme registry and preference owner.
 *
 * `light` and `dark` are built in — the token stylesheets carry both palettes —
 * and additional themes register alias-layer overrides on top of one of them.
 * The runtime holds the `prefers-color-scheme` media query (environment sensing,
 * not presentation) and republishes when the OS scheme flips while the
 * preference is `system`. It never touches the DOM; `ThemePresenter` applies the
 * published snapshot and `applyBootTheme` covers the interval before scripts run.
 */
import {
  bootstrapFontSize, DEFAULT_PREFERENCE, FONT_SIZE_MAX, FONT_SIZE_MIN,
  isThemePreference,
  type ThemeDefinition, type ThemePreference, type ThemeSnapshot, type ThemeTokenInspection,
  type ThemeTokenModes, type ThemeTokenOverrides, type ThemeTokens,
} from './types'

const BUILTIN_THEMES: readonly ThemeDefinition[] = Object.freeze([
  Object.freeze({ id: 'light', colorScheme: 'light' as const, tokens: Object.freeze({}) }),
  Object.freeze({ id: 'dark', colorScheme: 'dark' as const, tokens: Object.freeze({}) }),
])

const BUILTIN_INSPECT_TOKENS: readonly ThemeTokenInspection[] = Object.freeze([
  { name: '--dsw-alias-bg-base', description: 'Application base background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-base' },
  { name: '--dsw-alias-bg-layer-1', description: 'Primary raised surface background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-layer-1' },
  { name: '--dsw-alias-bg-layer-2', description: 'Secondary nested surface background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-layer-2' },
  { name: '--dsw-alias-bg-layer-3', description: 'Tertiary surface background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-layer-3' },
  { name: '--dsw-alias-bg-overlay', description: 'Overlay and popover background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-overlay' },
  { name: '--dsw-alias-border-l1', description: 'Primary subtle border.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-border-l1' },
  { name: '--dsw-alias-border-l2', description: 'Secondary stronger border.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-border-l2' },
  { name: '--dsw-alias-brand-primary', description: 'Primary brand accent.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-brand-primary' },
  { name: '--dsw-alias-link', description: 'Link and artifact-reference color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-link' },
  { name: '--dsw-alias-label-primary', description: 'Primary text color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-label-primary' },
  { name: '--dsw-alias-label-secondary', description: 'Secondary text color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-label-secondary' },
  { name: '--dsw-alias-label-tertiary', description: 'Tertiary text color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-label-tertiary' },
  { name: '--dsw-alias-state-error-primary', description: 'Primary error state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-error-primary' },
  { name: '--dsw-alias-state-success-primary', description: 'Primary success state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-success-primary' },
  { name: '--dsw-alias-state-warn-primary', description: 'Primary warning state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-warn-primary' },
  { name: '--dsw-specific-bubble', description: 'User message bubble fill.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-specific-bubble' },
  { name: '--dsw-specific-sidebar-fill', description: 'Sidebar column and title-row background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-specific-sidebar-fill' },
])

/** Durable preference storage owned by the embedding application. */
export interface ThemePersistence {
  /** Load the persisted section, or `undefined` when nothing was stored. */
  load: () => Partial<ThemeSettingsShape> | undefined
  /** Persist one accepted preference or font size. */
  save: (patch: Partial<ThemeSettingsShape>) => void
}

/** The persistable subset of the theme state. */
export interface ThemeSettingsShape {
  /** Selected preference. */
  preference: ThemePreference
  /** Conversation content font size in px. */
  fontSize: number
}

/** Options accepted by the {@link ThemeRuntime} constructor. */
export interface ThemeRuntimeOptions {
  /** Initial preference before persistence is read. Defaults to `system`. */
  preference?: ThemePreference
  /** Initial content font size in px. Defaults to the boot value, then 14. */
  fontSize?: number
  /** Durable storage; omit for a session-only runtime. */
  persistence?: ThemePersistence
}

/**
 * Theme registry and preference owner.
 *
 * Reads go through {@link getTheme}; preference writes only through
 * {@link setTheme} and {@link setFontSize}; continuous sync only through
 * {@link subscribe}. {@link overrideTokens} stacks partial token layers over the
 * active theme without touching the registry.
 */
export class ThemeRuntime {
  private themes: ThemeDefinition[] = [...BUILTIN_THEMES]
  private preference: ThemePreference
  private fontSize: number
  private revision = 0
  private snapshot: ThemeSnapshot
  private readonly media: MediaQueryList | undefined
  private readonly persistence: ThemePersistence | undefined
  private readonly listeners = new Set<(snapshot: ThemeSnapshot) => void>()
  /** Override layers by source; seq is the monotonic stacking order. */
  private readonly overrides = new Map<string, { seq: number; tokens: ThemeTokenOverrides }>()
  private overrideSeq = 0

  /**
   * @param options - initial preference and font size plus optional durable storage.
   */
  constructor(options: ThemeRuntimeOptions = {}) {
    this.persistence = options.persistence
    const stored = options.persistence?.load()
    this.preference = stored?.preference ?? options.preference ?? DEFAULT_PREFERENCE
    this.fontSize = stored?.fontSize ?? options.fontSize ?? bootstrapFontSize()
    this.media = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: dark)')
    this.snapshot = this.buildSnapshot()
    if (this.media !== undefined) {
      const media = this.media
      media.addEventListener('change', () => {
        if (this.preference !== 'system') return
        this.publish()
      })
    }
  }

  /**
   * Read the current immutable theme snapshot.
   * @returns the current snapshot, stable until the next change.
   */
  getTheme(): ThemeSnapshot {
    return this.snapshot
  }

  /**
   * Subscribe to every published snapshot.
   * @param listener - called with each new snapshot.
   * @returns disposer removing the listener.
   */
  subscribe(listener: (snapshot: ThemeSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Switch the theme preference — the only preference write entry.
   * @param id - a registered theme id or `system`; an unknown id throws.
   */
  setTheme(id: string): void {
    if (id !== 'system' && !this.themes.some(t => t.id === id)) {
      throw new Error(`theme "${id}" is not registered`)
    }
    if (this.preference === id) return
    this.preference = id as ThemePreference
    if (isThemePreference(id)) this.persistence?.save({ preference: id })
    this.publish()
  }

  /**
   * Change the conversation content font size — the only font-size write entry.
   * @param px - integer px within FONT_SIZE_MIN..FONT_SIZE_MAX; other values throw.
   */
  setFontSize(px: number): void {
    if (!Number.isInteger(px) || px < FONT_SIZE_MIN || px > FONT_SIZE_MAX) {
      throw new Error(`font size ${px} is outside ${FONT_SIZE_MIN}..${FONT_SIZE_MAX}`)
    }
    if (this.fontSize === px) return
    this.fontSize = px
    this.persistence?.save({ fontSize: px })
    this.publish()
  }

  /**
   * Register a theme. A duplicate id throws; the built-in pair counts;
   * `system` is a preference, not a registrable id.
   * @param definition - theme id, colorScheme, and alias-token overrides.
   * @returns disposer; disposing the theme backing the active preference resets
   *   the preference to the default so the UI never keeps tokens of an
   *   unregistered theme.
   */
  register(definition: ThemeDefinition): () => void {
    if (definition.id === 'system') throw new Error('"system" is a preference, not a registrable theme id')
    if (this.themes.some(t => t.id === definition.id)) {
      throw new Error(`theme "${definition.id}" is already registered`)
    }
    this.themes = [...this.themes, definition]
    this.publish()
    return () => {
      if (!this.themes.some(t => t.id === definition.id)) return
      this.themes = this.themes.filter(t => t.id !== definition.id)
      if (this.preference === definition.id) this.preference = DEFAULT_PREFERENCE
      this.publish()
    }
  }

  /**
   * Stack a token override layer over the active theme. Layers compose in call
   * order with later layers winning per token; removing a layer restores what it
   * covered. Calling again with the same source replaces that source's whole
   * layer and restacks it on top.
   * @param source - layer identity, one layer per source.
   * @param tokens - token name to `{ light, dark }` value pairs.
   * @returns disposer removing exactly the layer this call created; a no-op once
   *   the source has re-overridden.
   */
  overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void {
    const layer = { seq: this.overrideSeq++, tokens: validateOverrides(source, tokens) }
    this.overrides.set(source, layer)
    this.publish()
    return () => {
      if (this.overrides.get(source) !== layer) return
      this.overrides.delete(source)
      this.publish()
    }
  }

  /**
   * Export the token directory without reading the DOM or computed styles.
   * @returns stable JSON-safe token descriptions, including dynamic names.
   */
  exportInspectTokens(): ThemeTokenInspection[] {
    const tokens = new Map(BUILTIN_INSPECT_TOKENS.map(token => [token.name, token]))
    for (const theme of this.themes) {
      for (const name of Object.keys(theme.tokens)) {
        if (!tokens.has(name)) tokens.set(name, dynamicToken(name))
      }
    }
    for (const layer of this.overrides.values()) {
      for (const name of Object.keys(layer.tokens)) {
        if (!tokens.has(name)) tokens.set(name, dynamicToken(name))
      }
    }
    return [...tokens.values()].map(token => ({ ...token })).sort((left, right) => left.name.localeCompare(right.name))
  }

  private buildSnapshot(): ThemeSnapshot {
    const resolvedId = this.preference === 'system'
      ? (this.media?.matches === true ? 'dark' : 'light')
      : this.preference
    const active = this.themes.find(t => t.id === resolvedId)
    if (active === undefined) throw new Error(`theme registry lost "${resolvedId}"`)
    return Object.freeze({
      preference: this.preference,
      fontSize: this.fontSize,
      active: this.composeActive(active),
      themes: Object.freeze([...this.themes]),
      revision: this.revision,
    })
  }

  /** Fold the override layers into the active definition for the active scheme. */
  private composeActive(active: ThemeDefinition): ThemeDefinition {
    if (this.overrides.size === 0) return active
    const tokens: ThemeTokens = { ...active.tokens }
    for (const layer of [...this.overrides.values()].sort((a, b) => a.seq - b.seq)) {
      for (const [name, modes] of Object.entries(layer.tokens)) {
        tokens[name] = modes[active.colorScheme]
      }
    }
    return Object.freeze({ ...active, tokens: Object.freeze(tokens) })
  }

  private publish(): void {
    this.revision += 1
    this.snapshot = this.buildSnapshot()
    for (const listener of [...this.listeners]) listener(this.snapshot)
  }
}

/** Validate one override layer and copy it defensively. */
function validateOverrides(source: string, tokens: ThemeTokenOverrides): ThemeTokenOverrides {
  const validated: ThemeTokenOverrides = {}
  for (const [name, value] of Object.entries<unknown>(tokens)) {
    if (typeof value === 'string') {
      throw new TypeError(
        `theme override "${name}" from "${source}" is a bare string — pass { light: ${JSON.stringify(value)}, dark: ${JSON.stringify(value)} } `
        + '(repeat the value when it is the same in both palettes); a single value goes illegible when the user switches color scheme',
      )
    }
    if (typeof value !== 'object' || value === null
      || typeof (value as { light?: unknown }).light !== 'string'
      || typeof (value as { dark?: unknown }).dark !== 'string') {
      throw new TypeError(
        `theme override "${name}" from "${source}" must map to a { light, dark } pair of strings — one value per color scheme`,
      )
    }
    const modes = value as ThemeTokenModes
    validated[name] = { light: modes.light, dark: modes.dark }
  }
  return validated
}

function dynamicToken(name: string): ThemeTokenInspection {
  return {
    name,
    description: 'Theme token registered by the current composition.',
    valueType: 'CSS value',
    requiresLightAndDark: true,
    ...(name.startsWith('--') ? { cssVariable: name } : {}),
  }
}
