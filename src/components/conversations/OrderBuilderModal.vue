<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import {
  explainBundleRecommendation,
  fetchBundleRecommendations,
} from '@/services/bundleService'
import {
  addCartItem,
  cancelCart,
  confirmCart,
  fetchCart,
  openCart,
  removeCartItem,
  reopenCart,
  requestCartConfirmation,
  updateCart,
  updateCartItem,
} from '@/services/cartService'
import { fetchProducts } from '@/services/productService'
import { CART_STATUS } from '@/constants/statuses'
import type { BundleRecommendation } from '@/types/bundles'
import type { Cart, CartItem } from '@/types/cart'
import type { Product, ProductVariant } from '@/types/catalogue'
import type { Order } from '@/types/commerce'
import type { Conversation } from '@/types/inbox'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { statusTone } from '@/utils/status'

const props = defineProps<{
  open: boolean
  conversation: Conversation | null
}>()

const emit = defineEmits<{
  close: []
  confirmed: [order: Order]
}>()

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const cart = ref<Cart | null>(null)
const confirmedOrder = ref<Order | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const busy = ref<string | null>(null)
const reviewMode = ref(false)
const cancelArmed = ref(false)
const confirmArmed = ref(false)
const confirmationMessage = ref('')
const notifyCustomer = ref(true)

const productQuery = ref('')
const debouncedProductQuery = useDebounce(productQuery, 300)
const products = ref<Product[]>([])
const productsLoading = ref(false)
const productsError = ref<string | null>(null)
const expandedProducts = ref<number[]>([])
const bundleAnchor = ref<Product | null>(null)
const bundleRecommendations = ref<BundleRecommendation[]>([])
const bundleLoading = ref(false)
const bundleError = ref<string | null>(null)
const bundleExplanations = ref<Record<string, string>>({})
const explaining = ref<string | null>(null)
let productRequest = 0
let bundleRequest = 0
let loadRequest = 0

const details = reactive({
  shipping: '0',
  tax: '0',
  notes: '',
  contact: '',
  line1: '',
  city: '',
  postal: '',
  country: '',
})
const savedDetails = reactive({ ...details })

const isPending = computed(() => cart.value?.status === 'pending_confirmation')
const isFinal = computed(
  () => cart.value?.status === 'converted' || cart.value?.status === 'cancelled',
)
const isEditing = computed(() => cart.value?.status === 'draft' && !reviewMode.value)
const canNotify = computed(
  () =>
    cart.value?.conversation?.channel === 'whatsapp' &&
    cart.value.conversation.reply_window.is_open,
)
const canExplain = computed(() => auth.can('ai.use'))
const detailsDirty = computed(() =>
  (Object.keys(details) as Array<keyof typeof details>).some(
    (key) => details[key] !== savedDetails[key],
  ),
)
const orderLink = computed(() => {
  const number = confirmedOrder.value?.order_number ?? cart.value?.order?.order_number
  return number ? `/orders/${number}` : null
})

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.message ? caught.message : fallback
}

function money(value: number): string {
  return formatCurrency(value, cart.value?.currency ?? 'USD')
}

function note(caught: unknown, fallback: string): void {
  toast.error(message(caught, fallback))

  if (
    caught instanceof ApiError &&
    (caught.code === 'cart_version_conflict' || caught.code === 'cart_total_changed')
  ) {
    void refreshCart()
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function syncDetails(next: Cart): void {
  const address = (next.shipping_address ?? {}) as Record<string, unknown>
  const values = {
    shipping: String(next.shipping_total ?? 0),
    tax: String(Math.round((next.tax_rate ?? 0) * 10000) / 100),
    notes: next.notes ?? '',
    contact: text(address.contact_name),
    line1: text(address.line_one),
    city: text(address.city),
    postal: text(address.postal_code),
    country: text(address.country),
  }

  Object.assign(details, values)
  Object.assign(savedDetails, values)
}

function applyCart(next: Cart, forceDetails = false): void {
  const wasDirty = detailsDirty.value
  cart.value = next

  if (forceDetails || !wasDirty) {
    syncDetails(next)
  }

  cancelArmed.value = false
  confirmArmed.value = false

  if (next.status !== 'draft') {
    reviewMode.value = false
  }
}

async function loadProducts(): Promise<void> {
  const current = cart.value

  if (!current || props.open === false || current.status !== 'draft' || reviewMode.value) {
    return
  }

  const request = ++productRequest
  productsLoading.value = true
  productsError.value = null

  try {
    const result = await fetchProducts({
      search: debouncedProductQuery.value || undefined,
      store_id: current.store_id ?? undefined,
      per_page: 30,
      sort: 'name',
      desc: false,
    })

    if (request === productRequest) {
      products.value = result.data
    }
  } catch (caught) {
    if (request === productRequest) {
      productsError.value = message(caught, t('orderBuilder.products.failed'))
    }
  } finally {
    if (request === productRequest) {
      productsLoading.value = false
    }
  }
}

async function load(): Promise<void> {
  const conversation = props.conversation

  if (!conversation) return

  const request = ++loadRequest
  loading.value = true
  loadError.value = null
  cart.value = null
  confirmedOrder.value = null
  reviewMode.value = false
  cancelArmed.value = false
  confirmArmed.value = false
  confirmationMessage.value = ''
  expandedProducts.value = []
  closeBundleRecommendations()

  try {
    let next: Cart

    try {
      next = await fetchCart(conversation.id)
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 404) {
        throw caught
      }

      next = await openCart(conversation.id)
    }

    if (request !== loadRequest) return

    applyCart(next, true)
    notifyCustomer.value = canNotify.value
    await loadProducts()
  } catch (caught) {
    if (request === loadRequest) {
      loadError.value = message(caught, t('orderBuilder.loadFailed'))
    }
  } finally {
    if (request === loadRequest) {
      loading.value = false
    }
  }
}

async function refreshCart(): Promise<void> {
  const conversation = props.conversation

  if (!conversation) return

  try {
    const next = await fetchCart(conversation.id)
    applyCart(next)
    notifyCustomer.value = canNotify.value
  } catch {
    return
  }
}

async function newProposal(): Promise<void> {
  if (!props.conversation) return

  busy.value = 'new'

  try {
    const next = await openCart(props.conversation.id)
    confirmedOrder.value = null
    reviewMode.value = false
    productQuery.value = ''
    closeBundleRecommendations()
    applyCart(next, true)
    notifyCustomer.value = canNotify.value
    await loadProducts()
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function saveDetails(showToast = true): Promise<boolean> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || !current.capabilities.edit) {
    return false
  }

  busy.value = 'details'

  try {
    const next = await updateCart(conversation.id, {
      version: current.version,
      shipping_total: Math.max(0, Number.parseFloat(details.shipping) || 0),
      tax_rate: Math.min(100, Math.max(0, Number.parseFloat(details.tax) || 0)) / 100,
      notes: details.notes.trim() || null,
      shipping_address: {
        contact_name: details.contact.trim() || null,
        line_one: details.line1.trim() || null,
        city: details.city.trim() || null,
        postal_code: details.postal.trim() || null,
        country: details.country.trim().toUpperCase() || null,
      },
    })

    applyCart(next)
    syncDetails(next)

    if (showToast) {
      toast.success(t('orderBuilder.details.saved'))
    }

    return true
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))

    return false
  } finally {
    busy.value = null
  }
}

async function startReview(): Promise<void> {
  if (detailsDirty.value && !(await saveDetails())) {
    return
  }

  reviewMode.value = true
}

function toggleProduct(product: Product): void {
  expandedProducts.value = expandedProducts.value.includes(product.id)
    ? expandedProducts.value.filter((id) => id !== product.id)
    : [...expandedProducts.value, product.id]
}

function variantsFor(product: Product): ProductVariant[] {
  return product.variants ?? []
}

async function addVariant(product: Product, variant: ProductVariant): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = `add:${variant.id}`

  try {
    const next = await addCartItem(conversation.id, {
      version: current.version,
      product_id: product.id,
      product_variant_id: variant.id,
      quantity: 1,
    })

    applyCart(next)
    toast.success(t('orderBuilder.cart.added'))
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

function closeBundleRecommendations(): void {
  bundleRequest++
  bundleAnchor.value = null
  bundleRecommendations.value = []
  bundleError.value = null
  bundleLoading.value = false
  bundleExplanations.value = {}
  explaining.value = null
}

async function loadBundleRecommendations(product: Product): Promise<void> {
  const current = cart.value
  if (!current) return

  const request = ++bundleRequest
  bundleAnchor.value = product
  bundleRecommendations.value = []
  bundleExplanations.value = {}
  bundleError.value = null
  bundleLoading.value = true

  try {
    const payload = await fetchBundleRecommendations(product.id, {
      store_id: current.store_id ?? undefined,
      limit: 4,
    })

    if (request === bundleRequest) {
      bundleRecommendations.value = payload.recommendations
    }
  } catch (caught) {
    if (request === bundleRequest) {
      bundleError.value = message(caught, t('orderBuilder.recommendations.loadFailed'))
    }
  } finally {
    if (request === bundleRequest) {
      bundleLoading.value = false
    }
  }
}

function refreshBundleRecommendations(): void {
  const anchor = bundleAnchor.value
  if (anchor) void loadBundleRecommendations(anchor)
}

function recommendationExplanation(recommendation: BundleRecommendation): string {
  if (recommendation.evidence.basis === 'merchant_curated') {
    return t('orderBuilder.recommendations.curatedExplanation')
  }

  const anchor = bundleAnchor.value
  const partner = anchor
    ? recommendation.items.find((line) => line.product_id !== anchor.id)?.product.name
    : null

  if (!anchor || !partner) return recommendation.explanation

  if (recommendation.evidence.basis === 'purchased_together') {
    return t('orderBuilder.recommendations.measuredExplanation', {
      anchor: anchor.name,
      partner,
      count: recommendation.evidence.order_count ?? 0,
      units: recommendation.evidence.unit_count ?? 0,
      days: recommendation.evidence.window_days ?? 180,
    })
  }

  return t('orderBuilder.recommendations.categoryExplanation', {
    anchor: anchor.name,
    partner,
  })
}

function evidenceLabel(recommendation: BundleRecommendation): string {
  switch (recommendation.evidence.basis) {
    case 'purchased_together':
      return t('orderBuilder.recommendations.evidence.measured')
    case 'merchant_curated':
      return t('orderBuilder.recommendations.evidence.curated')
    default:
      return t('orderBuilder.recommendations.evidence.rule')
  }
}

function evidenceTone(recommendation: BundleRecommendation): 'success' | 'brand' | 'info' {
  switch (recommendation.evidence.basis) {
    case 'purchased_together':
      return 'success'
    case 'merchant_curated':
      return 'brand'
    default:
      return 'info'
  }
}

async function addBundle(recommendation: BundleRecommendation): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value || !recommendation.is_available) return

  busy.value = `bundle:${recommendation.key}`
  let version = current.version
  let next = current

  try {
    // Cart mutations are versioned, so lines are added one at a time and each
    // response supplies the version the next request must present.
    for (const line of recommendation.items) {
      next = await addCartItem(conversation.id, {
        version,
        product_id: line.product_id,
        product_variant_id: line.product_variant_id,
        quantity: line.quantity,
      })
      version = next.version
    }

    applyCart(next)
    toast.success(t('orderBuilder.recommendations.added'))
    closeBundleRecommendations()
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))

    if (
      caught instanceof ApiError &&
      caught.code === 'stale_recommendations' &&
      bundleAnchor.value
    ) {
      void loadBundleRecommendations(bundleAnchor.value)
    }
  } finally {
    busy.value = null
  }
}

async function explainRecommendation(recommendation: BundleRecommendation): Promise<void> {
  const anchor = bundleAnchor.value
  const current = cart.value

  if (!anchor || !current || recommendation.kind !== 'suggested') return

  const partner = recommendation.items.find((line) => line.product_id !== anchor.id)
  if (!partner) return

  explaining.value = recommendation.key

  try {
    const result = await explainBundleRecommendation({
      product_id: anchor.id,
      partner_product_id: partner.product_id,
      store_id: current.store_id ?? undefined,
    })
    bundleExplanations.value = {
      ...bundleExplanations.value,
      [recommendation.key]: result.explanation,
    }
  } catch (caught) {
    toast.error(
      message(caught, t('orderBuilder.recommendations.explainFailed')),
    )
  } finally {
    explaining.value = null
  }
}

async function setQuantity(item: CartItem, quantity: number): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value || quantity < 1) return

  busy.value = `item:${item.id}`

  try {
    const next = await updateCartItem(conversation.id, item.id, {
      version: current.version,
      quantity,
      discount_total: item.discount_total,
    })

    applyCart(next)
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function changeDiscount(item: CartItem, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const value = Number.parseFloat(input.value)
  const discount = Number.isFinite(value) ? Math.max(0, value) : 0

  if (Math.abs(discount - item.discount_total) < 0.001) return

  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = `item:${item.id}`

  try {
    const next = await updateCartItem(conversation.id, item.id, {
      version: current.version,
      quantity: item.quantity,
      discount_total: discount,
    })

    applyCart(next)
  } catch (caught) {
    input.value = String(item.discount_total)
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function removeLine(item: CartItem): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = `item:${item.id}`

  try {
    const next = await removeCartItem(conversation.id, item.id, current.version)
    applyCart(next)
    toast.success(t('orderBuilder.cart.removed'))
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function sendForConfirmation(): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  if (detailsDirty.value && !(await saveDetails(false))) {
    return
  }

  const latest = cart.value

  if (!latest) return

  busy.value = 'request'

  try {
    const next = await requestCartConfirmation(conversation.id, {
      version: latest.version,
      notify: canNotify.value && notifyCustomer.value,
      message: confirmationMessage.value.trim() || null,
    })

    applyCart(next)
    confirmationMessage.value = ''
    toast.success(t('orderBuilder.review.requestedToast'))
  } catch (caught) {
    await refreshCart()
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function confirmOrder(): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = 'confirm'

  try {
    const order = await confirmCart(conversation.id, {
      version: current.version,
      expected_grand_total: current.grand_total,
    })

    confirmedOrder.value = order
    confirmArmed.value = false
    toast.success(t('orderBuilder.confirm.doneToast', { number: order.order_number }))
    emit('confirmed', order)

    try {
      const next = await fetchCart(conversation.id)
      applyCart(next)
    } catch {
      cart.value = {
        ...current,
        status: 'converted',
        version: current.version + 1,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          status_label: order.status_label,
          grand_total: order.grand_total,
          placed_at: order.placed_at ?? null,
        },
      }
    }
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function cancelProposal(): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = 'cancel'

  try {
    const next = await cancelCart(conversation.id, current.version)
    applyCart(next)
    toast.success(t('orderBuilder.cancel.done'))
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

async function reopenProposal(): Promise<void> {
  const current = cart.value
  const conversation = props.conversation

  if (!current || !conversation || busy.value) return

  busy.value = 'reopen'

  try {
    const next = await reopenCart(conversation.id, current.version)
    applyCart(next)
    toast.success(t('orderBuilder.reopen.done'))
    await loadProducts()
  } catch (caught) {
    note(caught, t('orderBuilder.actionFailed'))
  } finally {
    busy.value = null
  }
}

function statusLabel(current: Cart): string {
  return t(CART_STATUS[current.status].key)
}

function variantName(variant: ProductVariant): string {
  return variant.is_default ? t('products.defaultVariant') : variant.name
}

watch(
  () => [props.open, props.conversation?.id] as const,
  ([open]) => {
    if (open) {
      void load()
    }
  },
)

watch(debouncedProductQuery, () => {
  if (props.open && isEditing.value) {
    void loadProducts()
  }
})

watch(reviewMode, (reviewing) => {
  if (!reviewing) {
    void loadProducts()
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    size="full"
    :title="t('orderBuilder.title')"
    :description="conversation ? t('orderBuilder.description') : undefined"
    @close="emit('close')"
  >
    <div v-if="loading" class="space-y-4">
      <BaseSkeleton class="h-10 w-1/3" />
      <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <BaseSkeleton class="h-72" />
        <BaseSkeleton class="h-72" />
      </div>
    </div>

    <BaseAlert v-else-if="loadError" tone="danger" class="my-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ loadError }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div v-else-if="cart" class="flex h-full min-h-0 flex-col gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <BaseBadge dot :tone="statusTone(cart.status)">{{ statusLabel(cart) }}</BaseBadge>
        <span class="text-small text-muted">
          {{ t('orderBuilder.version', { version: cart.version }) }}
        </span>
        <span v-if="cart.customer" class="text-small text-muted">
          · {{ cart.customer.name }}
        </span>
        <span v-if="cart.store" class="text-small text-muted">· {{ cart.store.name }}</span>
      </div>

      <div v-if="isFinal" class="flex flex-1 items-center justify-center">
        <BaseEmptyState
          :icon="isPending ? ShoppingCart : Check"
          :title="
            cart.status === 'converted'
              ? t('orderBuilder.final.convertedTitle')
              : t('orderBuilder.final.cancelledTitle')
          "
          :description="
            cart.status === 'converted'
              ? t('orderBuilder.final.convertedBody')
              : t('orderBuilder.final.cancelledBody')
          "
        >
          <template #action>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <BaseButton v-if="orderLink" :to="orderLink" :icon="ArrowRight">
                {{ t('orderBuilder.viewOrder') }}
              </BaseButton>
              <BaseButton variant="secondary" :icon="Plus" :loading="busy === 'new'" @click="newProposal">
                {{ t('orderBuilder.newProposal') }}
              </BaseButton>
            </div>
          </template>
        </BaseEmptyState>
      </div>

      <div
        v-else
        class="grid min-h-0 flex-1 gap-4"
        :class="isEditing ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : 'lg:grid-cols-1'"
      >
        <section
          v-if="isEditing"
          class="flex min-h-0 flex-col rounded-xl border border-line bg-surface"
          :aria-label="t('orderBuilder.products.title')"
        >
          <div class="shrink-0 space-y-3 border-b border-line p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-h4 font-semibold text-ink">{{ t('orderBuilder.products.title') }}</h3>
              <span class="text-small text-muted">{{ t('orderBuilder.products.hint') }}</span>
            </div>
            <BaseInput
              v-model="productQuery"
              type="search"
              :placeholder="t('orderBuilder.products.search')"
              :aria-label="t('orderBuilder.products.search')"
            >
              <template #prefix><Search class="size-4" /></template>
            </BaseInput>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div
              v-if="bundleAnchor"
              class="mb-2 rounded-lg border border-brand-soft-border bg-brand-soft p-3"
            >
              <div class="flex items-start gap-2">
                <Sparkles class="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-ink">
                    {{ t('orderBuilder.recommendations.title') }}
                  </p>
                  <p class="truncate text-small text-muted">{{ bundleAnchor.name }}</p>
                </div>
                <button
                  type="button"
                  class="btn-icon"
                  :aria-label="t('orderBuilder.recommendations.close')"
                  :title="t('orderBuilder.recommendations.close')"
                  @click="closeBundleRecommendations"
                >
                  <X class="size-4" />
                </button>
              </div>

              <div v-if="bundleLoading" class="mt-3 space-y-2">
                <BaseSkeleton v-for="index in 3" :key="index" class="h-20" />
              </div>

              <BaseAlert v-else-if="bundleError" tone="danger" class="mt-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span>{{ bundleError }}</span>
                  <BaseButton size="sm" variant="secondary" @click="refreshBundleRecommendations">
                    {{ t('orderBuilder.recommendations.refresh') }}
                  </BaseButton>
                </div>
              </BaseAlert>

              <div v-else-if="bundleRecommendations.length === 0" class="mt-3">
                <p class="text-sm font-medium text-ink">
                  {{ t('orderBuilder.recommendations.emptyTitle') }}
                </p>
                <p class="mt-0.5 text-small text-muted">
                  {{ t('orderBuilder.recommendations.emptyBody') }}
                </p>
              </div>

              <ul v-else class="mt-3 space-y-2">
                <li
                  v-for="recommendation in bundleRecommendations"
                  :key="recommendation.key"
                  class="rounded-lg border border-line bg-surface p-3"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <p class="text-sm font-medium text-ink">{{ recommendation.title }}</p>
                    <BaseBadge :tone="evidenceTone(recommendation)" size="sm">
                      {{ evidenceLabel(recommendation) }}
                    </BaseBadge>
                  </div>

                  <p class="mt-1 text-small text-muted">
                    {{ bundleExplanations[recommendation.key] ?? recommendationExplanation(recommendation) }}
                  </p>

                  <p
                    v-if="recommendation.evidence.order_count !== null"
                    class="mt-0.5 text-caption text-subtle"
                  >
                    {{
                      t('orderBuilder.recommendations.orderCount', {
                        count: recommendation.evidence.order_count,
                      })
                    }}
                    <span v-if="recommendation.evidence.unit_count !== null">
                      ·
                      {{
                        t('orderBuilder.recommendations.unitCount', {
                          count: recommendation.evidence.unit_count,
                        })
                      }}
                    </span>
                    <span v-if="recommendation.evidence.window_days !== null">
                      ·
                      {{
                        t('orderBuilder.recommendations.window', {
                          days: recommendation.evidence.window_days,
                        })
                      }}
                    </span>
                  </p>

                  <ul class="mt-2 space-y-1">
                    <li
                      v-for="line in recommendation.items"
                      :key="`${line.product_id}-${line.product_variant_id}`"
                      class="flex items-center justify-between gap-2 text-small"
                    >
                      <span class="truncate text-muted">
                        {{ line.name }} × {{ line.quantity }}
                      </span>
                      <span class="shrink-0 tabular-nums text-ink">
                        {{ formatCurrency(line.line_subtotal, recommendation.currency) }}
                      </span>
                    </li>
                  </ul>

                  <div
                    class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2"
                  >
                    <div class="min-w-0">
                      <span class="text-sm font-semibold tabular-nums text-ink">
                        {{ formatCurrency(recommendation.total, recommendation.currency) }}
                      </span>
                      <span
                        v-if="recommendation.discount > 0"
                        class="ms-1.5 text-caption text-muted"
                      >
                        {{
                          t('orderBuilder.cart.discountShort', {
                            amount: formatCurrency(recommendation.discount, recommendation.currency),
                          })
                        }}
                      </span>
                    </div>

                    <div class="flex items-center gap-1">
                      <BaseButton
                        v-if="canExplain && recommendation.kind === 'suggested'"
                        size="sm"
                        variant="ghost"
                        :loading="explaining === recommendation.key"
                        @click="explainRecommendation(recommendation)"
                      >
                        {{ t('orderBuilder.recommendations.explain') }}
                      </BaseButton>
                      <BaseButton
                        size="sm"
                        :icon="Plus"
                        :disabled="busy !== null || !recommendation.is_available"
                        :loading="busy === `bundle:${recommendation.key}`"
                        @click="addBundle(recommendation)"
                      >
                        {{ t('orderBuilder.recommendations.add') }}
                      </BaseButton>
                    </div>
                  </div>

                  <p
                    v-if="!recommendation.is_available"
                    class="mt-1 text-caption text-danger-ink"
                  >
                    {{ t('orderBuilder.recommendations.unavailable') }}
                  </p>
                </li>
              </ul>
            </div>

            <div v-if="productsLoading" class="space-y-2 p-2">
              <BaseSkeleton v-for="index in 6" :key="index" class="h-14" />
            </div>

            <BaseAlert v-else-if="productsError" tone="danger" class="m-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>{{ productsError }}</span>
                <BaseButton size="sm" variant="secondary" @click="loadProducts">
                  {{ t('action.retry') }}
                </BaseButton>
              </div>
            </BaseAlert>

            <div v-else-if="products.length === 0" class="p-6">
              <BaseEmptyState
                :icon="Package"
                :title="t('orderBuilder.products.emptyTitle')"
                :description="t('orderBuilder.products.emptyBody')"
              />
            </div>

            <ul v-else class="space-y-1">
              <li
                v-for="product in products"
                :key="product.id"
                class="rounded-lg border border-transparent transition hover:border-line"
              >
                <div class="flex items-center gap-3 p-2.5">
                  <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                    <Package class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink">{{ product.name }}</p>
                    <p class="truncate text-small text-muted">
                      {{ product.sku || t('orderBuilder.products.noSku') }} ·
                      {{ money(product.price) }}
                    </p>
                  </div>

                  <button
                    type="button"
                    class="btn-icon"
                    :aria-label="
                      t('orderBuilder.recommendations.forProduct', { name: product.name })
                    "
                    :title="t('orderBuilder.recommendations.title')"
                    :disabled="bundleLoading && bundleAnchor?.id === product.id"
                    @click="loadBundleRecommendations(product)"
                  >
                    <Sparkles class="size-4" />
                  </button>

                  <BaseButton
                    v-if="variantsFor(product).length <= 1"
                    size="sm"
                    variant="secondary"
                    :icon="Plus"
                    :disabled="!variantsFor(product)[0] || busy !== null"
                    :loading="busy === `add:${variantsFor(product)[0]?.id}`"
                    @click="
                      variantsFor(product)[0] &&
                        addVariant(product, variantsFor(product)[0] as ProductVariant)
                    "
                  >
                    {{ t('orderBuilder.products.add') }}
                  </BaseButton>

                  <button
                    v-else
                    type="button"
                    class="btn-icon"
                    :aria-label="t('orderBuilder.products.choose')"
                    :aria-expanded="expandedProducts.includes(product.id)"
                    @click="toggleProduct(product)"
                  >
                    <ChevronUp v-if="expandedProducts.includes(product.id)" class="size-4" />
                    <ChevronDown v-else class="size-4" />
                  </button>
                </div>

                <div
                  v-if="variantsFor(product).length > 1 && expandedProducts.includes(product.id)"
                  class="space-y-1 border-t border-line px-3 py-2"
                >
                  <div
                    v-for="variant in variantsFor(product)"
                    :key="variant.id"
                    class="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
                  >
                    <div class="min-w-0">
                      <p class="truncate text-sm text-ink">{{ variantName(variant) }}</p>
                      <p class="text-small text-muted">
                        {{ variant.sku || t('orderBuilder.products.noSku') }} · {{ money(variant.price) }}
                      </p>
                    </div>
                    <BaseButton
                      size="sm"
                      variant="secondary"
                      :icon="Plus"
                      :disabled="busy !== null"
                      :loading="busy === `add:${variant.id}`"
                      @click="addVariant(product, variant)"
                    >
                      {{ t('orderBuilder.products.add') }}
                    </BaseButton>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section class="min-h-0 overflow-y-auto rounded-xl border border-line bg-surface p-4">
          <BaseAlert v-if="cancelArmed" tone="danger" class="mb-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span>{{ t('orderBuilder.cancel.body') }}</span>
              <div class="flex items-center gap-2">
                <BaseButton size="sm" variant="secondary" @click="cancelArmed = false">
                  {{ t('orderBuilder.cancel.keep') }}
                </BaseButton>
                <BaseButton
                  size="sm"
                  variant="danger"
                  :loading="busy === 'cancel'"
                  @click="cancelProposal"
                >
                  {{ t('orderBuilder.cancel.button') }}
                </BaseButton>
              </div>
            </div>
          </BaseAlert>

          <BaseAlert v-if="confirmArmed" tone="warning" class="mb-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span>{{ t('orderBuilder.confirm.body') }}</span>
              <div class="flex items-center gap-2">
                <BaseButton size="sm" variant="secondary" @click="confirmArmed = false">
                  {{ t('orderBuilder.confirm.notYet') }}
                </BaseButton>
                <BaseButton
                  size="sm"
                  :icon="Check"
                  :loading="busy === 'confirm'"
                  @click="confirmOrder"
                >
                  {{ t('orderBuilder.confirm.button') }}
                </BaseButton>
              </div>
            </div>
          </BaseAlert>

          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-h4 font-semibold text-ink">{{ t('orderBuilder.cart.title') }}</h3>
            <span class="text-small text-muted">
              {{ t('orderBuilder.cart.lineCount', { count: cart.items.length }) }}
            </span>
          </div>

          <BaseEmptyState
            v-if="cart.items.length === 0"
            :icon="ShoppingCart"
            :title="t('orderBuilder.cart.emptyTitle')"
            :description="t('orderBuilder.cart.emptyBody')"
          />

          <ul v-else class="divide-y divide-line rounded-lg border border-line">
            <li v-for="item in cart.items" :key="item.id" class="p-3">
              <div class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-ink">{{ item.name }}</p>
                  <p class="text-small text-muted">
                    {{ item.sku || t('orderBuilder.products.noSku') }} · {{ money(item.unit_price) }}
                    <span v-if="!item.is_available" class="text-danger-ink">
                      · {{ t('orderBuilder.cart.available', { count: item.available }) }}
                    </span>
                  </p>
                </div>

                <div class="text-end">
                  <p class="text-sm font-semibold text-ink">{{ money(item.line_total) }}</p>
                  <p v-if="item.discount_total > 0" class="text-small text-muted">
                    {{ t('orderBuilder.cart.discountShort', { amount: money(item.discount_total) }) }}
                  </p>
                </div>
              </div>

              <div v-if="isEditing" class="mt-2 flex flex-wrap items-end gap-2">
                <div class="flex items-center rounded-lg border border-line">
                  <button
                    type="button"
                    class="btn-icon size-8"
                    :aria-label="t('orderBuilder.cart.decrease')"
                    :disabled="busy !== null || item.quantity <= 1"
                    @click="setQuantity(item, item.quantity - 1)"
                  >
                    <Minus class="size-3.5" />
                  </button>
                  <span class="min-w-8 text-center text-sm tabular-nums text-ink">
                    {{ item.quantity }}
                  </span>
                  <button
                    type="button"
                    class="btn-icon size-8"
                    :aria-label="t('orderBuilder.cart.increase')"
                    :disabled="busy !== null"
                    @click="setQuantity(item, item.quantity + 1)"
                  >
                    <Plus class="size-3.5" />
                  </button>
                </div>

                <label class="flex items-center gap-1.5 text-small text-muted">
                  {{ t('orderBuilder.cart.discount') }}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    :value="item.discount_total"
                    :disabled="busy !== null"
                    class="h-8 w-24 rounded-md border border-line bg-surface px-2 text-sm text-ink tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring disabled:bg-inset"
                    :aria-label="t('orderBuilder.cart.discount')"
                    @change="changeDiscount(item, $event)"
                  />
                </label>

                <BaseButton
                  class="ms-auto"
                  size="sm"
                  variant="ghost"
                  :icon="Trash2"
                  :disabled="busy !== null"
                  :aria-label="t('orderBuilder.cart.removeLine')"
                  @click="removeLine(item)"
                >
                  {{ t('orderBuilder.cart.removeLine') }}
                </BaseButton>
              </div>
            </li>
          </ul>

          <div class="mt-4 rounded-lg bg-surface-2 p-3">
            <dl class="space-y-1.5 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('orderBuilder.totals.subtotal') }}</dt>
                <dd class="tabular-nums text-ink">{{ money(cart.subtotal) }}</dd>
              </div>
              <div v-if="cart.discount_total > 0" class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('orderBuilder.totals.discount') }}</dt>
                <dd class="tabular-nums text-ink">−{{ money(cart.discount_total) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('orderBuilder.totals.tax') }}</dt>
                <dd class="tabular-nums text-ink">{{ money(cart.tax_total) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('orderBuilder.totals.shipping') }}</dt>
                <dd class="tabular-nums text-ink">{{ money(cart.shipping_total) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 border-t border-line pt-1.5">
                <dt class="font-semibold text-ink">{{ t('orderBuilder.totals.grandTotal') }}</dt>
                <dd class="text-base font-semibold tabular-nums text-ink">{{ money(cart.grand_total) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="isEditing" class="mt-4 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-sm font-semibold text-ink">{{ t('orderBuilder.details.title') }}</h4>
              <span v-if="detailsDirty" class="text-small text-warning-ink">
                {{ t('orderBuilder.details.unsaved') }}
              </span>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <BaseInput
                v-model="details.shipping"
                type="number"
                min="0"
                step="0.01"
                :label="t('orderBuilder.details.shipping')"
              >
                <template #prefix><span class="text-small">{{ cart.currency }}</span></template>
              </BaseInput>
              <BaseInput
                v-model="details.tax"
                type="number"
                min="0"
                max="100"
                step="0.01"
                :label="t('orderBuilder.details.tax')"
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <BaseInput v-model="details.contact" :label="t('orderBuilder.details.contact')" />
              <BaseInput v-model="details.line1" :label="t('orderBuilder.details.line1')" />
              <BaseInput v-model="details.city" :label="t('orderBuilder.details.city')" />
              <BaseInput v-model="details.postal" :label="t('orderBuilder.details.postal')" />
              <BaseInput
                v-model="details.country"
                maxlength="2"
                :label="t('orderBuilder.details.country')"
                :hint="t('orderBuilder.details.countryHint')"
              />
            </div>

            <BaseTextarea
              v-model="details.notes"
              :rows="2"
              :label="t('orderBuilder.details.notes')"
              :placeholder="t('orderBuilder.details.notesPlaceholder')"
              :maxlength="2000"
            />

            <BaseButton
              variant="secondary"
              size="sm"
              :loading="busy === 'details'"
              :disabled="!detailsDirty || busy !== null"
              @click="saveDetails()"
            >
              {{ t('orderBuilder.details.save') }}
            </BaseButton>
          </div>

          <div v-else class="mt-4 space-y-3">
            <div class="rounded-lg border border-line p-3 text-sm">
              <h4 class="mb-2 font-semibold text-ink">{{ t('orderBuilder.review.delivery') }}</h4>
              <p class="text-muted">
                {{ details.contact || t('orderBuilder.review.noRecipient') }}
              </p>
              <p v-if="details.line1" class="text-muted">
                {{ details.line1 }}<span v-if="details.city">, {{ details.city }}</span>
                <span v-if="details.postal"> {{ details.postal }}</span>
                <span v-if="details.country"> · {{ details.country }}</span>
              </p>
              <p v-if="details.notes" class="mt-2 whitespace-pre-line text-muted">
                {{ details.notes }}
              </p>
            </div>

            <div class="space-y-3 rounded-lg border border-line p-3">
              <div>
                <h4 class="text-sm font-semibold text-ink">{{ t('orderBuilder.review.title') }}</h4>
                <p class="mt-0.5 text-small text-muted">{{ t('orderBuilder.review.body') }}</p>
              </div>

              <BaseTextarea
                v-if="canNotify"
                v-model="confirmationMessage"
                :rows="2"
                :label="t('orderBuilder.review.message')"
                :placeholder="t('orderBuilder.review.messagePlaceholder')"
                :maxlength="2000"
                :disabled="!notifyCustomer"
              />

              <label
                v-if="canNotify"
                class="flex items-start gap-2 text-sm text-ink"
              >
                <input
                  v-model="notifyCustomer"
                  type="checkbox"
                  class="mt-0.5 size-4 rounded border-line text-brand focus:ring-brand-ring"
                />
                <span>
                  {{ t('orderBuilder.review.notify') }}
                  <span class="block text-small text-muted">{{ t('orderBuilder.review.notifyHint') }}</span>
                </span>
              </label>
              <p v-else class="text-small text-muted">
                {{
                  cart.conversation?.channel === 'whatsapp'
                    ? t('orderBuilder.review.windowClosed')
                    : t('orderBuilder.review.notWhatsapp')
                }}
              </p>

              <div v-if="cart.confirmation_sent_at" class="text-small text-success-ink">
                {{ t('orderBuilder.review.sentAt', { date: formatDateTime(cart.confirmation_sent_at) }) }}
              </div>
              <div v-else-if="isPending" class="text-small text-muted">
                {{ t('orderBuilder.review.notSent') }}
              </div>

              <BaseAlert v-if="cart.confirmation_error" tone="danger">
                {{ cart.confirmation_error }}
              </BaseAlert>

              <BaseButton
                v-if="isPending && cart.capabilities.request_confirmation && !cart.confirmation_message_id"
                variant="secondary"
                size="sm"
                :icon="ArrowRight"
                :loading="busy === 'request'"
                :disabled="busy !== null"
                @click="sendForConfirmation"
              >
                {{ t('orderBuilder.review.request') }}
              </BaseButton>
            </div>
          </div>
        </section>
      </div>
    </div>

    <template v-if="cart && !isFinal" #footer>
      <template v-if="cancelArmed">
        <BaseButton variant="secondary" size="sm" @click="cancelArmed = false">
          {{ t('orderBuilder.cancel.keep') }}
        </BaseButton>
        <BaseButton variant="danger" size="sm" :loading="busy === 'cancel'" @click="cancelProposal">
          {{ t('orderBuilder.cancel.button') }}
        </BaseButton>
      </template>

      <template v-else-if="confirmArmed">
        <BaseButton variant="secondary" size="sm" @click="confirmArmed = false">
          {{ t('orderBuilder.confirm.notYet') }}
        </BaseButton>
        <BaseButton size="sm" :icon="Check" :loading="busy === 'confirm'" @click="confirmOrder">
          {{ t('orderBuilder.confirm.button') }}
        </BaseButton>
      </template>

      <template v-else-if="isEditing">
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="busy !== null"
          @click="cancelArmed = true"
        >
          {{ t('orderBuilder.cancel.action') }}
        </BaseButton>
        <BaseButton
          :icon="ArrowRight"
          size="sm"
          :disabled="cart.items.length === 0 || busy !== null"
          @click="startReview"
        >
          {{ t('orderBuilder.review.action') }}
        </BaseButton>
      </template>

      <template v-else-if="isPending">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="busy !== null"
          @click="reopenProposal"
        >
          {{ t('orderBuilder.reopen.action') }}
        </BaseButton>
        <BaseButton
          :icon="Check"
          size="sm"
          :disabled="!cart.capabilities.confirm || busy !== null"
          @click="confirmArmed = true"
        >
          {{ t('orderBuilder.confirm.action') }}
        </BaseButton>
      </template>

      <template v-else>
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="busy !== null"
          @click="reviewMode = false"
        >
          {{ t('orderBuilder.review.back') }}
        </BaseButton>
        <BaseButton
          :icon="ArrowRight"
          size="sm"
          :loading="busy === 'request'"
          :disabled="cart.items.length === 0 || busy !== null"
          @click="sendForConfirmation"
        >
          {{ t('orderBuilder.review.request') }}
        </BaseButton>
      </template>
    </template>
  </BaseModal>
</template>
