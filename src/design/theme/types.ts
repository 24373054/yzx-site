/**
 * Theme vocabulary shared by the runtime, the DOM presenter, and host boot
 * scripts. Values here are the complete set accepted at every boundary; a
 * durable settings document and a wire payload validate against these names.
 */

/** Built-in preferences accepted by the runtime and by a settings document. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Selected built-in theme preference. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Default preference when no durable override exists. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Settings namespace a host may use to persist the preference. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Settings field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Settings field carrying the conversation content font size. */
export const FONT_SIZE_FIELD = 'fontSize'

/** Smallest accepted content font size (px). */
export const FONT_SIZE_MIN = 12

/** Largest accepted content font size (px). */
export const FONT_SIZE_MAX = 17

/** Content font size when no durable override exists (px). */
export const DEFAULT_FONT_SIZE = 14

/** Durable theme section a host may persist. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Conversation content font size in px, an integer within {@link FONT_SIZE_MIN}..{@link FONT_SIZE_MAX}. */
  fontSize: number
}

/** Token name to CSS value map applied as inline variables on `body`. */
export type ThemeTokens = Record<string, string>

/**
 * One override-layer token value. Both palette modes are mandatory — repeat the
 * same value when the token is scheme-invariant — so an override never goes
 * illegible when the user switches to the other scheme.
 */
export interface ThemeTokenModes {
  /** Value applied while the light base palette is active. */
  light: string
  /** Value applied while the dark base palette is active. */
  dark: string
}

/** Override-layer dictionary: token names to per-mode value pairs. */
export type ThemeTokenOverrides = Record<string, ThemeTokenModes>

/** One selectable theme: id, palette semantics, and alias-token overrides. */
export interface ThemeDefinition {
  /** Theme id, the argument accepted by `setTheme` for a concrete theme. */
  id: string
  /**
   * Base palette this theme builds on. The presenter switches
   * `body[data-ds-dark-theme]` from this field, never from the id.
   */
  colorScheme: 'light' | 'dark'
  /** Alias-layer overrides applied as inline CSS variables over the base palette. */
  tokens: ThemeTokens
}

/** Immutable theme state published on every change. */
export interface ThemeSnapshot {
  /** Persisted preference; may be `system`. */
  preference: ThemePreference
  /** Conversation content font size in px, an integer within {@link FONT_SIZE_MIN}..{@link FONT_SIZE_MAX}. */
  fontSize: number
  /** Resolved active theme with override layers folded into its tokens. */
  active: ThemeDefinition
  /** Registered themes in registration order. */
  themes: readonly ThemeDefinition[]
  /** Monotonic change counter. */
  revision: number
}

/** One theme token exposed for inspection before any theme is defined. */
export interface ThemeTokenInspection {
  /** Token name accepted by `overrideTokens`. */
  name: string
  /** Intended visual role. */
  description: string
  /** CSS value category. */
  valueType: string
  /** Whether override layers must supply both palette modes. */
  requiresLightAndDark: boolean
  /** CSS custom property consumed by UI styles. */
  cssVariable?: string
}

/**
 * Narrow one wire or settings value to a persistable preference.
 * @param value - value crossing a settings or wire boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/** Read the boot script's content font size, falling back to the default. */
export function bootstrapFontSize(): number {
  if (typeof document === 'undefined') return DEFAULT_FONT_SIZE
  const raw = document.body.style.getPropertyValue('--dsh-content-font-size')
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) && parsed >= FONT_SIZE_MIN && parsed <= FONT_SIZE_MAX
    ? parsed
    : DEFAULT_FONT_SIZE
}
