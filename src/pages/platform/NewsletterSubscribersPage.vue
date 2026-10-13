<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Mail, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import StatusSelect from '@/components/ui/StatusSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { NEWSLETTER_STATUS_OPTIONS } from '@/constants/statusConfig'
import { NEWSLETTER_STATUS, statusOptions } from '@/constants/statuses'
import {
  deleteNewsletterSubscriber,
  fetchNewsletterSubscribers,
  updateNewsletterSubscriber,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { NewsletterStatus } from '@/types/enums'
import type { NewsletterSubscriber } from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * Newsletter administration.
 *
 * Status-only like the other inboxes: consent timestamps are the record of the
 * signup, so the one thing an operator can change is whether the address is
 * still subscribed. Deletion is offered for spam and GDPR cleanup.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<NewsletterSubscriber[]>([])
const meta = ref<Paginated<NewsletterSubscriber>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const statusFilter = ref('')

const savingId = ref<number | null>(null)
const pendingDelete = ref<NewsletterSubscriber | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(() => query.value.trim() !== '' || statusFilter.value !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'email', label: t('common.email') },
  { key: 'source', label: t('common.source') },
  { key: 'status', label: t('common.status'), width: '11rem' },
  { key: 'subscribed', label: t('platform.newsletter.consentedAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const statusChoices = computed(() =>
  statusOptions(NEWSLETTER_STATUS).map(({ value, meta: m }) => ({ value, label: t(m.key) })),
)

const filterChoices = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  ...statusChoices.value,
])

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchNewsletterSubscribers({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: (statusFilter.value || undefined) as NewsletterStatus | undefined,
    })
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('error.title')
  } finally {
    loading.value = false
  }
}

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch(statusFilter, () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  statusFilter.value = ''
}

async function changeStatus(subscriber: NewsletterSubscriber, value: string): Promise<void> {
  const status = value as NewsletterStatus
  if (status === subscriber.status) return

  savingId.value = subscriber.id
  try {
    const updated = await updateNewsletterSubscriber(subscriber.id, status)
    const row = rows.value.find((item) => item.id === subscriber.id)
    if (row) {
      row.status = updated.status
      row.status_label = updated.status_label
    }
    toast.success(t('platform.newsletter.statusUpdated'))
  } catch (caught) {
    toast.error(errorMessage(caught))
    await load()
  } finally {
    savingId.value = null
  }
}

async function confirmDelete(): Promise<void> {
  const subscriber = pendingDelete.value
  if (!subscriber) return

  deleting.value = true
  try {
    await deleteNewsletterSubscriber(subscriber.id)
    toast.success(t('platform.newsletter.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.newsletter.title')" :description="t('platform.newsletter.subtitle')" />

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseInput
        v-model="query"
        class="min-w-56 flex-1"
        type="search"
        :label="t('filter.search')"
        :placeholder="t('filter.searchPlaceholder')"
      />
      <BaseSelect v-model="statusFilter" class="w-44" :label="t('common.status')" :options="filterChoices" />
      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <div class="surface overflow-x-auto">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="subscriber in rows" :key="subscriber.id">
          <td class="whitespace-nowrap px-4 py-3">
            <span class="block font-medium text-ink">{{ subscriber.email }}</span>
          </td>

          <td class="px-4 py-3 text-muted">
            <span v-if="subscriber.source">{{ subscriber.source }}</span>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="whitespace-nowrap px-4 py-3">
            <StatusSelect
              :model-value="subscriber.status"
              :options="NEWSLETTER_STATUS_OPTIONS"
              :loading="savingId === subscriber.id"
              :disabled="!canManage"
              @change="changeStatus(subscriber, $event)"
            />
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(subscriber.consented_at ?? subscriber.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div v-if="canManage" class="flex justify-end">
              <button
                type="button"
                class="btn-icon text-danger-ink hover:bg-danger-soft"
                :aria-label="t('action.delete')"
                :title="t('action.delete')"
                @click="pendingDelete = subscriber"
              >
                <Trash2 class="size-5" />
              </button>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="error && !loading"
            :title="t('state.loadFailed')"
            :description="t('state.loadFailedBody')"
          >
            <template #action>
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('action.retry') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState v-else-if="hasFilters" :title="t('common.noResults')">
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else
            :icon="Mail"
            :title="t('platform.newsletter.emptyTitle')"
            :description="t('platform.newsletter.emptyBody')"
          />
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.newsletter.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.newsletter.deleteBody', { email: pendingDelete?.email ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
