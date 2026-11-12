/**
 * Theme runtime, DOM presenter, palette bootstrap, and token vocabulary of the
 * DSH design system.
 *
 * ```
 * import '@dsh-ui/tokens/styles.css'
 * import { ThemeProvider } from '@dsh-ui/theme/react'
 *
 * createRoot(el).render(<ThemeProvider><App /></ThemeProvider>)
 * ```
 */
export {
  FONT_SIZE_FIELD, FONT_SIZE_MAX, FONT_SIZE_MIN, DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE,
  THEME_PREFERENCES, THEME_PREFERENCE_FIELD, THEME_SETTINGS_NAMESPACE,
  bootstrapFontSize, isThemePreference,
  type ThemeDefinition, type ThemePreference, type ThemeSettings, type ThemeSnapshot,
  type ThemeTokenInspection, type ThemeTokenModes, type ThemeTokenOverrides, type ThemeTokens,
} from './types'
export { ThemeRuntime, type ThemePersistence, type ThemeRuntimeOptions, type ThemeSettingsShape } from './runtime'
export { ThemePresenter, presentTheme } from './presenter'
export { bootThemeBodyScript, bootThemeFragments, bootThemeHeadCss } from './boot'
export {
  CONTENT_FONT_SIZE_VARIABLE, DARK_THEME_ATTRIBUTE, DARK_CANVAS, LIGHT_CANVAS, THEME_SOURCE_ATTRIBUTE,
} from '../tokens'
