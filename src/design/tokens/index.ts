/**
 * Global stylesheet inventory of the design system.
 *
 * Most applications import `@dsh-ui/tokens/styles.css` once and let the bundler
 * emit a single stylesheet. This module exists for hosts that mount the tokens at
 * runtime instead — a framework-free boot page, a shadow root, or a desktop shell
 * that injects the sheets after the window is created.
 */

/** Load order of the global sheets; later sheets may consume earlier tokens. */
export const GLOBAL_STYLESHEET_NAMES = [
  'base.css',
  'corner-shape.css',
  'design-platform.css',
  'scrollbar.css',
  'gradient-shadow-text.css',
  'shiki.css',
] as const

/** One global sheet's file name. */
export type GlobalStylesheetName = typeof GLOBAL_STYLESHEET_NAMES[number]

/** Body attribute selecting the dark palette in `design-platform.css`. */
export const DARK_THEME_ATTRIBUTE = 'data-ds-dark-theme'

/** Root attribute publishing the resolved theme source for native window chrome. */
export const THEME_SOURCE_ATTRIBUTE = 'data-ds-theme-source'

/** Body variable carrying the content font size in px (`gradient-shadow-text.css`). */
export const CONTENT_FONT_SIZE_VARIABLE = '--dsh-content-font-size'

/** Baseline light document color, matching the light palette. */
export const LIGHT_CANVAS = '#fff'

/** Baseline dark document color, matching the dark palette. */
export const DARK_CANVAS = '#151517'
