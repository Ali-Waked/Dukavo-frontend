import { computed, ref } from 'vue'
import { fetchStores } from '@/services/storeService'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import { t } from '@/i18n'
import type { Store } from '@/types/catalogue'

/**
 * Store selection for store-scoped configuration.
 *
 * Storefront, delivery and payment settings belong to one store, not to the
 * tenant as a whole. Remembering the last choice per tenant keeps a merchant
 * editing the same shop as they move between the three screens, while a store
 * that was deleted or belongs to another tenant is never selected.
 */

const STORAGE_PREFIX = 'dukavo.merchantStore'

export function useMerchantStore() {
  const { activeTenant } = useAuth()

  const stores = ref<Store[]>([])
  const storeId = ref('')
  const loading = ref(true)
  const error = ref<string | null>(null)

  const storeOptions = computed(() =>
    stores.value.map((store) => ({
      value: String(store.id),
      label: `${store.name}${store.is_default ? ` · ${t('shop.admin.defaultStore')}` : ''}`,
    })),
  )

  const selectedStore = computed(
    () => stores.value.find((store) => String(store.id) === storeId.value) ?? null,
  )

  const canSwitch = computed(() => stores.value.length > 1)

  function storageKey(): string {
    return `${STORAGE_PREFIX}:${activeTenant.value?.id ?? 'none'}`
  }

  function remember(next: string): void {
    try {
      localStorage.setItem(storageKey(), next)
    } catch {
      // The selection is a convenience; losing it only resets the dropdown.
    }
  }

  const selectedId = computed({
    get: () => storeId.value,
    set: (next: string) => {
      storeId.value = next
      remember(next)
    },
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      stores.value = await fetchStores()

      let remembered: string | null = null
      try {
        remembered = localStorage.getItem(storageKey())
      } catch {
        remembered = null
      }

      const preferred =
        stores.value.find((store) => String(store.id) === remembered) ??
        stores.value.find((store) => store.is_default) ??
        stores.value[0] ??
        null

      storeId.value = preferred ? String(preferred.id) : ''
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

  return {
    stores,
    storeId,
    selectedId,
    selectedStore,
    storeOptions,
    canSwitch,
    loading,
    error,
    load,
  }
}
