/**
 * Locally remembered tracking links.
 *
 * A guest has no account and no order list, so the only way back to an order is
 * the secret token. Remembering the last few links on this device is a
 * convenience; the token itself remains the authorisation, and clearing this
 * storage never exposes anything.
 */

export interface TrackedOrder {
  token: string
  orderNumber: string
  storeName: string
  placedAt?: string | null
}

const PREFIX = 'dukavo.storefront.orders.v1'
const LIMIT = 8

function storageKey(tenantSlug: string, storeSlug: string): string {
  return `${PREFIX}:${tenantSlug}/${storeSlug}`
}

export function listTrackedOrders(tenantSlug: string, storeSlug: string): TrackedOrder[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantSlug, storeSlug))
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is TrackedOrder => {
      if (!entry || typeof entry !== 'object') return false
      const candidate = entry as Partial<TrackedOrder>
      return (
        typeof candidate.token === 'string' &&
        typeof candidate.orderNumber === 'string' &&
        typeof candidate.storeName === 'string'
      )
    })
  } catch {
    return []
  }
}

export function rememberTrackedOrder(
  tenantSlug: string,
  storeSlug: string,
  order: TrackedOrder,
): void {
  if (!order.token) return

  try {
    const existing = listTrackedOrders(tenantSlug, storeSlug).filter(
      (entry) => entry.token !== order.token,
    )
    const next = [order, ...existing].slice(0, LIMIT)
    localStorage.setItem(storageKey(tenantSlug, storeSlug), JSON.stringify(next))
  } catch {
    // Storage can be unavailable; the order is still reachable from its link.
  }
}

export function forgetTrackedOrders(tenantSlug: string, storeSlug: string): void {
  try {
    localStorage.removeItem(storageKey(tenantSlug, storeSlug))
  } catch {
    // Nothing was stored, or storage is unavailable.
  }
}
