<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, RefreshCw, ShieldCheck, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { fetchPermissionIndex } from '@/services/permissionService'
import {
  createRole,
  deleteRole,
  fetchRoles,
  syncRolePermissions,
  updateRole,
  type RolesBase,
} from '@/services/roleService'
import type { PermissionGroup, Role } from '@/types/admin'
import type { RoleScope } from '@/types/enums'

/**
 * Roles, in one screen: the list on the left, the editor on the right.
 *
 * There is no detail route — selecting a row is navigation enough, and keeping
 * the list visible while editing means switching roles never costs a page
 * load. The permission matrix is built from `GET /permissions` (the product's
 * whole registry, fetched once) rather than from the role's current set, so a
 * checkbox only ever offers a slug the backend actually enforces.
 *
 * Built-in roles are read-only: the name field, both save buttons and the
 * checkboxes lock, and if the server still answers a 409 the sentence it
 * returns is shown untouched — it names the reason better than any message
 * here could.
 *
 * One screen serves both contexts: the workspace team roles (`/tenant/roles`)
 * and Dukavo's platform catalogue (`/platform/roles`). In platform mode there
 * is no tenant, so the list shows the whole catalogue and the create dialog
 * only offers platform scoped roles.
 */

const props = defineProps<{ platform?: boolean }>()

const { t, tDynamic } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const base = computed<RolesBase>(() => (props.platform ? 'platform' : 'tenant'))

const roles = ref<Role[]>([])
const rolesLoading = ref(true)
const rolesError = ref<string | null>(null)
const roleQuery = ref('')
const debouncedRoleQuery = useDebounce(roleQuery, 300)

const selectedId = ref<number | null>(null)

const modules = ref<PermissionGroup[]>([])
const indexLoading = ref(true)
const indexError = ref<string | null>(null)

const editName = ref('')
const editDescription = ref('')
const selectedSlugs = ref<Set<string>>(new Set())
const nameError = ref<string | null>(null)
const detailsError = ref<string | null>(null)
const savingDetails = ref(false)
const savingPermissions = ref(false)

const createOpen = ref(false)
const createName = ref('')
const createScope = ref<string>('tenant')
const createDescription = ref('')
const createNameError = ref<string | null>(null)
const createError = ref<string | null>(null)
const creating = ref(false)

const pendingDelete = ref<Role | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.can('roles.manage'))
const selected = computed(() => roles.value.find((role) => role.id === selectedId.value) ?? null)
const hasSearch = computed(() => roleQuery.value.trim() !== '')

/** Name and description of a built-in role belong to Dukavo, not to us. */
const readonly = computed(() => !canManage.value || (selected.value?.is_system ?? false))

const permissionsReadonly = computed(
  () => readonly.value || indexLoading.value || indexError.value !== null,
)

const scopeOptions = computed(() => {
  // Platform mode manages Dukavo's own roles: only the platform scope is offered.
  const options: Array<{ value: string; label: string }> = [
    { value: props.platform ? 'platform' : 'tenant', label: t(props.platform ? 'roles.scopePlatform' : 'roles.scopeTenant') },
  ]
  if (!props.platform && auth.isPlatformUser) {
    options.push({ value: 'platform', label: t('roles.scopePlatform') })
  }
  return options
})

type GroupState = 'none' | 'some' | 'all'

function scopeLabel(role: Role): string {
  if (role.scope_label) return role.scope_label
  return role.scope === 'platform' ? t('roles.scopePlatform') : t('roles.scopeTenant')
}

function permissionCount(role: Role): number {
  return role.permission_slugs?.length ?? role.permissions?.length ?? 0
}

function roleSlugs(role: Role | null): string[] {
  return role?.permission_slugs ?? role?.permissions?.map((permission) => permission.slug) ?? []
}

function groupSlugs(group: PermissionGroup): string[] {
  return group.permissions.map((permission) => permission.slug)
}

function groupState(group: PermissionGroup): GroupState {
  const slugs = groupSlugs(group)
  const granted = slugs.filter((slug) => selectedSlugs.value.has(slug)).length
  if (granted === 0) return 'none'
  return granted === slugs.length ? 'all' : 'some'
}

function setGroup(group: PermissionGroup, checked: boolean): void {
  const next = new Set(selectedSlugs.value)
  for (const slug of groupSlugs(group)) {
    if (checked) {
      next.add(slug)
    } else {
      next.delete(slug)
    }
  }
  selectedSlugs.value = next
}

function togglePermission(slug: string, checked: boolean): void {
  const next = new Set(selectedSlugs.value)
  if (checked) {
    next.add(slug)
  } else {
    next.delete(slug)
  }
  selectedSlugs.value = next
}

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.isNetworkError ? t('auth.networkError') : caught.message
  }
  return t('error.title')
}

async function loadRoles(): Promise<void> {
  rolesLoading.value = true
  rolesError.value = null
  try {
    roles.value = await fetchRoles({ search: debouncedRoleQuery.value || undefined }, base.value)
    if (selectedId.value !== null && !roles.value.some((role) => role.id === selectedId.value)) {
      selectedId.value = null
    }
  } catch (caught) {
    rolesError.value = errorMessage(caught)
  } finally {
    rolesLoading.value = false
  }
}

async function loadIndex(): Promise<void> {
  indexLoading.value = true
  indexError.value = null
  try {
    const index = await fetchPermissionIndex()
    modules.value = index.modules
  } catch (caught) {
    modules.value = []
    indexError.value = errorMessage(caught)
  } finally {
    indexLoading.value = false
  }
}

watch(debouncedRoleQuery, () => void loadRoles())

/** Every selection change starts the editor from the role as the server holds it. */
watch(selected, (role) => {
  editName.value = role?.name ?? ''
  editDescription.value = role?.description ?? ''
  selectedSlugs.value = new Set(roleSlugs(role))
  nameError.value = null
  detailsError.value = null
})

/* ----------------------------------------------------------------- details */

async function saveDetails(): Promise<void> {
  const role = selected.value
  if (!role || readonly.value) return

  nameError.value = null
  detailsError.value = null
  if (!editName.value.trim()) {
    nameError.value = t('validation.required')
    return
  }

  savingDetails.value = true
  try {
    const updated = await updateRole(
      role.id,
      {
        name: editName.value.trim(),
        description: editDescription.value.trim() || null,
      },
      base.value,
    )
    // Patched in place: swapping the object would re-run the selection watcher
    // and discard whatever the user kept typing while the request was in flight.
    role.name = updated.name
    role.description = updated.description
    toast.success(t('roles.updated'))
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      nameError.value = caught.fields['name']?.[0] ?? null
      if (!nameError.value) {
        detailsError.value = caught.message || t('error.title')
      }
    } else {
      detailsError.value = errorMessage(caught)
    }
  } finally {
    savingDetails.value = false
  }
}

/* -------------------------------------------------------------- permissions */

async function savePermissions(): Promise<void> {
  const role = selected.value
  if (!role || permissionsReadonly.value) return

  savingPermissions.value = true
  try {
    const updated = await syncRolePermissions(role.id, [...selectedSlugs.value], base.value)
    const slugs =
      updated.permission_slugs ??
      updated.permissions?.map((permission) => permission.slug) ??
      [...selectedSlugs.value]
    role.permission_slugs = slugs
    selectedSlugs.value = new Set(slugs)
    toast.success(t('roles.permissionsSaved'))
  } catch (caught) {
    // A 409 arrives with the server's own sentence explaining the refusal —
    // pass it through verbatim rather than translating it into a guess.
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    savingPermissions.value = false
  }
}

/* ------------------------------------------------------------------ create */

function openCreate(): void {
  createName.value = ''
  createScope.value = props.platform ? 'platform' : 'tenant'
  createDescription.value = ''
  createNameError.value = null
  createError.value = null
  createOpen.value = true
}

function closeCreate(): void {
  createOpen.value = false
}

async function submitCreate(): Promise<void> {
  createNameError.value = null
  createError.value = null
  if (!createName.value.trim()) {
    createNameError.value = t('validation.required')
    return
  }

  creating.value = true
  try {
    const created = await createRole(
      {
        name: createName.value.trim(),
        scope: createScope.value as RoleScope,
        description: createDescription.value.trim() || null,
      },
      base.value,
    )
    toast.success(t('roles.created'))
    createOpen.value = false
    // Clear the search first so the reload can actually contain what was
    // just created, then land on it. The debounced watcher may refresh once
    // more after 300 ms — an idempotent read, not a duplicate write.
    roleQuery.value = ''
    selectedId.value = created.id
    await loadRoles()
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      createNameError.value = caught.fields['name']?.[0] ?? null
      if (!createNameError.value) {
        createError.value = caught.message || t('error.title')
      }
    } else {
      createError.value = errorMessage(caught)
    }
  } finally {
    creating.value = false
  }
}

/* ------------------------------------------------------------------ delete */

async function confirmDelete(): Promise<void> {
  const role = pendingDelete.value
  if (!role) return

  deleting.value = true
  try {
    await deleteRole(role.id, base.value)
    toast.success(t('roles.deleted'))
    pendingDelete.value = null
    if (selectedId.value === role.id) {
      selectedId.value = null
    }
    await loadRoles()
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void loadRoles()
  void loadIndex()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      :title="t(props.platform ? 'platform.roles.title' : 'roles.title')"
      :description="t(props.platform ? 'platform.roles.subtitle' : 'roles.subtitle')"
    >
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('roles.add') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="rolesError" tone="danger" dismissible @dismiss="rolesError = null">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ rolesError }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="loadRoles">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div v-if="rolesLoading || roles.length > 0 || hasSearch" class="surface overflow-hidden">
      <div class="grid grid-cols-1 lg:grid-cols-3">
        <!-- Role list -->
        <aside
          class="border-b border-line lg:border-b-0 lg:border-e"
          :aria-label="t('common.roles')"
        >
          <div class="border-b border-line p-4">
            <BaseInput
              v-model="roleQuery"
              type="search"
              :label="t('filter.search')"
              :placeholder="t('filter.searchPlaceholder')"
            />
          </div>

          <div v-if="rolesLoading" class="p-4">
            <BaseSkeleton :rows="5" height="h-5" />
          </div>

          <div v-else-if="roles.length === 0" class="px-4 py-8 text-center text-sm text-muted">
            {{ t('filter.noResults') }}
          </div>

          <div v-else class="divide-y divide-line">
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="flex w-full items-start gap-3 px-4 py-3 text-start transition"
              :class="role.id === selectedId ? 'bg-brand-soft' : 'hover:bg-surface-2'"
              :aria-current="role.id === selectedId ? 'true' : undefined"
              @click="selectedId = role.id"
            >
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-medium"
                  :class="role.id === selectedId ? 'text-brand-ink' : 'text-ink'"
                >
                  {{ role.name }}
                </span>

                <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <BaseBadge size="sm" :tone="role.scope === 'platform' ? 'info' : 'neutral'">
                    {{ scopeLabel(role) }}
                  </BaseBadge>

                  <BaseBadge v-if="role.is_system" size="sm" tone="brand">
                    {{ t('roles.systemRole') }}
                  </BaseBadge>

                  <span
                    class="text-caption"
                    :class="role.id === selectedId ? 'text-brand-ink' : 'text-muted'"
                  >
                    {{ t('roles.permissionCount', { count: permissionCount(role) }) }}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </aside>

        <!-- Editor -->
        <section
          class="p-5 lg:col-span-2"
          :aria-label="selected ? selected.name : t('roles.selectTitle')"
        >
          <div v-if="rolesLoading" class="space-y-4">
            <BaseSkeleton height="h-8" block />
            <BaseSkeleton :rows="6" height="h-5" />
          </div>

          <template v-else-if="selected">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-h4 font-semibold text-ink">{{ selected.name }}</h2>

                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <BaseBadge size="sm" :tone="selected.scope === 'platform' ? 'info' : 'neutral'">
                    {{ scopeLabel(selected) }}
                  </BaseBadge>

                  <BaseBadge v-if="selected.is_system" size="sm" tone="brand">
                    {{ t('roles.systemRole') }}
                  </BaseBadge>

                  <BaseBadge size="sm">
                    {{ t('roles.permissionCount', { count: permissionCount(selected) }) }}
                  </BaseBadge>
                </div>
              </div>

              <BaseButton
                v-if="canManage && !selected.is_system"
                variant="danger"
                size="sm"
                :icon="Trash2"
                @click="pendingDelete = selected"
              >
                {{ t('action.delete') }}
              </BaseButton>
            </div>

            <!-- Details -->
            <form class="mt-5 space-y-4" @submit.prevent="saveDetails">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted">
                {{ t('roles.details') }}
              </h3>

              <BaseAlert v-if="detailsError" tone="danger" dismissible @dismiss="detailsError = null">
                {{ detailsError }}
              </BaseAlert>

              <div>
                <BaseInput
                  v-model="editName"
                  :label="t('roles.roleName')"
                  :placeholder="t('roles.roleNamePlaceholder')"
                  :error="nameError"
                  :disabled="readonly"
                  required
                />
                <p v-if="selected.is_system" class="mt-1.5 text-small text-muted">
                  {{ t('roles.systemRoleHint') }}
                </p>
              </div>

              <BaseTextarea
                v-model="editDescription"
                :label="t('roles.description')"
                :rows="3"
                :disabled="readonly"
              />

              <div class="flex justify-end">
                <BaseButton type="submit" variant="secondary" :loading="savingDetails" :disabled="readonly">
                  {{ t('action.saveChanges') }}
                </BaseButton>
              </div>
            </form>

            <!-- Permissions -->
            <div class="mt-6 space-y-4 border-t border-line pt-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-muted">
                  {{ t('roles.permissions') }}
                </h3>

                <BaseButton
                  size="sm"
                  :loading="savingPermissions"
                  :disabled="permissionsReadonly"
                  @click="savePermissions"
                >
                  {{ t('roles.savePermissions') }}
                </BaseButton>
              </div>

              <BaseAlert v-if="indexError" tone="danger" dismissible @dismiss="indexError = null">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <span>{{ indexError }}</span>
                  <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="loadIndex">
                    {{ t('action.retry') }}
                  </BaseButton>
                </div>
              </BaseAlert>

              <div v-else-if="indexLoading" class="grid gap-4 md:grid-cols-2">
                <BaseSkeleton :rows="5" height="h-4" />
                <BaseSkeleton :rows="5" height="h-4" />
              </div>

              <div v-else class="grid gap-4 md:grid-cols-2">
                <BaseCard v-for="group in modules" :key="group.module">
                  <template #header>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span class="text-sm font-semibold text-ink">
                        {{ tDynamic('permission.module', group.module) }}
                      </span>

                      <span class="flex items-center gap-1">
                        <BaseButton
                          size="sm"
                          variant="ghost"
                          :disabled="permissionsReadonly"
                          @click="setGroup(group, true)"
                        >
                          {{ t('roles.grantAll') }}
                        </BaseButton>
                        <BaseButton
                          size="sm"
                          variant="ghost"
                          :disabled="permissionsReadonly"
                          @click="setGroup(group, false)"
                        >
                          {{ t('roles.grantNone') }}
                        </BaseButton>
                      </span>
                    </div>
                  </template>

                  <div class="space-y-3">
                    <BaseCheckbox
                      :model-value="groupState(group) === 'all'"
                      :indeterminate="groupState(group) === 'some'"
                      :label="t('common.all')"
                      :disabled="permissionsReadonly"
                      @update:model-value="setGroup(group, $event)"
                    />

                    <BaseCheckbox
                      v-for="permission in group.permissions"
                      :key="permission.slug"
                      :model-value="selectedSlugs.has(permission.slug)"
                      :label="permission.name"
                      :hint="permission.slug"
                      :disabled="permissionsReadonly"
                      @update:model-value="togglePermission(permission.slug, $event)"
                    />
                  </div>
                </BaseCard>
              </div>
            </div>
          </template>

          <BaseEmptyState
            v-else
            compact
            :icon="ShieldCheck"
            :title="t('roles.selectTitle')"
            :description="t('roles.selectBody')"
          />
        </section>
      </div>
    </div>

    <div v-else-if="rolesError === null" class="surface">
      <BaseEmptyState
        :icon="ShieldCheck"
        :title="t('roles.emptyTitle')"
        :description="t('roles.emptyBody')"
      >
        <template v-if="canManage" #action>
          <BaseButton :icon="Plus" @click="openCreate">
            {{ t('roles.add') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <!-- Create -->
    <BaseModal :open="createOpen" :title="t('roles.create')" @close="closeCreate">
      <div class="space-y-4">
        <BaseAlert v-if="createError" tone="danger" dismissible @dismiss="createError = null">
          {{ createError }}
        </BaseAlert>

        <BaseInput
          v-model="createName"
          :label="t('roles.roleName')"
          :placeholder="t('roles.roleNamePlaceholder')"
          :error="createNameError"
          required
        />

        <BaseSelect
          v-model="createScope"
          :label="t('roles.scope')"
          :options="scopeOptions"
        />

        <BaseTextarea
          v-model="createDescription"
          :label="t('roles.description')"
          :rows="3"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="closeCreate">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="creating" @click="submitCreate">
          {{ t('action.create') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('roles.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('roles.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
