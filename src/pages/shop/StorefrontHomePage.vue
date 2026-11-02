<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowRight,
  Clock,
  Info,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
} from '@/components/icons'
import StorefrontProductCard from '@/components/storefront/StorefrontProductCard.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicProducts } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import type { PublicProduct } from '@/types/storefront'

/** The shop's landing page: identity first, then what can actually be bought. */

const { t } = useI18n()
const route = useRoute()
const storefront = useStorefrontStore()

const products = ref<PublicProduct[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const basePath = computed(() => storefront.basePath)

const featured = computed(() =>
  products.value
    .filter((product) => storefront.showOutOfStock || product.in_stock)
    .slice(0, 8),
)

const categoriesWithStock = computed(() =>
  storefront.categories.filter((category) => category.products_count > 0).slice(0, 10),
)

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const result = await fetchPublicProducts(tenantSlug.value, storeSlug.value, {
      per_page: 24,
      sort: 'newest',
    })
    products.value = result.data
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([tenantSlug, storeSlug], () => void load())
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="border-b border-line bg-surface">
      <div class="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:px-6 md:py-16">
        <div class="space-y-5">
          <p class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-caption font-semibold uppercase tracking-wide text-brand-ink">
            <Store class="size-3.5" aria-hidden="true" />
            {{ storefront.storefront?.name }}
          </p>

          <h1 class="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {{ storefront.storefront?.settings.tagline || storefront.storefront?.name }}
          </h1>

          <p v-if="storefront.storefront?.description" class="max-w-xl text-body text-muted">
            {{ storefront.storefront.description }}
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <BaseButton :to="`${basePath}/products`" size="lg" :icon="ShoppingBag">
              {{ t('shop.home.browse') }}
            </BaseButton>
            <BaseButton :to="`${basePath}/track`" variant="secondary" size="lg">
              {{ t('shop.home.track') }}
            </BaseButton>
          </div>
        </div>

        <div class="relative overflow-hidden rounded-2xl bg-inset">
          <img
            v-if="storefront.storefront?.settings.hero_image_url"
            :src="storefront.storefront.settings.hero_image_url"
            :alt="storefront.storefront.name"
            class="aspect-4/3 size-full object-cover"
          />
          <img
            v-else-if="storefront.storefront?.logo_url"
            :src="storefront.storefront.logo_url"
            :alt="storefront.storefront.name"
            class="mx-auto aspect-4/3 max-h-80 object-contain p-8"
          />
          <div v-else class="grid aspect-4/3 place-items-center text-subtle">
            <ShoppingBag class="size-16" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>

    <!-- Practical notes: only render what the merchant actually filled in. -->
    <section
      v-if="
        storefront.storefront?.settings.opening_hours ||
        storefront.storefront?.settings.delivery_note ||
        storefront.storefront?.settings.address
      "
      class="border-b border-line bg-surface-2"
    >
      <div class="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:grid-cols-3 md:px-6">
        <div v-if="storefront.storefront?.settings.opening_hours" class="flex items-start gap-3">
          <Clock class="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <div>
            <p class="text-sm font-medium text-ink">{{ t('shop.home.hours') }}</p>
            <p class="mt-0.5 text-sm text-muted">{{ storefront.storefront.settings.opening_hours }}</p>
          </div>
        </div>

        <div v-if="storefront.storefront?.settings.delivery_note" class="flex items-start gap-3">
          <Truck class="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <div>
            <p class="text-sm font-medium text-ink">{{ t('shop.home.delivery') }}</p>
            <p class="mt-0.5 text-sm text-muted">{{ storefront.storefront.settings.delivery_note }}</p>
          </div>
        </div>

        <div v-if="storefront.storefront?.settings.address" class="flex items-start gap-3">
          <Info class="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <div>
            <p class="text-sm font-medium text-ink">{{ t('shop.home.address') }}</p>
            <p class="mt-0.5 text-sm text-muted">{{ storefront.storefront.settings.address }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6">
      <!-- Categories -->
      <section v-if="categoriesWithStock.length > 0" class="space-y-4">
        <div class="flex items-end justify-between gap-3">
          <h2 class="text-h3 font-semibold text-ink">{{ t('shop.home.categories') }}</h2>
          <RouterLink
            :to="`${basePath}/products`"
            class="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline"
          >
            {{ t('shop.home.allProducts') }}
            <ArrowRight class="size-4 rtl:rotate-180" aria-hidden="true" />
          </RouterLink>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-for="category in categoriesWithStock"
            :key="category.slug"
            :to="{ name: 'storefront.products', params: route.params, query: { category: category.slug } }"
            class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink transition hover:border-brand hover:bg-brand-soft hover:text-brand-ink"
          >
            {{ category.name }}
            <span class="rounded-full bg-surface-2 px-1.5 text-caption text-muted">
              {{ category.products_count }}
            </span>
          </RouterLink>
        </div>
      </section>

      <!-- Featured products -->
      <section class="space-y-4">
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-h3 font-semibold text-ink">{{ t('shop.home.featured') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('shop.home.featuredBody') }}</p>
          </div>
          <RouterLink
            :to="`${basePath}/products`"
            class="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline"
          >
            {{ t('shop.home.viewAll') }}
            <ArrowRight class="size-4 rtl:rotate-180" aria-hidden="true" />
          </RouterLink>
        </div>

        <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
          {{ error }}
        </BaseAlert>

        <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BaseSkeleton v-for="index in 4" :key="index" block height="h-72" />
        </div>

        <div v-else-if="featured.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StorefrontProductCard
            v-for="product in featured"
            :key="product.slug"
            :product="product"
            :base-path="basePath"
            :currency-decimals="storefront.storefront?.currency_decimals"
          />
        </div>

        <div v-else class="surface">
          <BaseEmptyState
            :icon="ShoppingBag"
            :title="t('shop.home.emptyTitle')"
            :description="t('shop.home.emptyBody')"
          >
            <template #action>
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('shop.common.retry') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </div>
      </section>

      <!-- About -->
      <section v-if="storefront.storefront?.settings.about" class="surface p-6 md:p-8">
        <h2 class="text-h3 font-semibold text-ink">{{ t('shop.home.about') }}</h2>
        <p class="mt-3 max-w-3xl whitespace-pre-line text-body text-muted">
          {{ storefront.storefront.settings.about }}
        </p>
      </section>
    </div>
  </div>
</template>
