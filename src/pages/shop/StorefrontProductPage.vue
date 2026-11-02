<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from '@/components/icons'
import QuantityStepper from '@/components/storefront/QuantityStepper.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { useToast } from '@/composables/useToast'
import { useDebounce } from '@/composables/useDebounce'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicProduct } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import { useStorefrontCartStore } from '@/stores/storefrontCartStore'
import { formatCurrency } from '@/utils/format'
import type { PublicProduct, PublicProductVariant } from '@/types/storefront'

/**
 * One product, as a customer sees it.
 *
 * The variant list is the server's, so a shopper can only pick a combination
 * that actually exists. Availability is shown per variant because the product
 * total can be in stock while the chosen size is not.
 */

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { set: setSeo } = useSeo()
const storefront = useStorefrontStore()
const cart = useStorefrontCartStore()

const product = ref<PublicProduct | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const selectedVariantId = ref<number | null>(null)
const quantity = ref(1)
const activeImage = ref(0)
const added = ref(false)

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const productSlug = computed(() => String(route.params.productSlug ?? ''))
const basePath = computed(() => storefront.basePath)
const currencyDecimals = computed(() => storefront.storefront?.currency_decimals ?? undefined)

/** Debounced so a quick double-click cannot fire two identical requests. */
const debouncedSlug = useDebounce(productSlug, 0)

const variants = computed<PublicProductVariant[]>(() => product.value?.variants ?? [])

const selectedVariant = computed<PublicProductVariant | null>(
  () => variants.value.find((variant) => variant.id === selectedVariantId.value) ?? null,
)

const inStock = computed(() => selectedVariant.value?.in_stock === true)

const price = computed(() =>
  formatCurrency(selectedVariant.value?.price ?? product.value?.price ?? 0, product.value?.currency, {
    decimals: currencyDecimals.value,
  }),
)

const images = computed(() => product.value?.images ?? [])

const activeImageUrl = computed(() => {
  const image = images.value[activeImage.value]
  return image?.url ?? images.value[0]?.url ?? null
})

function chooseVariant(variant: PublicProductVariant): void {
  if (selectedVariantId.value === variant.id) return

  selectedVariantId.value = variant.id
  quantity.value = 1
  added.value = false
}

function addToCart(): void {
  const current = product.value
  const variant = selectedVariant.value

  if (!current || !variant || variant.available < 1) return

  if (!cart.scope && storefront.cartScope) {
    cart.setScope(storefront.cartScope)
  }

  cart.addLine(
    {
      variantId: variant.id,
      productSlug: current.slug,
      productName: current.name,
      variantName: variant.name,
      unitPrice: variant.price,
      quantity: 1,
      currency: current.currency,
      imageUrl: activeImageUrl.value,
      available: variant.available,
      sku: variant.sku,
    },
    quantity.value,
  )

  added.value = true
  toast.success(t('shop.product.addedToCart'))
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false
  product.value = null
  activeImage.value = 0

  try {
    const result = await fetchPublicProduct(tenantSlug.value, storeSlug.value, debouncedSlug.value)
    product.value = result

    const preferred =
      result.variants.find((variant) => variant.is_default && variant.in_stock) ??
      result.variants.find((variant) => variant.in_stock) ??
      result.variants.find((variant) => variant.is_default) ??
      result.variants[0] ??
      null

    selectedVariantId.value = preferred?.id ?? null
    quantity.value = 1

    setSeo({
      title: result.name,
      description: result.description ?? result.name,
      image: images.value[0]?.url ?? null,
    })
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      error.value =
        caught instanceof ApiError && caught.isNetworkError
          ? t('shop.common.networkError')
          : caught instanceof ApiError
            ? caught.message
            : t('shop.common.error')
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(debouncedSlug, () => void load())
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
    <RouterLink
      :to="`${basePath}/products`"
      class="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
    >
      <ArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
      {{ t('shop.product.backToCatalogue') }}
    </RouterLink>

    <BaseAlert v-if="error" tone="danger" class="mb-5" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Loading -->
    <div v-if="loading" class="grid gap-8 lg:grid-cols-2">
      <BaseSkeleton block height="h-96" />
      <div class="space-y-4">
        <BaseSkeleton block height="h-6" />
        <BaseSkeleton block height="h-10" />
        <BaseSkeleton :rows="3" height="h-4" />
        <BaseSkeleton block height="h-12" />
      </div>
    </div>

    <!-- Missing or errored -->
    <div v-else-if="!product" class="surface">
      <BaseEmptyState
        :icon="notFound ? ShoppingBag : Package"
        :title="notFound ? t('shop.product.notFoundTitle') : t('shop.common.error')"
        :description="notFound ? t('shop.product.notFoundBody') : (error ?? t('shop.common.error'))"
      >
        <template #action>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <BaseButton :to="`${basePath}/products`" variant="secondary">
              {{ t('shop.product.backToCatalogue') }}
            </BaseButton>
            <BaseButton v-if="!notFound" variant="ghost" :icon="RefreshCw" @click="load">
              {{ t('shop.common.retry') }}
            </BaseButton>
          </div>
        </template>
      </BaseEmptyState>
    </div>

    <!-- Product -->
    <div v-else class="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div class="space-y-3">
        <div class="relative overflow-hidden rounded-2xl border border-line bg-inset">
          <img
            v-if="activeImageUrl"
            :src="activeImageUrl"
            :alt="images[activeImage]?.alt_text || product.name"
            class="aspect-square size-full object-cover"
          />
          <div v-else class="grid aspect-square place-items-center text-subtle">
            <ShoppingBag class="size-16" aria-hidden="true" />
          </div>
        </div>

        <div v-if="images.length > 1" class="flex flex-wrap gap-2">
          <button
            v-for="(image, index) in images"
            :key="`${image.url}-${index}`"
            type="button"
            class="size-16 overflow-hidden rounded-lg border-2 transition"
            :class="index === activeImage ? 'border-brand-700' : 'border-line hover:border-brand'"
            :aria-label="t('shop.product.viewImage', { index: index + 1 })"
            :aria-pressed="index === activeImage"
            @click="activeImage = index"
          >
            <img
              :src="image.url"
              :alt="image.alt_text || `${product.name} ${index + 1}`"
              class="size-full object-cover"
            />
          </button>
        </div>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <RouterLink
            v-if="product.category"
            :to="{
              name: 'storefront.products',
              params: route.params,
              query: { category: product.category.slug },
            }"
            class="text-caption font-medium uppercase tracking-wide text-brand-ink hover:underline"
          >
            {{ product.category.name }}
          </RouterLink>

          <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ product.name }}</h1>

          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge v-if="inStock" tone="success" dot>{{ t('shop.product.inStock') }}</BaseBadge>
            <BaseBadge v-else tone="danger" dot>{{ t('shop.product.outOfStock') }}</BaseBadge>
            <BaseBadge v-if="inStock && (selectedVariant?.available ?? 0) <= 5" tone="warning">
              {{ t('shop.product.lowStockCount', { count: selectedVariant?.available ?? 0 }) }}
            </BaseBadge>
          </div>
        </div>

        <p class="text-3xl font-semibold tabular-nums text-ink">{{ price }}</p>

        <p v-if="product.description" class="whitespace-pre-line text-body text-muted">
          {{ product.description }}
        </p>

        <!-- Variants -->
        <div v-if="variants.length > 0" class="space-y-2">
          <p class="text-sm font-medium text-ink">{{ t('shop.product.variant') }}</p>
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('shop.product.variant')">
            <button
              v-for="variant in variants"
              :key="variant.id"
              type="button"
              role="radio"
              :aria-checked="variant.id === selectedVariantId"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition"
              :class="[
                variant.id === selectedVariantId
                  ? 'border-brand-700 bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink hover:border-brand',
                variant.available < 1 ? 'opacity-60' : '',
              ]"
              @click="chooseVariant(variant)"
            >
              <span>{{ variant.name }}</span>
              <span v-if="variant.available < 1" class="ms-1 text-caption text-danger-ink">
                ({{ t('shop.product.outOfStock') }})
              </span>
            </button>
          </div>
          <p v-if="selectedVariant?.sku" class="text-caption text-subtle">
            {{ t('shop.product.sku') }}: <span dir="ltr">{{ selectedVariant.sku }}</span>
          </p>
        </div>

        <!-- Purchase -->
        <div class="surface space-y-4 p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="space-y-1.5">
              <p class="text-sm font-medium text-ink">{{ t('shop.product.quantity') }}</p>
              <QuantityStepper v-model="quantity" :max="Math.max(1, selectedVariant?.available ?? 1)" :disabled="!inStock" />
            </div>

            <BaseButton
              class="flex-1"
              size="lg"
              :icon="added ? Check : ShoppingCart"
              :disabled="!inStock"
              @click="addToCart"
            >
              {{ inStock ? t('shop.product.addToCart') : t('shop.product.outOfStock') }}
            </BaseButton>
          </div>

          <p v-if="inStock" class="text-caption text-muted">
            {{ t('shop.product.availableCount', { count: selectedVariant?.available ?? 0 }) }}
          </p>

          <BaseButton :to="`${basePath}/cart`" variant="secondary" block :icon="ShoppingCart">
            {{ t('shop.product.viewCart') }}
          </BaseButton>
        </div>

        <ul class="grid gap-3 text-sm text-muted sm:grid-cols-2">
          <li class="flex items-start gap-2">
            <Truck class="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
            <span>{{ t('shop.product.deliveryNote') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <ShieldCheck class="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
            <span>{{ t('shop.product.paymentNote') }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
