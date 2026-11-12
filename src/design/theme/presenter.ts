/**
 * Global theme DOM applier: projects a resolved {@link ThemeSnapshot} onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), `body[data-ds-dark-theme]` for the token palette, the active
 * theme's alias-token overrides as inline CSS variables on `body`, the content
 * font-size axis, `html[data-ds-theme-source]` for native-chrome mirroring, and
 * one presenter-owned `meta[name="theme-color"]` for surrounding browser UI.
 *
 * The presenter only ever retracts what it wrote itself, so foreign attributes,
 * metadata, and inline styles survive.
 */
import {
  CONTENT_FONT_SIZE_VARIABLE, DARK_THEME_ATTRIBUTE, THEME_SOURCE_ATTRIBUTE,
} from '../tokens'
import type { ThemeSnapshot } from './types'

/** Applies theme snapshots to the document; one instance per application root. */
export class ThemePresenter {
  /** Token names written by the last apply; this is the retraction set. */
  private appliedTokens: string[] = []
  /** The single metadata node this presenter inserts and removes. */
  private readonly themeColorMeta: HTMLMetaElement

  /** Create the presenter-owned metadata node before the first snapshot arrives. */
  constructor() {
    this.themeColorMeta = document.createElement('meta')
    this.themeColorMeta.name = 'theme-color'
  }

  /**
   * Project a snapshot onto the document: set root `color-scheme` and the body
   * palette attribute from `active.colorScheme` (never the id — `system` is
   * resolved upstream), publish the content font-size axis, then replace the
   * previously applied token variables with `active.tokens`. Browser
   * theme-color metadata follows the computed body background, so the rendered
   * palette stays the color authority.
   * @param snapshot - resolved theme snapshot.
   */
  apply(snapshot: ThemeSnapshot): void {
    const scheme = snapshot.active.colorScheme
    document.documentElement.style.colorScheme = scheme
    document.documentElement.setAttribute(
      THEME_SOURCE_ATTRIBUTE,
      snapshot.preference === 'system' ? 'system' : scheme,
    )
    const body = document.body
    if (scheme === 'dark') body.setAttribute(DARK_THEME_ATTRIBUTE, '')
    else body.removeAttribute(DARK_THEME_ATTRIBUTE)
    body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value)
      this.appliedTokens.push(name)
    }
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta)
  }

  /**
   * Retract root color-scheme, the theme-source attribute, the palette
   * attribute, token variables, the font-size axis, and the owned metadata node.
   */
  dispose(): void {
    document.documentElement.style.removeProperty('color-scheme')
    document.documentElement.removeAttribute(THEME_SOURCE_ATTRIBUTE)
    const body = document.body
    body.removeAttribute(DARK_THEME_ATTRIBUTE)
    body.style.removeProperty(CONTENT_FONT_SIZE_VARIABLE)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    this.themeColorMeta.remove()
  }
}

/**
 * Bind a runtime to the document for the lifetime of the application.
 * @param runtime - runtime to project; its current snapshot is applied at once.
 * @returns disposer that unsubscribes and retracts every DOM write.
 */
export function presentTheme(runtime: { getTheme: () => ThemeSnapshot; subscribe: (listener: (snapshot: ThemeSnapshot) => void) => () => void }): () => void {
  if (typeof document === 'undefined') return () => {}
  const presenter = new ThemePresenter()
  presenter.apply(runtime.getTheme())
  const unsubscribe = runtime.subscribe(snapshot => { presenter.apply(snapshot) })
  return () => {
    unsubscribe()
    presenter.dispose()
  }
}
