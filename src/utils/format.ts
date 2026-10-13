import { currentLocale as appLocale } from '@/i18n'

/**
 * Presentation-only formatting.
 *
 * Every function here takes a value that already exists — the backend is the
 * only thing that decides what a number *means*. These helpers only decide how
 * it reads in the current language and currency, which is why none of them
 * performs arithmetic beyond rounding for display.
 */

function currentLocale(): string {
  return appLocale.value
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  options: { compact?: boolean; showSymbol?: boolean } = {},
): string {
  const amount = value ?? 0

  try {
    return new Intl.NumberFormat(currentLocale(), {
      style: options.showSymbol === false ? 'decimal' : 'currency',
      currency,
      notation: options.compact ? 'compact' : 'standard',
      maximumFractionDigits: amount !== 0 && Math.abs(amount) < 100 ? 2 : 2,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    // An unknown ISO currency code would throw; showing the raw figure beats
    // showing nothing.
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits }).format(value ?? 0)
}

/** Large counts read better compressed: 12.4K rather than 12,400. */
export function formatCompact(value: number | null | undefined): string {
  return new Intl.NumberFormat(currentLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0)
}

export function formatPercent(value: number | null | undefined, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'percent',
    maximumFractionDigits,
  }).format((value ?? 0) / 100)
}

/**
 * Signed change between two periods, as a display string.
 * Returns `null` when there is no prior period to compare against, so callers
 * can show "—" instead of a misleading 0%.
 */
export function formatChange(current: number, previous: number | null | undefined): string | null {
  if (previous === null || previous === undefined || previous === 0) {
    return null
  }

  const change = ((current - previous) / Math.abs(previous)) * 100
  const sign = change > 0 ? '+' : ''

  return `${sign}${new Intl.NumberFormat(currentLocale(), {
    maximumFractionDigits: 1,
  }).format(change)}%`
}

function toDate(iso: string | Date | null | undefined): Date | null {
  if (!iso) {
    return null
  }

  const date = iso instanceof Date ? iso : new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(iso: string | Date | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'

  return new Intl.DateTimeFormat(currentLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'

  return new Intl.DateTimeFormat(currentLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(iso: string | Date | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'

  return new Intl.DateTimeFormat(currentLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * "3 minutes ago" / "just now".
 *
 * Uses `Intl.RelativeTimeFormat`, which is the only way to get this right in
 * Arabic — hand-rolled suffixes do not conjugate.
 */
export function formatRelative(iso: string | Date | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absolute = Math.abs(seconds)

  if (absolute < 45) {
    return new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' }).format(0, 'second')
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.345],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ]

  let value = seconds

  for (const [unit, factor] of units) {
    if (Math.abs(value) < factor) {
      return new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' }).format(
        Math.round(value),
        unit,
      )
    }

    value /= factor
  }

  return new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' }).format(
    Math.round(value),
    'year',
  )
}

/** Today in the workspace's calendar, as `YYYY-MM-DD` for `<input type="date">`. */
export function todayIso(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

/** First initial of each word in a name, for avatars. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('')
}

/**
 * Shorten a long identifier (`{8-4-4-4-12}` style references, tokens) for
 * display without losing the part a human would recognise.
 */
export function truncateMiddle(value: string, max = 24): string {
  if (value.length <= max) {
    return value
  }

  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)

  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`
}
