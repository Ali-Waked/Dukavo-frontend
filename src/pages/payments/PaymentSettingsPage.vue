<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Banknote, CheckCircle2, CreditCard, RefreshCw, Save, Wallet, XCircle } from '@/components/icons'
import MerchantStoreSelector from '@/components/storefront/MerchantStoreSelector.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useMerchantStore } from '@/composables/useMerchantStore'
import { ApiError } from '@/lib/axiosClient'
import { fetchStorePayments, updateStorePayments } from '@/services/storefrontService'
import type { StorePaymentResponse } from '@/types/storefront'

/**
 * Payment methods a store may offer.
 *
 * Cash on delivery is the only method that is genuinely fulfilled today, so it
 * is the only one exposed as a setting. Online payment is listed as a fact —
 * unavailable with the server's reason — rather than as a switch that would
 * imply a checkout that does not exist.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const {
  stores,
  selectedId,
  loading: storesLoading,
  error: storesError,
  load: loadStores,
} = useMerchantStore()

const canManage = computed(() => auth.can('payments.manage'))

const resource = ref<StorePaymentResponse | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

const form = reactive({
  cod_enabled: true,
  cod_instructions: '',
})

let requestId = 0

const methods = computed(() => resource.value?.methods ?? [])

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function errorFor(key: string): string | null {
  return fieldErrors.value[key]?.[0] ?? null
}

function apply(next: StorePaymentResponse): void {
  resource.value = next
  form.cod_enabled = next.settings.cod_enabled
  form.cod_instructions = next.settings.cod_instructions ?? ''
}

async function load(): Promise<void> {
  if (selectedId.value === '') {
    resource.value = null
    return
  }

  const id = ++requestId
  loading.value = true
  loadError.value = null
  fieldErrors.value = {}

  try {
    const result = await fetchStorePayments(selectedId.value)
    if (id !== requestId) return
    apply(result)
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

async function save(): Promise<void> {
  if (!canManage.value || selectedId.value === '' || saving.value) return

  saving.value = true
  fieldErrors.value = {}

  try {
    const result = await updateStorePayments(selectedId.value, {
      cod_enabled: form.cod_enabled,
      cod_instructions: nullable(form.cod_instructions),
    })
    apply(result)
    toast.success(t('shop.admin.saved'))
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

watch(selectedId, () => {
  if (!storesLoading.value) void load()
})

onMounted(loadStores)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('shop.admin.payments.title')" :description="t('shop.admin.payments.subtitle')">
      <template #actions>
        <BaseButton
          v-if="canManage && resource"
          :icon="Save"
          :loading="saving"
          :disabled="saving"
          @click="save"
        >
          {{ t('shop.admin.save') }}
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

    <div v-if="storesLoading" class="space-y-4">
      <BaseSkeleton block height="h-20" />
      <BaseSkeleton block height="h-64" />
    </div>

    <BaseAlert v-else-if="stores.length === 0" tone="warning">
      {{ t('shop.admin.noStoresBody') }}
      <BaseButton to="/stores" variant="link" size="sm" class="px-0">
        {{ t('shop.admin.goToStores') }}
      </BaseButton>
    </BaseAlert>

    <div v-else-if="loading" class="space-y-4">
      <BaseSkeleton block height="h-64" />
    </div>

    <div v-else-if="loadError" class="surface">
      <BaseEmptyState :icon="Wallet" :title="t('shop.common.error')" :description="loadError">
        <template #action>
          <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
            {{ t('shop.common.retry') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <template v-else-if="resource">
      <BaseAlert tone="info">{{ t('shop.admin.payments.honestyNote') }}</BaseAlert>

      <!-- COD -->
      <section class="surface space-y-4 p-5">
        <div class="flex items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <Banknote class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.payments.codTitle') }}</h2>
            <p class="mt-0.5 text-sm text-muted">{{ t('shop.admin.payments.codBody') }}</p>
          </div>
        </div>

        <BaseSwitch
          v-model="form.cod_enabled"
          :label="t('shop.admin.payments.codEnabled')"
          :hint="t('shop.admin.payments.codEnabledHint')"
          :disabled="!canManage || saving"
        />

        <BaseTextarea
          v-model="form.cod_instructions"
          :label="t('shop.admin.payments.codInstructions')"
          :hint="t('shop.admin.payments.codInstructionsHint')"
          :error="errorFor('cod_instructions')"
          :rows="4"
          :disabled="!canManage || saving"
        />

        <p class="text-caption text-subtle">{{ t('shop.admin.payments.codUnpaid') }}</p>
      </section>

      <!-- What the shop currently offers -->
      <section class="surface space-y-4 p-5">
        <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.payments.methodsTitle') }}</h2>
        <ul class="divide-y divide-line rounded-lg border border-line">
          <li
            v-for="method in methods"
            :key="method.code"
            class="flex items-start gap-3 p-4"
          >
            <span
              class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg"
              :class="method.available ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-subtle'"
            >
              <CreditCard v-if="method.code === 'online'" class="size-4" aria-hidden="true" />
              <Banknote v-else class="size-4" aria-hidden="true" />
            </span>

            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                {{ method.label }}
                <span
                  class="inline-flex items-center gap-1 text-caption font-medium"
                  :class="method.available ? 'text-success-ink' : 'text-muted'"
                >
                  <CheckCircle2 v-if="method.available" class="size-3.5" aria-hidden="true" />
                  <XCircle v-else class="size-3.5" aria-hidden="true" />
                  {{
                    method.available
                      ? t('shop.admin.payments.available')
                      : t('shop.admin.payments.unavailable')
                  }}
                </span>
              </p>
              <p class="mt-0.5 text-small text-muted">{{ method.description }}</p>
              <p v-if="!method.available && method.unavailable_reason" class="mt-1 text-caption text-muted">
                {{ method.unavailable_reason }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <div v-if="canManage" class="flex justify-end">
        <BaseButton :icon="Save" :loading="saving" :disabled="saving" @click="save">
          {{ t('shop.admin.save') }}
        </BaseButton>
      </div>
    </template>
  </div>
</template>
