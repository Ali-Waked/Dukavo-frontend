<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  deleteOrder,
  fetchOrder,
  fetchTransitions,
  transitionOrder,
  type OrderTransitions,
} from '@/services/orderService'
import type { Order } from '@/types/commerce'
import type { OrderStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'

/**
 * One order: what was bought, what it cost, where it is going, and how it got
 * here.
 *
 * The 404 is a state of its own rather than an error — a deleted order gets a
 * plain explanation and a way back, while a transport failure keeps the page
 * and offers a retry. Status changes are a workflow, not an edit: the allowed
 * transitions are fetched from the server when the dialog opens, because the
 * server — not the client — decides where an order may go next, and a refusal
 * (409) is shown with the server's own sentence.
 */

const route = useRoute()
const router = useRouter()
const { t, tDynamic } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const canUpdate = computed(() => auth.can('orders.update'))
const canDelete = computed(() => auth.can('orders.delete'))
const canViewCustomers = computed(() => auth.can('customers.view'))

const orderNumber = computed(() =>
  typeof route.params.orderNumber === 'string' ? route.params.orderNumber : '',
)

const items = computed(() => order.value?.items ?? [])
const history = computed(() => order.value?.status_history ?? [])

/* ------------------------------------------------------------- transition */

const transitionOpen = ref(false)
const transitions = ref<OrderTransitions | null>(null)
const transitionStatus = ref('')
const transitionNote = ref('')
const transitionError = ref<string | null>(null)
const loadingTransitions = ref(false)
const transitioning = ref(false)

const allowedStatuses = computed(() => transitions.value?.allowed ?? [])

const canTransition = computed(
  () =>
    transitionOpen.value &&
    !loadingTransitions.value &&
    transitionStatus.value !== '' &&
    transitions.value !== null,
)

/* ----------------------------------------------------------------- delete */

const confirmingDelete = ref(false)
const deleting = ref(false)

/* -------------------------------------------------------------- addresses */

interface AddressLine {
  key: string
  label: string
  value: string
}

/**
 * Backend address keys (`postal_code`, `line1`) are server strings with no
 * message of their own, so they are humanised here rather than added to the
 * catalogues — an address shape the UI has never seen still reads correctly.
 */
function formatKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .trim()
  return words.charAt(0).toLocaleUpperCase() + words.slice(1)
}

const shippingLines = computed<AddressLine[]>(() => {
  const address = order.value?.shipping_address
  if (!address || typeof address !== 'object') return []

  return Object.entries(address)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => ({ key, label: formatKey(key), value: String(value) }))
})

/* ------------------------------------------------------------------ loads */

function messageOf(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.isNetworkError ? t('auth.networkError') : caught.message || t('error.title')
  }
  return t('error.title')
}

async function load(): Promise<void> {
  const number = orderNumber.value
  if (number === '') {
    order.value = null
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  notFound.value = false

  try {
    order.value = await fetchOrder(number)
  } catch (caught) {
    order.value = null
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      error.value = messageOf(caught)
    }
  } finally {
    loading.value = false
  }
}

function statusText(value: string | null | undefined): string {
  return value ? tDynamic('status.order', value) : '—'
}

/* ------------------------------------------------------------- transition */

async function openTransition(): Promise<void> {
  const current = order.value
  if (!current) return

  transitionOpen.value = true
  transitions.value = null
  transitionStatus.value = ''
  transitionNote.value = ''
  transitionError.value = null
  loadingTransitions.value = true

  try {
    transitions.value = await fetchTransitions(current.id)
  } catch (caught) {
    transitionError.value = messageOf(caught)
  } finally {
    loadingTransitions.value = false
  }
}

function closeTransition(): void {
  transitionOpen.value = false
}

async function submitTransition(): Promise<void> {
  const current = order.value
  const next = transitionStatus.value as OrderStatus
  if (!current || !next) return

  transitioning.value = true
  try {
    await transitionOrder(current.id, {
      status: next,
      note: transitionNote.value.trim() || null,
    })

    const label =
      allowedStatuses.value.find((option) => option.status === next)?.label ??
      tDynamic('status.order', next)

    toast.success(t('orders.transitioned', { status: label }))
    closeTransition()
    await load()
  } catch (caught) {
    // A 409 refusal carries the server's own explanation of why the move is
    // not allowed; replacing it with a generic failure would lose the answer.
    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    transitioning.value = false
  }
}

/* ----------------------------------------------------------------- delete */

async function confirmDelete(): Promise<void> {
  const current = order.value
  if (!current) return

  deleting.value = true
  try {
    await deleteOrder(current.id)
    toast.success(t('orders.deleted'))
    confirmingDelete.value = false
    await router.push({ name: 'orders.index' })
  } catch (caught) {
    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    deleting.value = false
  }
}

watch(orderNumber, () => {
  order.value = null
  void load()
})

onMounted(() => void load())
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="space-y-5">
      <BaseSkeleton height="h-8" block />
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <BaseSkeleton class="xl:col-span-2" :rows="6" height="h-5" />
        <BaseSkeleton :rows="5" height="h-5" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="notFound"
      :title="t('orders.notFound')"
      :description="t('orders.notFoundBody')"
    >
      <template #action>
        <BaseButton to="/orders">{{ t('orders.backToList') }}</BaseButton>
      </template>
    </BaseEmptyState>

    <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <template v-else-if="order">
      <PageHeader :title="order.order_number">
        <template #actions>
          <BaseBadge :tone="statusTone(order.status)" dot>
            {{ order.status_label }}
          </BaseBadge>

          <BaseBadge :tone="statusTone(order.payment_status)" dot>
            {{ order.payment_status_label }}
          </BaseBadge>

          <BaseButton variant="secondary" to="/orders">
            {{ t('orders.backToList') }}
          </BaseButton>

          <BaseButton v-if="canUpdate" variant="secondary" :icon="ArrowLeftRight" @click="openTransition">
            {{ t('orders.transitionTitle') }}
          </BaseButton>

          <BaseButton v-if="canDelete" variant="danger" :icon="Trash2" @click="confirmingDelete = true">
            {{ t('action.delete') }}
          </BaseButton>
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div class="space-y-5 xl:col-span-2">
          <!-- Line items and totals -->
          <section class="surface p-5" :aria-label="t('orders.items')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('orders.items') }}</h2>

            <div class="mt-4 overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      class="border-b border-line px-4 py-2.5 text-start text-caption font-semibold uppercase tracking-wide text-muted"
                    >
                      {{ t('common.product') }}
                    </th>
                    <th
                      scope="col"
                      class="border-b border-line px-4 py-2.5 text-end text-caption font-semibold uppercase tracking-wide text-muted"
                    >
                      {{ t('common.quantity') }}
                    </th>
                    <th
                      scope="col"
                      class="border-b border-line px-4 py-2.5 text-end text-caption font-semibold uppercase tracking-wide text-muted"
                    >
                      {{ t('common.price') }}
                    </th>
                    <th
                      scope="col"
                      class="border-b border-line px-4 py-2.5 text-end text-caption font-semibold uppercase tracking-wide text-muted"
                    >
                      {{ t('common.total') }}
                    </th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-line">
                  <tr v-for="item in items" :key="item.id">
                    <td class="px-4 py-3">
                      <span class="font-medium text-ink">{{ item.name }}</span>
                      <span v-if="item.sku" class="mt-0.5 block text-caption text-subtle">
                        {{ item.sku }}
                      </span>
                    </td>

                    <td class="px-4 py-3 text-end tabular-nums text-muted">
                      {{ formatNumber(item.quantity) }}
                    </td>

                    <td class="px-4 py-3 text-end tabular-nums text-muted">
                      {{ formatCurrency(item.unit_price, order.currency) }}
                    </td>

                    <td class="px-4 py-3 text-end font-medium tabular-nums text-ink">
                      {{ formatCurrency(item.line_total, order.currency) }}
                    </td>
                  </tr>

                  <tr v-if="items.length === 0">
                    <td colspan="4" class="px-4 py-6 text-center text-sm text-muted">
                      {{ t('state.empty') }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <dl class="mt-5 ms-auto w-full max-w-sm space-y-2">
              <div class="flex items-center justify-between gap-4 text-sm">
                <dt class="text-muted">{{ t('orders.subtotal') }}</dt>
                <dd class="tabular-nums text-ink">{{ formatCurrency(order.subtotal, order.currency) }}</dd>
              </div>

              <div class="flex items-center justify-between gap-4 text-sm">
                <dt class="text-muted">{{ t('orders.discount') }}</dt>
                <dd class="tabular-nums text-ink">{{ formatCurrency(order.discount_total, order.currency) }}</dd>
              </div>

              <div class="flex items-center justify-between gap-4 text-sm">
                <dt class="text-muted">{{ t('orders.tax') }}</dt>
                <dd class="tabular-nums text-ink">{{ formatCurrency(order.tax_total, order.currency) }}</dd>
              </div>

              <div class="flex items-center justify-between gap-4 text-sm">
                <dt class="text-muted">{{ t('orders.shipping') }}</dt>
                <dd class="tabular-nums text-ink">{{ formatCurrency(order.shipping_total, order.currency) }}</dd>
              </div>

              <div class="flex items-center justify-between gap-4 border-t border-line pt-2.5">
                <dt class="text-sm font-semibold text-ink">{{ t('orders.grandTotal') }}</dt>
                <dd class="text-h4 font-semibold tabular-nums text-ink">
                  {{ formatCurrency(order.grand_total, order.currency) }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Status history -->
          <section class="surface p-5" :aria-label="t('orders.timeline')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('orders.timeline') }}</h2>

            <ol v-if="history.length > 0" class="mt-4 space-y-4">
              <li
                v-for="(entry, index) in history"
                :key="entry.id ?? index"
                class="border-s-2 border-line ps-4"
              >
                <p class="text-sm font-medium text-ink">
                  {{ t('orders.transitionFrom', { from: statusText(entry.from_status), to: statusText(entry.to_status) }) }}
                </p>

                <p v-if="entry.note" class="mt-1 whitespace-pre-wrap text-sm text-muted">
                  {{ entry.note }}
                </p>

                <p class="mt-1 text-caption text-subtle">
                  {{ formatDateTime(entry.created_at) }}
                  <template v-if="entry.actor"> · {{ entry.actor }}</template>
                </p>
              </li>
            </ol>

            <p v-else class="mt-4 text-sm text-muted">{{ t('orders.timelineEmpty') }}</p>
          </section>
        </div>

        <div class="space-y-5">
          <!-- Summary -->
          <section class="surface p-5" :aria-label="t('orders.summary')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('orders.summary') }}</h2>

            <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.status') }}
                </dt>
                <dd class="mt-1">
                  <BaseBadge :tone="statusTone(order.status)" dot>{{ order.status_label }}</BaseBadge>
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('orders.paymentStatus') }}
                </dt>
                <dd class="mt-1">
                  <BaseBadge :tone="statusTone(order.payment_status)" dot>
                    {{ order.payment_status_label }}
                  </BaseBadge>
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('orders.placedAt') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">
                  {{ formatDateTime(order.placed_at ?? order.created_at) }}
                </dd>
              </div>

              <div v-if="order.store">
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.store') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ order.store.name }}</dd>
              </div>

              <div v-if="order.notes" class="sm:col-span-2">
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.notes') }}
                </dt>
                <dd class="mt-1 whitespace-pre-wrap text-sm text-muted">{{ order.notes }}</dd>
              </div>
            </dl>
          </section>

          <!-- Customer -->
          <section class="surface p-5" :aria-label="t('orders.customerDetails')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('orders.customerDetails') }}</h2>

            <dl class="mt-4 space-y-4">
              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.name') }}
                </dt>
                <dd class="mt-1 break-words text-sm text-ink">
                  {{ order.customer_name ?? order.customer?.name ?? '—' }}
                </dd>
              </div>

              <div v-if="order.customer_phone ?? order.customer?.phone">
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.phone') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">
                  {{ order.customer_phone ?? order.customer?.phone }}
                </dd>
              </div>

              <div v-if="order.customer?.email">
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.email') }}
                </dt>
                <dd class="mt-1 break-words text-sm text-ink">{{ order.customer.email }}</dd>
              </div>
            </dl>

            <RouterLink
              v-if="order.customer_id && canViewCustomers"
              :to="{ name: 'customers.show', params: { id: String(order.customer_id) } }"
              class="mt-4 inline-block rounded-md text-sm font-medium text-brand-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {{ t('action.viewDetails') }}
            </RouterLink>
          </section>

          <!-- Shipping address -->
          <section
            v-if="shippingLines.length > 0"
            class="surface p-5"
            :aria-label="t('orders.shippingAddress')"
          >
            <h2 class="text-h4 font-semibold text-ink">{{ t('orders.shippingAddress') }}</h2>

            <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div v-for="line in shippingLines" :key="line.key">
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ line.label }}
                </dt>
                <dd class="mt-1 break-words text-sm text-ink">{{ line.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </template>

    <!-- Change status -->
    <BaseModal
      :open="transitionOpen"
      :title="t('orders.transitionTitle')"
      @close="closeTransition"
    >
      <div class="space-y-4">
        <BaseAlert v-if="transitionError" tone="danger" dismissible @dismiss="transitionError = null">
          {{ transitionError }}
        </BaseAlert>

        <div v-if="loadingTransitions" class="space-y-3">
          <BaseSkeleton :rows="3" height="h-5" />
        </div>

        <fieldset v-else-if="allowedStatuses.length > 0" class="space-y-2">
          <legend class="mb-2 text-sm font-medium text-ink">{{ t('common.status') }}</legend>

          <label
            v-for="option in allowedStatuses"
            :key="option.status"
            class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 transition hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
          >
            <input
              type="radio"
              name="order-status"
              :value="option.status"
              :checked="transitionStatus === option.status"
              class="size-4 accent-brand"
              @change="transitionStatus = option.status"
            />
            <span class="text-sm text-ink">{{ option.label }}</span>
          </label>
        </fieldset>

        <BaseTextarea
          v-model="transitionNote"
          :label="t('orders.transitionNote')"
          :rows="3"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="transitioning" @click="closeTransition">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="transitioning" :disabled="!canTransition" @click="submitTransition">
          {{ t('action.confirm') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="confirmingDelete"
      :title="t('orders.deleteTitle')"
      size="sm"
      @close="confirmingDelete = false"
    >
      <p class="text-sm text-muted">
        {{ t('orders.deleteBody', { number: order?.order_number ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="confirmingDelete = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
