import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type {
  AppNotification,
  NotificationChannelAvailabilityMap,
  NotificationReadFilter,
} from '@/types/notifications'

/**
 * The signed-in user's own notification inbox.
 *
 * Every call here is personal, never tenant scoped: the endpoints live under
 * `/notifications` and act on the caller, so a user sees one bell across all
 * their workspaces. Nothing in this service takes a user id — the server decides
 * ownership, and an id the caller does not own answers 404.
 */

const PATHS = {
  list: '/notifications',
  unreadCount: '/notifications/unread-count',
  readAll: '/notifications/read-all',
} as const

export interface NotificationListParams {
  status?: NotificationReadFilter
  page?: number
  per_page?: number
}

export function fetchNotifications(
  params: NotificationListParams = {},
): Promise<Paginated<AppNotification>> {
  return api.list<AppNotification>(PATHS.list, { ...(params as Record<string, unknown>) })
}

export function fetchUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>(PATHS.unreadCount)
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return api.post<AppNotification>(`${PATHS.list}/${id}/read`)
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return api.post<{ updated: number }>(PATHS.readAll)
}

export function dismissNotification(id: string): Promise<void> {
  return api.delete<void>(`${PATHS.list}/${id}`)
}

/** Which channels this installation can actually send on, for the settings UI. */
export function fetchNotificationChannelAvailability(): Promise<NotificationChannelAvailabilityMap> {
  return api.get<NotificationChannelAvailabilityMap>('/profile/notifications/channels')
}
