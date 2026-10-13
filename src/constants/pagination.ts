/**
 * Pagination defaults.
 *
 * One place decides how many rows a screen asks for, so a user's choice on one
 * table does not quietly disagree with another's, and the server's `per_page`
 * cap (100) is respected from here rather than per call site.
 */

export const DEFAULT_PER_PAGE = 15

/** Rows-per-page choices offered on dense screens. */
export const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100] as const

/** Inventory and the inbox default higher — they are scan, not edit, screens. */
export const DEFAULT_PER_PAGE_DENSE = 20

/** Pagination state carried in the URL so a list survives refresh and sharing. */
export interface PageQuery {
  page: number
  per_page: number
  q: string
}

export function normalisePage(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

export function normalisePerPage(value: unknown, fallback = DEFAULT_PER_PAGE): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 100)
}
