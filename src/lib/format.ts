/** Small formatting helpers shared by the list components. */

const pad = (value: number): string => String(value).padStart(2, '0')

/** `2026.11.10` — compact, monospace-friendly, locale-independent. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}
