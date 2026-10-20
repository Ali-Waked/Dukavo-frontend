import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/lib/axiosClient'
import {
  dismissNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService'
import type { Paginated } from '@/types/api'
import type { AppNotification, NotificationReadFilter } from '@/types/notifications'

/**
 * The bell, the centre and the unread badge, in one store.
 *
 * They share state because they answer the same question: what is waiting for
 * me right now. The badge is refreshed on a timer so it stays honest without a
 * websocket; the list itself is only fetched on demand, so a background poll
 * never churns through rows nobody is looking at.
 */

/** How often the unread count is refreshed while a session is open. */
const POLL_INTERVAL_MS = 60_000

/** How many rows the bell's dropdown shows before "view all". */
export const BELL_PREVIEW_LIMIT = 6

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const meta = ref<Paginated<AppNotification>['meta'] | null>(null)
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setInterval> | null = null

  const hasUnread = computed(() => unreadCount.value > 0)

  function messageFor(caught: unknown, fallback: string): string {
    return caught instanceof ApiError ? caught.message : fallback
  }

  /** Refresh just the badge. A failure keeps the last known count. */
  async function refreshUnreadCount(): Promise<void> {
    try {
      unreadCount.value = (await fetchUnreadCount()).count
    } catch {
      // The badge is auxiliary; a transient failure must not throw into the UI.
    }
  }

  /** Load the centre's list for a filter and page. */
  async function load(filter: NotificationReadFilter = 'all', page = 1): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const result = await fetchNotifications({ status: filter, page })
      items.value = result.data
      meta.value = result.meta
    } catch (caught) {
      error.value = messageFor(caught, 'load_failed')
    } finally {
      loading.value = false
    }
  }

  /** Load the newest handful for the bell's dropdown. */
  async function loadPreview(): Promise<void> {
    error.value = null

    try {
      const result = await fetchNotifications({ status: 'all', per_page: BELL_PREVIEW_LIMIT })
      items.value = result.data
      meta.value = result.meta
    } catch (caught) {
      error.value = messageFor(caught, 'load_failed')
    }
  }

  function applyReadLocally(notification: AppNotification): void {
    notification.read = true
    notification.read_at = notification.read_at ?? new Date().toISOString()
  }

  async function markRead(id: string): Promise<void> {
    const target = items.value.find((item) => item.id === id)

    if (target?.read) {
      return
    }

    try {
      const updated = await markNotificationRead(id)
      const index = items.value.findIndex((item) => item.id === id)

      if (index !== -1) {
        items.value[index] = updated
      }

      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (caught) {
      error.value = messageFor(caught, 'action_failed')
    }
  }

  async function markAllRead(): Promise<void> {
    if (unreadCount.value === 0) {
      return
    }

    try {
      await markAllNotificationsRead()
      items.value.forEach((item) => applyReadLocally(item))
      unreadCount.value = 0
    } catch (caught) {
      error.value = messageFor(caught, 'action_failed')
    }
  }

  async function dismiss(id: string): Promise<void> {
    const target = items.value.find((item) => item.id === id)
    const wasUnread = target ? !target.read : false

    try {
      await dismissNotification(id)
      items.value = items.value.filter((item) => item.id !== id)

      if (wasUnread) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (caught) {
      error.value = messageFor(caught, 'action_failed')
    }
  }

  /** Begin refreshing the badge. Idempotent, so several mounts share one timer. */
  function startPolling(): void {
    if (timer !== null) {
      return
    }

    void refreshUnreadCount()
    timer = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  /** Reset on sign-out so the next session starts from a clean badge. */
  function reset(): void {
    stopPolling()
    items.value = []
    meta.value = null
    unreadCount.value = 0
    loading.value = false
    error.value = null
  }

  return {
    items,
    meta,
    unreadCount,
    loading,
    error,
    hasUnread,
    refreshUnreadCount,
    load,
    loadPreview,
    markRead,
    markAllRead,
    dismiss,
    startPolling,
    stopPolling,
    reset,
  }
})
