<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Wallet,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicShippingZones, placeStorefrontOrder } from '@/services/storefrontService'
import { useStorefrontStore } from '@/stores/storefrontStore'
import { useStorefrontCartStore } from '@/stores/storefrontCartStore'
import { rememberTrackedOrder } from '@/utils/storefrontOrders'
import { formatCurrency } from '@/utils/format'
import type {
  PaymentMethodCode,
  ShippingZone,
  StorefrontCheckoutPayload,
} from '@/types/storefront'

/**
 * Guest checkout.
 *
 * Every amount shown here is an estimate that mirrors the store's published
 * delivery rules; the order itself is priced by the server. The browser sends
 * only what is being bought, where it goes and how it is paid — never a price,
 * a fee or a total. A stable idempotency key means a double submit or a lost
 * response returns the same order instead of charging twice.
 */

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { set: setSeo } = useSeo()
const storefront = useStorefrontStore()
const cart = useStorefrontCartStore()

const zones = ref<ShippingZone[]>([])
const zonesLoading = ref(true)
const zonesError = ref<string | null>(null)

const form = reactive({
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  notes: '',
  line_one: '',
  line_two: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  area: '',
})

const paymentMethod = ref<PaymentMethodCode | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

const submitted = ref(false)

const tenantSlug = computed(() => String(route.params.tenantSlug ?? ''))
const storeSlug = computed(() => String(route.params.storeSlug ?? ''))
const basePath = computed(() => storefront.basePath)
const currency = computed(() => storefront.storefront?.currency ?? cart.currency ?? undefined)
const currencyDecimals = computed(() => storefront.storefront?.currency_decimals ?? undefined)

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Stable for this page visit; a retry asks for the same order, not a new one. */
const idempotencyKey = ref(newIdempotencyKey())

function money(value: number): string {
  return formatCurrency(value, currency.value, { decimals: currencyDecimals.value })
}

function normalise(value: string | null | undefined): string | null {
  const result = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return result === '' ? null : result
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

const availableMethods = computed(() => storefront.paymentMethods.filter((method) => method.available))
const hasPaymentMethod = computed(() => availableMethods.value.length > 0)

watch(
  () => storefront.paymentMethods,
  (methods) => {
    if (paymentMethod.value) return
    const first = methods.find((method) => method.available)
    if (first) paymentMethod.value = first.code
  },
  { immediate: true },
)

/** Areas offered by zones that could match the city just entered. */
const areaOptions = computed(() => {
  const city = normalise(form.city)
  const values = new Set<string>()

  for (const zone of zones.value) {
    const zoneCity = normalise(zone.city)
    if (zoneCity !== null && zoneCity !== city) continue
    for (const area of zone.areas) values.add(area)
  }

  return Array.from(values)
    .sort()
    .map((value) => ({ value, label: titleCase(value) }))
})

const knownCities = computed(() =>
  Array.from(
    new Set(
      zones.value
        .map((zone) => zone.city)
        .filter((city): city is string => typeof city === 'string' && city !== ''),
    ),
  ).sort(),
)

const quote = computed(() => {
  const merchandise = cart.subtotal
  const city = normalise(form.city)
  const area = normalise(form.area)

  // A store with no delivery rules charges no delivery fee. That is an explicit
  // choice, not an invented free tier.
  if (zones.value.length === 0) {
    return { status: 'free' as const, fee: 0, zone: null, freeShipping: false }
  }

  if (!city) {
    return { status: 'needs-city' as const, fee: null, zone: null, freeShipping: false }
  }

  const zone = zones.value.find((candidate) => {
    const zoneCity = normalise(candidate.city)
    if (zoneCity !== null && zoneCity !== city) return false

    const areas = candidate.areas.map((value) => normalise(value)).filter((value): value is string => value !== null)
    if (areas.length === 0) return true

    return area !== null && areas.includes(area)
  })

  if (!zone) {
    return { status: 'not-deliverable' as const, fee: null, zone: null, freeShipping: false }
  }

  const threshold = zone.free_shipping_threshold
  const freeShipping = threshold != null && merchandise >= threshold

  return {
    status: 'ok' as const,
    fee: freeShipping ? 0 : zone.fee,
    zone,
    freeShipping,
  }
})

const shippingFee = computed(() => (quote.value.fee === null ? null : quote.value.fee))
const total = computed(() => (shippingFee.value === null ? cart.subtotal : cart.subtotal + shippingFee.value))

const canSubmit = computed(
  () => !cart.isEmpty && hasPaymentMethod.value && quote.value.status !== 'not-deliverable',
)

function errorFor(key: string): string | null {
  return fieldErrors.value[key]?.[0] ?? null
}

async function loadZones(): Promise<void> {
  zonesLoading.value = true
  zonesError.value = null

  try {
    zones.value = await fetchPublicShippingZones(tenantSlug.value, storeSlug.value)
  } catch (caught) {
    zonesError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error')
  } finally {
    zonesLoading.value = false
  }
}

function validate(): boolean {
  const missing: Record<string, string[]> = {}

  if (!form.customer_name.trim()) missing.customer_name = [t('shop.checkout.required')]
  if (!form.customer_phone.trim()) missing.customer_phone = [t('shop.checkout.required')]
  if (!form.line_one.trim()) missing['shipping_address.line_one'] = [t('shop.checkout.required')]
  if (!form.city.trim()) missing['shipping_address.city'] = [t('shop.checkout.required')]
  if (form.country.trim().length !== 2) {
    missing['shipping_address.country'] = [t('shop.checkout.countryInvalid')]
  }
  if (areaOptions.value.length > 0 && !form.area.trim()) {
    missing.area = [t('shop.checkout.areaRequired')]
  }

  fieldErrors.value = missing
  return Object.keys(missing).length === 0
}

function buildPayload(): StorefrontCheckoutPayload {
  return {
    customer_name: form.customer_name.trim(),
    customer_phone: form.customer_phone.trim(),
    customer_email: form.customer_email.trim() || null,
    area: form.area.trim() || null,
    notes: form.notes.trim() || null,
    payment_method: paymentMethod.value as PaymentMethodCode,
    idempotency_key: idempotencyKey.value,
    shipping_address: {
      contact_name: form.customer_name.trim() || null,
      line_one: form.line_one.trim(),
      line_two: form.line_two.trim() || null,
      city: form.city.trim(),
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim().toUpperCase(),
    },
    items: cart.lines.map((line) => ({
      product_variant_id: line.variantId,
      quantity: line.quantity,
    })),
  }
}

async function submit(): Promise<void> {
  if (submitting.value) return

  submitted.value = true
  formError.value = null

  if (!paymentMethod.value) {
    formError.value = t('shop.checkout.choosePayment')
    return
  }

  if (!validate()) {
    formError.value = t('shop.checkout.fixFields')
    return
  }

  submitting.value = true

  try {
    const order = await placeStorefrontOrder(tenantSlug.value, storeSlug.value, buildPayload())

    // The order exists now: drop the basket before navigating so a back button
    // cannot re-submit the same lines.
    cart.clear()

    if (order.tracking_token) {
      rememberTrackedOrder(tenantSlug.value, storeSlug.value, {
        token: order.tracking_token,
        orderNumber: order.order_number,
        storeName: order.store?.name ?? storefront.storefront?.name ?? '',
        placedAt: order.placed_at ?? null,
      })

      await router.replace({
        name: 'storefront.order',
        params: { ...route.params, token: order.tracking_token },
        query: { placed: '1' },
      })
    } else {
      await router.replace({ name: 'storefront.track', params: route.params })
    }
  } catch (caught) {
    if (caught instanceof ApiError) {
      if (caught.status === 422) {
        fieldErrors.value = caught.fields ?? {}
        formError.value = caught.message
      } else if (caught.status === 409) {
        formError.value = caught.message
        // Stock or delivery rules changed under the customer; re-reading zones
        // keeps the displayed fee honest before they try again.
        void loadZones()
      } else {
        formError.value = caught.isNetworkError
          ? t('shop.common.networkError')
          : caught.message
      }
    } else {
      formError.value = t('shop.common.error')
    }
  } finally {
    submitting.value = false
  }
}

watch(form, () => {
  if (Object.keys(fieldErrors.value).length > 0) {
    fieldErrors.value = {}
  }
})

watch(paymentMethod, () => {
  if (Object.keys(fieldErrors.value).length > 0) {
    fieldErrors.value = {}
  }
})

onMounted(() => {
  setSeo({ title: t('shop.checkout.title'), noindex: true })
  void loadZones()
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
    <RouterLink
      :to="`${basePath}/cart`"
      class="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
    >
      <ArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
      {{ t('shop.checkout.backToCart') }}
    </RouterLink>

    <div v-if="cart.isEmpty && !submitting" class="surface">
      <BaseEmptyState
        :icon="ShoppingCart"
        :title="t('shop.cart.emptyTitle')"
        :description="t('shop.cart.emptyBody')"
      >
        <template #action>
          <BaseButton :to="`${basePath}/products`" :icon="ShoppingBag">
            {{ t('shop.cart.browse') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <template v-else>
      <div class="mb-6">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('shop.checkout.title') }}</h1>
        <p class="mt-1.5 text-body text-muted">{{ t('shop.checkout.subtitle') }}</p>
      </div>

      <BaseAlert v-if="formError" tone="danger" class="mb-4" @dismiss="formError = null">
        {{ formError }}
      </BaseAlert>

      <BaseAlert v-if="!hasPaymentMethod" tone="warning" class="mb-4">
        {{ t('shop.checkout.noPaymentMethod') }}
      </BaseAlert>

      <form class="grid items-start gap-6 lg:grid-cols-[1fr_22rem]" novalidate @submit.prevent="submit">
        <div class="space-y-6">
          <!-- Customer -->
          <section class="surface space-y-4 p-5">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="size-5 text-brand-ink" aria-hidden="true" />
              <h2 class="text-h4 font-semibold text-ink">{{ t('shop.checkout.contact') }}</h2>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-model="form.customer_name"
                :label="t('shop.checkout.name')"
                :error="errorFor('customer_name')"
                autocomplete="name"
                required
              />
              <BaseInput
                v-model="form.customer_phone"
                type="tel"
                :label="t('shop.checkout.phone')"
                :hint="t('shop.checkout.phoneHint')"
                :error="errorFor('customer_phone')"
                autocomplete="tel"
                required
              />
              <BaseInput
                v-model="form.customer_email"
                type="email"
                class="sm:col-span-2"
                :label="t('shop.checkout.email')"
                :hint="t('shop.checkout.emailHint')"
                :error="errorFor('customer_email')"
                autocomplete="email"
              />
            </div>
          </section>

          <!-- Delivery address -->
          <section class="surface space-y-4 p-5">
            <div class="flex items-center gap-2">
              <MapPin class="size-5 text-brand-ink" aria-hidden="true" />
              <h2 class="text-h4 font-semibold text-ink">{{ t('shop.checkout.deliveryAddress') }}</h2>
            </div>

            <BaseInput
              v-model="form.line_one"
              :label="t('shop.checkout.lineOne')"
              :error="errorFor('shipping_address.line_one')"
              autocomplete="address-line1"
              required
            />
            <BaseInput
              v-model="form.line_two"
              :label="t('shop.checkout.lineTwo')"
              :error="errorFor('shipping_address.line_two')"
              autocomplete="address-line2"
            />

            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-model="form.city"
                :label="t('shop.checkout.city')"
                :hint="t('shop.checkout.cityHint')"
                :error="errorFor('shipping_address.city')"
                autocomplete="address-level2"
                required
              />

              <div v-if="areaOptions.length > 0" class="space-y-1.5">
                <BaseSelect
                  v-model="form.area"
                  :label="t('shop.checkout.area')"
                  :error="errorFor('area')"
                  :options="areaOptions"
                  :placeholder="t('shop.checkout.areaPlaceholder')"
                  required
                />
                <BaseButton
                  v-if="form.area"
                  variant="link"
                  size="sm"
                  class="px-0"
                  @click="form.area = ''"
                >
                  {{ t('shop.checkout.clearArea') }}
                </BaseButton>
              </div>
              <BaseInput
                v-else
                v-model="form.area"
                :label="t('shop.checkout.area')"
                :hint="t('shop.checkout.areaHint')"
                :error="errorFor('area')"
              />
            </div>

            <div class="flex flex-wrap gap-2" v-if="knownCities.length > 0">
              <span class="py-1 text-caption text-subtle">{{ t('shop.checkout.servedCities') }}</span>
              <button
                v-for="city in knownCities"
                :key="city"
                type="button"
                class="rounded-full border border-line px-2.5 py-1 text-caption text-muted transition hover:border-brand hover:text-ink"
                @click="form.city = titleCase(city)"
              >
                {{ titleCase(city) }}
              </button>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <BaseInput
                v-model="form.state"
                :label="t('shop.checkout.state')"
                :error="errorFor('shipping_address.state')"
                autocomplete="address-level1"
              />
              <BaseInput
                v-model="form.postal_code"
                :label="t('shop.checkout.postalCode')"
                :error="errorFor('shipping_address.postal_code')"
                autocomplete="postal-code"
              />
              <BaseInput
                v-model="form.country"
                :label="t('shop.checkout.country')"
                :hint="t('shop.checkout.countryHint')"
                :error="errorFor('shipping_address.country')"
                autocomplete="country"
                required
              />
            </div>

            <BaseTextarea
              v-model="form.notes"
              :label="t('shop.checkout.notes')"
              :hint="t('shop.checkout.notesHint')"
              :error="errorFor('notes')"
              :rows="3"
            />
          </section>

          <!-- Payment -->
          <section class="surface space-y-4 p-5">
            <div class="flex items-center gap-2">
              <Wallet class="size-5 text-brand-ink" aria-hidden="true" />
              <h2 class="text-h4 font-semibold text-ink">{{ t('shop.checkout.payment') }}</h2>
            </div>

            <div v-if="storefront.paymentMethods.length === 0" class="text-sm text-muted">
              {{ t('shop.checkout.paymentLoading') }}
            </div>

            <div v-else class="space-y-3">
              <label
                v-for="method in storefront.paymentMethods"
                :key="method.code"
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition"
                :class="[
                  method.available
                    ? paymentMethod === method.code
                      ? 'border-brand-700 bg-brand-soft'
                      : 'border-line hover:border-brand'
                    : 'cursor-not-allowed border-line opacity-60',
                ]"
              >
                <input
                  v-model="paymentMethod"
                  type="radio"
                  class="peer sr-only"
                  :value="method.code"
                  :disabled="!method.available"
                />
                <span
                  class="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border"
                  :class="
                    paymentMethod === method.code && method.available
                      ? 'border-brand-700'
                      : 'border-line'
                  "
                  aria-hidden="true"
                >
                  <span
                    v-if="paymentMethod === method.code && method.available"
                    class="size-2 rounded-full bg-brand-700"
                  />
                </span>

                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-ink">{{ method.label }}</span>
                    <span
                      v-if="!method.available"
                      class="rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted"
                    >
                      {{ t('shop.checkout.unavailable') }}
                    </span>
                  </span>
                  <span class="mt-0.5 block text-small text-muted">{{ method.description }}</span>
                  <span
                    v-if="method.unavailable_reason"
                    class="mt-1 block text-caption text-warning-ink"
                  >
                    {{ method.unavailable_reason }}
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        <!-- Summary -->
        <aside class="surface space-y-4 p-5 lg:sticky lg:top-24">
          <h2 class="text-h4 font-semibold text-ink">{{ t('shop.checkout.summary') }}</h2>

          <ul class="space-y-2">
            <li
              v-for="line in cart.lines"
              :key="line.variantId"
              class="flex items-start justify-between gap-3 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium text-ink">{{ line.productName }}</span>
                <span class="block text-caption text-muted">
                  {{ line.variantName }} × {{ line.quantity }}
                </span>
              </span>
              <span class="shrink-0 tabular-nums text-ink">
                {{ money(line.unitPrice * line.quantity) }}
              </span>
            </li>
          </ul>

          <dl class="space-y-2 border-t border-line pt-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">{{ t('shop.checkout.subtotal') }}</dt>
              <dd class="font-medium tabular-nums text-ink">{{ money(cart.subtotal) }}</dd>
            </div>

            <div class="flex items-center justify-between gap-3">
              <dt class="flex items-center gap-1.5 text-muted">
                <Truck class="size-4" aria-hidden="true" />
                {{ t('shop.checkout.delivery') }}
              </dt>
              <dd class="tabular-nums">
                <span v-if="zonesLoading || quote.status === 'needs-city'" class="text-muted">
                  {{ t('shop.checkout.deliveryPending') }}
                </span>
                <span v-else-if="quote.status === 'not-deliverable'" class="text-danger-ink">
                  {{ t('shop.checkout.notDeliverable') }}
                </span>
                <span v-else-if="quote.freeShipping" class="text-success-ink">
                  {{ t('shop.checkout.freeShipping') }}
                </span>
                <span v-else class="text-ink">{{ money(shippingFee ?? 0) }}</span>
              </dd>
            </div>

            <div class="flex items-center justify-between gap-3 border-t border-line pt-2 text-base">
              <dt class="font-semibold text-ink">{{ t('shop.checkout.total') }}</dt>
              <dd class="font-semibold tabular-nums text-ink">{{ money(total) }}</dd>
            </div>
          </dl>

          <p class="text-caption text-subtle">{{ t('shop.checkout.totalNote') }}</p>

          <BaseAlert v-if="zonesError" tone="warning">
            <p>{{ zonesError }}</p>
            <BaseButton variant="link" size="sm" class="mt-1 px-0" @click="loadZones">
              {{ t('shop.common.retry') }}
            </BaseButton>
          </BaseAlert>

          <BaseAlert v-else-if="quote.status === 'not-deliverable'" tone="warning">
            {{ t('shop.checkout.notDeliverableBody') }}
          </BaseAlert>

          <BaseAlert v-else-if="quote.freeShipping && quote.zone" tone="success">
            {{ t('shop.checkout.freeShippingBody', { threshold: money(quote.zone.free_shipping_threshold ?? 0) }) }}
          </BaseAlert>

          <BaseButton
            type="submit"
            size="lg"
            block
            :loading="submitting"
            :disabled="!canSubmit"
          >
            <LoaderCircle v-if="submitting" class="me-2 size-4 animate-spin" aria-hidden="true" />
            <AlertTriangle v-else-if="!canSubmit" class="me-2 size-4" aria-hidden="true" />
            {{ submitting ? t('shop.checkout.placing') : t('shop.checkout.placeOrder') }}
          </BaseButton>

          <p class="text-center text-caption text-subtle">{{ t('shop.checkout.codNote') }}</p>
        </aside>
      </form>
    </template>
  </div>
</template>
