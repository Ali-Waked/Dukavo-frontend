<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, MoreHorizontal, Pencil, Plus, RefreshCw, Store, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createStore,
  deleteStore,
  fetchStores,
  makeDefaultStore,
  updateStore,
  type StorePayload,
} from '@/services/storeService'
import type { Store as StoreRecord } from '@/types/catalogue'
import type { StoreStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatDateTime } from '@/utils/format'

/**
 * Sales channels.
 *
 * The one list screen without pagination: `fetchStores` returns every store as
 * a plain array, so the status filter runs against rows already in memory and
 * never refetches. "Make default" does reload — the default is a tenant-level
 * fact that belongs to the whole list, not to one row, so a partial update
 * would leave the other badges wrong until the next visit.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<StoreRecord[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const status = ref<string>('')

const pendingDelete = ref<StoreRecord | null>(null)
const deleting = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formSlug = ref('')
const formStatus = ref<string>('active')
const formEmail = ref('')
const formPhone = ref('')
const formCurrency = ref('')
const formTimezone = ref('')
const formIsDefault = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

const canManage = computed(() => auth.can('stores.manage'))

const hasFilters = computed(() => status.value !== '')

const statusOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'active', label: t('status.store.active') },
  { value: 'inactive', label: t('status.store.inactive') },
])

const statusFormOptions = computed(() => [
  { value: 'active', label: t('status.store.active') },
  { value: 'inactive', label: t('status.store.inactive') },
])

const filteredRows = computed(() =>
  status.value ? rows.value.filter((store) => store.status === status.value) : rows.value,
)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'slug', label: t('stores.slug') },
  { key: 'status', label: t('stores.status'), width: '9rem' },
  { key: 'default', label: t('stores.default'), width: '8rem' },
  { key: 'created', label: t('common.createdAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const STATUS_LABEL_KEYS = {
  active: 'status.store.active',
  inactive: 'status.store.inactive',
} as const

function statusLabel(value: StoreStatus): string {
  return t(STATUS_LABEL_KEYS[value])
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    rows.value = await fetchStores()
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

/** Client-side only: the fetch has no status parameter to narrow with. */
function clearFilters(): void {
  status.value = ''
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

/* ------------------------------------------------------------------- form */

/** Inputs this form tracks; anything else the server rejects falls to a toast. */
const BOUND_FIELDS = ['name', 'slug', 'email', 'phone', 'currency', 'timezone'] as const

function fieldError(field: string): string | null {
  return fieldErrors.value[field] ?? null
}

function clearFormErrors(): void {
  fieldErrors.value = {}
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formSlug.value = ''
  formStatus.value = 'active'
  formEmail.value = ''
  formPhone.value = ''
  formCurrency.value = auth.activeTenant?.currency ?? ''
  formTimezone.value = auth.activeTenant?.timezone ?? ''
  formIsDefault.value = false
  clearFormErrors()
  formOpen.value = true
}

function openEdit(store: StoreRecord): void {
  editingId.value = store.id
  formName.value = store.name
  formSlug.value = store.slug
  formStatus.value = store.status
  formEmail.value = store.email ?? ''
  formPhone.value = store.phone ?? ''
  formCurrency.value = store.currency
  formTimezone.value = store.timezone
  formIsDefault.value = store.is_default
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm(): boolean {
  const next: Record<string, string> = {}

  if (!formName.value.trim()) {
    next['name'] = t('validation.required')
  }

  const email = formEmail.value.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    next['email'] = t('validation.email')
  }

  fieldErrors.value = next
  return Object.keys(next).length === 0
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const next: Record<string, string> = {}
    for (const field of BOUND_FIELDS) {
      const message = caught.fields[field]?.[0]
      if (message) next[field] = message
    }
    fieldErrors.value = next
    if (Object.keys(next).length > 0) return
  }

  toast.error(errorMessage(caught))
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  const payload: StorePayload = {
    name: formName.value.trim(),
    slug: formSlug.value.trim() || undefined,
    status: formStatus.value as StoreStatus,
    email: formEmail.value.trim() || null,
    phone: formPhone.value.trim() || null,
    currency: formCurrency.value.trim() || undefined,
    timezone: formTimezone.value.trim() || undefined,
    is_default: formIsDefault.value,
  }

  try {
    if (editingId.value !== null) {
      await updateStore(editingId.value, payload)
      toast.success(t('stores.updated'))
    } else {
      await createStore(payload)
      toast.success(t('stores.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

/* ------------------------------------------------------------ mutations */

async function makeDefault(store: StoreRecord): Promise<void> {
  try {
    await makeDefaultStore(store.id)
    toast.success(t('stores.defaultSet'))
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  }
}

async function confirmDelete(): Promise<void> {
  const store = pendingDelete.value
  if (!store) return

  deleting.value = true
  try {
    await deleteStore(store.id)
    toast.success(t('stores.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    // 409 covers "this is the default store" — the server's sentence explains
    // the refusal far better than a generic failure would.
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('stores.title')" :description="t('stores.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('stores.add') }}
        </BaseButton>
      </template>
    </PageHeader>

    <!-- A failed refresh keeps the rows on screen; a failed first load is
         explained by the table's empty slot below. -->
    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Filters -->
    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseSelect
        v-model="status"
        class="w-44"
        :label="t('stores.status')"
        :options="statusOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="filteredRows">
        <tr v-for="store in filteredRows" :key="store.id">
          <td class="px-4 py-3 font-medium text-ink">
            {{ store.name }}
          </td>

          <td class="px-4 py-3 font-mono text-caption text-muted">
            {{ store.slug }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(store.status)" dot>
              {{ store.status_label ?? statusLabel(store.status) }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3">
            <BaseBadge v-if="store.is_default" size="sm" tone="brand">
              {{ t('stores.isDefault') }}
            </BaseBadge>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ formatDateTime(store.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div v-if="canManage" class="flex justify-end">
              <BaseDropdown align="end">
                <template #trigger>
                  <span
                    class="btn-icon"
                    role="button"
                    :aria-label="t('action.moreActions')"
                    :title="t('action.moreActions')"
                  >
                    <MoreHorizontal class="size-5" />
                  </span>
                </template>

                <template #default="{ close }">
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(store)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    v-if="!store.is_default"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); makeDefault(store)"
                  >
                    <Check class="size-4 text-muted" />
                    {{ t('stores.makeDefault') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = store"
                  >
                    <Trash2 class="size-4" />
                    {{ t('action.delete') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="error && rows.length === 0"
            :title="t('state.loadFailed')"
            :description="t('state.loadFailedBody')"
          >
            <template #action>
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('action.retry') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="filteredRows.length === 0 && hasFilters"
            :title="t('common.noResults')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="filteredRows.length === 0"
            :icon="Store"
            :title="t('stores.emptyTitle')"
            :description="t('stores.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('stores.add') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('stores.create') : t('stores.edit')"
      size="lg"
      @close="closeForm"
    >
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formName"
            :label="t('common.name')"
            :placeholder="t('stores.namePlaceholder')"
            :error="fieldError('name')"
            required
          />

          <BaseInput
            v-model="formSlug"
            :label="t('stores.slug')"
            :error="fieldError('slug')"
            :hint="t('common.optional')"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formEmail"
            type="email"
            :label="t('common.email')"
            :error="fieldError('email')"
            autocomplete="email"
          />

          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            :error="fieldError('phone')"
            autocomplete="tel"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formCurrency"
            :label="t('common.currency')"
            :error="fieldError('currency')"
          />

          <BaseInput
            v-model="formTimezone"
            :label="t('common.timezone')"
            :error="fieldError('timezone')"
          />
        </div>

        <BaseSelect
          v-model="formStatus"
          :label="t('stores.status')"
          :options="statusFormOptions"
        />

        <BaseSwitch v-model="formIsDefault" :label="t('stores.isDefault')" />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="saving" @click="submitForm">
          {{ editingId === null ? t('action.create') : t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('stores.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('stores.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
