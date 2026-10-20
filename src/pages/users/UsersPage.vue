<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Eye, EyeOff, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from '@/components/icons'
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
import PageHeader from '@/components/ui/PageHeader.vue'
import { createUser, deleteUser, fetchUsers, updateUser } from '@/services/userService'
import { fetchRoles } from '@/services/roleService'
import type { Role, User } from '@/types/admin'
import type { Paginated } from '@/types/api'
import type { UserStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatRelative } from '@/utils/format'

/**
 * Team list.
 *
 * There is no user detail route: reading a member means reading the row, and
 * every change happens in one modal — invite and edit share a form because the
 * fields are the same and a second page would only duplicate them. The page
 * itself renders for anyone holding `users.view`; each control that mutates is
 * gated on `users.manage`, so a viewer sees the team without the levers.
 *
 * The role filter sends `role_id` only once a role is chosen — the backend
 * replaces a member's assignment rather than stacking it, so an unset filter
 * has to stay unset instead of arriving as a zero.
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

/** One role fetch backs both the filter and the modal's role select. */
const roles = ref<Role[]>([])

const pendingDelete = ref<User | null>(null)
const deleting = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formLocale = ref<string>('en')
const formPassword = ref('')
const formPasswordConfirmation = ref('')
const formRole = ref('')
const formStatus = ref<string>('active')
const showPassword = ref(false)
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const roleError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const canManage = computed(() => auth.can('users.manage'))

const hasFilters = computed(
  () => query.value !== '' || status.value !== '' || roleId.value !== '',
)

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

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchUsers({
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
    roles.value = await fetchRoles()
  } catch {
    // Roles only decorate the filters and the form select; a failure there
    // must not take the team list down with it.
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
  passwordError.value = null
  formError.value = null
}

function resetPasswordFields(): void {
  formPassword.value = ''
  formPasswordConfirmation.value = ''
  passwordError.value = null
  showPassword.value = false
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formEmail.value = ''
  formPhone.value = ''
  formLocale.value = locale.value
  formRole.value = ''
  formStatus.value = 'active'
  resetPasswordFields()
  clearFormErrors()
  formOpen.value = true
}

function openEdit(user: User): void {
  editingId.value = user.id
  formName.value = user.name
  formEmail.value = user.email
  formPhone.value = user.phone ?? ''
  formLocale.value = user.locale ?? locale.value
  formRole.value = user.roles?.[0] ? String(user.roles[0].id) : ''
  formStatus.value = user.status
  resetPasswordFields()
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
  // Never leave a typed password sitting in the form's memory once it closes.
  resetPasswordFields()
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

  // The confirmation field only exists while creating; a mismatch (including a
  // filled password with an empty confirmation) is caught before the request.
  if (editingId.value === null && formPassword.value !== formPasswordConfirmation.value) {
    passwordError.value = t('validation.passwordMismatch')
  }

  return (
    nameError.value === null &&
    emailError.value === null &&
    roleError.value === null &&
    passwordError.value === null
  )
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    nameError.value = caught.fields['name']?.[0] ?? null
    emailError.value = caught.fields['email']?.[0] ?? null
    roleError.value = caught.fields['role_id']?.[0] ?? null
    passwordError.value =
      caught.fields['password']?.[0] ?? caught.fields['password_confirmation']?.[0] ?? null

    const bound =
      nameError.value !== null ||
      emailError.value !== null ||
      roleError.value !== null ||
      passwordError.value !== null
    const hasUnboundFields = Object.keys(caught.fields).some(
      (key) =>
        key !== 'name' &&
        key !== 'email' &&
        key !== 'role_id' &&
        key !== 'password' &&
        key !== 'password_confirmation',
    )
    if (!bound || hasUnboundFields) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function submitForm(): Promise<void> {
  if (saving.value || !validateForm()) return

  saving.value = true
  const common = {
    name: formName.value.trim(),
    email: formEmail.value.trim(),
    phone: formPhone.value.trim() || null,
    locale: formLocale.value || null,
    role_id: Number(formRole.value),
  }

  try {
    if (editingId.value === null) {
      await createUser({
        ...common,
        // Blank means invite: the recovery flow issues the set-password link.
        // The confirmation field travels with the password so the backend's
        // `confirmed` rule has a matching value to check.
        password: formPassword.value || undefined,
        password_confirmation: formPassword.value ? formPasswordConfirmation.value : undefined,
      })
      toast.success(t('users.created'))
    } else {
      await updateUser(editingId.value, {
        ...common,
        status: formStatus.value as UserStatus,
      })
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

/* ----------------------------------------------------------------- delete */

async function confirmDelete(): Promise<void> {
  const user = pendingDelete.value
  if (!user) return

  deleting.value = true
  try {
    await deleteUser(user.id)
    toast.success(t('users.deleted'))
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

onMounted(() => {
  void load()
  void loadRoles()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('users.title')" :description="t('users.subtitle')">
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
            <div v-if="user.roles && user.roles.length > 0" class="flex flex-wrap gap-1.5">
              <BaseBadge v-for="role in user.roles" :key="role.id" size="sm">
                {{ role.name }}
              </BaseBadge>
            </div>
            <span v-else class="text-sm text-subtle">{{ t('users.noRoles') }}</span>
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
                    @click="close(); openEdit(user)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = user"
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
            :title="t('users.emptyTitle')"
            :description="t('users.emptyBody')"
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

        <div v-if="editingId === null" class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formPassword"
            :type="showPassword ? 'text' : 'password'"
            :label="t('common.password')"
            :hint="t('users.passwordHint')"
            :error="passwordError"
            autocomplete="new-password"
          >
            <template #suffix>
              <button
                type="button"
                class="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="size-4" />
                <Eye v-else class="size-4" />
              </button>
            </template>
          </BaseInput>

          <BaseInput
            v-model="formPasswordConfirmation"
            :type="showPassword ? 'text' : 'password'"
            name="password_confirmation"
            :label="t('users.confirmPassword')"
            autocomplete="new-password"
          />
        </div>

        <BaseSelect
          v-model="formRole"
          :label="t('common.role')"
          :placeholder="t('roles.assignTitle')"
          :options="roleFormOptions"
          :error="roleError"
          required
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
      :title="t('users.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('users.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
