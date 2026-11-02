import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchPublicCategories,
  fetchPublicPaymentMethods,
  fetchPublicStorefront,
} from '@/services/storefrontService'
import { ApiError } from '@/lib/axiosClient'
import { t } from '@/i18n'
import type {
  PaymentMethodOption,
  PublicCategory,
  PublicStorefront,
} from '@/types/storefront'

/**
 * The shopfront currently being browsed.
 *
 * The layout owns the load and the pages read from here, so navigating between
 * catalogue pages does not re-fetch the store header, categories and payment
 * methods every time. The key is the tenant/store slug pair, which is also what
 * keeps two open shops from sharing state.
 */

export const useStorefrontStore = defineStore('storefront', () => {
  const key = ref<string | null>(null)
  const storefront = ref<PublicStorefront | null>(null)
  const categories = ref<PublicCategory[]>([])
  const paymentMethods = ref<PaymentMethodOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)

  const isReady = computed(() => storefront.value !== null)
  const basePath = computed(() => {
    if (!storefront.value) return ''
    return `/shop/${storefront.value.tenant_slug}/${storefront.value.slug}`
  })
  const cartScope = computed(() =>
    storefront.value ? `${storefront.value.tenant_slug}:${storefront.value.slug}` : null,
  )
  const showOutOfStock = computed(() => storefront.value?.settings?.show_out_of_stock !== false)

  function reset(): void {
    storefront.value = null
    categories.value = []
    paymentMethods.value = []
    error.value = null
    notFound.value = false
  }

  async function load(tenantSlug: string, storeSlug: string, force = false): Promise<void> {
    const next = `${tenantSlug}/${storeSlug}`

    if (!force && key.value === next && storefront.value) {
      return
    }

    key.value = next
    loading.value = true
    error.value = null
    notFound.value = false

    try {
      const [shop, categoryRows, paymentResponse] = await Promise.all([
        fetchPublicStorefront(tenantSlug, storeSlug),
        fetchPublicCategories(tenantSlug, storeSlug),
        fetchPublicPaymentMethods(tenantSlug, storeSlug),
      ])

      storefront.value = shop
      categories.value = categoryRows
      paymentMethods.value = paymentResponse.methods
    } catch (caught) {
      reset()
      notFound.value = caught instanceof ApiError && caught.status === 404
      error.value =
        caught instanceof ApiError && caught.isNetworkError
          ? t('shop.common.networkError')
          : caught instanceof ApiError && caught.message
            ? caught.message
            : t('shop.notAvailable.body')
    } finally {
      loading.value = false
    }
  }

  return {
    key,
    storefront,
    categories,
    paymentMethods,
    loading,
    error,
    notFound,
    isReady,
    basePath,
    cartScope,
    showOutOfStock,
    load,
    reset,
  }
})
