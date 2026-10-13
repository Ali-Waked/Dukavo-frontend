<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from '@/components/icons'
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
import { deleteProduct, fetchProducts } from '@/services/productService'
import type { Product } from '@/types/catalogue'
import type { Paginated } from '@/types/api'
import type { ProductStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatNumber } from '@/utils/format'

/**
 * Catalogue list.
 *
 * The pattern every list page in Dukavo follows, and the reference for the
 * others: filters live in the URL-facing state (page resets the moment a
 * filter changes), the table never shows a blank grid while loading — it shows
 * skeleton rows at the real column widths — and a search with no hits says so
 * in words that offer a way out, rather than an empty box.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()
const router = useRouter()

const PER_PAGE = 15

const query = ref('')
const status = ref<ProductStatus | ''>('')
const sort = ref<'name' | 'price' | 'created_at'>('created_at')
const desc = ref(true)
const page = ref(1)

const debouncedQuery = useDebounce(query, 300)

const rows = ref<Product[]>([])
const meta = ref<Paginated<Product>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const pendingDelete = ref<Product | null>(null)
const deleting = ref(false)

const canCreate = computed(() => auth.can('products.create'))
const canDelete = computed(() => auth.can('products.delete'))

const hasFilters = computed(() => query.value !== '' || status.value !== '')

const statusOptions = [
  { value: '', label: t('filter.anyStatus') },
  { value: 'active', label: t('status.product.active') },
  { value: 'draft', label: t('status.product.draft') },
  { value: 'archived', label: t('status.product.archived') },
]

const sortOptions = [
  { value: 'created_at', label: t('products.sortNewest') },
  { value: 'name', label: t('products.sortName') },
  { value: 'price', label: t('products.sortPrice') },
]

const columns: TableColumn[] = [
  { key: 'name', label: t('common.product'), sortable: true },
  { key: 'category', label: t('common.category') },
  { key: 'price', label: t('products.price'), align: 'end', sortable: true },
  { key: 'stock', label: t('products.stock'), align: 'end' },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
]

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchProducts({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value || undefined,
      sort: sort.value,
      desc: desc.value,
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

watch([status, sort], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function onSort(key: string): void {
  if (sort.value === key) {
    desc.value = !desc.value
  } else {
    sort.value = key as typeof sort.value
    desc.value = key === 'name'
  }
  page.value = 1
  void load()
}

function clearFilters(): void {
  query.value = ''
  status.value = ''
  page.value = 1
  void load()
}

async function confirmDelete(): Promise<void> {
  const product = pendingDelete.value
  if (!product) return

  deleting.value = true
  try {
    await deleteProduct(product.slug)
    toast.success(t('products.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    // 409 = the product has been ordered; the server's sentence explains why
    // far better than a generic failure would.
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
    <PageHeader :title="t('products.title')" :description="t('products.subtitle')">
      <template #actions>
        <BaseButton v-if="canCreate" to="/products/new" :icon="Plus">
          {{ t('products.add') }}
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
        :label="t('products.filterStatus')"
        :options="statusOptions"
      />

      <BaseSelect
        v-model="sort"
        class="w-40"
        :label="t('action.filter')"
        :options="sortOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable
        :columns="columns"
        :loading="loading"
        :rows="rows"
        :sort-key="sort"
        :sort-direction="desc ? 'desc' : 'asc'"
        @sort="onSort"
      >
        <tr v-for="product in rows" :key="product.id">
          <td class="px-4 py-3">
            <RouterLink
              :to="{ name: 'catalogue.products.show', params: { slug: product.slug } }"
              class="block rounded-md font-medium text-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {{ product.name }}
            </RouterLink>
            <span class="mt-0.5 block text-caption text-subtle">
              {{ product.sku || '—' }}
            </span>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ product.category?.name ?? '—' }}
          </td>

          <td class="px-4 py-3 text-end font-medium tabular-nums text-ink">
            {{ formatCurrency(product.price, product.currency) }}
          </td>

          <td class="px-4 py-3 text-end tabular-nums" :class="product.stock ? 'text-ink' : 'text-subtle'">
            {{ product.stock ? formatNumber(product.stock.quantity) : '—' }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(product.status)" dot>
              {{ product.status_label }}
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
                    :to="{ name: 'catalogue.products.show', params: { slug: product.slug } }"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close()"
                  >
                    <Eye class="size-4 text-muted" />
                    {{ t('action.view') }}
                  </RouterLink>

                  <RouterLink
                    v-if="auth.can('products.update')"
                    :to="{ name: 'catalogue.products.edit', params: { slug: product.slug } }"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </RouterLink>

                  <button
                    v-if="canDelete"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = product"
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
            :title="t('products.emptySearchTitle')"
            :description="t('products.emptySearchBody')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :title="t('products.emptyTitle')"
            :description="t('products.emptyBody')"
          >
            <template v-if="canCreate" #action>
              <BaseButton :icon="Plus" @click="router.push({ name: 'catalogue.products.create' })">
                {{ t('products.add') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('products.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('products.deleteBody', { name: pendingDelete?.name ?? '' }) }}
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