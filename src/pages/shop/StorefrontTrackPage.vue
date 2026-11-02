<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  ClipboardList,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicOrder } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import {
  forgetTrackedOrders,
  listTrackedOrders,
  type TrackedOrder,
} from '@/utils/storefrontOrders'
import { formatDateTime } from '@/utils/format'

/**
 * Find an order.
 *
 * A guest has no order history, so the shop remembers links on this device and
 * also accepts the tracking link or token itself. The token is the secret; the
 * page never searches by order number, which would let anyone enumerate orders.
 */

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { set: setSeo } = useSeo()
const storefront = useStorefrontStore()

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const basePath = computed(() => storefront.basePath)

const tracked = ref<TrackedOrder[]>([])
const lookup = ref('')
const lookupError = ref<string | null>(null)
const looking = ref(false)
const clearOpen = ref(false)

function refreshTracked(): void {
  tracked.value = listTrackedOrders(tenantSlug.value, storeSlug.value)
}

function extractToken(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') return ''

  const match = trimmed.match(/\/orders\/([^/?#\s]+)/)
  const matchedToken = match?.[1]
  if (matchedToken) return decodeURIComponent(matchedToken)

  return trimmed
}

async function findOrder(): Promise<void> {
  const token = extractToken(lookup.value)

  if (token === '') {
    lookupError.value = t('shop.track.tokenRequired')
    return
  }

  looking.value = true
  lookupError.value = null

  try {
    await fetchPublicOrder(tenantSlug.value, storeSlug.value, token)
    await router.push({
      name: 'storefront.order',
      params: { ...route.params, token },
    })
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      lookupError.value = t('shop.track.notFound')
    } else {
      lookupError.value =
        caught instanceof ApiError && caught.isNetworkError
          ? t('shop.common.networkError')
          : caught instanceof ApiError
            ? caught.message
            : t('shop.common.error')
    }
  } finally {
    looking.value = false
  }
}

function clearTracked(): void {
  forgetTrackedOrders(tenantSlug.value, storeSlug.value)
  refreshTracked()
  clearOpen.value = false
}

onMounted(() => {
  setSeo({ title: t('shop.track.title'), noindex: true })
  refreshTracked()
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6 md:py-10">
    <div>
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('shop.track.title') }}</h1>
      <p class="mt-1.5 text-body text-muted">{{ t('shop.track.subtitle') }}</p>
    </div>

    <section class="surface space-y-4 p-5">
      <div class="flex items-center gap-2">
        <Search class="size-5 text-brand-ink" aria-hidden="true" />
        <h2 class="text-h4 font-semibold text-ink">{{ t('shop.track.lookup') }}</h2>
      </div>

      <form class="space-y-3" @submit.prevent="findOrder">
        <BaseInput
          v-model="lookup"
          :label="t('shop.track.tokenLabel')"
          :hint="t('shop.track.tokenHint')"
          :placeholder="t('shop.track.tokenPlaceholder')"
          :error="lookupError"
        />
        <BaseButton type="submit" :icon="Search" :loading="looking">
          {{ t('shop.track.find') }}
        </BaseButton>
      </form>

      <p class="text-caption text-subtle">{{ t('shop.track.privacyNote') }}</p>
    </section>

    <BaseAlert tone="info">{{ t('shop.track.helpNote') }}</BaseAlert>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-h3 font-semibold text-ink">{{ t('shop.track.recent') }}</h2>
        <BaseButton
          v-if="tracked.length > 0"
          variant="ghost"
          size="sm"
          :icon="Trash2"
          @click="clearOpen = true"
        >
          {{ t('shop.track.clearRecent') }}
        </BaseButton>
      </div>

      <div v-if="tracked.length > 0" class="surface divide-y divide-line">
        <RouterLink
          v-for="entry in tracked"
          :key="entry.token"
          :to="{ name: 'storefront.order', params: { ...route.params, token: entry.token } }"
          class="flex items-center gap-3 p-4 transition hover:bg-surface-2"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <ClipboardList class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-ink">{{ entry.orderNumber }}</span>
            <span class="block truncate text-caption text-muted">
              {{ entry.storeName }}
              <template v-if="entry.placedAt"> · {{ formatDateTime(entry.placedAt) }}</template>
            </span>
          </span>
          <ArrowRight class="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
        </RouterLink>
      </div>

      <div v-else class="surface">
        <BaseEmptyState
          :icon="Package"
          :title="t('shop.track.emptyTitle')"
          :description="t('shop.track.emptyBody')"
          compact
        >
          <template #action>
            <BaseButton :to="`${basePath}/products`" variant="secondary" :icon="RefreshCw">
              {{ t('shop.cart.browse') }}
            </BaseButton>
          </template>
        </BaseEmptyState>
      </div>
    </section>

    <BaseModal
      :open="clearOpen"
      :title="t('shop.track.clearTitle')"
      :description="t('shop.track.clearBody')"
      size="sm"
      @close="clearOpen = false"
    >
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="clearOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :icon="Trash2" @click="clearTracked">
          {{ t('shop.track.clearRecent') }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
