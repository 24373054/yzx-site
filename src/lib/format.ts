/** Small formatting helpers shared by the list components. */

const pad = (value: number): string => String(value).padStart(2, '0')

/** `2026.11.10` — compact, monospace-friendly, locale-independent. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

/**
 * Rough reading time for mixed Chinese/English prose: 350 CJK characters or
 * 220 Latin words per minute, never less than a minute.
 */
export function readingTime(body: string | undefined): number {
  if (!body) return 1
  const cjk = (body.match(/[\u4e00-\u9fff]/g) ?? []).length
  const latin = body.replace(/[\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(cjk / 350 + latin / 220))
}
