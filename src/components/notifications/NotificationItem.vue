<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell,
  Check,
  MessageSquare,
  Package,
  ShoppingCart,
  Store,
  UserPlus,
  X,
} from '@/components/icons'
import { useI18n } from '@/i18n'
import { useNotificationStore } from '@/stores/notificationStore'
import { BADGE_TONE_CLASSES, type BadgeTone } from '@/components/ui/badgeTones'
import type { AppNotification, NotificationSeverity } from '@/types/notifications'
import { formatRelative } from '@/utils/format'

/**
 * One notification row, shared by the bell's dropdown and the centre.
 *
 * The icon is chosen from the event's `category` rather than its key, so a new
 * event in an existing family inherits the right glyph without a code change,
 * and an unrecognised category still renders a bell instead of nothing.
 *
 * Opening a notification navigates and marks it read in one gesture: opening it
 * is the acknowledgement, so a separate "mark read" click would be busywork.
 */

const props = defineProps<{ notification: AppNotification }>()

const { t } = useI18n()
const router = useRouter()
const notifications = useNotificationStore()

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  orders: ShoppingCart,
  inventory: Package,
  messages: MessageSquare,
  leads: UserPlus,
  tenants: Store,
}

const SEVERITY_TONES: Record<NotificationSeverity, BadgeTone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  critical: 'danger',
}

const icon = computed(() => CATEGORY_ICONS[props.notification.category] ?? Bell)
const toneClass = computed(
  () => BADGE_TONE_CLASSES[SEVERITY_TONES[props.notification.severity] ?? 'info'],
)

async function open(): Promise<void> {
  if (!props.notification.read) {
    void notifications.markRead(props.notification.id)
  }

  if (props.notification.action_url) {
    await router.push(props.notification.action_url)
  }
}

function markRead(): void {
  void notifications.markRead(props.notification.id)
}

function dismiss(): void {
  void notifications.dismiss(props.notification.id)
}
</script>

<template>
  <div
    class="flex gap-3 px-4 py-3 transition"
    :class="notification.read ? 'bg-surface' : 'bg-brand-soft/40'"
  >
    <span
      class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border"
      :class="toneClass"
    >
      <component :is="icon" class="size-5" aria-hidden="true" />
    </span>

    <div class="min-w-0 flex-1">
      <button type="button" class="flex w-full items-start gap-2 text-start" @click="open">
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold text-ink">{{ notification.title }}</span>
            <span
              v-if="!notification.read"
              class="size-2 shrink-0 rounded-full bg-accent-400"
              aria-hidden="true"
            />
          </span>
          <span class="mt-0.5 block text-small text-muted">{{ notification.body }}</span>
          <span class="mt-1 block text-caption text-subtle">
            {{ formatRelative(notification.created_at) }}
          </span>
        </span>
      </button>
    </div>

    <div class="flex shrink-0 items-start gap-0.5">
      <button
        v-if="!notification.read"
        type="button"
        class="btn-icon"
        :title="t('notifications.center.markRead')"
        :aria-label="t('notifications.center.markRead')"
        @click.stop="markRead"
      >
        <Check class="size-4" />
      </button>

      <button
        type="button"
        class="btn-icon"
        :title="t('notifications.center.dismiss')"
        :aria-label="t('notifications.center.dismiss')"
        @click.stop="dismiss"
      >
        <X class="size-4" />
      </button>
    </div>
  </div>
</template>
