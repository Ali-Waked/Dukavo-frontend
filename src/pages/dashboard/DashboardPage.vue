<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, CircleDollarSign, ShoppingCart, TrendingUp, Wallet } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AiInsightsPanel from '@/components/ui/AiInsightsPanel.vue'
import RevenueChart from '@/components/charts/RevenueChart.vue'
import BarMeters, { type MeterItem } from '@/components/charts/BarMeters.vue'
import MiniList, { type MiniListItem } from '@/components/charts/MiniList.vue'
import {
  fetchDeadStock,
  fetchOverview,
  fetchRevenue,
  fetchSummary,
  fetchTopProducts,
} from '@/services/dashboardService'
import { fetchLowStock } from '@/services/inventoryService'
import { fetchOrders } from '@/services/orderService'
import { fetchAuditLogs } from '@/services/auditService'
import { fetchStores } from '@/services/storeService'
import type {
  DashboardOverview,
  DashboardSummary,
  DeadStockItem,
  RevenuePoint,
  TopProduct,
} from '@/types/dashboard'
import type { Inventory, Store } from '@/types/catalogue'
import type { Order } from '@/types/commerce'
import type { AuditLog } from '@/types/admin'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatNumber, formatRelative } from '@/utils/format'

/**
 * The dashboard answers four questions in one screen: how much came in, what
 * needs attention, what is selling, and what changed.
 *
 * Every panel is permission-gated — a user without `orders.view` never sees a
 * recent-orders skeleton resolve into "forbidden". Scope (all stores vs one)
 * only re-fetches the figures it actually affects instead of reloading the
 * whole page under the cursor.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const router = useRouter()

const loading = ref(true)
const scopeLoading = ref(false)
const error = ref<string | null>(null)

const overview = ref<DashboardOverview | null>(null)
const summary = ref<DashboardSummary | null>(null)
const revenue = ref<RevenuePoint[]>([])
const topProducts = ref<TopProduct[]>([])
const deadStock = ref<DeadStockItem[]>([])
const lowStock = ref<Inventory[]>([])
const recentOrders = ref<Order[]>([])
const activity = ref<AuditLog[]>([])
const stores = ref<Store[]>([])
const storeScope = ref<string>('')

const currency = computed(() => auth.activeTenant?.currency ?? overview.value?.context.currency ?? 'USD')
const tenantName = computed(() => auth.activeTenant?.name ?? overview.value?.context.tenant ?? '')

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return t('dashboard.greetingMorning')
  if (hour < 18) return t('dashboard.greetingAfternoon')
  return t('dashboard.greetingEvening')
})

const can = (permission: string) => auth.can(permission)

const storeOptions = computed(() => [
  { value: '', label: t('dashboard.storeScope') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

/* ------------------------------------------------------------------ widgets */

const topProductItems = computed<MeterItem[]>(() => {
  const leader = Math.max(1, ...topProducts.value.map((item) => item.units))
  return topProducts.value.map((item) => ({
    id: item.product_slug ?? '',
    label: item.name,
    meta: item.sku ?? undefined,
    value: formatCurrency(item.revenue, currency.value, { compact: true }),
    ratio: item.units / leader,
  }))
})

const deadStockItems = computed<MiniListItem[]>(() =>
  deadStock.value.map((item) => ({
    id: item.id,
    title: item.name,
    meta: item.sku ?? undefined,
    trailing: formatNumber(item.stock),
    trailingTone: 'warning' as const,
  })),
)

const lowStockItems = computed<MiniListItem[]>(() =>
  lowStock.value.map((item) => ({
    id: item.id,
    title: item.product?.name ?? item.variant?.name ?? '—',
    meta: item.store?.name ?? undefined,
    trailing: `${formatNumber(item.quantity)} / ${formatNumber(item.low_stock_threshold)}`,
    trailingTone: 'danger' as const,
  })),
)

const recentOrderItems = computed<MiniListItem[]>(() =>
  recentOrders.value.map((order) => ({
    id: order.order_number,
    title: `${order.order_number} · ${order.customer_name ?? t('common.none')}`,
    meta: formatCurrency(order.grand_total, order.currency || currency.value),
    trailing: order.status_label,
    trailingTone: statusTone(order.status),
  })),
)

const activityItems = computed<MiniListItem[]>(() =>
  activity.value.map((entry) => ({
    id: entry.id,
    title: entry.action_label,
    meta: `${entry.user?.name ?? t('common.none')}${
      entry.created_at ? ` · ${formatRelative(entry.created_at)}` : ''
    }`,
  })),
)

const secondaryStats = computed(() => [
  { label: t('dashboard.awaitingFulfilment'), value: summary.value?.awaiting_fulfilment ?? 0 },
  { label: t('dashboard.openConversations'), value: summary.value?.open_conversations ?? 0 },
  { label: t('dashboard.lowStockItems'), value: summary.value?.low_stock_items ?? 0 },
  { label: t('dashboard.activeCustomers'), value: summary.value?.active_customers ?? 0 },
])

/* -------------------------------------------------------------------- loads */

async function loadScoped(): Promise<void> {
  const storeId = storeScope.value === '' ? undefined : Number(storeScope.value)
  const [nextSummary, nextRevenue, nextTop] = await Promise.all([
    fetchSummary(storeId),
    fetchRevenue(30, storeId),
    fetchTopProducts(5, storeId),
  ])
  summary.value = nextSummary
  revenue.value = nextRevenue
  topProducts.value = nextTop
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [nextOverview] = await Promise.all([
      fetchOverview(),
      stores.value.length === 0 && can('stores.view')
        ? fetchStores({ activeOnly: false }).then((list) => {
            stores.value = list
          })
        : Promise.resolve(),
    ])
    overview.value = nextOverview

    await loadScoped()

    const [dead, low, orders, logs] = await Promise.all([
      can('inventory.view') ? fetchDeadStock(5) : Promise.resolve([] as DeadStockItem[]),
      can('inventory.view') ? fetchLowStock({ per_page: 5 }) : Promise.resolve(null),
      can('orders.view') ? fetchOrders({ per_page: 5 }) : Promise.resolve(null),
      can('audit.view') ? fetchAuditLogs({ per_page: 6 }) : Promise.resolve(null),
    ])

    deadStock.value = dead
    lowStock.value = low?.data ?? []
    recentOrders.value = orders?.data ?? []
    activity.value = logs?.data ?? []
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : (caught instanceof ApiError && caught.message) || t('error.title')
  } finally {
    loading.value = false
  }
}

async function onScopeChange(): Promise<void> {
  scopeLoading.value = true
  error.value = null
  try {
    await loadScoped()
  } catch {
    error.value = t('error.title')
  } finally {
    scopeLoading.value = false
  }
}

function openOrder(orderNumber: number | string): void {
  void router.push({ name: 'orders.show', params: { orderNumber: String(orderNumber) } })
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="`${greeting}, ${tenantName}`"
      :description="t('dashboard.subtitle', { tenant: tenantName })"
    >
      <template #actions>
        <BaseSelect
          v-if="stores.length > 0"
          v-model="storeScope"
          class="w-44"
          :aria-label="t('dashboard.storeScopeLabel')"
          :options="storeOptions"
          :disabled="scopeLoading"
          @update:model-value="onScopeChange"
        />
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Headline figures -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        :label="t('dashboard.revenueToday')"
        :value="formatCurrency(summary?.revenue_today, currency)"
        :icon="Wallet"
        :loading="loading"
      />
      <StatCard
        :label="t('dashboard.ordersToday')"
        :value="formatNumber(summary?.orders_today)"
        :icon="ShoppingCart"
        :loading="loading"
      />
      <StatCard
        :label="t('dashboard.averageOrder')"
        :value="formatCurrency(summary?.average_order_value, currency)"
        :icon="CircleDollarSign"
        :loading="loading"
      />
      <StatCard
        :label="t('dashboard.revenueMonth')"
        :value="formatCurrency(summary?.revenue_month, currency)"
        :icon="TrendingUp"
        :loading="loading"
      />
    </div>

    <!-- Attention strip -->
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <div
        v-for="stat in secondaryStats"
        :key="stat.label"
        class="surface flex items-center justify-between gap-3 px-4 py-3"
      >
        <p class="text-small text-muted">{{ stat.label }}</p>
        <p v-if="loading" class="shimmer h-6 w-10 rounded" />
        <p v-else class="text-h4 font-semibold tabular-nums text-ink">
          {{ formatNumber(stat.value) }}
        </p>
      </div>
    </div>

    <AiInsightsPanel
      v-if="can('ai.use')"
      scope="tenant"
      :store-id="storeScope === '' ? undefined : Number(storeScope)"
    />

    <!-- Revenue + top products -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section class="surface xl:col-span-2" :aria-label="t('dashboard.revenueOverview')">
        <header class="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.revenueOverview') }}</h2>
            <p class="mt-0.5 text-small text-muted">
              {{ t('dashboard.revenueOverviewDesc', { days: 30 }) }}
            </p>
          </div>
        </header>

        <div class="px-5 pb-5 pt-4">
          <RevenueChart
            :points="revenue"
            :currency="currency"
            :loading="loading || scopeLoading"
            :dashboard-no-revenue="t('dashboard.noRevenueYet')"
            :aria-label="t('dashboard.revenueOverview')"
            :orders-word="t('orders.items')"
          />
        </div>
      </section>

      <section class="surface p-5" :aria-label="t('dashboard.topProducts')">
        <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.topProducts') }}</h2>
        <p class="mt-0.5 text-small text-muted">{{ t('dashboard.topProductsDesc') }}</p>

        <div class="mt-4">
          <BarMeters
            :items="topProductItems"
            :loading="loading || scopeLoading"
            :empty-title="t('dashboard.noOrdersYet')"
            :empty-description="t('dashboard.noOrdersHint')"
            @select="(id) => id && router.push({ name: 'catalogue.products.show', params: { slug: String(id) } })"
          />
        </div>
      </section>
    </div>

    <!-- Recent orders + low stock -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section
        v-if="can('orders.view')"
        class="surface p-5"
        :aria-label="t('dashboard.recentOrders')"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.recentOrders') }}</h2>
          <BaseButton variant="link" size="sm" to="/orders">
            {{ t('common.all') }}
          </BaseButton>
        </div>

        <div class="mt-3">
          <MiniList
            :items="recentOrderItems"
            :loading="loading"
            :empty-title="t('dashboard.noOrdersYet')"
            :empty-description="t('dashboard.noOrdersHint')"
            @select="openOrder"
          />
        </div>
      </section>

      <section
        v-if="can('inventory.view')"
        class="surface p-5"
        :aria-label="t('dashboard.lowStock')"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.lowStock') }}</h2>
            <p class="mt-0.5 text-small text-muted">{{ t('dashboard.lowStockDesc') }}</p>
          </div>
          <BaseButton variant="link" size="sm" to="/inventory">
            {{ t('common.all') }}
          </BaseButton>
        </div>

        <div class="mt-3">
          <MiniList
            :items="lowStockItems"
            :loading="loading"
            :empty-title="t('common.noResults')"
            @select="(id) => router.push({ name: 'inventory.index', query: { item: String(id) } })"
          />
        </div>
      </section>
    </div>

    <!-- Dead stock + activity -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section
        v-if="can('inventory.view')"
        class="surface p-5"
        :aria-label="t('dashboard.deadStock')"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.deadStock') }}</h2>
            <p class="mt-0.5 text-small text-muted">{{ t('dashboard.deadStockDesc') }}</p>
          </div>
        </div>

        <div class="mt-3">
          <MiniList
            :items="deadStockItems"
            :loading="loading"
            :selectable="false"
            :empty-title="t('common.noResults')"
          />
        </div>
      </section>

      <section
        v-if="can('audit.view')"
        class="surface p-5"
        :aria-label="t('dashboard.recentActivity')"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
              <Activity class="size-4" aria-hidden="true" />
            </span>
            <h2 class="text-h4 font-semibold text-ink">{{ t('dashboard.recentActivity') }}</h2>
          </div>
          <BaseButton variant="link" size="sm" to="/audit">
            {{ t('common.all') }}
          </BaseButton>
        </div>

        <div class="mt-3">
          <MiniList
            :items="activityItems"
            :loading="loading"
            :selectable="false"
            :empty-title="t('dashboard.noActivity')"
            :empty-description="t('dashboard.noActivityHint')"
          />
        </div>
      </section>
    </div>
  </div>
</template>