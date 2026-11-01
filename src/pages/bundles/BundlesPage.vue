<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createBundle,
  deleteBundle,
  fetchBundle,
  fetchBundles,
  previewBundle,
  updateBundle,
} from '@/services/bundleService'
import { fetchProducts } from '@/services/productService'
import { fetchStores } from '@/services/storeService'
import type { Paginated } from '@/types/api'
import type {
  Bundle,
  BundleDiscountType,
  BundleItemPayload,
  BundlePreview,
  BundleStatus,
} from '@/types/bundles'
import type { Product, Store } from '@/types/catalogue'
import { formatCurrency } from '@/utils/format'
import { activeCurrency } from '@/utils/currency'
import { statusTone } from '@/utils/status'

/**
 * Merchant-curated bundles.
 *
 * Prices and availability are never calculated here: the form only describes
 * lines, and every total the merchant sees comes from the server's preview.
 * Editing replaces the whole line set, so an empty or duplicate line is a
 * validation problem rather than a silent partial save.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 15

const rows = ref<Bundle[]>([])
const meta = ref<Paginated<Bundle>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const query = ref('')
const status = ref<BundleStatus | ''>('')
const storeFilter = ref<string>('')
const page = ref(1)
const debouncedQuery = useDebounce(query, 300)

const products = ref<Product[]>([])
const stores = ref<Store[]>([])

const canCreate = computed(() => auth.can('products.create'))
const canUpdate = computed(() => auth.can('products.update'))
const canDelete = computed(() => auth.can('products.delete'))
const hasFilters = computed(
  () => query.value !== '' || status.value !== '' || storeFilter.value !== '',
)

const statusOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'draft', label: t('status.bundle.draft') },
  { value: 'active', label: t('status.bundle.active') },
  { value: 'archived', label: t('status.bundle.archived') },
])

const formStatusOptions = computed(() => [
  { value: 'draft', label: t('status.bundle.draft') },
  { value: 'active', label: t('status.bundle.active') },
  { value: 'archived', label: t('status.bundle.archived') },
])

const discountTypeOptions = computed(() => [
  { value: 'percentage', label: t('bundles.discountPercentage') },
  { value: 'fixed', label: t('bundles.discountFixed') },
])

const storeOptions = computed(() => [
  { value: '', label: t('bundles.anyStore') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('bundles.name') },
  { key: 'items', label: t('bundles.items'), align: 'end', width: '7rem' },
  { key: 'discount', label: t('bundles.discount'), align: 'end' },
  { key: 'store', label: t('bundles.store') },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const productOptions = computed(() =>
  products.value.map((product) => ({ value: String(product.id), label: product.name })),
)

function discountLabel(bundle: Bundle): string {
  return bundle.discount_type === 'percentage'
    ? `${bundle.discount_value}%`
    : formatCurrency(bundle.discount_value, bundle.currency)
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.message ? caught.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const result = await fetchBundles({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value || undefined,
      store_id: storeFilter.value ? Number(storeFilter.value) : undefined,
    })
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('error.title'))
  } finally {
    loading.value = false
  }
}

async function loadFormOptions(): Promise<void> {
  try {
    const [active, draft, archived, storesResult] = await Promise.all([
      fetchProducts({ per_page: 100, status: 'active', sort: 'name', desc: false }),
      fetchProducts({ per_page: 100, status: 'draft', sort: 'name', desc: false }),
      fetchProducts({ per_page: 100, status: 'archived', sort: 'name', desc: false }),
      fetchStores(),
    ])

    const seen = new Set<number>()
    products.value = [...active.data, ...draft.data, ...archived.data].filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })
    stores.value = storesResult
  } catch {
    // The list is still usable without form options; opening the editor will
    // simply offer fewer choices rather than breaking the page.
  }
}

function resetFilters(): void {
  query.value = ''
  status.value = ''
  storeFilter.value = ''
  page.value = 1
}

watch([debouncedQuery, status, storeFilter], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

/* ------------------------------------------------------------------ form */

interface FormItem {
  product_id: string
  product_variant_id: string
  quantity: string
}

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)

const form = reactive({
  name: '',
  description: '',
  status: 'draft' as BundleStatus,
  discount_type: 'percentage' as BundleDiscountType,
  discount_value: '0',
  currency: '',
  store_id: '',
  items: [] as FormItem[],
})

function blankItem(): FormItem {
  return { product_id: '', product_variant_id: '', quantity: '1' }
}

function resetForm(): void {
  form.name = ''
  form.description = ''
  form.status = 'draft'
  form.discount_type = 'percentage'
  form.discount_value = '0'
  form.currency = ''
  form.store_id = ''
  form.items = [blankItem(), blankItem()]
  fieldErrors.value = {}
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  resetForm()
  formOpen.value = true
}

async function openEdit(bundle: Bundle): Promise<void> {
  editingId.value = bundle.id
  resetForm()
  formOpen.value = true

  try {
    const full = await fetchBundle(bundle.id)
    form.name = full.name
    form.description = full.description ?? ''
    form.status = full.status
    form.discount_type = full.discount_type
    form.discount_value = String(full.discount_value)
    form.currency = full.currency
    form.store_id = full.store_id === null ? '' : String(full.store_id)
    form.items = (full.items ?? []).map((item) => ({
      product_id: String(item.product_id),
      product_variant_id: String(item.product_variant_id),
      quantity: String(item.quantity),
    }))

    if (form.items.length < 2) {
      form.items.push(blankItem())
    }
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
    formOpen.value = false
  }
}

function selectedProduct(productId: string): Product | undefined {
  return products.value.find((product) => String(product.id) === productId)
}

function variantOptions(item: FormItem): Array<{ value: string; label: string }> {
  const product = selectedProduct(item.product_id)
  return (product?.variants ?? []).map((variant) => ({
    value: String(variant.id),
    label: `${variant.name} · ${formatCurrency(variant.price, product?.currency ?? activeCurrency())}`,
  }))
}

function onProductChange(item: FormItem, value: string | number): void {
  item.product_id = String(value)
  const product = selectedProduct(item.product_id)
  const variant = product?.variants?.find((candidate) => candidate.is_default) ?? product?.variants?.[0]
  item.product_variant_id = variant ? String(variant.id) : ''
}

function addItem(): void {
  form.items.push(blankItem())
}

function removeItem(index: number): void {
  if (form.items.length <= 2) return
  form.items.splice(index, 1)
}

function localValidation(): boolean {
  fieldErrors.value = {}

  if (form.name.trim() === '') {
    fieldErrors.value.name = t('validation.required')
    return false
  }

  const variants = new Set<string>()
  for (const [index, item] of form.items.entries()) {
    if (!item.product_id) {
      fieldErrors.value[`items.${index}.product_id`] = t('validation.required')
    }
    if (!item.product_variant_id) {
      fieldErrors.value[`items.${index}.product_variant_id`] = t('validation.required')
    }
    if (item.product_variant_id) {
      if (variants.has(item.product_variant_id)) {
        fieldErrors.value[`items.${index}.product_variant_id`] = t('bundles.duplicateVariant')
      }
      variants.add(item.product_variant_id)
    }
  }

  if (form.items.filter((item) => item.product_variant_id).length < 2) {
    fieldErrors.value.items = t('bundles.needsTwo')
  }

  return Object.keys(fieldErrors.value).length === 0
}

async function save(): Promise<void> {
  if (!localValidation()) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  const items: BundleItemPayload[] = form.items.map((item) => ({
    product_id: Number(item.product_id),
    product_variant_id: Number(item.product_variant_id),
    quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1),
  }))

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    status: form.status,
    discount_type: form.discount_type,
    discount_value: Number.parseFloat(form.discount_value) || 0,
    currency: form.currency ? form.currency.toUpperCase() : undefined,
    store_id: form.store_id ? Number(form.store_id) : null,
    items,
  }

  try {
    if (editingId.value === null) {
      await createBundle(payload)
      toast.success(t('bundles.created'))
    } else {
      await updateBundle(editingId.value, payload)
      toast.success(t('bundles.updated'))
    }

    formOpen.value = false
    await load()
  } catch (caught) {
    if (caught instanceof ApiError && caught.isValidation && caught.fields) {
      const flat: Record<string, string> = {}
      for (const [key, messages] of Object.entries(caught.fields)) {
        if (messages[0]) flat[key] = messages[0]
      }
      fieldErrors.value = flat
    } else {
      formError.value = errorMessage(caught, t('error.title'))
    }
  } finally {
    saving.value = false
  }
}

/* --------------------------------------------------------------- preview */

const previewOpen = ref(false)
const previewing = ref<Bundle | null>(null)
const preview = ref<BundlePreview | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)
const previewStoreId = ref('')

async function loadPreview(): Promise<void> {
  const bundle = previewing.value
  if (!bundle) return

  previewLoading.value = true
  previewError.value = null

  try {
    preview.value = await previewBundle(bundle.id, {
      store_id: previewStoreId.value ? Number(previewStoreId.value) : undefined,
    })
  } catch (caught) {
    preview.value = null
    previewError.value = errorMessage(caught, t('error.title'))
  } finally {
    previewLoading.value = false
  }
}

function openPreview(bundle: Bundle): void {
  previewing.value = bundle
  preview.value = null
  previewError.value = null
  previewStoreId.value = bundle.store_id === null ? '' : String(bundle.store_id)
  previewOpen.value = true
  void loadPreview()
}

watch(previewStoreId, () => {
  if (previewOpen.value) void loadPreview()
})

/* ---------------------------------------------------------------- delete */

const pendingDelete = ref<Bundle | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  const bundle = pendingDelete.value
  if (!bundle) return

  deleting.value = true
  try {
    await deleteBundle(bundle.id)
    toast.success(t('bundles.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void load()
  void loadFormOptions()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('bundles.title')" :description="t('bundles.subtitle')">
      <template v-if="canCreate" #actions>
        <BaseButton :icon="Plus" @click="openCreate">{{ t('bundles.new') }}</BaseButton>
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-end gap-3">
      <BaseInput
        v-model="query"
        type="search"
        class="w-full sm:w-72"
        :label="t('action.search')"
        :placeholder="t('bundles.searchPlaceholder')"
      />

      <BaseSelect v-model="status" class="w-40" :label="t('common.status')" :options="statusOptions" />

      <BaseSelect
        v-model="storeFilter"
        class="w-48"
        :label="t('bundles.store')"
        :options="storeOptions"
      />

      <BaseButton v-if="hasFilters" variant="ghost" @click="resetFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <BaseAlert v-if="error" tone="danger">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" @click="load">{{ t('action.retry') }}</BaseButton>
      </div>
    </BaseAlert>

    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="bundle in rows" :key="bundle.id">
          <td class="px-4 py-3">
            <p class="font-medium text-ink">{{ bundle.name }}</p>
            <p v-if="bundle.description" class="mt-0.5 line-clamp-1 text-caption text-subtle">
              {{ bundle.description }}
            </p>
          </td>

          <td class="px-4 py-3 text-end tabular-nums text-ink">
            {{ bundle.item_count ?? bundle.items?.length ?? 0 }}
          </td>

          <td class="px-4 py-3 text-end font-medium tabular-nums text-ink">
            {{ discountLabel(bundle) }}
          </td>

          <td class="px-4 py-3 text-muted">
            {{ bundle.store?.name ?? t('bundles.anyStore') }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="statusTone(bundle.status)" dot>{{ bundle.status_label }}</BaseBadge>
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
                    @click="close(); openPreview(bundle)"
                  >
                    <Eye class="size-4 text-muted" />
                    {{ t('bundles.preview') }}
                  </button>

                  <button
                    v-if="canUpdate"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(bundle)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    v-if="canDelete"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = bundle"
                  >
                    <Trash2 class="size-4" />
                    {{ t('action.delete') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="rows.length === 0 && hasFilters"
            :icon="Package"
            :title="t('bundles.emptySearchTitle')"
            :description="t('bundles.emptySearchBody')"
          >
            <template #action>
              <BaseButton variant="secondary" @click="resetFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :icon="Sparkles"
            :title="t('bundles.emptyTitle')"
            :description="t('bundles.emptyBody')"
          >
            <template v-if="canCreate" #action>
              <BaseButton :icon="Plus" @click="openCreate">{{ t('bundles.new') }}</BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Editor -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('bundles.createTitle') : t('bundles.editTitle')"
      size="xl"
      @close="formOpen = false"
    >
      <form class="space-y-5" @submit.prevent="save">
        <BaseAlert v-if="formError" tone="danger">{{ formError }}</BaseAlert>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.name"
            :label="t('bundles.name')"
            required
            :error="fieldErrors.name"
          />

          <BaseSelect
            v-model="form.status"
            :label="t('common.status')"
            :options="formStatusOptions"
            :error="fieldErrors.status"
          />

          <BaseSelect
            v-model="form.store_id"
            :label="t('bundles.store')"
            :options="storeOptions"
            :hint="t('bundles.storeHint')"
            :error="fieldErrors.store_id"
          />

          <BaseInput
            v-model="form.currency"
            :label="t('bundles.currency')"
            :hint="t('bundles.currencyHint')"
            maxlength="3"
            :error="fieldErrors.currency"
          />

          <BaseSelect
            v-model="form.discount_type"
            :label="t('bundles.discountType')"
            :options="discountTypeOptions"
            :error="fieldErrors.discount_type"
          />

          <BaseInput
            v-model="form.discount_value"
            type="number"
            min="0"
            step="0.01"
            :label="t('bundles.discountValue')"
            :error="fieldErrors.discount_value"
          />
        </div>

        <BaseTextarea
          v-model="form.description"
          :label="t('common.description')"
          :rows="3"
          :error="fieldErrors.description"
        />

        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-h4 font-semibold text-ink">{{ t('bundles.items') }}</h3>
              <p class="text-small text-muted">{{ t('bundles.itemsHint') }}</p>
            </div>
            <BaseButton size="sm" variant="secondary" :icon="Plus" @click="addItem">
              {{ t('bundles.addItem') }}
            </BaseButton>
          </div>

          <BaseAlert v-if="fieldErrors.items" tone="danger">{{ fieldErrors.items }}</BaseAlert>

          <div
            v-for="(item, index) in form.items"
            :key="index"
            class="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem_2.5rem]"
          >
            <BaseSelect
              v-model="item.product_id"
              :label="t('bundles.product')"
              :options="productOptions"
              :placeholder="t('bundles.chooseProduct')"
              :error="fieldErrors[`items.${index}.product_id`]"
              @update:model-value="onProductChange(item, $event)"
            />

            <BaseSelect
              v-model="item.product_variant_id"
              :label="t('bundles.variant')"
              :options="variantOptions(item)"
              :placeholder="t('bundles.chooseVariant')"
              :disabled="!item.product_id"
              :error="fieldErrors[`items.${index}.product_variant_id`]"
            />

            <BaseInput
              v-model="item.quantity"
              type="number"
              min="1"
              max="999"
              :label="t('bundles.quantity')"
              :error="fieldErrors[`items.${index}.quantity`]"
            />

            <div class="flex items-end pb-0.5">
              <button
                type="button"
                class="btn-icon text-danger-ink"
                :aria-label="t('bundles.removeItem')"
                :disabled="form.items.length <= 2"
                :class="{ 'pointer-events-none opacity-40': form.items.length <= 2 }"
                @click="removeItem(index)"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">{{ t('action.cancel') }}</BaseButton>
        <BaseButton :loading="saving" @click="save">
          {{ editingId === null ? t('action.create') : t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Preview -->
    <BaseModal
      :open="previewOpen"
      :title="t('bundles.previewTitle')"
      size="lg"
      @close="previewOpen = false"
    >
      <div class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <p class="text-sm text-muted">
            {{ previewing?.name }}
            <span class="text-subtle">· {{ t('bundles.previewHint') }}</span>
          </p>
          <BaseSelect
            v-model="previewStoreId"
            class="w-52"
            :label="t('bundles.store')"
            :options="storeOptions"
          />
        </div>

        <div v-if="previewLoading" class="space-y-2">
          <div v-for="index in 3" :key="index" class="h-12 animate-pulse rounded-lg bg-surface-2" />
        </div>

        <BaseAlert v-else-if="previewError" tone="danger">{{ previewError }}</BaseAlert>

        <template v-else-if="preview">
          <BaseAlert v-if="preview.issues.length > 0" tone="warning">
            <p class="font-medium">{{ t('bundles.issuesTitle') }}</p>
            <ul class="mt-1 list-inside list-disc text-small">
              <li v-for="issue in preview.issues" :key="`${issue.code}-${issue.product_id}`">
                {{ issue.message }}
              </li>
            </ul>
          </BaseAlert>

          <div class="rounded-lg border border-line">
            <ul class="divide-y divide-line">
              <li
                v-for="line in preview.items"
                :key="`${line.product_id}-${line.product_variant_id}`"
                class="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink">{{ line.name }}</p>
                  <p class="text-small text-muted">
                    {{ line.quantity }} × {{ formatCurrency(line.unit_price, preview.currency) }}
                    <span v-if="!line.is_available" class="text-danger-ink">
                      · {{ t('bundles.unavailable') }}
                    </span>
                  </p>
                </div>
                <span class="shrink-0 text-sm font-medium tabular-nums text-ink">
                  {{ formatCurrency(line.line_subtotal, preview.currency) }}
                </span>
              </li>
            </ul>

            <dl class="space-y-1.5 border-t border-line bg-surface-2 px-3 py-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('bundles.subtotal') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(preview.subtotal, preview.currency) }}
                </dd>
              </div>
              <div v-if="preview.discount > 0" class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('bundles.discount') }}</dt>
                <dd class="tabular-nums text-ink">
                  −{{ formatCurrency(preview.discount, preview.currency) }}
                </dd>
              </div>
              <div class="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                <dt class="text-ink">{{ t('bundles.total') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(preview.total, preview.currency) }}
                </dd>
              </div>
            </dl>
          </div>

          <p class="text-small text-muted">
            {{ preview.store?.name ?? t('bundles.noStore') }} ·
            <BaseBadge :tone="preview.is_available ? 'success' : 'warning'" size="sm">
              {{ preview.is_available ? t('bundles.available') : t('bundles.unavailable') }}
            </BaseBadge>
          </p>
        </template>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="previewOpen = false">
          {{ t('action.close') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('bundles.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('bundles.deleteBody', { name: pendingDelete?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" :icon="Trash2" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
