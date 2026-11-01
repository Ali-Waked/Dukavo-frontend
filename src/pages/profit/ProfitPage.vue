<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from '@/components/icons'
import { tDynamic, useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { ORDER_STATUS, PAYMENT_STATUS } from '@/constants/statuses'
import { exportProfitIntelligence, fetchProfitIntelligence } from '@/services/profitService'
import { fetchStores } from '@/services/storeService'
import type { Store } from '@/types/catalogue'
import type {
  ProfitIntelligenceParams,
  ProfitIntelligenceResponse,
  ProfitProduct,
  ProfitStore,
} from '@/types/profit'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format'
import { activeCurrency } from '@/utils/currency'

/**
 * Profit intelligence.
 *
 * Every figure on this page comes from the server aggregate. The page never
 * subtracts, allocates or estimates locally: when a value is null it is because
 * the underlying data cannot support it, and the UI says so instead of showing
 * a comforting zero.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

function isoToday(timezone?: string): string {
  const now = new Date()
  if (!timezone) {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

function daysBefore(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

const tenantTimezone = auth.activeTenant?.timezone
const today = isoToday(tenantTimezone)
const defaultFrom = daysBefore(today, 29)

const storeId = ref('')
const currency = ref((auth.activeTenant?.currency ?? activeCurrency()).toUpperCase())
const from = ref(defaultFrom)
const until = ref(today)
const loading = ref(true)
const exporting = ref(false)
const error = ref<string | null>(null)
const data = ref<ProfitIntelligenceResponse | null>(null)
const stores = ref<Store[]>([])
let loadSequence = 0

const summary = computed(() => data.value?.summary ?? null)
const series = computed(() => data.value?.series ?? [])
const products = computed(() => data.value?.products ?? [])
const storeRows = computed(() => data.value?.stores ?? [])
const statusRows = computed(() => (data.value?.statuses ?? []).filter((row) => row.orders > 0))
const paymentRows = computed(() => (data.value?.payments.statuses ?? []).filter((row) => row.orders > 0))
const limitations = computed(() => data.value?.limitations ?? [])
const methodology = computed(() => data.value?.methodology ?? null)

const canExport = computed(() => auth.can('profit.export'))
const canViewStores = computed(() => auth.can('stores.view'))

const storeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

const currencyOptions = computed(() =>
  (data.value?.currencies ?? [currency.value]).map((code) => ({ value: code, label: code })),
)

const rangeInvalid = computed(() => Boolean(from.value && until.value && from.value > until.value))

const rangeLabel = computed(() => {
  const range = data.value?.range
  if (!range) return ''
  return t('profit.rangeSummary', {
    days: range.days,
    from: formatDate(range.from),
    until: formatDate(range.until),
    timezone: range.timezone,
  })
})

const chartMax = computed(() =>
  Math.max(
    1,
    ...series.value.map((point) => Math.max(point.net_sales, point.gross_profit ?? 0)),
  ),
)

function barHeight(value: number): string {
  return `${Math.max(1, Math.round((Math.max(0, value) / chartMax.value) * 100))}%`
}

function money(value: number | null | undefined, code = currency.value): string {
  if (value === null || value === undefined) return t('profit.notAvailable')
  return formatCurrency(value, code)
}

function margin(value: number | null | undefined): string {
  return value === null || value === undefined ? t('profit.notAvailable') : formatPercent(value)
}

function costCoverage(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : formatPercent(value)
}

function friendlyError(caught: unknown): string {
  if (caught instanceof ApiError && caught.isNetworkError) return t('auth.networkError')
  if (caught instanceof ApiError && caught.message) return caught.message
  return t('error.title')
}

function params(): ProfitIntelligenceParams {
  return {
    store_id: storeId.value ? Number(storeId.value) : undefined,
    currency: currency.value || undefined,
    from: from.value || undefined,
    until: until.value || undefined,
    product_limit: 25,
  }
}

async function load(): Promise<void> {
  const sequence = ++loadSequence

  if (rangeInvalid.value) {
    error.value = t('profit.rangeInvalid')
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const result = await fetchProfitIntelligence(params())
    if (sequence !== loadSequence) return
    data.value = result
  } catch (caught) {
    if (sequence !== loadSequence) return
    error.value = friendlyError(caught)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function loadStores(): Promise<void> {
  if (!canViewStores.value) return
  try {
    stores.value = await fetchStores()
  } catch {
    stores.value = []
  }
}

watch([storeId, currency, from, until], () => void load())

function clearFilters(): void {
  storeId.value = ''
  currency.value = (auth.activeTenant?.currency ?? activeCurrency()).toUpperCase()
  from.value = defaultFrom
  until.value = today
}

async function exportRows(): Promise<void> {
  if (rangeInvalid.value) {
    error.value = t('profit.rangeInvalid')
    return
  }

  exporting.value = true
  try {
    const { blob, filename } = await exportProfitIntelligence(params())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename ?? `profit-${currency.value}-${from.value}-${until.value}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(t('profit.exported'))
  } catch (caught) {
    toast.error(friendlyError(caught))
  } finally {
    exporting.value = false
  }
}

const productColumns = computed<TableColumn[]>(() => [
  { key: 'product', label: t('profit.product') },
  { key: 'units', label: t('profit.units'), align: 'end' },
  { key: 'net', label: t('profit.netSales'), align: 'end' },
  { key: 'cogs', label: t('profit.cogs'), align: 'end' },
  { key: 'profit', label: t('profit.grossProfit'), align: 'end' },
  { key: 'margin', label: t('profit.margin'), align: 'end' },
])

const storeColumns = computed<TableColumn[]>(() => [
  { key: 'store', label: t('common.store') },
  { key: 'orders', label: t('profit.orders'), align: 'end' },
  { key: 'net', label: t('profit.netSales'), align: 'end' },
  { key: 'cogs', label: t('profit.cogs'), align: 'end' },
  { key: 'profit', label: t('profit.grossProfit'), align: 'end' },
  { key: 'margin', label: t('profit.margin'), align: 'end' },
  { key: 'average', label: t('profit.averageOrder'), align: 'end' },
])

const definitionKeys = [
  'revenue_recognition',
  'gross_sales',
  'net_sales',
  'cogs',
  'gross_profit',
  'gross_margin',
  'tax_treatment',
  'shipping_treatment',
  'cost_source',
] as const

const excludedStatuses = computed(() =>
  (methodology.value?.excluded_order_statuses ?? [])
    .map((status) => t(ORDER_STATUS[status].key))
    .join(', '),
)

const excludedPayments = computed(() =>
  (methodology.value?.excluded_payment_statuses ?? [])
    .map((status) => t(PAYMENT_STATUS[status].key))
    .join(', '),
)

function productProfit(row: ProfitProduct): string {
  return row.gross_profit === null ? t('profit.notAvailable') : money(row.gross_profit)
}

function storeProfit(row: ProfitStore): string {
  return row.gross_profit === null ? t('profit.notAvailable') : money(row.gross_profit)
}

const grossProfitHint = computed(() => {
  if (summary.value && !summary.value.cost_complete) {
    return t('profit.costIncompleteHint', {
      units: formatNumber(summary.value.uncosted_units),
      amount: money(summary.value.uncosted_net_sales),
    })
  }
  return t('profit.grossProfitHint')
})

onMounted(() => {
  void load()
  void loadStores()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('profit.title')" :description="t('profit.subtitle')">
      <template #actions>
        <BaseButton v-if="canExport" variant="secondary" :loading="exporting" @click="exportRows">
          <Download class="size-4" />
          {{ t('action.export') }}
        </BaseButton>
        <BaseButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" />
          {{ t('action.refresh') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <div class="surface space-y-4 p-4">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BaseSelect
          v-if="canViewStores"
          v-model="storeId"
          :label="t('common.store')"
          :options="storeOptions"
        />
        <BaseSelect v-model="currency" :label="t('profit.currency')" :options="currencyOptions" />
        <BaseInput v-model="from" type="date" :label="t('inventory.from')" :max="until || today" />
        <BaseInput v-model="until" type="date" :label="t('inventory.until')" :min="from" :max="today" />
        <div class="flex items-end">
          <BaseButton variant="ghost" @click="clearFilters">{{ t('action.clearAll') }}</BaseButton>
        </div>
      </div>

      <p v-if="rangeInvalid" class="text-small text-danger-ink">{{ t('profit.rangeInvalid') }}</p>
      <p v-else-if="rangeLabel" class="text-small text-muted">{{ rangeLabel }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        :label="t('profit.netSales')"
        :value="money(summary?.net_sales)"
        :hint="t('profit.netSalesHint', { orders: formatNumber(summary?.recognized_orders) })"
        :icon="CircleDollarSign"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('profit.grossProfit')"
        :value="summary?.gross_profit === null || summary?.gross_profit === undefined ? t('profit.notAvailable') : money(summary.gross_profit)"
        :hint="grossProfitHint"
        :icon="TrendingUp"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('profit.grossMargin')"
        :value="margin(summary?.gross_margin_percent)"
        :hint="t('profit.grossMarginHint')"
        :icon="Activity"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('profit.cogs')"
        :value="money(summary?.cogs)"
        :hint="t('profit.cogsHint', { coverage: costCoverage(summary?.cost_coverage_percent) })"
        :icon="Wallet"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('profit.markedPaid')"
        :value="money(summary ? data?.payments.marked_paid_value : null)"
        :hint="t('profit.markedPaidHint')"
        :icon="CircleDollarSign"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('profit.netProfit')"
        :value="t('profit.notAvailable')"
        :hint="t('profit.netProfitHint')"
        :icon="TrendingDown"
        :loading="loading && !summary"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-3">
      <div class="surface p-4 xl:col-span-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-ink">{{ t('profit.revenueTrend') }}</h2>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.revenueTrendHint') }}</p>
          </div>
          <div class="flex items-center gap-4 text-caption text-muted">
            <span class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-sm bg-brand-400" aria-hidden="true" />
              {{ t('profit.legendNetSales') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-sm bg-success-500" aria-hidden="true" />
              {{ t('profit.legendGrossProfit') }}
            </span>
          </div>
        </div>

        <div v-if="!series.length" class="py-12 text-center text-sm text-muted">
          {{ t('profit.noSeries') }}
        </div>
        <div v-else class="mt-5">
          <div class="overflow-x-auto pb-1">
            <div
              class="flex h-44 min-w-[640px] items-end gap-1"
              role="img"
              :aria-label="t('profit.chartAria')"
            >
              <div
                v-for="point in series"
                :key="point.date"
                class="group flex h-full min-w-1.5 flex-1 items-end justify-center gap-0.5"
                :title="`${formatDate(point.date)} · ${t('profit.legendNetSales')}: ${money(point.net_sales)} · ${t('profit.legendGrossProfit')}: ${point.gross_profit === null ? t('profit.notAvailable') : money(point.gross_profit)}`"
              >
                <div
                  class="w-1/2 rounded-t bg-brand-400 transition group-hover:bg-brand-600"
                  :style="{ height: barHeight(point.net_sales) }"
                />
                <div
                  v-if="point.gross_profit !== null"
                  class="w-1/3 rounded-t bg-success-500 transition group-hover:bg-success-600"
                  :style="{ height: barHeight(point.gross_profit) }"
                />
              </div>
            </div>
          </div>
          <div class="mt-2 flex justify-between text-caption text-subtle">
            <span>{{ formatDate(series[0]?.date) }}</span>
            <span>{{ formatDate(series[series.length - 1]?.date) }}</span>
          </div>
        </div>
      </div>

      <div class="surface p-4">
        <div>
          <h2 class="text-sm font-semibold text-ink">{{ t('profit.breakdownTitle') }}</h2>
          <p class="mt-0.5 text-caption text-subtle">{{ t('profit.breakdownHint') }}</p>
        </div>

        <dl class="mt-4 space-y-2.5 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.grossSales') }}</dt>
            <dd class="font-medium tabular-nums text-ink">{{ money(summary?.gross_sales) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.discounts') }}</dt>
            <dd class="tabular-nums text-muted">−{{ money(summary?.discounts) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <dt class="font-medium text-ink">{{ t('profit.netSales') }}</dt>
            <dd class="font-semibold tabular-nums text-ink">{{ money(summary?.net_sales) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.cogs') }}</dt>
            <dd class="tabular-nums text-muted">−{{ money(summary?.cogs) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <dt class="font-medium text-ink">{{ t('profit.grossProfit') }}</dt>
            <dd class="font-semibold tabular-nums text-ink">
              {{ summary?.gross_profit === null || summary?.gross_profit === undefined ? t('profit.notAvailable') : money(summary.gross_profit) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.grossMargin') }}</dt>
            <dd class="tabular-nums text-ink">{{ margin(summary?.gross_margin_percent) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.taxCollected') }}</dt>
            <dd class="tabular-nums text-muted">{{ money(summary?.tax_collected) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.shippingRevenue') }}</dt>
            <dd class="tabular-nums text-muted">{{ money(summary?.shipping_revenue) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.averageOrderValue') }}</dt>
            <dd class="tabular-nums text-ink">{{ money(summary?.average_order_value) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.unitsSold') }}</dt>
            <dd class="tabular-nums text-ink">{{ formatNumber(summary?.units_sold) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('profit.costCoverage') }}</dt>
            <dd class="tabular-nums text-ink">{{ costCoverage(summary?.cost_coverage_percent) }}</dd>
          </div>
        </dl>

        <BaseAlert class="mt-4" tone="info">
          {{ t('profit.netProfitUnavailableBody') }}
        </BaseAlert>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <div class="surface overflow-hidden">
        <div class="border-b border-line px-4 py-3">
          <h2 class="text-sm font-semibold text-ink">{{ t('profit.productsTitle') }}</h2>
          <p class="mt-0.5 text-caption text-subtle">{{ t('profit.productsHint') }}</p>
        </div>

        <BaseTable :columns="productColumns" :loading="loading" :rows="products">
          <tr v-for="row in products" :key="`${row.product_id}-${row.name}-${row.sku}`">
            <td class="px-4 py-3">
              <p class="font-medium text-ink">{{ row.name }}</p>
              <p class="mt-0.5 text-caption text-subtle">
                <span v-if="row.sku">{{ row.sku }} · </span>{{ t('profit.ordersCount', { count: formatNumber(row.orders) }) }}
              </p>
            </td>
            <td class="px-4 py-3 text-end tabular-nums text-ink">{{ formatNumber(row.units) }}</td>
            <td class="px-4 py-3 text-end tabular-nums text-ink">{{ money(row.net_sales) }}</td>
            <td class="px-4 py-3 text-end tabular-nums text-muted">{{ money(row.cogs) }}</td>
            <td class="px-4 py-3 text-end">
              <span class="tabular-nums" :class="row.gross_profit === null ? 'text-subtle' : 'text-ink'">
                {{ productProfit(row) }}
              </span>
              <span v-if="!row.cost_complete" class="mt-0.5 block text-caption text-subtle">
                {{ t('profit.costIncompleteShort', { units: formatNumber(row.uncosted_units) }) }}
              </span>
            </td>
            <td class="px-4 py-3 text-end tabular-nums" :class="row.gross_margin_percent === null ? 'text-subtle' : 'text-ink'">
              {{ margin(row.gross_margin_percent) }}
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              :title="t('profit.noProducts')"
              :description="t('profit.noProductsBody')"
              :icon="CircleDollarSign"
            />
          </template>
        </BaseTable>
      </div>

      <div class="surface overflow-hidden">
        <div class="border-b border-line px-4 py-3">
          <h2 class="text-sm font-semibold text-ink">{{ t('profit.storesTitle') }}</h2>
          <p class="mt-0.5 text-caption text-subtle">{{ t('profit.storesHint') }}</p>
        </div>

        <BaseTable :columns="storeColumns" :loading="loading" :rows="storeRows">
          <tr v-for="row in storeRows" :key="row.store_id">
            <td class="px-4 py-3 font-medium text-ink">{{ row.store ?? '—' }}</td>
            <td class="px-4 py-3 text-end tabular-nums text-ink">{{ formatNumber(row.orders) }}</td>
            <td class="px-4 py-3 text-end tabular-nums text-ink">{{ money(row.net_sales) }}</td>
            <td class="px-4 py-3 text-end tabular-nums text-muted">{{ money(row.cogs) }}</td>
            <td class="px-4 py-3 text-end">
              <span class="tabular-nums" :class="row.gross_profit === null ? 'text-subtle' : 'text-ink'">
                {{ storeProfit(row) }}
              </span>
              <span v-if="!row.cost_complete" class="mt-0.5 block text-caption text-subtle">
                {{ t('profit.costIncomplete') }}
              </span>
            </td>
            <td class="px-4 py-3 text-end tabular-nums" :class="row.gross_margin_percent === null ? 'text-subtle' : 'text-ink'">
              {{ margin(row.gross_margin_percent) }}
            </td>
            <td class="px-4 py-3 text-end tabular-nums text-ink">{{ money(row.average_order_value) }}</td>
          </tr>

          <template #empty>
            <BaseEmptyState
              :title="t('profit.noStores')"
              :description="t('profit.noStoresBody')"
              :icon="CircleDollarSign"
            />
          </template>
        </BaseTable>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <div class="surface p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-ink">{{ t('profit.statusTitle') }}</h2>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.statusHint') }}</p>
          </div>
          <BaseBadge tone="neutral">{{ t('profit.ordersCount', { count: formatNumber(summary?.total_orders) }) }}</BaseBadge>
        </div>

        <ul v-if="statusRows.length" class="mt-4 divide-y divide-line">
          <li v-for="row in statusRows" :key="row.status" class="flex items-center justify-between gap-3 py-2.5">
            <div class="flex min-w-0 items-center gap-2">
              <BaseBadge :tone="ORDER_STATUS[row.status].tone" dot>
                {{ t(ORDER_STATUS[row.status].key) }}
              </BaseBadge>
              <span class="truncate text-caption text-subtle">
                {{ t('profit.ordersCount', { count: formatNumber(row.orders) }) }}
              </span>
            </div>
            <div class="text-end">
              <p class="text-sm font-medium tabular-nums text-ink">{{ money(row.order_value) }}</p>
              <p class="text-caption tabular-nums text-subtle">
                {{ row.share_percent === null ? '—' : formatPercent(row.share_percent) }}
              </p>
            </div>
          </li>
        </ul>
        <p v-else class="mt-6 text-center text-sm text-muted">{{ t('profit.noStatuses') }}</p>

        <dl class="mt-4 grid gap-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted">{{ t('profit.cancelledOrders') }}</dt>
            <dd class="mt-0.5 tabular-nums text-ink">
              {{ formatNumber(summary?.cancelled_orders) }} · {{ money(summary?.cancelled_order_value) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('profit.refundedOrders') }}</dt>
            <dd class="mt-0.5 tabular-nums text-ink">
              {{ formatNumber(summary?.refunded_orders) }} · {{ money(summary?.refunded_order_value) }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="surface p-4">
        <div>
          <h2 class="text-sm font-semibold text-ink">{{ t('profit.paymentTitle') }}</h2>
          <p class="mt-0.5 text-caption text-subtle">{{ t('profit.paymentHint') }}</p>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.markedPaidValue') }}</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-ink">
              {{ money(data?.payments.marked_paid_value) }}
            </p>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.markedPaidHint') }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.collectedPayments') }}</p>
            <p class="mt-1 text-lg font-semibold text-subtle">{{ t('profit.notAvailable') }}</p>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.collectedHint') }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.unpaidValue') }}</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-ink">{{ money(data?.payments.unpaid_value) }}</p>
            <p class="mt-0.5 text-caption text-subtle">
              {{ t('profit.ordersCount', { count: formatNumber(data?.payments.unpaid_orders) }) }}
            </p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.partialValue') }}</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-ink">{{ money(data?.payments.partially_paid_value) }}</p>
            <p class="mt-0.5 text-caption text-subtle">
              {{ t('profit.ordersCount', { count: formatNumber(data?.payments.partially_paid_orders) }) }}
            </p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.outstanding') }}</p>
            <p class="mt-1 text-lg font-semibold tabular-nums" :class="data?.payments.outstanding_amount === null ? 'text-subtle' : 'text-ink'">
              {{ money(data?.payments.outstanding_amount) }}
            </p>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.outstandingHint') }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('profit.refundAmount') }}</p>
            <p class="mt-1 text-lg font-semibold text-subtle">{{ t('profit.notAvailable') }}</p>
            <p class="mt-0.5 text-caption text-subtle">
              {{ t('profit.refundRateValue', { rate: margin(data?.refunds.refund_rate_percent) }) }}
            </p>
          </div>
        </div>

        <ul v-if="paymentRows.length" class="mt-4 divide-y divide-line border-t border-line pt-2">
          <li v-for="row in paymentRows" :key="row.payment_status" class="flex items-center justify-between gap-3 py-2">
            <div class="flex items-center gap-2">
              <BaseBadge :tone="PAYMENT_STATUS[row.payment_status].tone" dot>
                {{ t(PAYMENT_STATUS[row.payment_status].key) }}
              </BaseBadge>
              <span class="text-caption text-subtle">
                {{ t('profit.ordersCount', { count: formatNumber(row.orders) }) }}
              </span>
            </div>
            <span class="text-sm tabular-nums text-ink">{{ money(row.order_value) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <div class="surface p-4">
        <div class="flex items-start gap-2">
          <AlertTriangle class="mt-0.5 size-4 text-warning-ink" />
          <div>
            <h2 class="text-sm font-semibold text-ink">{{ t('profit.limitationsTitle') }}</h2>
            <p class="mt-0.5 text-caption text-subtle">{{ t('profit.limitationsHint') }}</p>
          </div>
        </div>

        <div v-if="limitations.length" class="mt-4 space-y-2">
          <BaseAlert v-for="limitation in limitations" :key="limitation.code" tone="warning">
            <p class="font-medium">{{ tDynamic('profit.limitation', limitation.code) }}</p>
            <p class="mt-1 text-caption">
              {{ t('profit.affects', { fields: limitation.affects.join(', ') }) }}
            </p>
          </BaseAlert>
        </div>
        <p v-else class="mt-6 text-center text-sm text-muted">{{ t('profit.noLimitations') }}</p>
      </div>

      <div class="surface p-4">
        <div>
          <h2 class="text-sm font-semibold text-ink">{{ t('profit.definitionTitle') }}</h2>
          <p class="mt-0.5 text-caption text-subtle">{{ t('profit.definitionHint') }}</p>
        </div>

        <div v-if="methodology" class="mt-4">
          <dl class="space-y-3">
            <div v-for="key in definitionKeys" :key="key">
              <dt class="text-sm font-medium text-ink">{{ tDynamic('profit.definition', key) }}</dt>
              <dd class="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted">
                <code class="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-subtle">
                  {{ methodology[key] }}
                </code>
              </dd>
            </div>
          </dl>

          <div class="mt-4 space-y-1 border-t border-line pt-3 text-caption text-subtle">
            <p>{{ t('profit.excludedOrders', { statuses: excludedStatuses }) }}</p>
            <p>{{ t('profit.excludedPayments', { statuses: excludedPayments }) }}</p>
            <p>{{ t('profit.currencyNote', { currency: methodology.currency }) }}</p>
            <p>{{ t('profit.timezoneNote', { timezone: methodology.timezone }) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
