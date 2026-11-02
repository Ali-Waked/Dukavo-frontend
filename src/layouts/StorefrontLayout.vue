<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { RefreshCw, Store } from '@/components/icons'
import StorefrontHeader from '@/components/storefront/StorefrontHeader.vue'
import StorefrontFooter from '@/components/storefront/StorefrontFooter.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { useI18n } from '@/i18n'
import { useStorefrontStore } from '@/stores/storefrontStore'
import { useStorefrontCartStore } from '@/stores/storefrontCartStore'

/**
 * Shell for a merchant's public shop.
 *
 * The tenant and store are read from the URL and resolved by the API; the two
 * slugs are never replaced with ids in the frontend. A failed resolution is
 * shown as an unavailable shop rather than an empty catalogue, so a shopper is
 * never left wondering whether the shop simply has no products.
 */

const { t } = useI18n()
const route = useRoute()
const storefront = useStorefrontStore()
const cart = useStorefrontCartStore()

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))

async function load(): Promise<void> {
  if (!tenantSlug.value || !storeSlug.value) return
  await storefront.load(tenantSlug.value, storeSlug.value)
  if (storefront.cartScope) {
    cart.setScope(storefront.cartScope)
  }
}

watch([tenantSlug, storeSlug], () => void load())
watch(
  () => storefront.cartScope,
  (scope) => {
    if (scope) cart.setScope(scope)
  },
)

onMounted(load)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <template v-if="storefront.storefront">
      <StorefrontHeader :store="storefront.storefront" :cart-count="cart.itemCount" />

      <main id="main-content" class="flex-1" tabindex="-1">
        <RouterView />
      </main>

      <StorefrontFooter :store="storefront.storefront" />
    </template>

    <div v-else-if="storefront.loading" class="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 md:px-6">
      <div class="flex items-center gap-3">
        <div class="shimmer size-10 rounded-lg" aria-hidden="true" />
        <div class="shimmer h-5 w-48 rounded-md" aria-hidden="true" />
      </div>
      <BaseSkeleton block height="h-56" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BaseSkeleton v-for="index in 4" :key="index" block height="h-64" />
      </div>
    </div>

    <div v-else class="mx-auto grid min-h-dvh w-full max-w-3xl place-items-center px-4 py-16">
      <div class="w-full">
        <BaseEmptyState
          :icon="Store"
          :title="storefront.notFound ? t('shop.notAvailable.title') : t('shop.common.error')"
          :description="storefront.error || t('shop.notAvailable.body')"
        >
          <template #action>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('shop.common.retry') }}
              </BaseButton>
              <BaseButton to="/" variant="ghost">
                {{ t('shop.notAvailable.home') }}
              </BaseButton>
            </div>
          </template>
        </BaseEmptyState>
      </div>
    </div>
  </div>
</template>
