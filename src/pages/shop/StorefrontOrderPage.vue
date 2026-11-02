<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Printer,
  RefreshCw,
  ShoppingBag,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicOrder } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import { listTrackedOrders, rememberTrackedOrder } from '@/utils/storefrontOrders'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { statusTone } from '@/utils/status'
import type { PublicOrder } from '@/types/storefront'

/**
 * One order, addressed by its tracking token.
 *
 * The token in the URL is the authorisation; there is no guest session. The
 * page is deliberately printable and only shows what the store chose to share
 * with the customer — no internal ids, costs or merchant notes.
 */

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { set: setSeo } = useSeo()
const storefront = useStorefrontStore()

const order = ref<PublicOrder | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const copied = ref(false)

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const token = computed(() => String(route.params.token ?? ''))
const basePath = computed(() => storefront.basePath)
const placed = computed(() => route.query.placed === '1')
const currencyDecimals = computed(() => storefront.storefront?.currency_decimals ?? undefined)

const recentOrderCount = computed(
  () => listTrackedOrders(tenantSlug.value, storeSlug.value).length,
)

const addressLines = computed<string[]>(() => {
  const address = order.value?.shipping_address
  if (!address || typeof address !== 'object') return []

  const record = address as Record<string, unknown>
  return ['line_one', 'line_two', 'city', 'state', 'postal_code', 'country']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
})

const contactChannels = computed(() => {
  const store = order.value?.store
  if (!store) return []

  return [
    { key: 'email', icon: Mail, href: store.email ? `mailto:${store.email}` : null, label: store.email },
    { key: 'phone', icon: Phone, href: store.phone ? `tel:${store.phone}` : null, label: store.phone },
  ].filter((channel) => Boolean(channel.href && channel.label))
})

function money(value: number): string {
  return formatCurrency(value, order.value?.currency, { decimals: currencyDecimals.value })
}

function printOrder(): void {
  window.print()
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    toast.success(t('shop.order.linkCopied'))
    window.setTimeout(() => (copied.value = false), 2500)
  } catch {
    toast.error(t('shop.order.copyFailed'))
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false

  try {
    const result = await fetchPublicOrder(tenantSlug.value, storeSlug.value, token.value)
    order.value = result

    rememberTrackedOrder(tenantSlug.value, storeSlug.value, {
      token: token.value,
      orderNumber: result.order_number,
      storeName: result.store?.name ?? storefront.storefront?.name ?? '',
      placedAt: result.placed_at ?? null,
    })

    setSeo({ title: `${t('shop.order.title')} ${result.order_number}`, noindex: true })
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
    setSeo({ title: t('shop.order.title'), noindex: true })
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(token, () => void load())
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
    <div class="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        :to="`${basePath}/products`"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
      >
        <ArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
        {{ t('shop.order.continueShopping') }}
      </RouterLink>

      <div class="flex flex-wrap gap-2">
        <BaseButton variant="ghost" size="sm" :icon="RefreshCw" :loading="loading" @click="load">
          {{ t('shop.common.retry') }}
        </BaseButton>
        <BaseButton v-if="order" variant="secondary" size="sm" :icon="Printer" @click="printOrder">
          {{ t('shop.order.print') }}
        </BaseButton>
      </div>
    </div>

    <BaseAlert v-if="error" tone="danger" class="mb-5" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <BaseSkeleton block height="h-28" />
      <BaseSkeleton block height="h-48" />
      <BaseSkeleton block height="h-32" />
    </div>

    <!-- Missing -->
    <div v-else-if="!order" class="surface">
      <BaseEmptyState
        :icon="Package"
        :title="notFound ? t('shop.order.notFoundTitle') : t('shop.common.error')"
        :description="notFound ? t('shop.order.notFoundBody') : (error ?? t('shop.common.error'))"
      >
        <template #action>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <BaseButton :to="`${basePath}/track`" variant="secondary">
              {{ t('shop.track.title') }}
            </BaseButton>
            <BaseButton :to="`${basePath}/products`" variant="ghost">
              {{ t('shop.cart.browse') }}
            </BaseButton>
          </div>
        </template>
      </BaseEmptyState>
    </div>

    <template v-else>
      <!-- Confirmation / header -->
      <section class="surface overflow-hidden">
        <div v-if="placed" class="border-b border-success-border bg-success-soft px-5 py-4 text-success-ink">
          <p class="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 class="size-5" aria-hidden="true" />
            {{ t('shop.order.placedTitle') }}
          </p>
          <p class="mt-1 text-sm opacity-90">{{ t('shop.order.placedBody') }}</p>
        </div>

        <div class="space-y-4 p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-caption font-medium uppercase tracking-wide text-subtle">
                {{ t('shop.order.number') }}
              </p>
              <h1 class="mt-1 text-h2 font-semibold tracking-tight text-ink">
                {{ order.order_number }}
              </h1>
              <p v-if="order.placed_at" class="mt-1 text-sm text-muted">
                {{ t('shop.order.placedAt', { date: formatDateTime(order.placed_at) }) }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <BaseBadge :tone="statusTone(order.status)" dot>{{ order.status_label }}</BaseBadge>
              <BaseBadge :tone="statusTone(order.payment_status)" dot>
                {{ order.payment_status_label }}
              </BaseBadge>
            </div>
          </div>

          <div v-if="order.store" class="rounded-lg border border-line bg-surface-2 p-4">
            <p class="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShoppingBag class="size-4 text-brand-ink" aria-hidden="true" />
              {{ order.store.name }}
            </p>
            <div class="mt-2 flex flex-wrap gap-4 text-sm">
              <a
                v-for="channel in contactChannels"
                :key="channel.key"
                :href="channel.href ?? undefined"
                class="inline-flex items-center gap-1.5 text-muted transition hover:text-ink"
              >
                <component :is="channel.icon" class="size-4" aria-hidden="true" />
                <span dir="ltr">{{ channel.label }}</span>
              </a>
              <a
                v-if="storefront.storefront?.settings.whatsapp_number"
                :href="`https://wa.me/${storefront.storefront.settings.whatsapp_number.replace(/[^0-9]/g, '')}`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-muted transition hover:text-ink"
              >
                <MessageCircle class="size-4" aria-hidden="true" />
                <span dir="ltr">{{ storefront.storefront.settings.whatsapp_number }}</span>
              </a>
            </div>
          </div>

          <div class="no-print flex flex-wrap items-center gap-2">
            <BaseButton variant="secondary" size="sm" :icon="copied ? CheckCircle2 : Copy" @click="copyLink">
              {{ copied ? t('shop.order.linkCopied') : t('shop.order.copyLink') }}
            </BaseButton>
            <p class="text-caption text-subtle">{{ t('shop.order.linkHint') }}</p>
          </div>
        </div>
      </section>

      <!-- Items -->
      <section class="surface mt-4 overflow-hidden">
        <h2 class="border-b border-line px-5 py-3 text-h4 font-semibold text-ink">
          {{ t('shop.order.items') }}
        </h2>

        <ul class="divide-y divide-line">
          <li
            v-for="(item, index) in order.items ?? []"
            :key="`${item.sku ?? item.name}-${index}`"
            class="flex items-start justify-between gap-4 px-5 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ item.name }}</p>
              <p class="mt-0.5 text-caption text-muted">
                <span v-if="item.sku" dir="ltr" class="me-2">{{ item.sku }}</span>
                {{ t('shop.order.quantityShort', { count: item.quantity }) }} ·
                {{ money(item.unit_price) }}
              </p>
            </div>
            <p class="shrink-0 text-sm font-semibold tabular-nums text-ink">
              {{ money(item.line_total) }}
            </p>
          </li>
        </ul>

        <dl class="space-y-2 border-t border-line px-5 py-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.order.subtotal') }}</dt>
            <dd class="tabular-nums text-ink">{{ money(order.subtotal) }}</dd>
          </div>
          <div v-if="order.discount_total > 0" class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.order.discount') }}</dt>
            <dd class="tabular-nums text-success-ink">−{{ money(order.discount_total) }}</dd>
          </div>
          <div v-if="order.tax_total > 0" class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.order.tax') }}</dt>
            <dd class="tabular-nums text-ink">{{ money(order.tax_total) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.order.delivery') }}</dt>
            <dd class="tabular-nums text-ink">
              {{ order.shipping_total > 0 ? money(order.shipping_total) : t('shop.order.free') }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line pt-2 text-base">
            <dt class="font-semibold text-ink">{{ t('shop.order.total') }}</dt>
            <dd class="font-semibold tabular-nums text-ink">{{ money(order.grand_total) }}</dd>
          </div>
        </dl>
      </section>

      <!-- Delivery and payment -->
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <section class="surface p-5">
          <h2 class="text-h4 font-semibold text-ink">{{ t('shop.order.deliveryAddress') }}</h2>
          <div class="mt-3 space-y-1 text-sm text-muted">
            <p v-if="order.customer_name" class="font-medium text-ink">{{ order.customer_name }}</p>
            <p v-if="order.customer_phone" dir="ltr">{{ order.customer_phone }}</p>
            <p v-if="order.customer_email" dir="ltr">{{ order.customer_email }}</p>
            <p v-for="(line, index) in addressLines" :key="index">{{ line }}</p>
            <p v-if="addressLines.length === 0">{{ t('shop.order.noAddress') }}</p>
          </div>
        </section>

        <section class="surface p-5">
          <h2 class="text-h4 font-semibold text-ink">{{ t('shop.order.payment') }}</h2>
          <p class="mt-3 text-sm text-ink">
            {{ order.payment_method_label ?? t('shop.order.paymentUnknown') }}
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ order.payment_status_label }}
          </p>
          <p
            v-if="order.payment_method === 'cod' && order.payment_status !== 'paid'"
            class="mt-3 rounded-lg bg-surface-2 p-3 text-caption text-muted"
          >
            {{ t('shop.order.codNote') }}
          </p>
        </section>
      </div>

      <div class="no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <RouterLink
          :to="`${basePath}/track`"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
        >
          {{ t('shop.order.trackAnother') }}
        </RouterLink>

        <p
          v-if="recentOrderCount > 1"
          class="text-caption text-subtle"
        >
          {{ t('shop.order.recentSaved') }}
        </p>
      </div>
    </template>
  </div>
</template>
