<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw, Search, ShoppingBag, X } from '@/components/icons'
import StorefrontProductCard from '@/components/storefront/StorefrontProductCard.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/composables/useDebounce'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicProducts } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import type { Paginated } from '@/types/api'
import type { PublicProduct, PublicProductSort } from '@/types/storefront'

/**
 * The catalogue.
 *
 * Filters are sent to the server so a search is not limited to the current page.
 * Out-of-stock rows are hidden only when the merchant turned that setting off;
 * the card still carries a stock badge, because hiding a product the customer
 * searched for without explanation is worse than showing it as unavailable.
 */

const PER_PAGE = 24

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const storefront = useStorefrontStore()

const search = ref(String(route.query.search ?? ''))
const category = ref(String(route.query.category ?? ''))
const sort = ref<PublicProductSort>(
  ['price_asc', 'price_desc', 'name'].includes(String(route.query.sort))
    ? (String(route.query.sort) as PublicProductSort)
    : 'newest',
)
const page = ref(Math.max(1, Number(route.query.page) || 1))

const debouncedSearch = useDebounce(search, 300)

const rows = ref<PublicProduct[]>([])
const meta = ref<Paginated<PublicProduct>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const basePath = computed(() => storefront.basePath)

const visibleRows = computed(() =>
  rows.value.filter((product) => storefront.showOutOfStock || product.in_stock),
)

const hasFilters = computed(
  () => search.value !== '' || category.value !== '' || sort.value !== 'newest',
)

const categoryOptions = computed(() => [
  { value: '', label: t('shop.catalogue.allCategories') },
  ...storefront.categories
    .filter((entry) => entry.products_count > 0)
    .map((entry) => ({ value: entry.slug, label: `${entry.name} (${entry.products_count})` })),
])

const sortOptions = computed(() => [
  { value: 'newest', label: t('shop.catalogue.sort.newest') },
  { value: 'price_asc', label: t('shop.catalogue.sort.priceAsc') },
  { value: 'price_desc', label: t('shop.catalogue.sort.priceDesc') },
  { value: 'name', label: t('shop.catalogue.sort.name') },
])

let requestId = 0

async function load(): Promise<void> {
  const id = ++requestId
  loading.value = true
  error.value = null

  try {
    const result = await fetchPublicProducts(tenantSlug.value, storeSlug.value, {
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedSearch.value || undefined,
      category: category.value || undefined,
      sort: sort.value,
    })
    if (id !== requestId) return
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    if (id !== requestId) return
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

/** Keep the address bar shareable without forcing a reload on every keystroke. */
function syncQuery(): void {
  void router.replace({
    name: 'storefront.products',
    params: route.params,
    query: {
      ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
      ...(category.value ? { category: category.value } : {}),
      ...(sort.value !== 'newest' ? { sort: sort.value } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    },
  })
}

function resetFilters(): void {
  search.value = ''
  category.value = ''
  sort.value = 'newest'
  page.value = 1
}

watch(debouncedSearch, () => {
  page.value = 1
  void load()
  syncQuery()
})

watch([category, sort], () => {
  page.value = 1
  void load()
  syncQuery()
})

watch(page, () => {
  void load()
  syncQuery()
})

/** A category link from the home page can arrive while this page is mounted. */
watch(
  () => route.query.category,
  (next) => {
    const value = String(next ?? '')
    if (value !== category.value) {
      category.value = value
    }
  },
)

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-10">
    <div>
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('shop.catalogue.title') }}</h1>
      <p class="mt-1.5 text-body text-muted">{{ t('shop.catalogue.subtitle') }}</p>
    </div>

    <!-- Filters -->
    <div class="surface flex flex-col gap-3 p-4 md:flex-row md:items-end">
      <BaseInput
        v-model="search"
        type="search"
        class="flex-1"
        :label="t('shop.catalogue.search')"
        :placeholder="t('shop.catalogue.searchPlaceholder')"
      >
        <template #prefix>
          <Search class="size-4" aria-hidden="true" />
        </template>
      </BaseInput>

      <BaseSelect
        v-model="category"
        class="md:w-60"
        :label="t('shop.catalogue.category')"
        :options="categoryOptions"
      />

      <BaseSelect
        v-model="sort"
        class="md:w-48"
        :label="t('shop.catalogue.sortLabel')"
        :options="sortOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" :icon="X" @click="resetFilters">
        {{ t('shop.catalogue.clear') }}
      </BaseButton>
    </div>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <p v-if="!loading && meta" class="text-sm text-muted">
      {{ t('shop.catalogue.results', { count: meta.total }) }}
    </p>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <BaseSkeleton v-for="index in 8" :key="index" block height="h-80" />
    </div>

    <div
      v-else-if="visibleRows.length > 0"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <StorefrontProductCard
        v-for="product in visibleRows"
        :key="product.slug"
        :product="product"
        :base-path="basePath"
        :currency-decimals="storefront.storefront?.currency_decimals"
      />
    </div>

    <div v-else class="surface">
      <BaseEmptyState
        :icon="ShoppingBag"
        :title="hasFilters ? t('shop.catalogue.emptyTitle') : t('shop.home.emptyTitle')"
        :description="hasFilters ? t('shop.catalogue.emptyBody') : t('shop.home.emptyBody')"
      >
        <template #action>
          <BaseButton v-if="hasFilters" variant="secondary" @click="resetFilters">
            {{ t('shop.catalogue.clear') }}
          </BaseButton>
          <BaseButton v-else variant="secondary" :icon="RefreshCw" @click="load">
            {{ t('shop.common.retry') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <BasePagination
      v-if="!loading && meta && meta.last_page > 1"
      :meta="meta"
      @change="page = $event"
    />
  </div>
</template>
