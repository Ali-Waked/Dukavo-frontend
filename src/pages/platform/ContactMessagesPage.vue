<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Eye, Inbox, RefreshCw, Trash2 } from '@/components/icons'
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
import { CONTACT_STATUS_OPTIONS } from '@/constants/statusConfig'
import { CONTACT_STATUS, statusOptions } from '@/constants/statuses'
import {
  deleteContactMessage,
  fetchContactMessages,
  updateContactMessage,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { ContactStatus } from '@/types/enums'
import type { ContactMessage } from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * Contact inbox.
 *
 * Triage only: the message body is a faithful copy of what the visitor wrote,
 * so the workflow status (new → read → replied → closed) is the single field an
 * operator may change. The detail view is a modal rather than a page because
 * there is nothing else to do with a message.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<ContactMessage[]>([])
const meta = ref<Paginated<ContactMessage>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const statusFilter = ref('')

const savingId = ref<number | null>(null)
const pendingDelete = ref<ContactMessage | null>(null)
const deleting = ref(false)
const viewing = ref<ContactMessage | null>(null)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(() => query.value.trim() !== '' || statusFilter.value !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'from', label: t('common.name') },
  { key: 'subject', label: t('common.subject') },
  { key: 'status', label: t('common.status'), width: '11rem' },
  { key: 'created', label: t('common.createdAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '6.5rem' },
])

const statusChoices = computed(() =>
  statusOptions(CONTACT_STATUS).map(({ value, meta: m }) => ({ value, label: t(m.key) })),
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
    const result = await fetchContactMessages({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: (statusFilter.value || undefined) as ContactStatus | undefined,
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

function openMessage(message: ContactMessage): void {
  viewing.value = message
  // Opening an unread message is the natural moment to mark it read; the server
  // is the authority, so only act when it actually changes something.
  if (message.status === 'new') {
    void changeStatus(message, 'read')
  }
}

async function changeStatus(message: ContactMessage, value: string): Promise<void> {
  const status = value as ContactStatus
  if (status === message.status) return

  savingId.value = message.id
  try {
    const updated = await updateContactMessage(message.id, status)
    const row = rows.value.find((item) => item.id === message.id)
    if (row) {
      row.status = updated.status
      row.status_label = updated.status_label
    }
    if (viewing.value?.id === message.id) {
      viewing.value.status = updated.status
      viewing.value.status_label = updated.status_label
    }
    toast.success(t('platform.contact.statusUpdated'))
  } catch (caught) {
    toast.error(errorMessage(caught))
    await load()
  } finally {
    savingId.value = null
  }
}

async function confirmDelete(): Promise<void> {
  const message = pendingDelete.value
  if (!message) return

  deleting.value = true
  try {
    await deleteContactMessage(message.id)
    toast.success(t('platform.contact.deleted'))
    pendingDelete.value = null
    if (viewing.value?.id === message.id) {
      viewing.value = null
    }
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
    <PageHeader :title="t('platform.contact.title')" :description="t('platform.contact.subtitle')" />

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
        <tr v-for="message in rows" :key="message.id">
          <td class="whitespace-nowrap px-4 py-3">
            <span class="block font-medium text-ink">{{ message.name }}</span>
            <span class="mt-0.5 block text-caption text-subtle">{{ message.email }}</span>
          </td>

          <td class="px-4 py-3">
            <button
              type="button"
              class="text-start font-medium text-ink hover:text-brand-700"
              @click="openMessage(message)"
            >
              {{ message.subject }}
            </button>
          </td>

          <td class="whitespace-nowrap px-4 py-3">
            <StatusSelect
              :model-value="message.status"
              :options="CONTACT_STATUS_OPTIONS"
              :loading="savingId === message.id"
              :disabled="!canManage"
              @change="changeStatus(message, $event)"
            />
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(message.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div class="flex justify-end gap-1">
              <button
                type="button"
                class="btn-icon"
                :aria-label="t('action.viewDetails')"
                :title="t('action.viewDetails')"
                @click="openMessage(message)"
              >
                <Eye class="size-5" />
              </button>
              <button
                v-if="canManage"
                type="button"
                class="btn-icon text-danger-ink hover:bg-danger-soft"
                :aria-label="t('action.delete')"
                :title="t('action.delete')"
                @click="pendingDelete = message"
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
            :icon="Inbox"
            :title="t('platform.contact.emptyTitle')"
            :description="t('platform.contact.emptyBody')"
          />
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Message detail -->
    <BaseModal
      :open="viewing !== null"
      :title="viewing?.subject ?? ''"
      size="lg"
      @close="viewing = null"
    >
      <div v-if="viewing" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-ink">{{ viewing.name }}</p>
            <a
              :href="`mailto:${viewing.email}`"
              class="text-small text-brand-700 hover:underline"
            >
              {{ viewing.email }}
            </a>
          </div>
          <span class="text-caption text-subtle tabular-nums">
            {{ formatDateTime(viewing.created_at) }}
          </span>
        </div>

        <div class="space-y-1.5">
          <p class="text-sm font-medium text-ink">{{ t('common.status') }}</p>
          <StatusSelect
            :model-value="viewing.status"
            :options="CONTACT_STATUS_OPTIONS"
            :loading="savingId === viewing.id"
            :disabled="!canManage"
            @change="viewing && changeStatus(viewing, $event)"
          />
        </div>

        <div class="rounded-lg border border-line bg-surface-2 p-4">
          <p class="whitespace-pre-wrap break-words text-sm text-ink">{{ viewing.message }}</p>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="viewing = null">
          {{ t('action.close') }}
        </BaseButton>
        <BaseButton
          v-if="canManage && viewing"
          variant="danger"
          :icon="Trash2"
          @click="pendingDelete = viewing"
        >
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.contact.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{
          t('platform.contact.deleteBody', {
            subject: pendingDelete?.subject ?? '',
            name: pendingDelete?.name ?? '',
          })
        }}
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
