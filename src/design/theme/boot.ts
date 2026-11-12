/**
 * Palette bootstrap for the interval before the application script runs.
 *
 * Without it the document paints the browser default white canvas and the first
 * frame flashes when the palette turns out to be dark. A host embeds
 * {@link bootThemeHeadCss} in `<head>` so the canvas is already correct at first
 * paint, and {@link bootThemeBodyScript} at the end of `<body>` so the palette
 * attribute and content font size are installed before the bundle executes.
 */
import {
  DARK_CANVAS, DARK_THEME_ATTRIBUTE, LIGHT_CANVAS, THEME_SOURCE_ATTRIBUTE, CONTENT_FONT_SIZE_VARIABLE,
} from '../tokens'
import { DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE, type ThemePreference } from './types'

/**
 * Head CSS coloring the document canvas before any script executes.
 * @param preference - persisted preference; `system` follows the OS scheme.
 * @returns a stylesheet body safe to embed in a `<style>` element.
 */
export function bootThemeHeadCss(preference: ThemePreference = DEFAULT_PREFERENCE): string {
  const light = `:root{color-scheme:light}body{background-color:${LIGHT_CANVAS}}`
  const dark = `:root{color-scheme:dark}body{background-color:${DARK_CANVAS}}`
  if (preference === 'light') return light
  if (preference === 'dark') return dark
  return `${light}@media(prefers-color-scheme:dark){${dark}}`
}

/**
 * Body script installing the palette attribute and content font size before the
 * bundle executes, so the first React frame already reads the right tokens.
 * @param preference - persisted preference.
 * @param fontSize - content font size in px written to the font-size axis.
 * @returns JavaScript source safe to embed in a `<script>` element.
 */
export function bootThemeBodyScript(
  preference: ThemePreference = DEFAULT_PREFERENCE,
  fontSize: number = DEFAULT_FONT_SIZE,
): string {
  return `(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.dataset.dsThemeSource = preference
  document.body.toggleAttribute(${JSON.stringify(DARK_THEME_ATTRIBUTE)}, dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.style.setProperty(${JSON.stringify(CONTENT_FONT_SIZE_VARIABLE)}, ${JSON.stringify(`${fontSize}px`)})
})()`
}

/**
 * Build both bootstrap fragments for a server-rendered or generated document.
 * @param preference - persisted preference.
 * @param fontSize - content font size in px.
 * @returns the head stylesheet and the body script, in the order they must appear.
 */
export function bootThemeFragments(
  preference: ThemePreference = DEFAULT_PREFERENCE,
  fontSize: number = DEFAULT_FONT_SIZE,
): { headStyle: string; bodyScript: string } {
  return {
    headStyle: bootThemeHeadCss(preference),
    bodyScript: bootThemeBodyScript(preference, fontSize),
  }
}

/** Attribute carrying the theme source; re-exported for boot templates. */
export { THEME_SOURCE_ATTRIBUTE }
