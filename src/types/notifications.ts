/**
 * The notification centre's wire types.
 *
 * These mirror `NotificationResource` on the server. The event parameters that
 * produced a message ride under `params` rather than `data`, because `data` is
 * already the name of the API envelope's payload slot.
 */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical'

/** Which slice of the list a caller is looking at. */
export type NotificationReadFilter = 'all' | 'unread' | 'read'

export interface AppNotification {
  id: string
  /** Catalogue key, e.g. `tenant.order.created`. Stable; safe to branch on. */
  event_key: string
  /** Grouping used to pick an icon: `orders`, `inventory`, `messages`, … */
  category: string
  severity: NotificationSeverity
  title: string
  body: string
  /** In-app destination, e.g. `/orders/ORD-000123`. Platform routes are absolute. */
  action_url: string | null
  /** Interpolation values behind the humanised title/body. */
  params: Record<string, unknown>
  read: boolean
  read_at: string | null
  created_at: string | null
}

/** One channel's availability, keyed by its stored preference key. */
export interface NotificationChannelAvailability {
  available: boolean
  reason: string | null
  label: string
}

export type NotificationChannelAvailabilityMap = Record<string, NotificationChannelAvailability>
