<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, Trash2, UserPlus } from '@/components/icons'
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
import { WAITLIST_STATUS_OPTIONS } from '@/constants/statusConfig'
import { WAITLIST_STATUS, statusOptions } from '@/constants/statuses'
import {
  deleteWaitlistEntry,
  fetchWaitlistEntries,
  updateWaitlistEntry,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { WaitlistStatus } from '@/types/enums'
import type { WaitlistEntry } from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * Waitlist administration.
 *
 * Signups are immutable: an operator can advance the workflow status (pending →
 * invited → joined, or disqualified) but never edit what the visitor typed.
 * Deletion is spam cleanup only.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<WaitlistEntry[]>([])
const meta = ref<Paginated<WaitlistEntry>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const statusFilter = ref('')

const savingId = ref<number | null>(null)
const pendingDelete = ref<WaitlistEntry | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(() => query.value.trim() !== '' || statusFilter.value !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'email', label: t('common.email') },
  { key: 'business_type', label: t('platform.waitlist.businessType') },
  { key: 'source', label: t('common.source') },
  { key: 'status', label: t('common.status'), width: '11rem' },
  { key: 'created', label: t('common.createdAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const statusChoices = computed(() =>
  statusOptions(WAITLIST_STATUS).map(({ value, meta: m }) => ({ value, label: t(m.key) })),
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
    const result = await fetchWaitlistEntries({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: (statusFilter.value || undefined) as WaitlistStatus | undefined,
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

async function changeStatus(entry: WaitlistEntry, value: string): Promise<void> {
  const status = value as WaitlistStatus
  if (status === entry.status) return

  savingId.value = entry.id
  try {
    const updated = await updateWaitlistEntry(entry.id, status)
    const row = rows.value.find((item) => item.id === entry.id)
    if (row) {
      row.status = updated.status
      row.status_label = updated.status_label
    }
    toast.success(t('platform.waitlist.statusUpdated'))
  } catch (caught) {
    toast.error(errorMessage(caught))
    await load()
  } finally {
    savingId.value = null
  }
}

async function confirmDelete(): Promise<void> {
  const entry = pendingDelete.value
  if (!entry) return

  deleting.value = true
  try {
    await deleteWaitlistEntry(entry.id)
    toast.success(t('platform.waitlist.deleted'))
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
    <PageHeader :title="t('platform.waitlist.title')" :description="t('platform.waitlist.subtitle')" />

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
        <tr v-for="entry in rows" :key="entry.id">
          <td class="whitespace-nowrap px-4 py-3">
            <span class="block font-medium text-ink">{{ entry.email }}</span>
            <span v-if="entry.name" class="mt-0.5 block text-caption text-subtle">{{ entry.name }}</span>
          </td>

          <td class="px-4 py-3 text-muted">
            <span v-if="entry.business_type">{{ entry.business_type }}</span>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="px-4 py-3 text-muted">
            <span v-if="entry.source">{{ entry.source }}</span>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="whitespace-nowrap px-4 py-3">
            <StatusSelect
              :model-value="entry.status"
              :options="WAITLIST_STATUS_OPTIONS"
              :loading="savingId === entry.id"
              :disabled="!canManage"
              @change="changeStatus(entry, $event)"
            />
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(entry.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div v-if="canManage" class="flex justify-end">
              <button
                type="button"
                class="btn-icon text-danger-ink hover:bg-danger-soft"
                :aria-label="t('action.delete')"
                :title="t('action.delete')"
                @click="pendingDelete = entry"
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
            :icon="UserPlus"
            :title="t('platform.waitlist.emptyTitle')"
            :description="t('platform.waitlist.emptyBody')"
          />
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.waitlist.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.waitlist.deleteBody', { email: pendingDelete?.email ?? '' }) }}
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
