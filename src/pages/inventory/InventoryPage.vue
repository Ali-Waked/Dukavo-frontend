<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  MoreHorizontal,
  Package,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Search,
  TrendingDown,
} from '@/components/icons'
import { tDynamic, useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import {
  adjustStock,
  exportInventoryIntelligence,
  fetchInventoryIntelligence,
  fetchInventoryIntelligenceDetail,
  fetchMovements,
  receiveStock,
  transferStock,
} from '@/services/inventoryService'
import { fetchStores } from '@/services/storeService'
import type { InventoryMovement, Store } from '@/types/catalogue'
import type {
  InventoryIntelligenceDetailResponse,
  InventoryIntelligenceItem,
  InventoryIntelligenceResponse,
  InventoryIntelligenceSettings,
  InventoryStatusFilter,
} from '@/types/inventory'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format'

/**
 * Inventory intelligence.
 *
 * The table answers "what needs attention now"; the detail drawer answers "why
 * this number". Every forecast and reorder figure is shown with its inputs and
 * limits, and transfer/adjust/receive stay explicit human actions.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

const today = isoDate(new Date())

const status = ref<InventoryStatusFilter>('all')
const storeId = ref('')
const from = ref(daysAgo(27))
const until = ref(today)
const search = ref('')
const debouncedSearch = useDebounce(search, 300)
const page = ref(1)

const data = ref<InventoryIntelligenceResponse | null>(null)
const rows = computed(() => data.value?.items ?? [])
const summary = computed(() => data.value?.summary ?? null)
const settings = ref<InventoryIntelligenceSettings | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
let loadSequence = 0

const stores = ref<Store[]>([])
const canManage = computed(() => auth.can('inventory.manage'))
const canViewStores = computed(() => auth.can('stores.view'))

const storeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

const statusTabs = computed<TabItem[]>(() => [
  { key: 'all', label: t('inventory.allStock'), count: summary.value?.items_count ?? 0 },
  { key: 'low', label: t('inventory.lowStockTitle'), count: summary.value?.low_stock_count ?? 0 },
  { key: 'out', label: t('inventory.outOfStock'), count: summary.value?.out_of_stock_count ?? 0 },
  { key: 'reorder', label: t('inventory.reorderNeeded'), count: summary.value?.reorder_count ?? 0 },
  { key: 'slow', label: t('inventory.slowMoving'), count: summary.value?.slow_moving_count ?? 0 },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'product', label: t('inventory.product') },
  { key: 'store', label: t('common.store') },
  { key: 'available', label: t('inventory.available'), align: 'end' },
  { key: 'demand', label: t('inventory.dailyDemand'), align: 'end' },
  { key: 'cover', label: t('inventory.daysOfCover'), align: 'end' },
  { key: 'reorder', label: t('inventory.suggestedOrder'), align: 'end' },
  { key: 'value', label: t('inventory.value'), align: 'end' },
  { key: 'status', label: t('inventory.status'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const currencyValue = computed(() => {
  const valuation = summary.value?.valuation ?? []
  if (valuation.length === 0) return '—'
  return valuation
    .map((entry) => formatCurrency(entry.value, entry.currency))
    .join(' · ')
})

const valuationHint = computed(() => {
  const entries = summary.value?.valuation ?? []
  if (entries.length === 0) return t('inventory.costMissing')
  if (entries.length > 1) return t('inventory.multipleCurrencies', { count: entries.length })
  return t('inventory.valueHint')
})

const rangeLabel = computed(() => {
  const range = data.value?.range
  if (!range) return ''
  return t('inventory.rangeSummary', {
    days: range.days,
    from: formatDate(range.from),
    until: formatDate(range.until),
  })
})

const rangeInvalid = computed(() => Boolean(from.value && until.value && from.value > until.value))

function friendlyError(caught: unknown): string {
  if (caught instanceof ApiError && caught.isNetworkError) return t('auth.networkError')
  if (caught instanceof ApiError && caught.message) return caught.message
  return t('error.title')
}

async function load(): Promise<void> {
  const sequence = ++loadSequence

  if (rangeInvalid.value) {
    error.value = t('inventory.rangeInvalid')
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const result = await fetchInventoryIntelligence({
      page: page.value,
      per_page: PER_PAGE,
      status: status.value,
      store_id: storeId.value ? Number(storeId.value) : undefined,
      from: from.value || undefined,
      until: until.value || undefined,
      q: debouncedSearch.value.trim() || undefined,
    })
    if (sequence !== loadSequence) return
    data.value = result
    settings.value = result.settings
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

watch([status, storeId, from, until, debouncedSearch], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  status.value = 'all'
  storeId.value = ''
  search.value = ''
  from.value = daysAgo(27)
  until.value = today
  page.value = 1
}

/* ------------------------------------------------------------- display */

function statusLabel(value: string): string {
  return tDynamic('inventory.stockStatus', value)
}

function statusTone(value: string): BadgeTone {
  switch (value) {
    case 'out_of_stock':
      return 'danger'
    case 'low_stock':
    case 'reorder':
      return 'warning'
    case 'slow_moving':
      return 'info'
    default:
      return 'success'
  }
}

function demand(row: InventoryIntelligenceItem): string {
  const value = row.forecast.daily_demand
  return value === null ? '—' : formatNumber(value, 2)
}

function cover(row: InventoryIntelligenceItem): string {
  const value = row.replenishment.days_of_cover
  return value === null ? '—' : `${formatNumber(value, 1)} ${t('inventory.days')}`
}

function valueOf(row: InventoryIntelligenceItem): string {
  if (row.inventory_value === null) return '—'
  return formatCurrency(row.inventory_value, row.currency)
}

/* ------------------------------------------------------------ exporting */

const exporting = ref(false)

async function exportRows(): Promise<void> {
  if (rangeInvalid.value) {
    error.value = t('inventory.rangeInvalid')
    return
  }

  exporting.value = true
  try {
    const { blob, filename } = await exportInventoryIntelligence({
      status: status.value,
      store_id: storeId.value ? Number(storeId.value) : undefined,
      from: from.value || undefined,
      until: until.value || undefined,
      q: debouncedSearch.value.trim() || undefined,
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename ?? `inventory-${from.value || 'start'}-${until.value || today}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(t('inventory.exported'))
  } catch (caught) {
    toast.error(friendlyError(caught))
  } finally {
    exporting.value = false
  }
}

/* ------------------------------------------------------- adjust / receive */

const stockMode = ref<'adjust' | 'receive' | null>(null)
const stockTarget = ref<InventoryIntelligenceItem | null>(null)
const stockQuantity = ref('')
const stockThreshold = ref('')
const stockNote = ref('')
const stockKey = ref('')
const quantityError = ref<string | null>(null)
const thresholdError = ref<string | null>(null)
const noteError = ref<string | null>(null)
const submittingStock = ref(false)

const stockTitle = computed(() =>
  t(stockMode.value === 'adjust' ? 'inventory.adjustTitle' : 'inventory.receiveTitle', {
    name: stockTarget.value?.product_name ?? t('common.product'),
  }),
)

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function openStock(mode: 'adjust' | 'receive', row: InventoryIntelligenceItem): void {
  stockMode.value = mode
  stockTarget.value = row
  stockQuantity.value = ''
  stockThreshold.value = row.low_stock_threshold === null ? '' : String(row.low_stock_threshold)
  stockNote.value = ''
  stockKey.value = newIdempotencyKey()
  quantityError.value = null
  thresholdError.value = null
  noteError.value = null
}

function closeStock(): void {
  stockMode.value = null
  stockTarget.value = null
}

function clearStockErrors(): void {
  quantityError.value = null
  thresholdError.value = null
  noteError.value = null
}

function quantityMessage(raw: string, positive: boolean): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return t('validation.required')

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return t('validation.number')
  if (!Number.isInteger(value)) return t('validation.wholeNumber')
  if (positive) return value > 0 ? null : t('validation.positive')
  if (value < 0 && !settings.value?.allow_negative_stock) return t('validation.nonNegative')
  return null
}

function thresholdMessage(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : quantityMessage(trimmed, false)
}

async function submitStock(): Promise<void> {
  const row = stockTarget.value
  const mode = stockMode.value
  if (!row || !mode) return

  clearStockErrors()

  const quantityProblem = quantityMessage(stockQuantity.value, mode === 'receive')
  if (quantityProblem) {
    quantityError.value = quantityProblem
    return
  }

  const thresholdProblem = thresholdMessage(stockThreshold.value)
  if (thresholdProblem) {
    thresholdError.value = thresholdProblem
    return
  }

  submittingStock.value = true
  const payload = {
    store_id: row.store_id,
    product_variant_id: row.product_variant_id,
    quantity: Number(stockQuantity.value.trim()),
    note: stockNote.value.trim() || undefined,
    idempotency_key: stockKey.value,
  }

  try {
    if (mode === 'adjust') {
      await adjustStock(payload)
      toast.success(t('inventory.adjusted'))
    } else {
      const threshold = stockThreshold.value.trim()
      await receiveStock({
        ...payload,
        low_stock_threshold: threshold === '' ? undefined : Number(threshold),
      })
      toast.success(t('inventory.received'))
    }
    closeStock()
    await load()
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      quantityError.value = caught.fields['quantity']?.[0] ?? null
      noteError.value = caught.fields['note']?.[0] ?? null
      thresholdError.value = caught.fields['low_stock_threshold']?.[0] ?? null

      if (!quantityError.value && !noteError.value && !thresholdError.value) {
        toast.error(caught.message || t('error.title'))
      }
      return
    }
    toast.error(friendlyError(caught))
  } finally {
    submittingStock.value = false
  }
}

/* ------------------------------------------------------------- transfer */

const transferOpen = ref(false)
const transferSource = ref<InventoryIntelligenceItem | null>(null)
const transferToStoreId = ref('')
const transferQuantity = ref('')
const transferNote = ref('')
const transferKey = ref('')
const transferQtyError = ref<string | null>(null)
const transferStoreError = ref<string | null>(null)
const transferNoteError = ref<string | null>(null)
const submittingTransfer = ref(false)

const transferStoreOptions = computed(() =>
  stores.value
    .filter((store) => store.id !== transferSource.value?.store_id)
    .map((store) => ({ value: String(store.id), label: store.name })),
)

function openTransfer(row: InventoryIntelligenceItem): void {
  transferSource.value = row
  transferToStoreId.value = ''
  transferQuantity.value = ''
  transferNote.value = ''
  transferKey.value = newIdempotencyKey()
  transferQtyError.value = null
  transferStoreError.value = null
  transferNoteError.value = null
  transferOpen.value = true
}

function closeTransfer(): void {
  transferOpen.value = false
  transferSource.value = null
}

async function submitTransfer(): Promise<void> {
  const source = transferSource.value
  if (!source) return

  transferQtyError.value = null
  transferStoreError.value = null
  transferNoteError.value = null

  if (transferToStoreId.value === '') {
    transferStoreError.value = t('validation.required')
    return
  }

  const quantityProblem = quantityMessage(transferQuantity.value, true)
  if (quantityProblem) {
    transferQtyError.value = quantityProblem
    return
  }

  const quantity = Number(transferQuantity.value.trim())
  if (!settings.value?.allow_negative_stock && quantity > source.available) {
    transferQtyError.value = t('inventory.transferTooMuch', {
      count: formatNumber(source.available),
    })
    return
  }

  submittingTransfer.value = true
  try {
    await transferStock({
      from_store_id: source.store_id,
      to_store_id: Number(transferToStoreId.value),
      product_variant_id: source.product_variant_id,
      quantity,
      note: transferNote.value.trim() || undefined,
      idempotency_key: transferKey.value,
    })
    toast.success(t('inventory.transferred'))
    closeTransfer()
    await load()
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      transferQtyError.value = caught.fields['quantity']?.[0] ?? null
      transferStoreError.value = caught.fields['to_store_id']?.[0] ?? null
      transferNoteError.value = caught.fields['note']?.[0] ?? null

      if (!transferQtyError.value && !transferStoreError.value && !transferNoteError.value) {
        toast.error(caught.message || t('error.title'))
      }
      return
    }
    toast.error(friendlyError(caught))
  } finally {
    submittingTransfer.value = false
  }
}

/* -------------------------------------------------------------- insight */

const insightOpen = ref(false)
const insightLoading = ref(false)
const insightError = ref<string | null>(null)
const insightTarget = ref<InventoryIntelligenceItem | null>(null)
const insight = ref<InventoryIntelligenceDetailResponse | null>(null)
const movements = ref<InventoryMovement[]>([])
let insightSequence = 0

const detail = computed(() => insight.value?.item ?? null)
const series = computed(() => detail.value?.series ?? [])
const seriesMax = computed(() => Math.max(1, ...series.value.map((point) => point.sold)))
const insightStoreName = computed(
  () => detail.value?.store ?? insightTarget.value?.store ?? '—',
)

function barHeight(sold: number): string {
  return `${Math.max(2, Math.round((sold / seriesMax.value) * 100))}%`
}

async function openInsight(row: InventoryIntelligenceItem): Promise<void> {
  const sequence = ++insightSequence
  insightTarget.value = row
  insightOpen.value = true
  insightLoading.value = true
  insightError.value = null
  insight.value = null
  movements.value = []

  try {
    const movementsPromise = fetchMovements(row.id, { per_page: 12 })
      .then((result) => result.data)
      .catch(() => [])
    const result = await fetchInventoryIntelligenceDetail(row.id, {
      from: from.value || undefined,
      until: until.value || undefined,
    })
    if (sequence !== insightSequence) return
    insight.value = result
    const movementRows = await movementsPromise
    if (sequence === insightSequence) movements.value = movementRows
  } catch (caught) {
    if (sequence !== insightSequence) return
    insightError.value = friendlyError(caught)
  } finally {
    if (sequence === insightSequence) insightLoading.value = false
  }
}

function closeInsight(): void {
  insightOpen.value = false
  insight.value = null
  insightTarget.value = null
  movements.value = []
}

function movementTone(quantity: number): string {
  if (quantity > 0) return 'text-success-ink'
  if (quantity < 0) return 'text-danger-ink'
  return 'text-muted'
}

async function refreshInsight(): Promise<void> {
  const target = insightTarget.value
  if (target) await openInsight(target)
}

function receiveFromInsight(): void {
  const target = detail.value
  if (!target) return
  closeInsight()
  openStock('receive', target)
}

onMounted(() => {
  void load()
  void loadStores()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('inventory.title')" :description="t('inventory.subtitle')">
      <template #actions>
        <BaseButton variant="secondary" :loading="exporting" @click="exportRows">
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

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        :label="t('inventory.unitsOnHand')"
        :value="formatNumber(summary?.units_on_hand)"
        :hint="t('inventory.unitsOnHandHint', { reserved: formatNumber(summary?.units_reserved) })"
        :icon="Boxes"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('inventory.unitsAvailable')"
        :value="formatNumber(summary?.units_available)"
        :hint="t('inventory.unitsAvailableHint', { sold: formatNumber(summary?.units_sold) })"
        :icon="Package"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('inventory.lowStockTitle')"
        :value="formatNumber(summary?.low_stock_count)"
        :hint="t('inventory.lowStockHint', { out: formatNumber(summary?.out_of_stock_count) })"
        :icon="AlertTriangle"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('inventory.reorderNeeded')"
        :value="formatNumber(summary?.reorder_count)"
        :hint="t('inventory.reorderHint', { ready: formatNumber(summary?.forecast_ready_count) })"
        :icon="TrendingDown"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('inventory.slowMoving')"
        :value="formatNumber(summary?.slow_moving_count)"
        :hint="t('inventory.slowMovingHint', { events: formatNumber(summary?.stockout_events) })"
        :icon="Clock"
        :loading="loading && !summary"
      />
      <StatCard
        :label="t('inventory.value')"
        :value="currencyValue"
        :hint="valuationHint"
        :icon="CircleDollarSign"
        :loading="loading && !summary"
      />
    </div>

    <div class="surface space-y-4 p-4">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BaseInput v-model="search" type="search" :label="t('action.search')" :placeholder="t('inventory.searchPlaceholder')">
          <template #prefix><Search class="size-4" /></template>
        </BaseInput>

        <BaseSelect
          v-if="canViewStores"
          v-model="storeId"
          :label="t('common.store')"
          :options="storeOptions"
        />

        <BaseInput v-model="from" type="date" :label="t('inventory.from')" :max="until || today" />
        <BaseInput v-model="until" type="date" :label="t('inventory.until')" :min="from" :max="today" />

        <div class="flex items-end">
          <BaseButton variant="ghost" @click="clearFilters">
            {{ t('action.clearAll') }}
          </BaseButton>
        </div>
      </div>

      <BaseTabs
        :model-value="status"
        :tabs="statusTabs"
        @update:model-value="status = $event as InventoryStatusFilter"
      />

      <p v-if="rangeInvalid" class="text-small text-danger-ink">{{ t('inventory.rangeInvalid') }}</p>
      <p v-else-if="rangeLabel" class="text-small text-muted">{{ rangeLabel }}</p>
    </div>

    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="row in rows" :key="row.id">
          <td class="px-4 py-3">
            <button
              type="button"
              class="text-start font-medium text-ink transition hover:text-brand-ink"
              @click="openInsight(row)"
            >
              {{ row.product_name }}
            </button>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-subtle">
              <span v-if="row.variant_name">{{ row.variant_name }}</span>
              <span v-if="row.sku">· {{ row.sku }}</span>
            </span>
          </td>

          <td class="px-4 py-3 text-muted">{{ row.store ?? '—' }}</td>

          <td class="px-4 py-3 text-end">
            <span class="font-medium tabular-nums" :class="row.available > 0 ? 'text-ink' : 'text-danger-ink'">
              {{ formatNumber(row.available) }}
            </span>
            <span class="mt-0.5 block text-caption text-subtle">
              {{ t('inventory.onHand') }}: {{ formatNumber(row.quantity) }}
            </span>
          </td>

          <td class="px-4 py-3 text-end">
            <span class="tabular-nums" :class="row.forecast.daily_demand === null ? 'text-subtle' : 'text-ink'">
              {{ demand(row) }}
            </span>
            <span
              v-if="row.forecast.status === 'estimated'"
              class="mt-0.5 block text-caption text-subtle"
            >
              {{ tDynamic('inventory.confidence', row.forecast.confidence) }}
            </span>
            <span v-else class="mt-0.5 block text-caption text-subtle">
              {{ t('inventory.insufficientShort') }}
            </span>
          </td>

          <td class="px-4 py-3 text-end tabular-nums" :class="row.replenishment.days_of_cover === null ? 'text-subtle' : 'text-ink'">
            {{ cover(row) }}
          </td>

          <td class="px-4 py-3 text-end">
            <span
              class="font-medium tabular-nums"
              :class="row.replenishment.suggested_quantity > 0 ? 'text-warning-ink' : 'text-subtle'"
            >
              {{ row.replenishment.suggested_quantity > 0 ? formatNumber(row.replenishment.suggested_quantity) : '—' }}
            </span>
            <span
              v-if="row.replenishment.needed"
              class="mt-0.5 block text-caption text-subtle"
            >
              {{ tDynamic('inventory.reorderBasis', row.replenishment.basis) }}
            </span>
          </td>

          <td class="px-4 py-3 text-end tabular-nums">
            <span :class="row.inventory_value === null ? 'text-subtle' : 'text-ink'">{{ valueOf(row) }}</span>
            <span v-if="row.inventory_value === null" class="mt-0.5 block text-caption text-subtle">
              {{ t('inventory.costMissing') }}
            </span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(row.status)" dot>{{ statusLabel(row.status) }}</BaseBadge>
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
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openInsight(row)"
                  >
                    <Eye class="size-4 text-muted" />
                    {{ t('inventory.viewInsight') }}
                  </button>

                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openStock('adjust', row)"
                  >
                    <PackageMinus class="size-4 text-muted" />
                    {{ t('inventory.adjust') }}
                  </button>

                  <button
                    v-if="canManage"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openStock('receive', row)"
                  >
                    <PackagePlus class="size-4 text-muted" />
                    {{ t('inventory.receive') }}
                  </button>

                  <button
                    v-if="canManage && stores.length > 1"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openTransfer(row)"
                  >
                    <ArrowLeftRight class="size-4 text-muted" />
                    {{ t('inventory.transfer') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="search || storeId || status !== 'all'"
            :title="t('inventory.emptyFiltered')"
            :description="t('inventory.emptyFilteredBody')"
            :icon="Search"
          />
          <BaseEmptyState
            v-else
            :title="t('inventory.emptyTitle')"
            :description="t('inventory.emptyBody')"
            :icon="Package"
          />
        </template>

        <template #footer>
          <BasePagination
            v-if="data"
            :meta="data.pagination"
            :disabled="loading"
            @change="page = $event"
          />
        </template>
      </BaseTable>
    </div>

    <!-- Adjust / receive -->
    <BaseModal :open="stockMode !== null" :title="stockTitle" @close="closeStock">
      <div class="space-y-4">
        <dl class="grid gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm sm:grid-cols-2">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('common.store') }}</dt>
            <dd class="text-ink">{{ stockTarget?.store ?? '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('inventory.available') }}</dt>
            <dd class="font-medium tabular-nums text-ink">{{ formatNumber(stockTarget?.available) }}</dd>
          </div>
        </dl>

        <BaseInput
          v-model="stockQuantity"
          type="number"
          :label="stockMode === 'adjust' ? t('inventory.onHand') : t('common.quantity')"
          :error="quantityError"
          :min="stockMode === 'adjust' && settings?.allow_negative_stock ? undefined : 0"
          step="1"
          required
        />

        <BaseInput
          v-if="stockMode === 'receive'"
          v-model="stockThreshold"
          type="number"
          :label="t('inventory.threshold')"
          :hint="t('common.optional')"
          :error="thresholdError"
          min="0"
          step="1"
        />

        <BaseTextarea v-model="stockNote" :label="t('inventory.adjustNote')" :rows="3" :error="noteError" />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="submittingStock" @click="closeStock">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="submittingStock" @click="submitStock">
          {{ stockMode === 'adjust' ? t('inventory.adjust') : t('inventory.receive') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Transfer -->
    <BaseModal :open="transferOpen" :title="t('inventory.transferTitle')" @close="closeTransfer">
      <div class="space-y-4">
        <BaseAlert tone="info">
          {{ t('inventory.transferHint') }}
        </BaseAlert>

        <dl class="grid gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm sm:grid-cols-2">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('inventory.fromStore') }}</dt>
            <dd class="text-ink">{{ transferSource?.store ?? '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('inventory.available') }}</dt>
            <dd class="font-medium tabular-nums text-ink">{{ formatNumber(transferSource?.available) }}</dd>
          </div>
        </dl>

        <BaseSelect
          v-model="transferToStoreId"
          :label="t('inventory.toStore')"
          :placeholder="t('inventory.selectStore')"
          :options="transferStoreOptions"
          :error="transferStoreError"
          required
        />

        <BaseInput
          v-model="transferQuantity"
          type="number"
          :label="t('common.quantity')"
          :error="transferQtyError"
          min="1"
          step="1"
          required
        />

        <BaseTextarea v-model="transferNote" :label="t('inventory.adjustNote')" :rows="2" :error="transferNoteError" />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="submittingTransfer" @click="closeTransfer">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="submittingTransfer" @click="submitTransfer">
          {{ t('inventory.transfer') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Insight -->
    <BaseModal :open="insightOpen" size="xl" :title="t('inventory.insightTitle')" @close="closeInsight">
      <div v-if="insightLoading" class="flex items-center justify-center py-16">
        <BaseSpinner size="lg" :label="t('state.loading')" />
      </div>

      <BaseAlert v-else-if="insightError" tone="danger">{{ insightError }}</BaseAlert>

      <div v-else-if="detail" class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-ink">{{ detail.product_name }}</h3>
            <p class="mt-0.5 text-sm text-muted">
              {{ insightStoreName }}
              <span v-if="detail.variant_name">· {{ detail.variant_name }}</span>
              <span v-if="detail.sku">· {{ detail.sku }}</span>
            </p>
          </div>
          <BaseBadge :tone="statusTone(detail.status)" dot>{{ statusLabel(detail.status) }}</BaseBadge>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.onHand') }}</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ formatNumber(detail.quantity) }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.available') }}</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ formatNumber(detail.available) }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.reserved') }}</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ formatNumber(detail.reserved_quantity) }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.value') }}</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ valueOf(detail) }}</p>
            <p v-if="!detail.cost_reliable" class="mt-0.5 text-caption text-subtle">{{ t('inventory.costMissing') }}</p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <BaseCard flush>
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Activity class="size-4 text-muted" />
                  {{ t('inventory.forecastTitle') }}
                </span>
                <BaseBadge
                  :tone="detail.forecast.status === 'estimated' ? 'info' : 'warning'"
                >
                  {{ tDynamic('inventory.confidence', detail.forecast.confidence) }}
                </BaseBadge>
              </div>
            </template>

            <div class="space-y-4 p-4">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.dailyDemand') }}</p>
                  <p class="mt-1 text-2xl font-semibold tabular-nums text-ink">{{ demand(detail) }}</p>
                </div>
                <p class="text-end text-caption text-muted">
                  {{ t('inventory.netUnits', { count: formatNumber(detail.forecast.net_units_sold) }) }}
                </p>
              </div>

              <BaseAlert v-if="detail.forecast.status === 'insufficient_history'" tone="warning">
                {{ t('inventory.forecastInsufficient', { days: detail.forecast.minimum_history_days }) }}
              </BaseAlert>

              <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.observedDays') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.forecast.observed_days) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.activeSalesDays') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.forecast.active_sales_days) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.recentWindow') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.forecast.recent_window_days) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.recentWeight') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.forecast.recent_weight * 100) }}%</dd>
                </div>
              </dl>

              <div>
                <p class="mb-1.5 text-caption font-medium uppercase tracking-wide text-subtle">
                  {{ t('inventory.assumptions') }}
                </p>
                <ul class="space-y-1 text-small text-muted">
                  <li v-for="note in detail.forecast.notes" :key="note" class="flex gap-2">
                    <span class="text-subtle">•</span>
                    <span>{{ tDynamic('inventory.forecastNote', note) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </BaseCard>

          <BaseCard flush>
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-sm font-semibold text-ink">
                  <TrendingDown class="size-4 text-muted" />
                  {{ t('inventory.replenishmentTitle') }}
                </span>
                <BaseBadge :tone="detail.replenishment.needed ? 'warning' : 'success'">
                  {{ detail.replenishment.needed ? t('inventory.reorderNeeded') : t('inventory.stockHealthy') }}
                </BaseBadge>
              </div>
            </template>

            <div class="space-y-4 p-4">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.suggestedOrder') }}</p>
                  <p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
                    {{ formatNumber(detail.replenishment.suggested_quantity) }}
                  </p>
                </div>
                <div class="text-end">
                  <p class="text-caption uppercase tracking-wide text-subtle">{{ t('inventory.basis') }}</p>
                  <p class="mt-1 text-sm font-medium text-ink">
                    {{ tDynamic('inventory.reorderBasis', detail.replenishment.basis) }}
                  </p>
                </div>
              </div>

              <BaseAlert v-if="detail.replenishment.basis === 'threshold'" tone="info">
                {{ t('inventory.thresholdFallback') }}
              </BaseAlert>

              <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.reorderPoint') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.replenishment.reorder_point) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.targetStock') }}</dt>
                  <dd class="tabular-nums text-ink">{{ formatNumber(detail.replenishment.target_stock) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.daysOfCover') }}</dt>
                  <dd class="tabular-nums text-ink">{{ cover(detail) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.leadTime') }}</dt>
                  <dd class="tabular-nums text-ink">{{ t('inventory.daysCount', { count: detail.replenishment.lead_time_days }) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.safetyDays') }}</dt>
                  <dd class="tabular-nums text-ink">{{ t('inventory.daysCount', { count: detail.replenishment.safety_days }) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{{ t('inventory.reviewPeriod') }}</dt>
                  <dd class="tabular-nums text-ink">{{ t('inventory.daysCount', { count: detail.replenishment.review_period_days }) }}</dd>
                </div>
              </dl>

              <p class="text-small text-muted">{{ t('inventory.reorderAdvisory') }}</p>
            </div>
          </BaseCard>
        </div>

        <BaseCard flush>
          <template #header>
            <span class="flex items-center gap-2 text-sm font-semibold text-ink">
              <TrendingDown class="size-4 text-muted" />
              {{ t('inventory.salesSeries') }}
            </span>
          </template>

          <div class="p-4">
            <div v-if="series.length === 0" class="py-8 text-center text-sm text-muted">
              {{ t('inventory.noSeries') }}
            </div>
            <div v-else>
              <div class="flex h-28 items-end gap-1" role="img" :aria-label="t('inventory.salesSeries')">
                <div
                  v-for="point in series"
                  :key="point.date"
                  class="group relative flex h-full flex-1 items-end"
                  :title="`${formatDate(point.date)}: ${formatNumber(point.sold)}`"
                >
                  <div
                    class="w-full rounded-t bg-brand-400 transition group-hover:bg-brand-600"
                    :style="{ height: barHeight(point.sold) }"
                  />
                </div>
              </div>
              <div class="mt-2 flex justify-between text-caption text-subtle">
                <span>{{ formatDate(series[0]?.date) }}</span>
                <span>{{ formatDate(series[series.length - 1]?.date) }}</span>
              </div>
            </div>

            <dl class="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-muted">{{ t('inventory.lastSale') }}</dt>
                <dd class="mt-0.5 text-ink">
                  {{ detail.last_sale_at ? formatDate(detail.last_sale_at) : t('inventory.neverSold') }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">{{ t('inventory.stockoutEvents') }}</dt>
                <dd class="mt-0.5 text-ink">
                  {{ t('inventory.eventsCount', { count: detail.stockout_events }) }}
                  <span v-if="detail.last_stockout_at" class="text-subtle">
                    · {{ t('inventory.lastStockout') }} {{ formatDate(detail.last_stockout_at) }}
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-muted">{{ t('inventory.stockAge') }}</dt>
                <dd class="mt-0.5 text-ink">
                  {{ detail.age_days === null ? '—' : t('inventory.daysCount', { count: detail.age_days }) }}
                </dd>
              </div>
            </dl>
          </div>
        </BaseCard>

        <BaseCard flush>
          <template #header>
            <span class="flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock class="size-4 text-muted" />
              {{ t('inventory.movementHistory') }}
            </span>
          </template>

          <div v-if="movements.length === 0" class="px-4 py-8 text-center text-sm text-muted">
            {{ t('inventory.noMovements') }}
          </div>
          <ul v-else class="divide-y divide-line">
            <li v-for="movement in movements" :key="movement.id" class="flex items-center justify-between gap-4 px-4 py-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ink">
                  {{ tDynamic('inventory.movementType', movement.type) }}
                </p>
                <p class="mt-0.5 text-caption text-subtle">
                  {{ formatDateTime(movement.created_at) }}
                  <span v-if="movement.note">· {{ movement.note }}</span>
                </p>
              </div>
              <div class="text-end">
                <p class="text-sm font-semibold tabular-nums" :class="movementTone(movement.quantity)">
                  {{ movement.quantity > 0 ? '+' : '' }}{{ formatNumber(movement.quantity) }}
                </p>
                <p v-if="movement.balance_after !== undefined" class="text-caption tabular-nums text-subtle">
                  {{ t('inventory.balanceAfter', { count: formatNumber(movement.balance_after) }) }}
                </p>
              </div>
            </li>
          </ul>
        </BaseCard>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="closeInsight">{{ t('action.close') }}</BaseButton>
        <BaseButton variant="secondary" :disabled="insightLoading" @click="refreshInsight">
          {{ t('action.refresh') }}
        </BaseButton>
        <BaseButton
          v-if="canManage && detail"
          @click="receiveFromInsight"
        >
          {{ t('inventory.receive') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
