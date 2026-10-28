<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { CheckCheck, Inbox, RefreshCw } from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NotificationItem from '@/components/notifications/NotificationItem.vue'
import { useI18n } from '@/i18n'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationReadFilter, NotificationSeverity } from '@/types/notifications'

/**
 * The notification centre.
 *
 * A personal inbox, not a workspace one: it lists what this signed-in user was
 * addressed on, across every workspace they belong to. Ownership is enforced by
 * the API, so the page never passes an identity it could get wrong.
 */

const { t } = useI18n()
const notifications = useNotificationStore()

const status = ref<NotificationReadFilter>('all')
const category = ref('all')
const severity = ref<'all' | NotificationSeverity>('all')
const page = ref(1)

const statusOptions = [
  { value: 'all', label: t('notifications.center.filter.all') },
  { value: 'unread', label: t('notifications.center.filter.unread') },
  { value: 'read', label: t('notifications.center.filter.read') },
]

const categoryOptions = [
  { value: 'all', label: t('notifications.center.category.all') },
  { value: 'orders', label: t('notifications.center.category.orders') },
  { value: 'inventory', label: t('notifications.center.category.inventory') },
  { value: 'messages', label: t('notifications.center.category.messages') },
  { value: 'automation', label: t('notifications.center.category.automation') },
  { value: 'leads', label: t('notifications.center.category.leads') },
  { value: 'tenants', label: t('notifications.center.category.tenants') },
  { value: 'system', label: t('notifications.center.category.system') },
]

const severityOptions = [
  { value: 'all', label: t('notifications.center.severity.all') },
  { value: 'info', label: t('notifications.center.severity.info') },
  { value: 'success', label: t('notifications.center.severity.success') },
  { value: 'warning', label: t('notifications.center.severity.warning') },
  { value: 'critical', label: t('notifications.center.severity.critical') },
]

function reload(): void {
  void notifications.load(status.value, page.value, {
    category: category.value === 'all' ? null : category.value,
    severity: severity.value === 'all' ? null : severity.value,
  })
}

onMounted(reload)

watch([status, category, severity], () => {
  page.value = 1
  reload()
})

watch(page, reload)

async function markAllRead(): Promise<void> {
  await notifications.markAllRead()
  reload()
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('notifications.center.title')"
      :description="t('notifications.center.subtitle')"
    >
      <template #actions>
        <BaseButton
          v-if="notifications.hasUnread"
          variant="secondary"
          :icon="CheckCheck"
          @click="markAllRead"
        >
          {{ t('notifications.center.markAllRead') }}
        </BaseButton>
      </template>
    </PageHeader>

    <div class="surface flex flex-wrap items-end justify-between gap-3 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <BaseSelect
          v-model="status"
          class="w-44"
          :label="t('notifications.center.statusLabel')"
          :options="statusOptions"
        />

        <BaseSelect
          v-model="category"
          class="w-44"
          :label="t('notifications.center.categoryLabel')"
          :options="categoryOptions"
        />

        <BaseSelect
          v-model="severity"
          class="w-44"
          :label="t('notifications.center.severityLabel')"
          :options="severityOptions"
        />
      </div>

      <span v-if="notifications.meta" class="text-caption text-subtle">
        {{ t('notifications.center.total', { count: notifications.meta.total }) }}
      </span>
    </div>

    <BaseAlert v-if="notifications.error" tone="danger" dismissible @dismiss="notifications.error = null">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ t('notifications.center.loadFailed') }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="reload">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div class="surface overflow-hidden">
      <template v-if="notifications.loading && notifications.items.length === 0">
        <div class="divide-y divide-line">
          <div v-for="index in 5" :key="index" class="flex animate-pulse gap-3 px-4 py-4">
            <span class="size-9 shrink-0 rounded-lg bg-surface-2" />
            <span class="flex-1 space-y-2">
              <span class="block h-3.5 w-1/3 rounded bg-surface-2" />
              <span class="block h-3 w-2/3 rounded bg-surface-2" />
            </span>
          </div>
        </div>
      </template>

      <div v-else-if="notifications.items.length > 0" class="divide-y divide-line">
        <NotificationItem
          v-for="notification in notifications.items"
          :key="notification.id"
          :notification="notification"
        />
      </div>

      <BaseEmptyState
        v-else
        :icon="Inbox"
        :title="t('notifications.center.empty')"
        :description="t('notifications.center.emptyBody')"
      />

      <div v-if="notifications.meta && notifications.meta.last_page > 1" class="border-t border-line">
        <BasePagination
          :meta="notifications.meta"
          :disabled="notifications.loading"
          @change="page = $event"
        />
      </div>
    </div>
  </div>
</template>
