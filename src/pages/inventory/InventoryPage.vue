<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, MoreHorizontal, Package, PackageMinus, PackagePlus } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  adjustStock,
  fetchInventory,
  fetchLowStock,
  receiveStock,
} from '@/services/inventoryService'
import { fetchStores } from '@/services/storeService'
import type { Inventory, Store } from '@/types/catalogue'
import type { Paginated } from '@/types/api'
import { statusTone } from '@/utils/status'
import { formatNumber } from '@/utils/format'

/**
 * Stock levels, with the two mutations that keep them honest.
 *
 * The endpoint offers no text search, so the page filters by tab and store
 * only — a search box that does nothing would be worse than none. Adjust and
 * receive are deliberately kept apart in the payload as well as the copy:
 * adjust sets an absolute on-hand quantity, receive records a purchase, and
 * confusing the two would quietly corrupt the ledger.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

const tab = ref('all')
const storeId = ref('')
const page = ref(1)

const rows = ref<Inventory[]>([])
const meta = ref<Paginated<Inventory>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const stores = ref<Store[]>([])

const canManage = computed(() => auth.can('inventory.manage'))
const canViewStores = computed(() => auth.can('stores.view'))

const tabs = computed<TabItem[]>(() => [
  { key: 'all', label: t('inventory.allStock') },
  { key: 'low', label: t('inventory.lowStockTitle') },
])

const storeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

const columns = computed<TableColumn[]>(() => [
  { key: 'product', label: t('inventory.product') },
  { key: 'sku', label: t('products.sku') },
  { key: 'store', label: t('common.store') },
  { key: 'quantity', label: t('inventory.onHand'), align: 'end' },
  { key: 'reserved', label: t('inventory.reserved'), align: 'end' },
  { key: 'available', label: t('inventory.available'), align: 'end' },
  { key: 'threshold', label: t('inventory.threshold'), align: 'end' },
  { key: 'low', label: t('inventory.lowStockTitle'), width: '8rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

/**
 * Below the reorder point reads as a warning; nothing on hand is a problem.
 * Both come from the shared status map so the colour means the same thing here
 * as it does on every other screen.
 */
function lowStockTone(row: Inventory): BadgeTone {
  if (!row.is_low_stock) return statusTone('inactive')
  return statusTone(row.quantity <= 0 ? 'cancelled' : 'pending')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const params = {
      page: page.value,
      per_page: PER_PAGE,
      store_id: storeId.value ? Number(storeId.value) : undefined,
    }
    const result = tab.value === 'low' ? await fetchLowStock(params) : await fetchInventory(params)
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('error.title')
  } finally {
    loading.value = false
  }
}

/** Optional filter: if it cannot load, the table still answers the main question. */
async function loadStores(): Promise<void> {
  if (!canViewStores.value) return
  try {
    stores.value = await fetchStores()
  } catch {
    stores.value = []
  }
}

watch([tab, storeId], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  storeId.value = ''
  page.value = 1
  void load()
}

/* ------------------------------------------------------------ stock forms */

const stockMode = ref<'adjust' | 'receive' | null>(null)
const stockTarget = ref<Inventory | null>(null)
const stockQuantity = ref('')
const stockThreshold = ref('')
const stockNote = ref('')
const quantityError = ref<string | null>(null)
const thresholdError = ref<string | null>(null)
const noteError = ref<string | null>(null)
const submitting = ref(false)

const stockTitle = computed(() => {
  const target = stockTarget.value
  if (stockMode.value !== 'adjust') return t('inventory.receive')
  const name = target?.product?.name ?? target?.variant?.name ?? t('common.product')
  return t('inventory.adjustTitle', { name })
})

function openStock(mode: 'adjust' | 'receive', row: Inventory): void {
  stockMode.value = mode
  stockTarget.value = row
  stockQuantity.value = ''
  stockThreshold.value = ''
  stockNote.value = ''
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
  return value >= 0 ? null : t('validation.nonNegative')
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

  const rowStoreId = row.store_id ?? row.store?.id ?? null
  const rowVariantId = row.product_variant_id ?? row.variant?.id ?? null
  if (rowStoreId === null || rowVariantId === null) {
    // Nothing here maps to a field, so the message goes to a toast rather
    // than being dropped silently.
    toast.error(t('error.title'))
    return
  }

  submitting.value = true
  const payload = {
    store_id: rowStoreId,
    product_variant_id: rowVariantId,
    quantity: Number(stockQuantity.value.trim()),
    note: stockNote.value.trim() || undefined,
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

    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void load()
  void loadStores()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('inventory.title')" :description="t('inventory.subtitle')" />

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <!-- Tabs and filters -->
    <div class="surface p-4">
      <BaseTabs v-model="tab" :tabs="tabs" />

      <div class="mt-4 flex flex-wrap items-end gap-3">
        <BaseSelect
          v-if="canViewStores"
          v-model="storeId"
          class="w-52"
          :label="t('common.store')"
          :options="storeOptions"
        />

        <BaseButton v-if="storeId !== ''" variant="ghost" @click="clearFilters">
          {{ t('action.clearAll') }}
        </BaseButton>
      </div>
    </div>

    <!-- Table -->
    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="row in rows" :key="row.id">
          <td class="px-4 py-3">
            <span class="font-medium text-ink">
              {{ row.product?.name ?? row.variant?.name ?? '—' }}
            </span>
            <span v-if="row.product && row.variant" class="mt-0.5 block text-caption text-subtle">
              {{ row.variant.name }}
            </span>
          </td>

          <td class="px-4 py-3 text-muted">
            {{ row.variant?.sku || row.product?.sku || '—' }}
          </td>

          <td class="px-4 py-3 text-muted">
            {{ row.store?.name ?? '—' }}
          </td>

          <td class="px-4 py-3 text-end tabular-nums" :class="row.quantity ? 'text-ink' : 'text-subtle'">
            {{ formatNumber(row.quantity) }}
          </td>

          <td class="px-4 py-3 text-end tabular-nums" :class="row.reserved_quantity ? 'text-ink' : 'text-subtle'">
            {{ formatNumber(row.reserved_quantity) }}
          </td>

          <td class="px-4 py-3 text-end font-medium tabular-nums" :class="row.available ? 'text-ink' : 'text-subtle'">
            {{ formatNumber(row.available) }}
          </td>

          <td class="px-4 py-3 text-end tabular-nums text-muted">
            {{ formatNumber(row.low_stock_threshold) }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge v-if="row.is_low_stock" :tone="lowStockTone(row)" dot>
              {{ t('inventory.lowStockTitle') }}
            </BaseBadge>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="px-4 py-3">
            <div class="flex justify-end">
              <BaseDropdown v-if="canManage" align="end">
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
                    @click="close(); openStock('adjust', row)"
                  >
                    <PackageMinus class="size-4 text-muted" />
                    {{ t('inventory.adjust') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openStock('receive', row)"
                  >
                    <PackagePlus class="size-4 text-muted" />
                    {{ t('inventory.receive') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="rows.length === 0 && tab === 'low'"
            :title="t('inventory.lowStockEmpty')"
            :description="t('inventory.lowStockEmptyBody')"
            :icon="AlertTriangle"
          />

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :title="t('inventory.emptyTitle')"
            :description="t('inventory.emptyBody')"
            :icon="Package"
          />
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Adjust / receive -->
    <BaseModal
      :open="stockMode !== null"
      :title="stockTitle"
      @close="closeStock"
    >
      <div class="space-y-4">
        <dl class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('common.store') }}</dt>
            <dd class="text-ink">{{ stockTarget?.store?.name ?? '—' }}</dd>
          </div>
        </dl>

        <BaseInput
          v-model="stockQuantity"
          type="number"
          :label="stockMode === 'adjust' ? t('inventory.onHand') : t('common.quantity')"
          :error="quantityError"
          min="0"
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

        <BaseTextarea
          v-model="stockNote"
          :label="t('inventory.adjustNote')"
          :rows="3"
          :error="noteError"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="submitting" @click="closeStock">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="submitting" @click="submitStock">
          {{ stockMode === 'adjust' ? t('inventory.adjust') : t('inventory.receive') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
