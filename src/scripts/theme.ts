/**
 * Client entry: wires the vendored DSH theme runtime to the DOM and to the
 * segmented control in the header. Everything else on the site is static —
 * this module is the only JavaScript Astro ships.
 */
import { presentTheme, ThemeRuntime } from '../design/theme'
import type { ThemePersistence, ThemePreference } from '../design/theme'

const STORAGE_KEY = 'site-theme'

const persistence: ThemePersistence = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return undefined
      const parsed = JSON.parse(raw) as { preference?: unknown }
      return typeof parsed.preference === 'string'
        ? { preference: parsed.preference as ThemePreference }
        : undefined
    } catch {
      return undefined
    }
  },
  save(patch) {
    if (!patch.preference) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preference: patch.preference }))
    } catch {
      /* private mode / quota — the session still works, it just won't persist. */
    }
  },
}

const runtime = new ThemeRuntime({ persistence })
presentTheme(runtime)

const buttons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-theme-set]'),
)

function sync(): void {
  const preference = runtime.getTheme().preference
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.themeSet === preference))
  }
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    const id = button.dataset.themeSet
    if (id) runtime.setTheme(id)
  })
}

runtime.subscribe(sync)
sync()
