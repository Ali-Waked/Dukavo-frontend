<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShoppingCart,
  Sparkles,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import {
  applyVoiceMessage,
  fetchVoiceMessage,
  retryVoiceMessage,
} from '@/services/conversationService'
import type { Cart } from '@/types/cart'
import type {
  VoiceApplyItem,
  VoiceDraftItem,
  VoiceMessage,
  VoiceMessageStatus,
} from '@/types/voice'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { activeCurrency } from '@/utils/currency'

/**
 * The human review step for an inbound voice note.
 *
 * The server transcribes and grounds the draft asynchronously. This panel waits
 * for that work, shows exactly what was verified and what was not, and is the
 * only place the draft can reach the Smart Cart. Applying still creates a cart,
 * never an order, and only runs after an explicit confirmation.
 */

const props = withDefaults(
  defineProps<{
    voice: VoiceMessage
    canUseAi?: boolean
    canCreateOrder?: boolean
  }>(),
  {
    canUseAi: false,
    canCreateOrder: false,
  },
)

const emit = defineEmits<{
  updated: [voice: VoiceMessage]
  applied: [cart: Cart]
  openOrderBuilder: []
}>()

const { t, tDynamic } = useI18n()

const current = ref<VoiceMessage>(props.voice)
const refreshing = ref(false)
const retrying = ref(false)
const applying = ref(false)
const confirmed = ref(false)
const error = ref<string | null>(null)
const quantities = ref<Record<string, string>>({})

let pollTimer: ReturnType<typeof setTimeout> | null = null
let unmounted = false

type ResolvedVoiceItem = VoiceDraftItem & {
  resolved: true
  product_id: number
  variant_id: number
}

interface ReviewLine {
  key: string
  item: ResolvedVoiceItem
  quantity: number
  shortage: boolean
}

const terminalStatuses: VoiceMessageStatus[] = ['ready', 'applied', 'failed']

const isTerminal = computed(() => terminalStatuses.includes(current.value.status))
const extraction = computed(() => current.value.extraction)
const isProcessing = computed(() =>
  ['queued', 'transcribing', 'extracting'].includes(current.value.status),
)

const transcript = computed(() => {
  const own = current.value.transcript?.trim()
  if (own) return own
  return extraction.value?.transcript?.trim() ?? ''
})

const detectedLanguage = computed(
  () =>
    current.value.language ??
    extraction.value?.detected_language ??
    null,
)

const resolvedItems = computed<ResolvedVoiceItem[]>(() =>
  (extraction.value?.items ?? []).filter(isResolvedItem),
)

const unresolvedItems = computed(() => extraction.value?.unresolved ?? [])
const missingInformation = computed(() => extraction.value?.missing_information ?? [])

const lines = computed<ReviewLine[]>(() =>
  resolvedItems.value.map((item) => {
    const key = lineKey(item)
    const quantity = quantityFor(item)

    return {
      key,
      item,
      quantity,
      shortage:
        item.available !== null &&
        quantity > 0 &&
        quantity > item.available,
    }
  }),
)

const warningItems = computed(() => {
  const codes = extraction.value?.warning_codes ?? []
  const warnings = extraction.value?.warnings ?? []

  if (codes.length === warnings.length) {
    return codes.map((code) => ({
      key: code,
      text: tDynamic('voice.warning', code),
    }))
  }

  return warnings.map((text, index) => ({ key: `warning-${index}`, text }))
})

const hasInvalidQuantity = computed(() =>
  lines.value.some((line) => line.quantity < 1),
)

const hasShortage = computed(() => lines.value.some((line) => line.shortage))

const canApplyPermissions = computed(
  () => props.canUseAi && props.canCreateOrder,
)

const reviewedItems = computed<VoiceApplyItem[]>(() =>
  lines.value.map((line) => ({
    product_id: line.item.product_id,
    product_variant_id: line.item.variant_id,
    quantity: line.quantity,
  })),
)

const canApply = computed(
  () =>
    current.value.status === 'ready' &&
    current.value.capabilities.apply &&
    canApplyPermissions.value &&
    confirmed.value &&
    reviewedItems.value.length > 0 &&
    !hasInvalidQuantity.value &&
    !hasShortage.value &&
    !applying.value,
)

const statusLabel = computed(() =>
  tDynamic('voice.status', current.value.status),
)

watch(
  () => extraction.value?.items,
  (items) => {
    const next: Record<string, string> = {}

    for (const item of items ?? []) {
      if (!isResolvedItem(item)) continue

      const key = lineKey(item)
      next[key] = quantities.value[key] ?? String(item.quantity ?? 1)
    }

    quantities.value = next
  },
  { immediate: true },
)

function isResolvedItem(item: VoiceDraftItem): item is ResolvedVoiceItem {
  return (
    item.resolved &&
    item.product_id !== null &&
    item.variant_id !== null
  )
}

function lineKey(item: VoiceDraftItem): string {
  return `${item.product_id ?? 'product'}:${item.variant_id ?? 'variant'}`
}

function quantityFor(item: VoiceDraftItem): number {
  const raw = quantities.value[lineKey(item)] ?? item.quantity ?? 1
  const value = Number(raw)

  if (!Number.isFinite(value)) return 0

  return Math.min(1000, Math.max(0, Math.trunc(value)))
}

function setQuantity(key: string, value: string): void {
  quantities.value = { ...quantities.value, [key]: value }
}

function statusTone(status: VoiceMessageStatus): BadgeTone {
  switch (status) {
    case 'applied':
      return 'success'
    case 'ready':
      return 'warning'
    case 'failed':
      return 'danger'
    default:
      return 'info'
  }
}

function lineCurrency(item: VoiceDraftItem): string {
  return item.currency ?? extraction.value?.currency ?? activeCurrency()
}

function lineTotal(line: ReviewLine): number {
  return (line.item.unit_price ?? 0) * line.quantity
}

function confidenceLabel(): string {
  const value = current.value.confidence ?? extraction.value?.confidence ?? null
  if (value === null) return ''

  return t('voice.confidence', { value: Math.round(value * 100) })
}

function unresolvedLabel(item: VoiceDraftItem): string {
  return tDynamic('voice.unresolved', item.reason ?? 'unknown')
}

function voiceError(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.isNetworkError) return t('auth.networkError')
    if (caught.status === 429 || caught.code === 'ai_rate_limited') return t('ai.limited')
    if (caught.code === 'ai_feature_disabled') return t('ai.disabled')
    if (caught.status === 502 || caught.status === 503) return t('ai.unavailable')
    if (caught.message) return caught.message
  }

  return t('voice.actionFailed')
}

function clearPoll(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function schedulePoll(): void {
  clearPoll()

  if (unmounted || isTerminal.value) return

  pollTimer = setTimeout(() => void refresh(true), 5000)
}

async function refresh(silent = false): Promise<void> {
  if (refreshing.value) return

  refreshing.value = true

  try {
    const next = await fetchVoiceMessage(
      current.value.conversation_id,
      current.value.id,
    )

    if (unmounted) return

    current.value = next
    emit('updated', next)
    if (!silent) error.value = null
  } catch (caught) {
    if (!silent) error.value = voiceError(caught)
  } finally {
    refreshing.value = false
    if (!unmounted) schedulePoll()
  }
}

async function retry(): Promise<void> {
  if (retrying.value) return

  retrying.value = true
  error.value = null
  confirmed.value = false

  try {
    const next = await retryVoiceMessage(
      current.value.conversation_id,
      current.value.id,
    )

    if (unmounted) return

    current.value = next
    emit('updated', next)
    schedulePoll()
  } catch (caught) {
    error.value = voiceError(caught)
  } finally {
    retrying.value = false
  }
}

async function apply(): Promise<void> {
  if (!canApply.value) return

  applying.value = true
  error.value = null

  try {
    const cart = await applyVoiceMessage(
      current.value.conversation_id,
      current.value.id,
      { confirmed: true, items: reviewedItems.value },
    )

    if (unmounted) return

    const next: VoiceMessage = {
      ...current.value,
      status: 'applied',
      applied_cart_id: cart.id,
      applied_at: new Date().toISOString(),
      capabilities: { ...current.value.capabilities, apply: false },
    }

    current.value = next
    confirmed.value = false
    emit('updated', next)
    emit('applied', cart)
  } catch (caught) {
    error.value = voiceError(caught)
  } finally {
    applying.value = false
  }
}

onMounted(() => {
  unmounted = false
  if (!isTerminal.value) void refresh(true)
})

onBeforeUnmount(() => {
  unmounted = true
  clearPoll()
})
</script>

<template>
  <section
    class="mt-2 rounded-xl border border-current/15 bg-surface/85 p-3 text-ink shadow-xs"
    :aria-label="t('voice.title')"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2">
        <span class="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <Sparkles class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-ink">{{ t('voice.title') }}</h3>
          <p class="text-caption text-muted">{{ t('voice.subtitle') }}</p>
        </div>
      </div>

      <BaseBadge :tone="statusTone(current.status)" size="sm" dot class="shrink-0">
        {{ statusLabel }}
      </BaseBadge>
    </header>

    <p v-if="extraction?.summary" class="mt-2 text-sm leading-relaxed text-ink">
      {{ extraction.summary }}
    </p>

    <!-- Automatic processing -->
    <div v-if="isProcessing" class="mt-3 flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-info-ink">
      <LoaderCircle class="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
      <div class="min-w-0">
        <p class="text-sm font-medium">{{ tDynamic('voice.progress', current.status) }}</p>
        <p class="mt-0.5 text-caption opacity-80">{{ t('voice.processingHint') }}</p>
      </div>
    </div>

    <!-- Failed -->
    <BaseAlert
      v-else-if="current.status === 'failed'"
      class="mt-3"
      tone="danger"
      :title="t('voice.failedTitle')"
    >
      <p>{{ current.failure_message || t('voice.failedBody') }}</p>
      <p v-if="current.failure_code" class="mt-1 text-caption opacity-80">
        {{ tDynamic('voice.failure', current.failure_code) }}
      </p>

      <BaseButton
        v-if="current.capabilities.retry && canUseAi"
        size="sm"
        variant="secondary"
        :icon="RefreshCw"
        :loading="retrying"
        class="mt-2"
        @click="retry"
      >
        {{ t('voice.retry') }}
      </BaseButton>

      <p v-else-if="!current.media.available" class="mt-2 text-caption">
        {{ t('voice.audioUnavailable') }}
      </p>
    </BaseAlert>

    <template v-else>
      <blockquote
        v-if="transcript"
        class="mt-2 border-s-2 border-brand/40 ps-2.5 text-sm italic leading-relaxed text-ink/85"
      >
        {{ transcript }}
      </blockquote>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <BaseBadge v-if="detectedLanguage" tone="neutral" size="sm">
          {{ tDynamic('voice.language', detectedLanguage) }}
        </BaseBadge>
        <BaseBadge v-if="confidenceLabel()" tone="neutral" size="sm">
          {{ confidenceLabel() }}
        </BaseBadge>
        <span v-if="current.processed_at" class="text-caption text-subtle">
          {{ t('voice.processedAt', { date: formatDateTime(current.processed_at) }) }}
        </span>
      </div>

      <!-- Applied -->
      <BaseAlert
        v-if="current.status === 'applied'"
        class="mt-3"
        tone="success"
        :title="t('voice.appliedTitle')"
      >
        <p>
          {{ t('voice.appliedBody', { id: current.applied_cart_id ?? '—' }) }}
        </p>
        <BaseButton
          v-if="canCreateOrder"
          size="sm"
          variant="secondary"
          :icon="ShoppingCart"
          class="mt-2"
          @click="emit('openOrderBuilder')"
        >
          {{ t('voice.openBuilder') }}
        </BaseButton>
      </BaseAlert>

      <!-- Ready for review -->
      <template v-else-if="current.status === 'ready'">
        <section v-if="lines.length > 0" class="mt-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('voice.reviewTitle') }}
              </h4>
              <p class="mt-0.5 text-caption text-muted">{{ t('voice.reviewHint') }}</p>
            </div>
            <BaseBadge tone="warning" size="sm">{{ t('ai.suggestion') }}</BaseBadge>
          </div>

          <ul class="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            <li
              v-for="line in lines"
              :key="line.key"
              class="flex items-start justify-between gap-3 px-3 py-2.5"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-ink">{{ line.item.name }}</p>
                <p class="mt-0.5 flex flex-wrap gap-x-2 text-caption text-muted">
                  <span v-if="line.item.sku">{{ line.item.sku }}</span>
                  <span v-if="line.item.unit_price !== null">
                    {{ formatCurrency(line.item.unit_price, lineCurrency(line.item)) }}
                  </span>
                  <span v-if="line.item.available !== null">
                    {{ t('voice.available', { count: line.item.available }) }}
                  </span>
                </p>
                <p v-if="line.item.notes" class="mt-1 text-small text-muted">
                  {{ line.item.notes }}
                </p>
                <p v-if="line.shortage" class="mt-1 text-caption font-medium text-danger-ink">
                  {{ t('voice.shortage', { available: line.item.available ?? 0 }) }}
                </p>
              </div>

              <div class="w-20 shrink-0">
                <label class="sr-only" :for="`voice-quantity-${line.key}`">
                  {{ t('voice.quantity') }}
                </label>
                <input
                  :id="`voice-quantity-${line.key}`"
                  type="number"
                  min="1"
                  max="1000"
                  inputmode="numeric"
                  class="h-8 w-full rounded-md border bg-surface px-2 text-sm text-ink tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
                  :class="
                    line.quantity < 1 || line.shortage
                      ? 'border-danger'
                      : 'border-line'
                  "
                  :value="quantities[line.key] ?? String(line.quantity)"
                  :aria-invalid="line.quantity < 1 || line.shortage ? 'true' : undefined"
                  @input="setQuantity(line.key, ($event.target as HTMLInputElement).value)"
                />
                <p class="mt-1 text-end text-caption text-subtle tabular-nums">
                  {{ formatCurrency(lineTotal(line), lineCurrency(line.item)) }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <BaseAlert v-else class="mt-3" tone="warning">
          {{ t('voice.noItems') }}
        </BaseAlert>

        <BaseAlert
          v-if="unresolvedItems.length > 0"
          class="mt-3"
          tone="warning"
          :title="t('voice.unresolvedTitle')"
        >
          <ul class="space-y-1.5">
            <li
              v-for="(item, index) in unresolvedItems"
              :key="`${lineKey(item)}-${index}`"
              class="flex items-start gap-2"
            >
              <AlertTriangle class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span class="font-medium">
                  {{ item.requested_name || t('voice.unknownItem') }}
                </span>
                — {{ unresolvedLabel(item) }}
                <span v-if="item.notes" class="block text-caption opacity-80">{{ item.notes }}</span>
              </span>
            </li>
          </ul>
        </BaseAlert>

        <section v-if="missingInformation.length > 0" class="mt-3">
          <h4 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('voice.missingTitle') }}
          </h4>
          <ul class="mt-1.5 space-y-1">
            <li
              v-for="(item, index) in missingInformation"
              :key="index"
              class="flex items-start gap-2 text-sm text-ink"
            >
              <AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-warning-ink" aria-hidden="true" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <section v-if="warningItems.length > 0" class="mt-3">
          <h4 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('voice.warningsTitle') }}
          </h4>
          <ul class="mt-1.5 space-y-1">
            <li
              v-for="warning in warningItems"
              :key="warning.key"
              class="flex items-start gap-2 text-sm text-muted"
            >
              <AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-warning-ink" aria-hidden="true" />
              <span>{{ warning.text }}</span>
            </li>
          </ul>
        </section>

        <p
          v-if="!canApplyPermissions"
          class="mt-3 flex items-start gap-1.5 text-caption text-subtle"
        >
          <CheckCircle2 class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ t('voice.permissionHint') }}
        </p>

        <div class="mt-3 border-t border-line pt-3">
          <BaseCheckbox
            v-model="confirmed"
            :label="t('voice.confirmLabel')"
            :hint="t('voice.confirmHint')"
            :disabled="applying || lines.length === 0"
          />

          <div class="mt-2.5 flex flex-wrap items-center gap-2">
            <BaseButton
              v-if="canApplyPermissions"
              :icon="ShoppingCart"
              :loading="applying"
              :disabled="!canApply"
              @click="apply"
            >
              {{ t('voice.apply') }}
            </BaseButton>

            <BaseButton
              v-if="canCreateOrder && (unresolvedItems.length > 0 || lines.length === 0)"
              variant="secondary"
              :icon="ShoppingCart"
              :disabled="applying"
              @click="emit('openOrderBuilder')"
            >
              {{ t('voice.openBuilder') }}
            </BaseButton>
          </div>
        </div>
      </template>
    </template>

    <BaseAlert v-if="error" class="mt-3" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>
  </section>
</template>
