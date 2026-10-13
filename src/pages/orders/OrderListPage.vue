<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Eye, ListFilter, MoreHorizontal, ShoppingCart } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useDebounce } from '@/composables/useDebounce'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { fetchOrders } from '@/services/orderService'
import type { Order } from '@/types/commerce'
import type { Paginated } from '@/types/api'
import type { OrderStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'

/**
 * Order list.
 *
 * Read-only by design: an order is born from a cart, never from an empty form,
 * so there is no create button and nothing on this screen mutates a record —
 * the row menu hands the user to the detail page, where the workflow lives.
 *
 * The date range is sent only when both ends are filled. The endpoint treats
 * `from` and `until` as a pair, and a half range would quietly widen the window
 * instead of narrowing it. The table never blanks out while loading: it shows
 * skeleton rows at the real column widths, and a search with no hits says so in
 * words that offer a way out.
 */

const { t } = useI18n()

const PER_PAGE = 15

const query = ref('')
const status = ref('')
const dateFrom = ref('')
const dateUntil = ref('')
const page = ref(1)

const debouncedQuery = useDebounce(query, 300)

const rows = ref<Order[]>([])
const meta = ref<Paginated<Order>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const hasFilters = computed(
  () =>
    query.value !== '' ||
    status.value !== '' ||
    dateFrom.value !== '' ||
    dateUntil.value !== '',
)

/** Single source of truth — the row loop and the empty state read the same list. */
const isEmpty = computed(() => rows.value.length === 0)

const statusOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'pending', label: t('status.order.pending') },
  { value: 'confirmed', label: t('status.order.confirmed') },
  { value: 'processing', label: t('status.order.processing') },
  { value: 'shipped', label: t('status.order.shipped') },
  { value: 'delivered', label: t('status.order.delivered') },
  { value: 'cancelled', label: t('status.order.cancelled') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'order', label: t('orders.number') },
  { key: 'date', label: t('common.date') },
  { key: 'items', label: t('orders.items'), align: 'end' },
  { key: 'total', label: t('common.total'), align: 'end' },
  { key: 'payment', label: t('orders.paymentStatus'), width: '9rem' },
  { key: 'fulfilment', label: t('orders.fulfilment'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const dateRange = computed<{ from?: string; until?: string }>(() =>
  dateFrom.value && dateUntil.value
    ? { from: dateFrom.value, until: dateUntil.value }
    : {},
)

/**
 * Monotonic request id: when filters/page changes while a previous request is
 * still in flight, the older response must not come back and repaint the table
 * over the newer one — that is how stale rows end up displayed next to a
 * message that belongs to the current (empty) result.
 */
let requestId = 0

async function load(): Promise<void> {
  const id = ++requestId
  loading.value = true
  error.value = null
  try {
    const result = await fetchOrders({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value ? (status.value as OrderStatus) : undefined,
      ...dateRange.value,
    })
    if (id !== requestId) return
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    if (id !== requestId) return
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('error.title')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch([status, dateFrom, dateUntil], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  status.value = ''
  dateFrom.value = ''
  dateUntil.value = ''
  page.value = 1
  void load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('orders.title')" :description="t('orders.subtitle')" />

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Filters -->
    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseInput
        v-model="query"
        class="min-w-56 flex-1"
        type="search"
        :label="t('filter.search')"
        :placeholder="t('filter.searchPlaceholder')"
      />

      <BaseSelect
        v-model="status"
        class="w-44"
        :label="t('orders.filterStatus')"
        :options="statusOptions"
      />

      <BaseInput
        v-model="dateFrom"
        class="w-44"
        type="date"
        :label="t('orders.filterFrom')"
      />

      <BaseInput
        v-model="dateUntil"
        class="w-44"
        type="date"
        :label="t('orders.filterUntil')"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="order in rows" :key="order.id">
          <td class="px-4 py-3">
            <RouterLink
              :to="{ name: 'orders.show', params: { orderNumber: order.order_number } }"
              dir="ltr"
              class="block max-w-max whitespace-nowrap rounded-md font-medium text-ink [unicode-bidi:isolate] hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {{ order.order_number }}
            </RouterLink>
            <span class="mt-0.5 block max-w-max truncate text-caption text-subtle">
              {{ order.customer_name || '—' }}
            </span>
          </td>

          <td class="whitespace-nowrap px-4 py-3 text-muted">
            {{ formatDateTime(order.placed_at ?? order.created_at) }}
          </td>

          <td class="px-4 py-3 text-end tabular-nums" :class="order.item_count ? 'text-ink' : 'text-subtle'">
            {{ typeof order.item_count === 'number' ? formatNumber(order.item_count) : '—' }}
          </td>

          <td class="px-4 py-3 text-end font-medium tabular-nums text-ink">
            <span dir="ltr" class="whitespace-nowrap [unicode-bidi:isolate]">
              {{ formatCurrency(order.grand_total, order.currency) }}
            </span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(order.payment_status)" dot>
              {{ order.payment_status_label }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(order.status)" dot>
              {{ order.status_label }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3">
            <div class="flex justify-end">
              <BaseDropdown align="end">
                <template #trigger>
                  <span
                    class="btn-icon"
                    role="button"
                    :aria-label="t('action.moreActions')"
                    :title="t('action.moreActions')"
                  >
                    <MoreHorizontal class="size-5" />
                  </span>
                </template>

                <template #default="{ close }">
                  <RouterLink
                    :to="{ name: 'orders.show', params: { orderNumber: order.order_number } }"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close()"
                  >
                    <Eye class="size-4 text-muted" />
                    {{ t('action.view') }}
                  </RouterLink>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="isEmpty && hasFilters"
            :title="t('orders.emptyFilterTitle')"
            :description="t('orders.emptyFilterBody')"
            :icon="ListFilter"
          >
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="isEmpty"
            :title="t('orders.emptyTitle')"
            :description="t('orders.emptyBody')"
            :icon="ShoppingCart"
          />
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>
  </div>
</template>
