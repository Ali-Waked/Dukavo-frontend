<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bell } from '@/components/icons'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import NotificationItem from '@/components/notifications/NotificationItem.vue'
import { useI18n } from '@/i18n'
import { useNotificationStore } from '@/stores/notificationStore'

/**
 * The bell in the topbar.
 *
 * It owns the polling lifecycle for the whole signed-in shell: while the shell
 * is mounted the unread badge stays current, and it stops the moment the shell
 * unmounts. The dropdown only fetches when opened, so an idle bell costs one
 * small count request a minute and nothing else.
 */

const { t } = useI18n()
const notifications = useNotificationStore()
const dropdown = ref<InstanceType<typeof BaseDropdown> | null>(null)

const badge = computed(() => (notifications.unreadCount > 9 ? '9+' : String(notifications.unreadCount)))

onMounted(() => notifications.startPolling())
onBeforeUnmount(() => notifications.stopPolling())

function openDropdown(): void {
  void notifications.loadPreview()
}

function viewAll(): void {
  dropdown.value?.close()
}
</script>

<template>
  <BaseDropdown ref="dropdown" align="end">
    <template #trigger>
      <button
        type="button"
        class="relative btn-icon"
        :title="t('notifications.center.title')"
        :aria-label="t('notifications.center.title')"
        @click="openDropdown"
      >
        <Bell class="size-5" />
        <span
          v-if="notifications.hasUnread"
          class="pointer-events-none absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold leading-4 text-white"
        >
          {{ badge }}
        </span>
      </button>
    </template>

    <div class="w-80 max-w-[calc(100vw-2rem)]">
      <div class="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span class="text-sm font-semibold text-ink">{{ t('notifications.center.title') }}</span>
        <button
          v-if="notifications.hasUnread"
          type="button"
          class="text-caption font-medium text-brand-ink transition hover:underline"
          @click="notifications.markAllRead()"
        >
          {{ t('notifications.center.markAllRead') }}
        </button>
      </div>

      <div v-if="notifications.items.length > 0" class="max-h-96 divide-y divide-line overflow-y-auto">
        <NotificationItem
          v-for="notification in notifications.items"
          :key="notification.id"
          :notification="notification"
        />
      </div>

      <p v-else class="px-4 py-8 text-center text-small text-muted">
        {{ t('notifications.center.empty') }}
      </p>

      <div class="border-t border-line p-2">
        <RouterLink
          :to="{ name: 'notifications.index' }"
          class="block w-full rounded-md px-3 py-2 text-center text-sm font-medium text-brand-ink transition hover:bg-surface-2"
          @click="viewAll"
        >
          {{ t('notifications.center.viewAll') }}
        </RouterLink>
      </div>
    </div>
  </BaseDropdown>
</template>
