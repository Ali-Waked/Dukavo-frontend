<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Pencil, Plus, RefreshCw, Save, Trash2, Truck } from '@/components/icons'
import MerchantStoreSelector from '@/components/storefront/MerchantStoreSelector.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useMerchantStore } from '@/composables/useMerchantStore'
import { ApiError } from '@/lib/axiosClient'
import {
  createShippingZone,
  deleteShippingZone,
  fetchShippingZones,
  updateShippingZone,
} from '@/services/storefrontService'
import { formatCurrency } from '@/utils/format'
import type { ShippingZone, ShippingZonePayload } from '@/types/storefront'

/**
 * Delivery zones.
 *
 * A zone is the whole pricing rule: the cities and areas it covers, the fee and
 * the optional amount at which delivery becomes free. The customer-facing
 * checkout resolves the first matching active zone, so order here is the
 * tie-breaker when two rules overlap.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const {
  stores,
  selectedId,
  selectedStore,
  loading: storesLoading,
  error: storesError,
  load: loadStores,
} = useMerchantStore()

const canManage = computed(() => auth.can('shipping.manage'))

const rows = ref<ShippingZone[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

const pendingDelete = ref<ShippingZone | null>(null)
const deleting = ref(false)

const form = reactive({
  name: '',
  city: '',
  areas: '',
  fee: '',
  free_shipping_threshold: '',
  is_active: true,
  sort_order: '0',
})

let requestId = 0

const currency = computed(() => selectedStore.value?.currency ?? undefined)
const currencyDecimals = computed(() => selectedStore.value?.currency_decimals ?? undefined)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('shop.admin.shipping.name') },
  { key: 'coverage', label: t('shop.admin.shipping.coverage') },
  { key: 'fee', label: t('shop.admin.shipping.fee'), align: 'end', width: '9rem' },
  { key: 'free', label: t('shop.admin.shipping.freeThreshold'), align: 'end', width: '11rem' },
  { key: 'status', label: t('shop.admin.status'), width: '8rem' },
  { key: 'order', label: t('shop.admin.shipping.sortOrder'), align: 'center', width: '6rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '7rem' },
])

function money(value: number): string {
  return formatCurrency(value, currency.value, { decimals: currencyDecimals.value })
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function coverage(zone: ShippingZone): string {
  const city = zone.city ? titleCase(zone.city) : t('shop.admin.shipping.anyCity')
  const areas = zone.areas.length > 0 ? zone.areas.map(titleCase).join(', ') : t('shop.admin.shipping.anyArea')
  return `${city} · ${areas}`
}

function errorFor(key: string): string | null {
  return fieldErrors.value[key]?.[0] ?? null
}

async function load(): Promise<void> {
  if (selectedId.value === '') {
    rows.value = []
    return
  }

  const id = ++requestId
  loading.value = true
  loadError.value = null

  try {
    const result = await fetchShippingZones(selectedId.value)
    if (id !== requestId) return
    rows.value = result
  } catch (caught) {
    if (id !== requestId) return
    loadError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

function resetForm(): void {
  editingId.value = null
  form.name = ''
  form.city = ''
  form.areas = ''
  form.fee = ''
  form.free_shipping_threshold = ''
  form.is_active = true
  form.sort_order = '0'
  fieldErrors.value = {}
}

function openCreate(): void {
  resetForm()
  formOpen.value = true
}

function openEdit(zone: ShippingZone): void {
  resetForm()
  editingId.value = zone.id
  form.name = zone.name
  form.city = zone.city ?? ''
  form.areas = zone.areas.join('\n')
  form.fee = String(zone.fee)
  form.free_shipping_threshold =
    zone.free_shipping_threshold === null ? '' : String(zone.free_shipping_threshold)
  form.is_active = zone.is_active
  form.sort_order = String(zone.sort_order)
  formOpen.value = true
}

function parsedAreas(): string[] {
  return Array.from(
    new Set(
      form.areas
        .split(/[\n,]+/)
        .map((area) => area.trim())
        .filter((area) => area !== ''),
    ),
  )
}

function buildPayload(): ShippingZonePayload {
  const threshold = form.free_shipping_threshold.trim()

  return {
    name: form.name.trim(),
    city: form.city.trim() || null,
    areas: parsedAreas(),
    fee: Number(form.fee),
    free_shipping_threshold: threshold === '' ? null : Number(threshold),
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
  }
}

async function save(): Promise<void> {
  if (!canManage.value || selectedId.value === '' || saving.value) return

  fieldErrors.value = {}

  if (form.name.trim() === '') {
    fieldErrors.value.name = [t('shop.admin.required')]
    return
  }

  saving.value = true

  try {
    if (editingId.value === null) {
      await createShippingZone(selectedId.value, buildPayload())
      toast.success(t('shop.admin.shipping.created'))
    } else {
      await updateShippingZone(selectedId.value, editingId.value, buildPayload())
      toast.success(t('shop.admin.shipping.updated'))
    }

    formOpen.value = false
    await load()
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 422) {
      fieldErrors.value = caught.fields ?? {}
      toast.error(caught.message)
    } else {
      toast.error(
        caught instanceof ApiError && caught.isNetworkError
          ? t('shop.common.networkError')
          : caught instanceof ApiError
            ? caught.message
            : t('shop.common.error'),
      )
    }
  } finally {
    saving.value = false
  }
}

async function confirmDelete(): Promise<void> {
  const zone = pendingDelete.value
  if (!zone || selectedId.value === '' || deleting.value) return

  deleting.value = true

  try {
    await deleteShippingZone(selectedId.value, zone.id)
    pendingDelete.value = null
    toast.success(t('shop.admin.shipping.deleted'))
    await load()
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error'),
    )
  } finally {
    deleting.value = false
  }
}

watch(selectedId, () => {
  if (!storesLoading.value) void load()
})

onMounted(loadStores)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('shop.admin.shipping.title')" :description="t('shop.admin.shipping.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" :disabled="selectedId === ''" @click="openCreate">
          {{ t('shop.admin.shipping.add') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="!canManage" tone="info">{{ t('shop.admin.readOnly') }}</BaseAlert>

    <MerchantStoreSelector
      v-model="selectedId"
      :stores="stores"
      :loading="storesLoading"
      :hint="t('shop.admin.storeHint')"
    />

    <BaseAlert v-if="storesError" tone="danger" dismissible @dismiss="storesError = null">
      {{ storesError }}
    </BaseAlert>

    <BaseAlert v-else-if="loadError" tone="danger" dismissible @dismiss="loadError = null">
      {{ loadError }}
    </BaseAlert>

    <div v-if="stores.length === 0 && !storesLoading" class="surface">
      <BaseEmptyState :icon="Truck" :title="t('shop.admin.noStores')" :description="t('shop.admin.noStoresBody')">
        <template #action>
          <BaseButton to="/stores" variant="secondary">{{ t('shop.admin.goToStores') }}</BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <div v-else class="surface">
      <BaseTable :columns="columns" :loading="loading || storesLoading" :rows="rows">
        <tr v-for="zone in rows" :key="zone.id">
          <td class="px-4 py-3">
            <p class="font-medium text-ink">{{ zone.name }}</p>
            <p class="text-caption text-muted">{{ t('shop.admin.shipping.zoneId', { id: zone.id }) }}</p>
          </td>
          <td class="px-4 py-3 text-muted">{{ coverage(zone) }}</td>
          <td class="px-4 py-3 text-end tabular-nums text-ink">{{ money(zone.fee) }}</td>
          <td class="px-4 py-3 text-end tabular-nums text-muted">
            {{
              zone.free_shipping_threshold == null
                ? t('shop.admin.shipping.noThreshold')
                : money(zone.free_shipping_threshold)
            }}
          </td>
          <td class="px-4 py-3">
            <BaseBadge :tone="zone.is_active ? 'success' : 'neutral'" dot>
              {{ zone.is_active ? t('shop.admin.shipping.active') : t('shop.admin.shipping.inactive') }}
            </BaseBadge>
          </td>
          <td class="px-4 py-3 text-center tabular-nums text-muted">{{ zone.sort_order }}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-1">
              <button
                v-if="canManage"
                type="button"
                class="btn-icon size-8"
                :aria-label="t('shop.admin.shipping.editZone', { name: zone.name })"
                @click="openEdit(zone)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </button>
              <button
                v-if="canManage"
                type="button"
                class="btn-icon size-8 text-muted hover:text-danger-ink"
                :aria-label="t('shop.admin.shipping.deleteZone', { name: zone.name })"
                @click="pendingDelete = zone"
              >
                <Trash2 class="size-4" aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            :icon="Truck"
            :title="t('shop.admin.shipping.emptyTitle')"
            :description="t('shop.admin.shipping.emptyBody')"
            compact
          >
            <template #action>
              <BaseButton v-if="canManage" variant="secondary" :icon="Plus" @click="openCreate">
                {{ t('shop.admin.shipping.add') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>
      </BaseTable>
    </div>

    <BaseAlert v-if="rows.length === 0 && !loading && selectedId !== ''" tone="info">
      {{ t('shop.admin.shipping.noZonesNote') }}
    </BaseAlert>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('shop.admin.shipping.add') : t('shop.admin.shipping.edit')"
      :description="t('shop.admin.shipping.formHint')"
      size="lg"
      @close="formOpen = false"
    >
      <form class="space-y-4" @submit.prevent="save">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.name"
            :label="t('shop.admin.shipping.name')"
            :error="errorFor('name')"
            required
          />
          <BaseInput
            v-model="form.city"
            :label="t('shop.admin.shipping.city')"
            :hint="t('shop.admin.shipping.cityHint')"
            :error="errorFor('city')"
          />
        </div>

        <BaseTextarea
          v-model="form.areas"
          :label="t('shop.admin.shipping.areas')"
          :hint="t('shop.admin.shipping.areasHint')"
          :error="errorFor('areas')"
          :rows="4"
        />

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model="form.fee"
            type="number"
            min="0"
            step="0.01"
            :label="t('shop.admin.shipping.fee')"
            :hint="t('shop.admin.shipping.feeHint', { currency: currency ?? '' })"
            :error="errorFor('fee')"
            required
          />
          <BaseInput
            v-model="form.free_shipping_threshold"
            type="number"
            min="0"
            step="0.01"
            :label="t('shop.admin.shipping.freeThreshold')"
            :hint="t('shop.admin.shipping.freeThresholdHint')"
            :error="errorFor('free_shipping_threshold')"
          />
          <BaseInput
            v-model="form.sort_order"
            type="number"
            min="0"
            step="1"
            :label="t('shop.admin.shipping.sortOrder')"
            :hint="t('shop.admin.shipping.sortOrderHint')"
            :error="errorFor('sort_order')"
          />
        </div>

        <BaseSwitch
          v-model="form.is_active"
          :label="t('shop.admin.shipping.activeLabel')"
          :hint="t('shop.admin.shipping.activeHint')"
        />

        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <BaseButton variant="secondary" @click="formOpen = false">
            {{ t('action.cancel') }}
          </BaseButton>
          <BaseButton type="submit" :icon="Save" :loading="saving" :disabled="saving">
            {{ t('shop.admin.save') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Delete -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('shop.admin.shipping.deleteTitle')"
      :description="t('shop.admin.shipping.deleteBody', { name: pendingDelete?.name ?? '' })"
      size="sm"
      @close="pendingDelete = null"
    >
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :icon="Trash2" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
