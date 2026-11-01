<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Eye, MoreHorizontal, Pencil, Trash2, UserPlus } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
} from '@/services/customerService'
import type { Customer } from '@/types/commerce'
import type { Paginated } from '@/types/api'
import type { CustomerStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatNumber, formatRelative } from '@/utils/format'
import { activeCurrency } from '@/utils/currency'

/**
 * Customer list.
 *
 * There is no customer create/edit route, so both live in one modal on this
 * page — the modal is the form, and the row menu only offers what the signed-in
 * user is actually allowed to do. The table never blanks out while loading: it
 * shows skeleton rows at the real column widths, and a search with no hits says
 * so in words that offer a way out rather than leaving an empty grid.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

const query = ref('')
const status = ref('')
const page = ref(1)

const debouncedQuery = useDebounce(query, 300)

const rows = ref<Customer[]>([])
const meta = ref<Paginated<Customer>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const pendingDelete = ref<Customer | null>(null)
const deleting = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formStatus = ref<string>('active')
const formNotes = ref('')
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const canCreate = computed(() => auth.can('customers.create'))
const canUpdate = computed(() => auth.can('customers.update'))
const canDelete = computed(() => auth.can('customers.delete'))
const currency = computed(() => auth.activeTenant?.currency ?? activeCurrency())

const hasFilters = computed(() => query.value !== '' || status.value !== '')

const statusFilterOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'active', label: t('status.customer.active') },
  { value: 'inactive', label: t('status.customer.inactive') },
  { value: 'blocked', label: t('status.customer.blocked') },
])

const statusFormOptions = computed(() => [
  { value: 'active', label: t('status.customer.active') },
  { value: 'inactive', label: t('status.customer.inactive') },
  { value: 'blocked', label: t('status.customer.blocked') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'phone', label: t('common.phone') },
  { key: 'orders', label: t('customers.ordersCount'), align: 'end' },
  { key: 'last_order', label: t('customers.lastOrder'), align: 'end' },
  { key: 'spent', label: t('customers.totalSpent'), align: 'end' },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const STATUS_LABEL_KEYS = {
  active: 'status.customer.active',
  inactive: 'status.customer.inactive',
  blocked: 'status.customer.blocked',
} as const

function statusLabel(value: CustomerStatus): string {
  return t(STATUS_LABEL_KEYS[value])
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchCustomers({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value ? (status.value as CustomerStatus) : undefined,
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

watch(status, () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  status.value = ''
  page.value = 1
  void load()
}

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  nameError.value = null
  emailError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formEmail.value = ''
  formPhone.value = ''
  formStatus.value = 'active'
  formNotes.value = ''
  clearFormErrors()
  formOpen.value = true
}

function openEdit(customer: Customer): void {
  editingId.value = customer.id
  formName.value = customer.name
  formEmail.value = customer.email ?? ''
  formPhone.value = customer.phone ?? ''
  formStatus.value = customer.status
  formNotes.value = customer.notes ?? ''
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm(): boolean {
  clearFormErrors()

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
  }

  const email = formEmail.value.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    emailError.value = t('validation.email')
  }

  return nameError.value === null && emailError.value === null
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const nameMessage = caught.fields['name']?.[0]
    const emailMessage = caught.fields['email']?.[0]
    nameError.value = nameMessage ?? null
    emailError.value = emailMessage ?? null

    if (!nameMessage && !emailMessage) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  const payload = {
    name: formName.value.trim(),
    email: formEmail.value.trim() || null,
    phone: formPhone.value.trim() || null,
    status: formStatus.value as CustomerStatus,
    notes: formNotes.value.trim() || null,
  }

  try {
    if (editingId.value !== null) {
      await updateCustomer(editingId.value, payload)
      toast.success(t('customers.updated'))
    } else {
      await createCustomer(payload)
      toast.success(t('customers.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

/* ----------------------------------------------------------------- delete */

async function confirmDelete(): Promise<void> {
  const customer = pendingDelete.value
  if (!customer) return

  deleting.value = true
  try {
    await deleteCustomer(customer.id)
    toast.success(t('customers.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('customers.title')" :description="t('customers.subtitle')">
      <template #actions>
        <BaseButton v-if="canCreate" :icon="UserPlus" @click="openCreate">
          {{ t('customers.add') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Filters -->
    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseInput
        v-model="query"
        class="min-w-56 flex-1"
        type="search"
        :label="t('filter.search')"
        :placeholder="t('filter.searchPlaceholder')"
      />

      <BaseSelect
        v-model="status"
        class="w-40"
        :label="t('common.status')"
        :options="statusFilterOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="customer in rows" :key="customer.id">
          <td class="px-4 py-3">
            <RouterLink
              :to="{ name: 'customers.show', params: { id: String(customer.id) } }"
              class="block rounded-md font-medium text-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {{ customer.name }}
            </RouterLink>
            <span class="mt-0.5 block text-caption text-subtle">
              {{ customer.email || '—' }}
            </span>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ customer.phone || '—' }}
          </td>

          <td
            class="px-4 py-3 text-end tabular-nums"
            :class="customer.orders_count ? 'text-ink' : 'text-subtle'"
          >
            {{ customer.orders_count !== undefined ? formatNumber(customer.orders_count) : '—' }}
          </td>

          <td
            class="px-4 py-3 text-end"
            :class="customer.last_order_at ? 'text-ink' : 'text-subtle'"
          >
            <span v-if="customer.last_order_at" class="tabular-nums">
              {{ formatRelative(customer.last_order_at) }}
            </span>
            <span v-else>—</span>
          </td>

          <td
            class="px-4 py-3 text-end tabular-nums"
            :class="customer.total_spent ? 'text-ink' : 'text-subtle'"
          >
            {{ customer.total_spent !== undefined ? formatCurrency(customer.total_spent, currency) : '—' }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(customer.status)" dot>
              {{ statusLabel(customer.status) }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3">
            <div class="flex justify-end">
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
                  <RouterLink
                    :to="{ name: 'customers.show', params: { id: String(customer.id) } }"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close()"
                  >
                    <Eye class="size-4 text-muted" />
                    {{ t('action.view') }}
                  </RouterLink>

                  <button
                    v-if="canUpdate"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(customer)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    v-if="canDelete"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = customer"
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
            v-if="rows.length === 0 && hasFilters"
            :title="t('customers.emptySearchTitle')"
            :description="t('customers.emptySearchBody')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :title="t('customers.emptyTitle')"
            :description="t('customers.emptyBody')"
          >
            <template v-if="canCreate" #action>
              <BaseButton :icon="UserPlus" @click="openCreate">
                {{ t('customers.add') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('customers.create') : t('customers.edit')"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <BaseInput
          v-model="formName"
          :label="t('customers.nameLabel')"
          :placeholder="t('customers.namePlaceholder')"
          :error="nameError"
          required
          autocomplete="name"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formEmail"
            type="email"
            :label="t('common.email')"
            :error="emailError"
            autocomplete="email"
          />
          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            autocomplete="tel"
          />
        </div>

        <BaseSelect
          v-model="formStatus"
          :label="t('common.status')"
          :options="statusFormOptions"
        />

        <BaseTextarea
          v-model="formNotes"
          :label="t('common.notes')"
          :rows="3"
        />
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
      :title="t('customers.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('customers.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
