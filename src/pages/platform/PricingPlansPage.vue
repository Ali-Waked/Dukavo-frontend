<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Wallet } from '@/components/icons'
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
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { BILLING_INTERVAL, statusOptions } from '@/constants/statuses'
import {
  createPricingPlan,
  deletePricingPlan,
  fetchPricingPlans,
  updatePricingPlan,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { BillingInterval } from '@/types/enums'
import type { PricingPlan, PricingPlanPayload } from '@/types/marketing'
import { formatCurrency, formatDateTime } from '@/utils/format'

/**
 * Pricing plan administration.
 *
 * The plans published on the public pricing page. A nullable price means
 * "coming soon" rather than free, so the form offers a blank price field
 * instead of a zero. Features and limits are edited as text rather than as a
 * repeatable input: one line per entry matches how operators think about them
 * and what they copy from elsewhere.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<PricingPlan[]>([])
const meta = ref<Paginated<PricingPlan>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const activeFilter = ref('')

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formSlug = ref('')
const formDescription = ref('')
const formPrice = ref('')
const formCurrency = ref('USD')
const formInterval = ref<BillingInterval>('monthly')
const formFeatures = ref('')
const formLimits = ref('')
const formSortOrder = ref('0')
const formHighlighted = ref(false)
const formActive = ref(true)
const nameError = ref<string | null>(null)
const priceError = ref<string | null>(null)
const currencyError = ref<string | null>(null)
const intervalError = ref<string | null>(null)
const featuresError = ref<string | null>(null)
const limitsError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const pendingDelete = ref<PricingPlan | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(() => query.value.trim() !== '' || activeFilter.value !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'interval', label: t('platform.pricing.billingInterval') },
  { key: 'price', label: t('platform.pricing.price') },
  { key: 'active', label: t('common.status'), width: '7rem' },
  { key: 'sort', label: t('platform.pricing.sortOrder') },
  { key: 'updated', label: t('common.updatedAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const intervalChoices = computed(() =>
  statusOptions(BILLING_INTERVAL).map(({ value, meta: m }) => ({ value, label: t(m.key) })),
)

const activeChoices = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'true', label: t('status.product.active') },
  { value: 'false', label: t('status.product.archived') },
])

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

function priceLabel(plan: PricingPlan): string {
  return plan.price === null ? t('platform.pricing.priceComingSoon') : formatCurrency(plan.price, plan.currency)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchPricingPlans({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      active: activeFilter.value === 'true' ? true : activeFilter.value === 'false' ? false : undefined,
    })
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

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch(activeFilter, () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  activeFilter.value = ''
}

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  nameError.value = null
  priceError.value = null
  currencyError.value = null
  intervalError.value = null
  featuresError.value = null
  limitsError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formSlug.value = ''
  formDescription.value = ''
  formPrice.value = ''
  formCurrency.value = 'USD'
  formInterval.value = 'monthly'
  formFeatures.value = ''
  formLimits.value = ''
  formSortOrder.value = '0'
  formHighlighted.value = false
  formActive.value = true
  clearFormErrors()
  formOpen.value = true
}

function openEdit(plan: PricingPlan): void {
  editingId.value = plan.id
  formName.value = plan.name
  formSlug.value = plan.slug
  formDescription.value = plan.description ?? ''
  formPrice.value = plan.price === null ? '' : String(plan.price)
  formCurrency.value = plan.currency
  formInterval.value = plan.billing_interval
  formFeatures.value = (plan.features ?? []).join('\n')
  formLimits.value = Object.entries(plan.limits ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  formSortOrder.value = String(plan.sort_order)
  formHighlighted.value = plan.highlighted
  formActive.value = plan.active
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

/** One feature per line; blank lines and surrounding space are ignored. */
function parseFeatures(): string[] {
  return formFeatures.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** Limits are `key=value` lines; a line without a separator is a typo, not a feature. */
function parseLimits(): Record<string, string> | null {
  const limits: Record<string, string> = {}

  for (const raw of formLimits.value.split('\n')) {
    const line = raw.trim()
    if (line === '') continue

    const separator = line.indexOf('=')
    if (separator === -1) {
      limitsError.value = t('platform.pricing.limitsHint')
      return null
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === '') {
      limitsError.value = t('platform.pricing.limitsHint')
      return null
    }
    limits[key] = value
  }

  return limits
}

function validateForm(): boolean {
  clearFormErrors()

  const limits = parseLimits()
  let valid = limits !== null

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
    valid = false
  }

  const price = formPrice.value.trim()
  if (price !== '' && Number.isNaN(Number(price))) {
    priceError.value = t('validation.number')
    valid = false
  } else if (price !== '' && Number(price) < 0) {
    priceError.value = t('validation.nonNegative')
    valid = false
  }

  const currency = formCurrency.value.trim()
  if (currency.length !== 3) {
    currencyError.value = t('validation.max', { max: 3 })
    valid = false
  }

  return valid
}

function buildPayload(): PricingPlanPayload {
  const price = formPrice.value.trim()

  return {
    name: formName.value.trim(),
    slug: formSlug.value.trim() || null,
    description: formDescription.value.trim() || null,
    price: price === '' ? null : Number(price),
    billing_interval: formInterval.value,
    currency: formCurrency.value.trim().toUpperCase(),
    features: parseFeatures(),
    limits: parseLimits(),
    highlighted: formHighlighted.value,
    active: formActive.value,
    sort_order: Number(formSortOrder.value) || 0,
  }
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const fields = caught.fields
    nameError.value = fields['name']?.[0] ?? null
    priceError.value = fields['price']?.[0] ?? null
    currencyError.value = fields['currency']?.[0] ?? null
    intervalError.value = fields['billing_interval']?.[0] ?? null
    featuresError.value = fields['features']?.[0] ?? null
    limitsError.value = fields['limits']?.[0] ?? null

    const anyField =
      nameError.value !== null ||
      priceError.value !== null ||
      currencyError.value !== null ||
      intervalError.value !== null ||
      featuresError.value !== null ||
      limitsError.value !== null

    if (!anyField) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = errorMessage(caught)
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  try {
    if (editingId.value !== null) {
      await updatePricingPlan(editingId.value, buildPayload())
      toast.success(t('platform.pricing.updated'))
    } else {
      await createPricingPlan(buildPayload())
      toast.success(t('platform.pricing.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(): Promise<void> {
  const plan = pendingDelete.value
  if (!plan) return

  deleting.value = true
  try {
    await deletePricingPlan(plan.id)
    toast.success(t('platform.pricing.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.pricing.title')" :description="t('platform.pricing.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('platform.pricing.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseInput
        v-model="query"
        class="min-w-56 flex-1"
        type="search"
        :label="t('filter.search')"
        :placeholder="t('filter.searchPlaceholder')"
      />
      <BaseSelect v-model="activeFilter" class="w-44" :label="t('common.status')" :options="activeChoices" />
      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="plan in rows" :key="plan.id">
          <td class="px-4 py-3">
            <span class="block font-medium text-ink">
              {{ plan.name }}
              <BaseBadge v-if="plan.highlighted" size="sm" tone="accent">{{ t('pricing.featured') }}</BaseBadge>
            </span>
            <span class="mt-0.5 block font-mono text-caption text-subtle">{{ plan.slug }}</span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge tone="brand" size="sm">{{ t(BILLING_INTERVAL[plan.billing_interval].key) }}</BaseBadge>
          </td>

          <td class="px-4 py-3">
            <span class="font-medium text-ink">{{ priceLabel(plan) }}</span>
            <span v-if="plan.price !== null" class="ms-1 text-caption text-subtle">
              {{ plan.billing_interval === 'one_time' ? t('billing.once') : plan.billing_interval === 'yearly' ? t('billing.perYear') : t('billing.perMonth') }}
            </span>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="plan.active ? 'success' : 'neutral'" dot>
              {{ plan.active ? t('content.live') : t('content.hidden') }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ plan.sort_order }}
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(plan.updated_at ?? plan.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div v-if="canManage" class="flex justify-end">
              <BaseDropdown align="end">
                <template #trigger>
                  <span class="btn-icon" role="button" :aria-label="t('action.moreActions')" :title="t('action.moreActions')">
                    <MoreHorizontal class="size-5" />
                  </span>
                </template>

                <template #default="{ close }">
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(plan)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = plan"
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
            v-if="error && !loading"
            :title="t('state.loadFailed')"
            :description="t('state.loadFailedBody')"
          >
            <template #action>
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('action.retry') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState v-else-if="rows.length === 0 && hasFilters" :title="t('common.noResults')">
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :icon="Wallet"
            :title="t('platform.pricing.emptyTitle')"
            :description="t('platform.pricing.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('platform.pricing.create') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('platform.pricing.create') : t('platform.pricing.edit')"
      size="lg"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formName"
            :label="t('platform.pricing.nameLabel')"
            :error="nameError"
            :placeholder="t('platform.pricing.namePlaceholder')"
            maxlength="120"
            required
          />

          <BaseInput
            v-model="formSlug"
            :label="t('common.slug')"
            :hint="t('common.optional')"
          />
        </div>

        <BaseTextarea
          v-model="formDescription"
          :label="t('platform.pricing.description')"
          :placeholder="t('platform.pricing.descriptionPlaceholder')"
          :rows="2"
          :maxlength="500"
        />

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model="formPrice"
            type="number"
            min="0"
            step="0.01"
            :label="t('platform.pricing.price')"
            :hint="t('platform.pricing.priceHint')"
            :error="priceError"
          />

          <BaseInput
            v-model="formCurrency"
            :label="t('platform.pricing.currency')"
            :error="currencyError"
            maxlength="3"
            required
          />

          <BaseSelect
            v-model="formInterval"
            :label="t('platform.pricing.billingInterval')"
            :options="intervalChoices"
            :error="intervalError"
          />
        </div>

        <BaseTextarea
          v-model="formFeatures"
          :label="t('platform.pricing.features')"
          :hint="t('platform.pricing.featuresHint')"
          :error="featuresError"
          :placeholder="t('platform.pricing.featuresPlaceholder')"
          :rows="5"
        />

        <BaseTextarea
          v-model="formLimits"
          :label="t('platform.pricing.limits')"
          :hint="t('platform.pricing.limitsHint')"
          :error="limitsError"
          :placeholder="t('platform.pricing.limitsPlaceholder')"
          :rows="3"
        />

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model="formSortOrder"
            type="number"
            min="0"
            max="9999"
            :label="t('platform.pricing.sortOrder')"
          />

          <div class="sm:col-span-2">
            <BaseSwitch
              v-model="formHighlighted"
              :label="t('platform.pricing.highlighted')"
              :hint="t('platform.pricing.highlightedHint')"
            />
          </div>
        </div>

        <BaseSwitch
          v-model="formActive"
          :label="t('platform.pricing.active')"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="saving" @click="submitForm">
          {{ editingId === null ? t('action.create') : t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.pricing.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.pricing.deleteBody', { name: pendingDelete?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
