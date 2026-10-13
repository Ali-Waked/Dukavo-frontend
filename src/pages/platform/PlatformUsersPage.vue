<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Pencil, UserPlus, Users } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  assignPlatformRole,
  createPlatformUser,
  fetchPlatformUsers,
  revokePlatformRole,
  updatePlatformUser,
} from '@/services/platformUserService'
import { fetchRoles } from '@/services/roleService'
import type { Role, User } from '@/types/admin'
import type { Paginated } from '@/types/api'
import type { UserStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatRelative } from '@/utils/format'

/**
 * Dukavo's own staff.
 *
 * The list holds only accounts that carry a *platform* role; workspace members
 * belong to their tenant's team page. There is no delete here — the backend
 * has no such endpoint — because suspending is a status change, exactly as the
 * team page treats it.
 *
 * Role changes go through the dedicated assign/revoke endpoints, so the
 * backend's guards can answer directly: a tenant role is refused with a 409,
 * and the *last* active super administrator can neither be suspended nor
 * stripped. Both refusals surface as the server's own sentence in the form.
 */

const { t, locale } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

const query = ref('')
const status = ref('')
const roleId = ref('')
const page = ref(1)

const debouncedQuery = useDebounce(query, 300)

const rows = ref<User[]>([])
const meta = ref<Paginated<User>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/** Only platform scoped roles can be assigned here — the backend refuses the rest. */
const roles = ref<Role[]>([])

const editingId = ref<number | null>(null)
const formOpen = ref(false)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formLocale = ref<string>('en')
const formPassword = ref('')
const formRole = ref('')
const formStatus = ref<string>('active')
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const roleError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const canManage = computed(() => auth.can('users.manage'))

const hasFilters = computed(() => query.value !== '' || status.value !== '' || roleId.value !== '')

const statusFilterOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'active', label: t('status.user.active') },
  { value: 'invited', label: t('status.user.invited') },
  { value: 'suspended', label: t('status.user.suspended') },
])

const roleFilterOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...roles.value.map((role) => ({ value: String(role.id), label: role.name })),
])

const roleFormOptions = computed(() =>
  roles.value.map((role) => ({ value: String(role.id), label: role.name })),
)

const statusFormOptions = computed(() => [
  { value: 'active', label: t('status.user.active') },
  { value: 'invited', label: t('status.user.invited') },
  { value: 'suspended', label: t('status.user.suspended') },
])

const localeOptions = [
  { value: 'en', label: t('language.en') },
  { value: 'ar', label: t('language.ar') },
]

const columns = computed<TableColumn[]>(() => {
  const list: TableColumn[] = [
    { key: 'name', label: t('common.name') },
    { key: 'roles', label: t('users.roles') },
    { key: 'workspaces', label: t('platform.users.workspaces') },
    { key: 'status', label: t('common.status'), width: '9rem' },
    { key: 'last_login', label: t('users.lastSignIn') },
  ]
  if (canManage.value) {
    list.push({ key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' })
  }
  return list
})

const STATUS_LABEL_KEYS = {
  active: 'status.user.active',
  invited: 'status.user.invited',
  suspended: 'status.user.suspended',
} as const

function statusLabel(user: User): string {
  return user.status_label ?? t(STATUS_LABEL_KEYS[user.status])
}

function platformRoleNames(user: User): string[] {
  return (user.roles ?? []).filter((role) => role.scope === 'platform').map((role) => role.name)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchPlatformUsers({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value ? (status.value as UserStatus) : undefined,
      role_id: roleId.value ? Number(roleId.value) : undefined,
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

async function loadRoles(): Promise<void> {
  try {
    roles.value = (await fetchRoles({ scope: 'platform' }, 'platform')).filter(
      (role) => role.scope === 'platform',
    )
  } catch {
    // Roles decorate the filters and the form select; their absence must not
    // take the list down with it.
    roles.value = []
  }
}

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch([status, roleId], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  status.value = ''
  roleId.value = ''
  page.value = 1
  void load()
}

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  nameError.value = null
  emailError.value = null
  roleError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formEmail.value = ''
  formPhone.value = ''
  formLocale.value = locale.value
  formPassword.value = ''
  formRole.value = ''
  formStatus.value = 'active'
  clearFormErrors()
  formOpen.value = true
}

function openEdit(user: User): void {
  editingId.value = user.id
  formName.value = user.name
  formEmail.value = user.email
  formPhone.value = user.phone ?? ''
  formLocale.value = user.locale ?? locale.value
  formPassword.value = ''
  const currentPlatformRole = (user.roles ?? []).find((role) => role.scope === 'platform')
  formRole.value = currentPlatformRole ? String(currentPlatformRole.id) : ''
  formStatus.value = user.status
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
  if (!email) {
    emailError.value = t('validation.required')
  } else if (!EMAIL_PATTERN.test(email)) {
    emailError.value = t('validation.email')
  }

  if (!formRole.value) {
    roleError.value = t('validation.required')
  }

  return nameError.value === null && emailError.value === null && roleError.value === null
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    nameError.value = caught.fields['name']?.[0] ?? null
    emailError.value = caught.fields['email']?.[0] ?? null
    roleError.value = caught.fields['role_id']?.[0] ?? null

    const bound = nameError.value !== null || emailError.value !== null || roleError.value !== null
    const hasUnboundFields = Object.keys(caught.fields).some(
      (key) => key !== 'name' && key !== 'email' && key !== 'role_id',
    )
    if (!bound || hasUnboundFields) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function assignNewRole(userId: number, roleIdValue: number): Promise<void> {
  const held = rows.value.find((user) => user.id === userId)?.roles ?? []
  for (const role of held) {
    if (role.scope === 'platform' && role.id !== roleIdValue) {
      await revokePlatformRole(userId, role.id)
    }
  }
  if (!held.some((role) => role.scope === 'platform' && role.id === roleIdValue)) {
    await assignPlatformRole(userId, roleIdValue)
  }
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  const common = {
    name: formName.value.trim(),
    email: formEmail.value.trim(),
    phone: formPhone.value.trim() || null,
    locale: formLocale.value || null,
  }

  try {
    if (editingId.value === null) {
      await createPlatformUser({
        ...common,
        password: formPassword.value || undefined,
        role_id: Number(formRole.value),
      })
      toast.success(t('users.created'))
    } else {
      const userId = editingId.value
      await updatePlatformUser(userId, {
        ...common,
        status: formStatus.value as UserStatus,
      })
      await assignNewRole(userId, Number(formRole.value))
      toast.success(t('users.updated'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
  void loadRoles()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.users.title')" :description="t('platform.users.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="UserPlus" @click="openCreate">
          {{ t('users.add') }}
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

      <BaseSelect
        v-model="roleId"
        class="w-44"
        :label="t('common.role')"
        :options="roleFilterOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="user in rows" :key="user.id">
          <td class="px-4 py-3">
            <span class="block font-medium text-ink">{{ user.name }}</span>
            <span class="mt-0.5 block text-caption text-subtle">{{ user.email }}</span>
          </td>

          <td class="px-4 py-3">
            <div v-if="platformRoleNames(user).length > 0" class="flex flex-wrap gap-1.5">
              <BaseBadge v-for="roleName in platformRoleNames(user)" :key="roleName" size="sm">
                {{ roleName }}
              </BaseBadge>
            </div>
            <span v-else class="text-sm text-subtle">{{ t('users.noRoles') }}</span>
          </td>

          <td class="px-4 py-3">
            <span v-if="user.tenants && user.tenants.length > 0" class="text-sm text-muted">
              {{ user.tenants.length }}
            </span>
            <span v-else class="text-sm text-subtle">—</span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(user.status)" dot>
              {{ statusLabel(user) }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3">
            <span v-if="user.last_login_at" class="tabular-nums text-muted">
              {{ formatRelative(user.last_login_at) }}
            </span>
            <span v-else class="text-subtle">{{ t('users.neverSignedIn') }}</span>
          </td>

          <td v-if="canManage" class="px-4 py-3">
            <div class="flex justify-end">
              <button
                type="button"
                class="btn-icon"
                :aria-label="t('action.edit')"
                :title="t('action.edit')"
                @click="openEdit(user)"
              >
                <Pencil class="size-5" />
              </button>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="rows.length === 0 && hasFilters"
            :title="t('users.emptySearchTitle')"
            :description="t('users.emptySearchBody')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :icon="Users"
            :title="t('platform.users.emptyTitle')"
            :description="t('platform.users.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="UserPlus" @click="openCreate">
                {{ t('users.add') }}
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
      :title="editingId === null ? t('users.create') : t('users.edit')"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <BaseInput
          v-model="formName"
          :label="t('users.nameLabel')"
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
            required
            autocomplete="email"
          />
          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            autocomplete="tel"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect
            v-model="formLocale"
            :label="t('common.locale')"
            :options="localeOptions"
          />
          <BaseSelect
            v-if="editingId !== null"
            v-model="formStatus"
            :label="t('common.status')"
            :options="statusFormOptions"
          />
        </div>

        <BaseInput
          v-if="editingId === null"
          v-model="formPassword"
          type="password"
          :label="t('common.password')"
          :hint="t('users.passwordHint')"
          autocomplete="new-password"
        />

        <div>
          <BaseSelect
            v-model="formRole"
            :label="t('common.role')"
            :placeholder="t('roles.assignTitle')"
            :options="roleFormOptions"
            :error="roleError"
            required
          />
          <p class="mt-1.5 text-small text-muted">
            {{ t('platform.users.roleHint') }}
          </p>
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
  </div>
</template>