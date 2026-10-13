<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Lock, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Users } from '@/components/icons'
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
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  activateTenant,
  createTenant,
  deleteTenant,
  fetchTenantMembers,
  fetchTenants,
  suspendTenant,
  updateTenant,
  type PlatformTenant,
  type PlatformTenantMember,
  type PlatformTenantPayload,
} from '@/services/platformService'
import type { Paginated } from '@/types/api'
import type { TenantStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatDateTime } from '@/utils/format'

/**
 * Platform-tenant management.
 *
 * The route is already restricted to platform operators; the mutations are
 * gated again on `isPlatformUser` because a UI action that exists is an
 * invitation to try it, and the server would only answer with a 403. Delete is
 * always offered rather than hidden: whether the backend refuses a live tenant
 * is its decision to make, and its sentence is the one worth showing.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<PlatformTenant[]>([])
const meta = ref<Paginated<PlatformTenant>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)

const pendingDelete = ref<PlatformTenant | null>(null)
const deleting = ref(false)

const pendingSuspend = ref<PlatformTenant | null>(null)
const suspending = ref(false)

const membersFor = ref<PlatformTenant | null>(null)
const members = ref<PlatformTenantMember[]>([])
const membersLoading = ref(false)
const membersError = ref<string | null>(null)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formSlug = ref('')
const formContactEmail = ref('')
const formPhone = ref('')
const formCurrency = ref('')
const formTimezone = ref('')
const formLocale = ref('')
const formStoreName = ref('')
const formOwnerName = ref('')
const formOwnerEmail = ref('')
const formOwnerPassword = ref('')
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const phoneError = ref<string | null>(null)
const localeError = ref<string | null>(null)
const storeNameError = ref<string | null>(null)
const ownerNameError = ref<string | null>(null)
const ownerEmailError = ref<string | null>(null)
const ownerPasswordError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const canManage = computed(() => auth.isPlatformUser)

const hasSearch = computed(() => query.value.trim() !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'currency', label: t('common.currency') },
  { key: 'timezone', label: t('common.timezone') },
  { key: 'created', label: t('common.createdAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const STATUS_LABEL_KEYS = {
  active: 'status.tenant.active',
  suspended: 'status.tenant.suspended',
} as const

function statusLabel(value: TenantStatus): string {
  return t(STATUS_LABEL_KEYS[value])
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchTenants({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
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

watch(page, () => void load())

function clearSearch(): void {
  query.value = ''
}

/* ---------------------------------------------------------------- members */

async function openMembers(tenant: PlatformTenant): Promise<void> {
  membersFor.value = tenant
  members.value = []
  membersError.value = null
  membersLoading.value = true
  try {
    members.value = await fetchTenantMembers(tenant.id)
  } catch (caught) {
    membersError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : t('state.loadFailed')
  } finally {
    membersLoading.value = false
  }
}

/** Role slugs read as code; capitalise the first word rather than ship a table of them. */
function roleLabel(role: string): string {
  return role.replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').replace(/^\w/, (char) => char.toUpperCase())
}

/* ------------------------------------------------------------ mutations */

async function confirmSuspend(): Promise<void> {
  const tenant = pendingSuspend.value
  if (!tenant) return

  suspending.value = true
  try {
    await suspendTenant(tenant.id)
    toast.success(t('platform.suspended'))
    pendingSuspend.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    suspending.value = false
  }
}

async function activate(tenant: PlatformTenant): Promise<void> {
  try {
    await activateTenant(tenant.id)
    toast.success(t('platform.activated'))
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  }
}

async function confirmDelete(): Promise<void> {
  const tenant = pendingDelete.value
  if (!tenant) return

  deleting.value = true
  try {
    await deleteTenant(tenant.id)
    toast.success(t('platform.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    // 409 = the tenant has data the server refuses to drop; its sentence says
    // why better than any copy written here could.
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

/* ------------------------------------------------------------------- form */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clearFormErrors(): void {
  nameError.value = null
  emailError.value = null
  phoneError.value = null
  localeError.value = null
  storeNameError.value = null
  ownerNameError.value = null
  ownerEmailError.value = null
  ownerPasswordError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formSlug.value = ''
  formContactEmail.value = ''
  formPhone.value = ''
  formCurrency.value = ''
  formTimezone.value = ''
  formLocale.value = ''
  formStoreName.value = ''
  formOwnerName.value = ''
  formOwnerEmail.value = ''
  formOwnerPassword.value = ''
  clearFormErrors()
  formOpen.value = true
}

function openEdit(tenant: PlatformTenant): void {
  editingId.value = tenant.id
  formName.value = tenant.name
  formSlug.value = tenant.slug
  formContactEmail.value = tenant.contact_email ?? ''
  formPhone.value = tenant.phone ?? ''
  formCurrency.value = tenant.currency
  formTimezone.value = tenant.timezone
  formLocale.value = tenant.locale ?? ''
  formStoreName.value = ''
  formOwnerName.value = ''
  formOwnerEmail.value = ''
  formOwnerPassword.value = ''
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

function validateForm(): boolean {
  clearFormErrors()

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
  }

  const contactEmail = formContactEmail.value.trim()
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    emailError.value = t('validation.email')
  }

  // The owner block is all-or-nothing: half an administrator is worse than
  // none, and the server would refuse it anyway.
  const ownerName = formOwnerName.value.trim()
  const ownerEmail = formOwnerEmail.value.trim()
  const ownerPassword = formOwnerPassword.value
  if (ownerName || ownerEmail || ownerPassword) {
    if (!ownerName) ownerNameError.value = t('validation.required')
    if (!ownerEmail) {
      ownerEmailError.value = t('validation.required')
    } else if (!EMAIL_PATTERN.test(ownerEmail)) {
      ownerEmailError.value = t('validation.email')
    }
    if (!ownerPassword) ownerPasswordError.value = t('validation.required')
  }

  return (
    nameError.value === null &&
    emailError.value === null &&
    ownerNameError.value === null &&
    ownerEmailError.value === null &&
    ownerPasswordError.value === null
  )
}

function buildPayload(mode: 'create' | 'edit'): PlatformTenantPayload {
  const payload: PlatformTenantPayload = {
    name: formName.value.trim(),
    slug: formSlug.value.trim() || undefined,
    contact_email: formContactEmail.value.trim() || null,
    phone: formPhone.value.trim() || null,
    currency: formCurrency.value.trim() || undefined,
    timezone: formTimezone.value.trim() || undefined,
    locale: formLocale.value.trim() || null,
  }

  // The first store is a provisioning concern — once a tenant has one, its
  // name is edited in the tenant itself, not here.
  if (mode === 'create') {
    payload.store_name = formStoreName.value.trim() || null
  }

  const ownerName = formOwnerName.value.trim()
  const ownerEmail = formOwnerEmail.value.trim()
  if (mode === 'create' && ownerName && ownerEmail) {
    payload.owner = {
      name: ownerName,
      email: ownerEmail,
      password: formOwnerPassword.value || null,
    }
  }

  return payload
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const fields = caught.fields
    nameError.value = fields['name']?.[0] ?? null
    emailError.value = fields['contact_email']?.[0] ?? null
    phoneError.value = fields['phone']?.[0] ?? null
    localeError.value = fields['locale']?.[0] ?? null
    storeNameError.value = fields['store_name']?.[0] ?? null
    ownerNameError.value = fields['owner.name']?.[0] ?? null
    ownerEmailError.value = fields['owner.email']?.[0] ?? null
    ownerPasswordError.value = fields['owner.password']?.[0] ?? null

    const anyField =
      nameError.value !== null ||
      emailError.value !== null ||
      phoneError.value !== null ||
      localeError.value !== null ||
      storeNameError.value !== null ||
      ownerNameError.value !== null ||
      ownerEmailError.value !== null ||
      ownerPasswordError.value !== null

    if (!anyField) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = errorMessage(caught)
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  try {
    if (editingId.value !== null) {
      await updateTenant(editingId.value, buildPayload('edit'))
      toast.success(t('platform.updated'))
    } else {
      await createTenant(buildPayload('create'))
      toast.success(t('platform.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.title')" :description="t('platform.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('platform.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
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

      <BaseButton v-if="hasSearch" variant="ghost" @click="clearSearch">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="tenant in rows" :key="tenant.id">
          <td class="px-4 py-3">
            <span class="block font-medium text-ink">{{ tenant.name }}</span>
            <span class="mt-0.5 block font-mono text-caption text-subtle">
              {{ tenant.slug }}
            </span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(tenant.status)" dot>
              {{ tenant.status_label ?? statusLabel(tenant.status) }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ tenant.currency }}
          </td>

          <td class="px-4 py-3 text-muted">
            {{ tenant.timezone }}
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(tenant.created_at) }}
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
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openMembers(tenant)"
                  >
                    <Users class="size-4 text-muted" />
                    {{ t('platform.viewMembers') }}
                  </button>

                  <button
                    v-if="canManage && tenant.status === 'active'"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); pendingSuspend = tenant"
                  >
                    <Lock class="size-4 text-muted" />
                    {{ t('platform.suspend') }}
                  </button>

                  <button
                    v-if="canManage && tenant.status !== 'active'"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); activate(tenant)"
                  >
                    <Check class="size-4 text-muted" />
                    {{ t('platform.activate') }}
                  </button>

                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(tenant)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = tenant"
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

          <BaseEmptyState v-else-if="rows.length === 0 && hasSearch" :title="t('common.noResults')">
            <template #action>
              <BaseButton variant="secondary" @click="clearSearch">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :title="t('platform.emptyTitle')"
            :description="t('platform.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('platform.create') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination
            v-if="meta"
            :meta="meta"
            :disabled="loading"
            @change="page = $event"
          />
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('platform.create') : t('platform.edit')"
      size="lg"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formName"
            :label="t('common.name')"
            :error="nameError"
            required
          />

          <BaseInput
            v-model="formSlug"
            :label="t('common.slug')"
            :hint="t('common.optional')"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formContactEmail"
            type="email"
            :label="t('common.email')"
            :error="emailError"
          />

          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            :error="phoneError"
            autocomplete="tel"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="formCurrency" :label="t('common.currency')" />

          <BaseInput v-model="formTimezone" :label="t('common.timezone')" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formLocale"
            :label="t('common.locale')"
            :error="localeError"
          />

          <BaseInput
            v-if="editingId === null"
            v-model="formStoreName"
            :label="t('platform.storeName')"
            :error="storeNameError"
          />
        </div>

        <div v-if="editingId === null" class="rounded-lg border border-line p-4">
          <p class="text-sm font-medium text-ink">{{ t('common.owner') }}</p>
          <p class="mt-0.5 text-small text-muted">{{ t('platform.ownerHint') }}</p>

          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="formOwnerName"
              :label="t('common.name')"
              :error="ownerNameError"
            />

            <BaseInput
              v-model="formOwnerEmail"
              type="email"
              :label="t('common.email')"
              :error="ownerEmailError"
            />
          </div>

          <div class="mt-4">
            <BaseInput
              v-model="formOwnerPassword"
              type="password"
              :label="t('common.password')"
              :error="ownerPasswordError"
              autocomplete="new-password"
            />
          </div>
        </div>
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

    <!-- Members -->
    <BaseModal
      :open="membersFor !== null"
      :title="t('platform.members')"
      :description="membersFor?.name"
      size="lg"
      @close="membersFor = null"
    >
      <div v-if="membersLoading" class="space-y-3">
        <BaseSkeleton :rows="4" height="h-5" />
      </div>

      <BaseAlert v-else-if="membersError" tone="danger" :title="t('error.title')">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{{ membersError }}</span>
          <BaseButton
            size="sm"
            variant="secondary"
            :icon="RefreshCw"
            @click="membersFor ? openMembers(membersFor) : undefined"
          >
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <BaseEmptyState
        v-else-if="members.length === 0"
        compact
        :title="t('platform.noMembers')"
        :description="t('platform.noMembersBody')"
      />

      <ul v-else class="divide-y divide-line">
        <li
          v-for="member in members"
          :key="member.id"
          class="flex flex-wrap items-start justify-between gap-3 py-3"
        >
          <div class="min-w-0">
            <p class="break-words text-sm font-medium text-ink">{{ member.name }}</p>
            <p class="break-words text-caption text-muted">{{ member.email }}</p>
          </div>

          <div class="flex flex-wrap justify-end gap-1.5">
            <BaseBadge v-for="role in member.roles" :key="role" size="sm" tone="brand">
              {{ roleLabel(role) }}
            </BaseBadge>
          </div>
        </li>
      </ul>

      <template #footer>
        <BaseButton variant="secondary" @click="membersFor = null">
          {{ t('action.close') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Suspend confirmation -->
    <BaseModal
      :open="pendingSuspend !== null"
      :title="t('platform.suspendTitle')"
      size="sm"
      @close="pendingSuspend = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.suspendBody', { name: pendingSuspend?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="suspending" @click="pendingSuspend = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="suspending" @click="confirmSuspend">
          {{ t('platform.suspend') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
