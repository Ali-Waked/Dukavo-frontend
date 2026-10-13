<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useSlugAvailability } from '@/composables/useSlugAvailability'
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
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  checkCategorySlug,
  createCategory,
  deleteCategory,
  fetchCategoryTree,
  updateCategory,
  type CategoryPayload,
} from '@/services/categoryService'
import type { Category } from '@/types/catalogue'
import { statusTone } from '@/utils/status'
import { formatNumber } from '@/utils/format'

/**
 * Category tree manager.
 *
 * The tree endpoint already returns the nested shape the page renders, so the
 * table flattens it once and indents children by depth — the hierarchy stays
 * visible without a bespoke tree control. Search filters the flattened rows on
 * the client: the endpoint takes no query, and a category list is small enough
 * that a round trip per keystroke would be a worse trade than filtering here.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const INDENT = ['ps-0', 'ps-4', 'ps-8', 'ps-12'] as const

interface FlatCategory {
  category: Category
  depth: number
}

function flatten(categories: Category[], depth = 0, out: FlatCategory[] = []): FlatCategory[] {
  for (const category of categories) {
    out.push({ category, depth })
    if (category.children && category.children.length > 0) {
      flatten(category.children, depth + 1, out)
    }
  }
  return out
}

function findById(categories: Category[], id: number): Category | null {
  for (const category of categories) {
    if (category.id === id) return category
    const found = category.children ? findById(category.children, id) : null
    if (found) return found
  }
  return null
}

function collectSubtree(category: Category | null, into: Set<number>): void {
  if (!category) return
  into.add(category.id)
  for (const child of category.children ?? []) {
    collectSubtree(child, into)
  }
}

const query = ref('')
const debouncedQuery = useDebounce(query, 300)

const tree = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const pendingDelete = ref<Category | null>(null)
const deleting = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formSlug = ref('')
const formDescription = ref('')
const formParent = ref('')
const formActive = ref(true)
const nameError = ref<string | null>(null)
const slugError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const slugAvailability = useSlugAvailability(formSlug, checkCategorySlug, {
  ignore: editingId,
})

const slugHint = computed(() => {
  switch (slugAvailability.state.value) {
    case 'checking':
      return t('slug.checking')
    case 'available':
      return t('slug.available')
    case 'taken':
      return t('slug.taken')
    default:
      return t('slug.autoHint')
  }
})

const canManage = computed(() => auth.can('categories.manage'))

const hasSearch = computed(() => query.value.trim() !== '')

const flatRows = computed<FlatCategory[]>(() => flatten(tree.value))

const filteredRows = computed<FlatCategory[]>(() => {
  const needle = debouncedQuery.value.trim().toLowerCase()
  if (!needle) return flatRows.value

  return flatRows.value.filter(
    ({ category }) =>
      category.name.toLowerCase().includes(needle) || category.slug.toLowerCase().includes(needle),
  )
})

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'slug', label: t('categories.slug') },
  { key: 'products', label: t('categories.products'), align: 'end' },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

/** Parent options skip the category being edited and everything beneath it. */
const parentOptions = computed(() => {
  const excluded = new Set<number>()
  if (editingId.value !== null) {
    collectSubtree(findById(tree.value, editingId.value), excluded)
  }

  const options = [{ value: '', label: t('categories.rootLevel') }]
  for (const { category, depth } of flatRows.value) {
    if (excluded.has(category.id)) continue
    options.push({
      value: String(category.id),
      label: `${'· '.repeat(depth)}${category.name}`,
    })
  }
  return options
})

function indentClass(depth: number): string {
  return INDENT[Math.min(depth, INDENT.length - 1)] ?? 'ps-0'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    tree.value = await fetchCategoryTree({ includeInactive: true })
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

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  nameError.value = null
  slugError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formSlug.value = ''
  formDescription.value = ''
  formParent.value = ''
  formActive.value = true
  clearFormErrors()
  formOpen.value = true
}

function openEdit(category: Category): void {
  editingId.value = category.id
  formName.value = category.name
  formSlug.value = category.slug
  formDescription.value = category.description ?? ''
  formParent.value = category.parent_id ? String(category.parent_id) : ''
  formActive.value = category.is_active
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

async function submitForm(): Promise<void> {
  clearFormErrors()

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
    return
  }

  // A slug already reported as taken would only come back as a 422; stop here so
  // the message lands on the field instead of the form banner.
  if (slugAvailability.state.value === 'taken') {
    slugError.value = t('slug.taken')
    return
  }

  saving.value = true
  const payload: CategoryPayload = {
    name: formName.value.trim(),
    description: formDescription.value.trim() || null,
    parent_id: formParent.value ? Number(formParent.value) : null,
    is_active: formActive.value,
  }

  if (formSlug.value.trim()) {
    payload.slug = formSlug.value.trim()
  }

  try {
    if (editingId.value !== null) {
      await updateCategory(editingId.value, payload)
      toast.success(t('categories.updated'))
    } else {
      await createCategory(payload)
      toast.success(t('categories.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      nameError.value = caught.fields['name']?.[0] ?? null
      slugError.value = caught.fields['slug']?.[0] ?? null
      if (!nameError.value && !slugError.value) {
        formError.value = caught.message || t('error.title')
      }
    } else {
      formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
    }
  } finally {
    saving.value = false
  }
}

/* ----------------------------------------------------------------- delete */

async function confirmDelete(): Promise<void> {
  const category = pendingDelete.value
  if (!category) return

  deleting.value = true
  try {
    await deleteCategory(category.id)
    toast.success(t('categories.deleted'))
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
    <PageHeader :title="t('categories.title')" :description="t('categories.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('categories.add') }}
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

      <BaseButton v-if="hasSearch" variant="ghost" @click="query = ''">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Tree -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="filteredRows">
        <tr v-for="item in filteredRows" :key="item.category.id">
          <td class="px-4 py-3" :class="indentClass(item.depth)">
            <span class="flex items-center gap-2">
              <FolderTree v-if="item.depth === 0" class="size-4 shrink-0 text-muted" />
              <span class="font-medium text-ink">{{ item.category.name }}</span>
            </span>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ item.category.slug }}
          </td>

          <td
            class="px-4 py-3 text-end tabular-nums"
            :class="item.category.products_count ? 'text-ink' : 'text-subtle'"
          >
            {{
              item.category.products_count !== undefined
                ? formatNumber(item.category.products_count)
                : '—'
            }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(item.category.is_active ? 'active' : 'inactive')" dot>
              {{ item.category.is_active ? t('categories.active') : t('categories.inactive') }}
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
                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(item.category)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = item.category"
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
            v-if="filteredRows.length === 0 && hasSearch"
            :title="t('categories.emptySearchTitle')"
            :description="t('categories.emptySearchBody')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="query = ''">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="filteredRows.length === 0"
            :icon="FolderTree"
            :title="t('categories.emptyTitle')"
            :description="t('categories.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('categories.add') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('categories.create') : t('categories.edit')"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <BaseInput
          v-model="formName"
          :label="t('common.name')"
          :placeholder="t('categories.namePlaceholder')"
          :error="nameError"
          required
        />

        <BaseInput
          v-model="formSlug"
          :label="t('categories.slug')"
          :placeholder="t('categories.slugPlaceholder')"
          :error="slugError"
          :hint="slugHint"
        />

        <BaseTextarea
          v-model="formDescription"
          :label="t('common.description')"
          :placeholder="t('categories.descriptionPlaceholder')"
          :rows="3"
        />

        <BaseSelect
          v-model="formParent"
          :label="t('categories.parent')"
          :options="parentOptions"
        />

        <BaseSwitch v-model="formActive" :label="t('categories.active')" />
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
      :title="t('categories.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('categories.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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
