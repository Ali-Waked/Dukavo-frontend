<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, ShoppingCart, TrendingUp, Wallet } from '@/components/icons'
import { hasMessage, tDynamic, useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import RevenueChart from '@/components/charts/RevenueChart.vue'
import BarMeters, { type MeterItem } from '@/components/charts/BarMeters.vue'
import { fetchAnalytics } from '@/services/analyticsService'
import { fetchStores } from '@/services/storeService'
import type { AnalyticsKpi, AnalyticsOverview } from '@/types/analytics'
import type { Store } from '@/types/catalogue'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format'

/**
 * Executive analytics.
 *
 * Every figure comes from the server aggregate. The page only formats values;
 * it never calculates, extrapolates or fills gaps with demo data. When a
 * metric cannot be supported by stored records the card explains why.
 */
const { t } = useI18n()
const { store: auth } = useAuth()
const router = useRouter()

const loading = ref(true)
const scopeLoading = ref(false)
const error = ref<string | null>(null)

const overview = ref<AnalyticsOverview | null>(null)
const stores = ref<Store[]>([])
const storeScope = ref('')
const fromDate = ref('')
const untilDate = ref('')

const currency = computed(
  () => overview.value?.currency ?? auth.activeTenant?.currency ?? 'USD',
)

const rangeSummary = computed(() => {
  const range = overview.value?.range
  if (!range) return ''

  return t('analytics.rangeSummary', {
    from: range.from,
    until: range.until,
    timezone: range.timezone,
  })
})

const storeOptions = computed(() => [
  { value: '', label: t('dashboard.storeScope') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

const salesTrendItems = computed(() =>
  (overview.value?.sales_trends ?? []).map((point) => ({
    date: point.date,
    total: point.revenue,
    orders: point.orders,
  })),
)

const productItems = computed<MeterItem[]>(() => {
  const products = overview.value?.product_performance ?? []
  const leader = Math.max(1, ...products.map((product) => product.units_sold || 1))

  return products.slice(0, 10).map((product) => ({
    id: String(product.product_id ?? product.sku ?? product.name),
    label: product.name,
    meta: product.sku ?? undefined,
    value: formatCurrency(product.revenue, currency.value, { compact: true }),
    ratio: (product.units_sold || 1) / leader,
  }))
})

const orderStatusItems = computed(() => overview.value?.order_status_distribution ?? [])
const repeatRate = computed(() => overview.value?.customer_repeat_purchase_rate)
const recoveryFunnel = computed(() => overview.value?.sales_recovery_funnel)
const deliveryMetrics = computed(() => overview.value?.message_delivery_metrics)
const conversationMetrics = computed(() => overview.value?.conversation_response_metrics)
const financialMargin = computed(() => overview.value?.financial_margin)
const payments = computed(() => overview.value?.payment_summary)
const refunds = computed(() => overview.value?.refunds)
const stockHealth = computed(() => overview.value?.stock_health)
const storePerformance = computed(() => overview.value?.store_performance ?? [])
const limitations = computed(() => overview.value?.limitations ?? [])

function kpiLabel(kpi: AnalyticsKpi): string {
  const key = `analytics.kpi.${kpi.key}`
  return hasMessage(key) ? tDynamic('analytics.kpi', kpi.key) : kpi.label
}

function kpiHint(kpi: AnalyticsKpi): string {
  const key = `analytics.kpiHint.${kpi.key}`
  return hasMessage(key) ? tDynamic('analytics.kpiHint', kpi.key) : kpi.definition
}

function kpiValue(kpi: AnalyticsKpi): string {
  return kpi.unit === 'currency'
    ? formatCurrency(kpi.value, currency.value)
    : formatNumber(kpi.value)
}

function kpiIcon(kpi: AnalyticsKpi) {
  if (kpi.key === 'revenue') return Wallet
  if (kpi.key.includes('orders')) return ShoppingCart
  return TrendingUp
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    if (stores.value.length === 0 && auth.can('stores.view')) {
      stores.value = await fetchStores({ activeOnly: false })
    }

    overview.value = await fetchAnalytics({
      ...(storeScope.value ? { store_id: Number(storeScope.value) } : {}),
      ...(fromDate.value ? { from: fromDate.value } : {}),
      ...(untilDate.value ? { until: untilDate.value } : {}),
    })
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : (caught instanceof ApiError && caught.message) || t('error.title')
  } finally {
    loading.value = false
  }
}

async function onFilterChange(): Promise<void> {
  scopeLoading.value = true
  try {
    await load()
  } finally {
    scopeLoading.value = false
  }
}

function openInventory(): void {
  void router.push({ name: 'inventory.index' })
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('analytics.title')" :description="t('analytics.subtitle')">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="fromDate"
            type="date"
            class="surface rounded px-2 py-1 text-sm"
            :aria-label="t('analytics.from')"
          />
          <input
            v-model="untilDate"
            type="date"
            class="surface rounded px-2 py-1 text-sm"
            :aria-label="t('analytics.until')"
          />
          <BaseSelect
            v-if="stores.length > 0"
            v-model="storeScope"
            class="w-44"
            :aria-label="t('analytics.storeFilter')"
            :options="storeOptions"
            :disabled="scopeLoading"
            @update:model-value="onFilterChange"
          />
          <BaseButton size="sm" :loading="scopeLoading" @click="onFilterChange">
            {{ t('action.apply') }}
          </BaseButton>
        </div>
      </template>
    </PageHeader>

    <p v-if="rangeSummary" class="text-small text-muted">{{ rangeSummary }}</p>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        v-for="kpi in overview?.kpis ?? []"
        :key="kpi.key"
        :label="kpiLabel(kpi)"
        :value="kpiValue(kpi)"
        :icon="kpiIcon(kpi)"
        :delta="kpi.change_percent"
        :delta-label="t('analytics.vsPrevious')"
        :hint="kpiHint(kpi)"
        :loading="loading"
      />
    </div>

    <p class="text-xs text-muted">{{ t('analytics.revenueNote') }}</p>

    <div class="surface p-4">
      <div class="mb-2">
        <h2 class="text-h5">{{ t('analytics.salesTrendTitle') }}</h2>
        <p class="text-small text-muted">{{ t('analytics.salesTrendHint') }}</p>
      </div>
      <RevenueChart
        :points="salesTrendItems"
        :currency="currency"
        :loading="loading"
        :dashboard-no-revenue="t('analytics.noRevenue')"
        :aria-label="t('analytics.salesTrendTitle')"
        :orders-word="t('analytics.orders')"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.orderStatusTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.orderStatusHint') }}</p>
        <div v-if="loading" class="shimmer h-32 w-full rounded" />
        <BaseEmptyState
          v-else-if="orderStatusItems.length === 0"
          compact
          :title="t('analytics.noOrders')"
          :description="t('analytics.noOrdersHint')"
        />
        <div v-else class="space-y-2">
          <div
            v-for="item in orderStatusItems"
            :key="item.status"
            class="flex items-center justify-between"
          >
            <span class="text-sm">{{ tDynamic('status.order', item.status) }}</span>
            <span class="text-sm tabular-nums">{{ formatNumber(item.count) }}</span>
          </div>
        </div>
      </div>

      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.productTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.productHint') }}</p>
        <BarMeters
          v-if="!loading && productItems.length > 0"
          :items="productItems"
          :selectable="false"
        />
        <BaseEmptyState
          v-else-if="!loading"
          compact
          :title="t('analytics.noProducts')"
          :description="t('analytics.noProductsHint')"
        />
        <div v-if="loading" class="shimmer h-32 w-full rounded" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.repeatTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.repeatHint') }}</p>
        <div v-if="loading" class="shimmer h-16 w-full rounded" />
        <template v-else-if="repeatRate?.measurable">
          <p class="text-h3">{{ formatPercent(repeatRate.repeat_purchase_rate_percent) }}</p>
          <p class="text-xs text-muted">
            {{
              t('analytics.repeatSummary', {
                repeat: repeatRate.repeat_customers,
                total: repeatRate.total_customers_with_orders,
              })
            }}
          </p>
        </template>
        <BaseEmptyState
          v-else
          compact
          :title="t('analytics.insufficientData')"
          :description="t('analytics.noCustomerData')"
        />
      </div>

      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.recoveryTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.recoveryHint') }}</p>
        <div v-if="loading" class="shimmer h-24 w-full rounded" />
        <template v-else-if="recoveryFunnel?.measurable">
          <div class="space-y-1 text-sm">
            <div
              v-for="stage in recoveryFunnel.funnel"
              :key="stage.stage"
              class="flex justify-between"
            >
              <span>{{ tDynamic('analytics.recoveryStage', stage.stage) }}</span>
              <span class="tabular-nums">{{ formatNumber(stage.count) }}</span>
            </div>
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ t('analytics.recoveredRevenue', { value: formatCurrency(recoveryFunnel.recovered_revenue, currency) }) }}
          </p>
          <p class="text-xs text-muted">
            {{ t('analytics.openPipeline', { value: formatCurrency(recoveryFunnel.open_pipeline_value, currency) }) }}
          </p>
        </template>
        <BaseEmptyState
          v-else
          compact
          :title="t('analytics.noRecovery')"
          :description="t('analytics.noRecoveryHint')"
        />
      </div>

      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.deliveryTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.deliveryHint') }}</p>
        <div v-if="loading" class="shimmer h-24 w-full rounded" />
        <template v-else-if="deliveryMetrics?.measurable">
          <div class="space-y-1 text-sm">
            <div
              v-for="(count, status) in deliveryMetrics.by_status"
              :key="status"
              class="flex justify-between"
            >
              <span>{{ tDynamic('analytics.deliveryStatus', String(status)) }}</span>
              <span class="tabular-nums">{{ formatNumber(count) }}</span>
            </div>
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ t('analytics.deliveryRate', { rate: formatPercent(deliveryMetrics.delivery_rate_percent) }) }}
          </p>
        </template>
        <BaseEmptyState
          v-else
          compact
          :title="t('analytics.noMessages')"
          :description="t('analytics.noMessagesHint')"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.conversationTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.conversationHint') }}</p>
        <div v-if="loading" class="shimmer h-16 w-full rounded" />
        <div v-else-if="conversationMetrics?.measurable" class="grid grid-cols-2 gap-2 text-sm">
          <div>
            {{ t('analytics.conversationsAnalyzed') }}:
            {{ formatNumber(conversationMetrics.conversations_analyzed) }}
          </div>
          <div>
            {{ t('analytics.withFirstResponse') }}:
            {{ formatNumber(conversationMetrics.conversations_with_first_response) }}
          </div>
          <div>
            {{ t('analytics.avgFirstResponse') }}:
            {{ formatNumber(conversationMetrics.avg_first_response_minutes, 1) }}
            {{ t('analytics.minutes') }}
          </div>
          <div>
            {{ t('analytics.medianFirstResponse') }}:
            {{ formatNumber(conversationMetrics.median_first_response_minutes, 1) }}
            {{ t('analytics.minutes') }}
          </div>
        </div>
        <BaseEmptyState
          v-else
          compact
          :title="t('analytics.insufficientData')"
          :description="t('analytics.noConversationData')"
        />
      </div>

      <div class="surface p-4">
        <h2 class="text-h5 mb-1">{{ t('analytics.marginTitle') }}</h2>
        <p class="mb-3 text-small text-muted">{{ t('analytics.marginHint') }}</p>
        <div v-if="loading" class="shimmer h-16 w-full rounded" />
        <div v-else-if="financialMargin?.measurable" class="grid grid-cols-2 gap-2 text-sm">
          <div>{{ t('analytics.netSales') }}: {{ formatCurrency(financialMargin.summary.net_sales, currency) }}</div>
          <div>{{ t('analytics.cogs') }}: {{ formatCurrency(financialMargin.summary.cogs, currency) }}</div>
          <div>{{ t('analytics.grossProfit') }}: {{ formatCurrency(financialMargin.summary.gross_profit, currency) }}</div>
          <div>{{ t('analytics.grossMargin') }}: {{ formatPercent(financialMargin.summary.gross_margin_percent) }}</div>
        </div>
        <BaseEmptyState
          v-else
          compact
          :title="t('analytics.insufficientData')"
          :description="t('analytics.costIncomplete')"
        />
        <p v-if="!loading" class="mt-2 text-xs text-muted">{{ t('analytics.marginNote') }}</p>
        <div v-if="!loading && payments && refunds" class="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">{{ t('analytics.markedPaid') }}</span>
            <span class="tabular-nums">{{ formatCurrency(payments.marked_paid_value, currency) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">{{ t('analytics.unpaidOrders') }}</span>
            <span class="tabular-nums">
              {{ formatNumber(payments.unpaid_orders) }} ·
              {{ formatCurrency(payments.unpaid_value, currency) }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">{{ t('analytics.partiallyPaidOrders') }}</span>
            <span class="tabular-nums">
              {{ formatNumber(payments.partially_paid_orders) }} ·
              {{ formatCurrency(payments.partially_paid_value, currency) }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">{{ t('analytics.refundedOrders') }}</span>
            <span class="tabular-nums">
              {{ formatNumber(refunds.refunded_orders) }} ·
              {{ formatCurrency(refunds.refunded_order_value, currency) }}
            </span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">{{ t('analytics.refundRate') }}</span>
            <span class="tabular-nums">{{ formatPercent(refunds.refund_rate_percent) }}</span>
          </div>
          <p class="text-xs text-muted">{{ t('analytics.paymentNote') }}</p>
        </div>
      </div>
    </div>

    <div v-if="!loading && storePerformance.length > 0" class="surface p-4">
      <h2 class="text-h5 mb-1">{{ t('analytics.storeTitle') }}</h2>
      <p class="mb-3 text-small text-muted">{{ t('analytics.storeHint') }}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-start text-muted">
            <tr class="border-b border-line">
              <th class="py-2 text-start font-medium">{{ t('analytics.store') }}</th>
              <th class="py-2 text-end font-medium">{{ t('analytics.orders') }}</th>
              <th class="py-2 text-end font-medium">{{ t('analytics.revenue') }}</th>
              <th class="py-2 text-end font-medium">{{ t('analytics.averageOrder') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in storePerformance" :key="row.store_id" class="border-b border-line last:border-0">
              <td class="py-2">{{ row.store ?? t('analytics.unknownStore') }}</td>
              <td class="py-2 text-end tabular-nums">{{ formatNumber(row.orders) }}</td>
              <td class="py-2 text-end tabular-nums">{{ formatCurrency(row.revenue, currency) }}</td>
              <td class="py-2 text-end tabular-nums">{{ formatCurrency(row.average_order_value, currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="surface p-4">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-h5">{{ t('analytics.stockTitle') }}</h2>
          <p class="text-small text-muted">{{ t('analytics.stockHint') }}</p>
        </div>
        <BaseButton size="sm" variant="ghost" @click="openInventory">
          {{ t('analytics.viewInventory') }}
        </BaseButton>
      </div>
      <div v-if="loading" class="shimmer h-32 w-full rounded" />
      <BaseEmptyState
        v-else-if="stockHealth?.insufficient_data"
        compact
        :title="t('analytics.noStock')"
        :description="t('analytics.noStockHint')"
      />
      <template v-else-if="stockHealth">
        <div class="mb-3 flex flex-wrap gap-4 text-sm">
          <span>{{ t('analytics.totalItems') }}: {{ formatNumber(stockHealth.summary.total_items) }}</span>
          <span>{{ t('analytics.outOfStock') }}: {{ formatNumber(stockHealth.summary.out_of_stock) }}</span>
          <span>{{ t('analytics.lowStock') }}: {{ formatNumber(stockHealth.summary.low_stock) }}</span>
          <span>{{ t('analytics.healthy') }}: {{ formatNumber(stockHealth.summary.healthy) }}</span>
        </div>
        <div class="max-h-64 space-y-1 overflow-auto text-sm">
          <div
            v-for="item in stockHealth.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 border-b border-line pb-1 last:border-0"
          >
            <div class="min-w-0">
              <div class="truncate">
                {{ item.product_name }}
                <span class="text-muted">({{ item.sku ?? t('analytics.noSku') }})</span>
              </div>
              <div class="text-xs text-muted">{{ item.store ?? t('analytics.unknownStore') }}</div>
            </div>
            <div class="shrink-0 text-end tabular-nums">
              <div>
                {{ t('analytics.available') }} {{ formatNumber(item.available) }} /
                {{ t('analytics.onHand') }} {{ formatNumber(item.quantity) }}
              </div>
              <div
                class="text-xs"
                :class="
                  item.status === 'out_of_stock'
                    ? 'text-danger'
                    : item.status === 'low_stock'
                      ? 'text-warning'
                      : 'text-muted'
                "
              >
                {{ tDynamic('analytics.stockStatus', item.status) }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="!loading && limitations.length > 0" class="surface p-4">
      <h2 class="text-h5 mb-1">{{ t('analytics.limitationsTitle') }}</h2>
      <p class="mb-3 text-small text-muted">{{ t('analytics.limitationsHint') }}</p>
      <ul class="space-y-1 text-sm">
        <li v-for="limitation in limitations" :key="limitation.code" class="flex gap-2">
          <Activity class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>{{ tDynamic('profit.limitation', limitation.code) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
