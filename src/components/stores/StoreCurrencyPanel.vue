<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock, RefreshCw } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { currencyMeta } from '@/utils/currency'
import {
  convertStoreCurrency,
  fetchCurrencyOptions,
  fetchStoreCurrency,
  newIdempotencyKey,
  previewStoreCurrency,
  type CurrencyConversionReceipt,
  type CurrencyOption,
  type CurrencyPreview,
} from '@/services/currencyService'
import type { Store } from '@/types/catalogue'

/**
 * Base-currency settings for one store.
 *
 * The flow is deliberately two-step: the merchant previews the server-fetched
 * rate and the affected rows, then confirms in a separate dialog. Nothing here
 * changes a price on its own, and the idempotency key is created when the
 * confirmation opens so a retried request cannot convert twice.
 */
const props = defineProps<{ store: Store }>()
const emit = defineEmits<{ converted: [] }>()

const { t } = useI18n()
const toast = useToast()

const options = ref<CurrencyOption[]>([])
const history = ref<CurrencyConversionReceipt[]>([])
const loading = ref(false)
const target = ref('')
const preview = ref<CurrencyPreview | null>(null)
const previewing = ref(false)
const converting = ref(false)
const confirmOpen = ref(false)
const idempotencyKey = ref('')
const error = ref<string | null>(null)

const current = computed(() => currencyMeta(props.store.currency))

const targetOptions = computed(() =>
  options.value
    .filter((option) => option.code !== props.store.currency)
    .map((option) => ({
      value: option.code,
      label: `${option.code} — ${option.name} (${option.symbol})`,
    })),
)

const canConvert = computed(() => preview.value !== null && !preview.value.noop)

const STATUS_TONE = {
  completed: 'success',
  processing: 'warning',
  failed: 'danger',
} as const

function statusLabel(status: CurrencyConversionReceipt['status']): string {
  return t(`currency.status.${status}`)
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('currency.failed')
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [catalogue, state] = await Promise.all([
      fetchCurrencyOptions(),
      fetchStoreCurrency(props.store.id),
    ])
    options.value = catalogue.currencies
    history.value = state.history
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

function reset(): void {
  target.value = ''
  preview.value = null
  error.value = null
}

async function loadPreview(): Promise<void> {
  if (!target.value) return

  previewing.value = true
  error.value = null
  try {
    preview.value = await previewStoreCurrency(props.store.id, target.value)
  } catch (caught) {
    preview.value = null
    error.value = errorMessage(caught)
  } finally {
    previewing.value = false
  }
}

function openConfirm(): void {
  if (!canConvert.value) return
  idempotencyKey.value = newIdempotencyKey()
  confirmOpen.value = true
}

async function confirmConversion(): Promise<void> {
  const next = preview.value
  if (!next) return

  converting.value = true
  error.value = null
  try {
    await convertStoreCurrency(props.store.id, {
      currency: next.to_currency,
      idempotency_key: idempotencyKey.value,
      confirm: true,
    })
    toast.success(t('currency.converted'))
    confirmOpen.value = false
    reset()
    await load()
    emit('converted')
  } catch (caught) {
    error.value = errorMessage(caught)
    confirmOpen.value = false
  } finally {
    converting.value = false
  }
}

watch(
  () => props.store.currency,
  () => reset(),
)

onMounted(load)
</script>

<template>
  <section class="surface space-y-5 p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <CircleDollarSign class="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 class="text-base font-semibold text-ink">{{ t('currency.title') }}</h2>
          <p class="mt-1 max-w-2xl text-sm text-muted">{{ t('currency.subtitle') }}</p>
        </div>
      </div>

      <div class="text-end">
        <p class="text-caption uppercase tracking-wide text-subtle">{{ t('currency.current') }}</p>
        <p class="mt-0.5 text-lg font-semibold text-ink">
          <span class="me-1">{{ current.symbol }}</span>{{ current.code }}
        </p>
        <p class="text-caption text-muted">
          {{ current.name }} · {{ t('currency.decimals', { count: current.decimals }) }}
        </p>
        <p class="mt-1 flex items-center justify-end gap-1 text-caption text-subtle">
          <Clock class="size-3.5" aria-hidden="true" />
          <span v-if="store.currency_updated_at">
            {{ t('currency.lastChanged') }}: {{ formatDateTime(store.currency_updated_at) }}
          </span>
          <span v-else>{{ t('currency.neverChanged') }}</span>
        </p>
      </div>
    </div>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <div class="grid gap-4 border-t border-line pt-5 lg:grid-cols-[minmax(0,18rem)_1fr]">
      <div class="space-y-3">
        <BaseSelect
          v-model="target"
          :label="t('currency.target')"
          :placeholder="t('currency.selectPlaceholder')"
          :options="targetOptions"
          :disabled="loading || previewing || converting"
        />
        <BaseButton
          variant="secondary"
          :icon="RefreshCw"
          :loading="previewing"
          :disabled="!target || previewing || converting"
          @click="loadPreview"
        >
          {{ t('currency.preview') }}
        </BaseButton>
      </div>

      <div v-if="preview" class="rounded-lg border border-line bg-surface-2 p-4">
        <BaseAlert v-if="preview.noop" tone="info">
          {{ t('currency.noop') }}
        </BaseAlert>

        <template v-else>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-caption uppercase tracking-wide text-subtle">{{ t('currency.rate') }}</dt>
              <dd class="mt-0.5 text-lg font-semibold text-ink">
                1 {{ preview.from_currency }} = {{ preview.rate }} {{ preview.to_currency }}
              </dd>
            </div>
            <div>
              <dt class="text-caption uppercase tracking-wide text-subtle">{{ t('currency.rateSource') }}</dt>
              <dd class="mt-0.5 text-sm text-ink">{{ preview.rate_source }}</dd>
              <dd class="text-caption text-muted">{{ formatDateTime(preview.rate_fetched_at) }}</dd>
            </div>
          </dl>

          <p class="mt-3 text-sm text-muted">
            {{
              t('currency.affected', {
                products: preview.products,
                variants: preview.variants,
                bundles: preview.bundles,
              })
            }}
          </p>

          <div v-if="preview.sample.length > 0" class="mt-4 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-start text-caption uppercase tracking-wide text-subtle">
                  <th class="pb-2 text-start font-medium">{{ t('currency.product') }}</th>
                  <th class="pb-2 text-end font-medium">{{ t('currency.price') }}</th>
                  <th class="pb-2 text-end font-medium">{{ t('currency.cost') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                <tr v-for="row in preview.sample" :key="row.id">
                  <td class="py-2 text-ink">{{ row.name }}</td>
                  <td class="py-2 text-end tabular-nums text-muted">
                    {{ formatCurrency(row.price_before, preview.from_currency) }}
                    <span class="mx-1 text-subtle">→</span>
                    <span class="font-medium text-ink">{{ formatCurrency(row.price_after, preview.to_currency) }}</span>
                  </td>
                  <td class="py-2 text-end tabular-nums text-muted">
                    {{ formatCurrency(row.cost_before, preview.from_currency) }}
                    <span class="mx-1 text-subtle">→</span>
                    <span class="font-medium text-ink">{{ formatCurrency(row.cost_after, preview.to_currency) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="flex items-center gap-1.5 text-caption text-warning-ink">
              <AlertTriangle class="size-4" aria-hidden="true" />
              {{ t('currency.irreversible') }}
            </p>
            <BaseButton :disabled="!canConvert" @click="openConfirm">
              {{ t('currency.change') }}
            </BaseButton>
          </div>
        </template>
      </div>
    </div>

    <div v-if="history.length > 0" class="border-t border-line pt-4">
      <h3 class="text-sm font-semibold text-ink">{{ t('currency.history') }}</h3>
      <ul class="mt-2 divide-y divide-line">
        <li
          v-for="entry in history"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
        >
          <span class="flex items-center gap-2 text-ink">
            <CheckCircle2 v-if="entry.status === 'completed'" class="size-4 text-success" aria-hidden="true" />
            <Clock v-else class="size-4 text-warning" aria-hidden="true" />
            {{ entry.from_currency }} → {{ entry.to_currency }}
            <span class="text-caption text-muted">@ {{ entry.exchange_rate }}</span>
          </span>
          <span class="flex items-center gap-2 text-caption text-muted">
            <span>{{ formatDateTime(entry.completed_at ?? entry.created_at) }}</span>
            <BaseBadge :tone="STATUS_TONE[entry.status]" size="sm">
              {{ statusLabel(entry.status) }}
            </BaseBadge>
          </span>
        </li>
      </ul>
    </div>

    <BaseModal
      :open="confirmOpen"
      :title="t('currency.confirmTitle', { currency: preview?.to_currency ?? '' })"
      size="md"
      :persistent="converting"
      @close="confirmOpen = false"
    >
      <p class="text-sm text-muted">{{ t('currency.confirmBody') }}</p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="converting" @click="confirmOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="converting" @click="confirmConversion">
          {{ t('currency.confirmAction') }}
        </BaseButton>
      </template>
    </BaseModal>
  </section>
</template>
