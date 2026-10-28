<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertTriangle,
  Check,
  Info,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useI18n } from '@/i18n'
import { suggestSalesCopilot } from '@/services/aiService'
import type { AiSalesCopilotSuggestion } from '@/types/ai'
import { aiErrorMessage } from '@/utils/ai'
import { formatCurrency } from '@/utils/format'

/**
 * The sales copilot's review surface.
 *
 * It prepares a reply and, at most, a draft basket. Everything shown here is a
 * suggestion: using the reply only fills the composer, and the draft order is
 * never an order until a person builds and confirms it. The panel also shows
 * the server's warnings, unverified references and handoff advice instead of
 * hiding uncertainty behind confident prose.
 */

const props = withDefaults(
  defineProps<{
    open: boolean
    conversationId: number | null
    /** Whether the viewer may assign the conversation to a person. */
    canAssign?: boolean
    /** Whether the viewer may open the order builder. */
    canBuildOrder?: boolean
    /** False while the reply window or conversation status blocks a text reply. */
    canUseReply?: boolean
  }>(),
  {
    canAssign: false,
    canBuildOrder: false,
    canUseReply: true,
  },
)

const emit = defineEmits<{
  close: []
  useReply: [value: string]
  handoff: []
  buildOrder: []
}>()

const { t, tDynamic } = useI18n()

const instruction = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<AiSalesCopilotSuggestion | null>(null)
const editedReply = ref('')

const intentTone = computed(() => {
  switch (result.value?.intent) {
    case 'complaint':
      return 'danger'
    case 'order_request':
      return 'success'
    case 'product_inquiry':
    case 'availability':
      return 'brand'
    default:
      return 'neutral'
  }
})

const canSubmitReply = computed(
  () => props.canUseReply && editedReply.value.trim() !== '' && !loading.value,
)

const warningItems = computed(() => {
  const current = result.value
  if (!current) return []

  if (current.warning_codes.length === current.warnings.length) {
    return current.warning_codes
      .filter((code) => code !== 'ignored_references')
      .map((code) => ({ code, text: tDynamic('ai.copilot.warning', code) }))
  }

  return current.warnings.map((text, index) => ({ code: `raw-${index}`, text }))
})

watch(
  () => props.open,
  (open) => {
    if (!open) return

    instruction.value = ''
    loading.value = false
    error.value = null
    result.value = null
    editedReply.value = ''
  },
)

async function generate(): Promise<void> {
  if (props.conversationId === null || loading.value) return

  loading.value = true
  error.value = null

  try {
    result.value = await suggestSalesCopilot(props.conversationId, instruction.value)
    editedReply.value = result.value.suggested_reply
  } catch (caught) {
    result.value = null
    editedReply.value = ''
    error.value = aiErrorMessage(caught, t)
  } finally {
    loading.value = false
  }
}

function useReply(): void {
  const value = editedReply.value.trim()
  if (value === '') return

  emit('useReply', value)
}

function stockLabel(sufficient: boolean | null): string {
  if (sufficient === null) return t('ai.copilot.stockUnknown')
  return sufficient ? t('ai.copilot.inStock') : t('ai.copilot.lowStock')
}

function stockTone(sufficient: boolean | null): 'success' | 'warning' | 'neutral' {
  if (sufficient === null) return 'neutral'
  return sufficient ? 'success' : 'warning'
}

function issueLabel(code: string): string {
  return tDynamic('ai.copilot.issue', code)
}

function handoffReason(value: AiSalesCopilotSuggestion): string {
  if (value.handoff_code && value.handoff_code !== 'model') {
    return tDynamic('ai.copilot.handoff', value.handoff_code)
  }

  return value.handoff_reason || t('ai.copilot.handoffDefault')
}
</script>

<template>
  <BaseModal
    :open="open"
    size="lg"
    :title="t('ai.copilot.title')"
    :description="t('ai.copilot.description')"
    @close="emit('close')"
  >
    <div class="space-y-5">
      <BaseAlert tone="info">
        {{ t('ai.copilot.disclaimer') }}
      </BaseAlert>

      <!-- Idle -->
      <div v-if="!result && !loading" class="space-y-3">
        <BaseTextarea
          v-model="instruction"
          :label="t('ai.copilot.instructionLabel')"
          :placeholder="t('ai.copilot.instructionPlaceholder')"
          :rows="3"
          :maxlength="1500"
        />
        <BaseButton
          :icon="Sparkles"
          :disabled="conversationId === null"
          @click="generate"
        >
          {{ t('ai.copilot.generate') }}
        </BaseButton>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="space-y-3" aria-hidden="true">
        <BaseSkeleton height="h-4" block />
        <BaseSkeleton class="w-5/6" height="h-4" block />
        <BaseSkeleton height="h-24" block />
        <p class="text-small text-muted">{{ t('ai.copilot.loading') }}</p>
      </div>

      <!-- Error -->
      <BaseAlert v-else-if="error" tone="danger" dismissible @dismiss="error = null">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{{ error }}</span>
          <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="generate">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <!-- Result -->
      <template v-else-if="result">
        <section>
          <div class="flex flex-wrap items-center gap-1.5">
            <BaseBadge :tone="intentTone" size="sm">
              <Sparkles class="size-3" aria-hidden="true" />
              {{ tDynamic('ai.copilot.intent', result.intent) }}
            </BaseBadge>
            <BaseBadge tone="neutral" size="sm">
              {{ tDynamic('ai.copilot.language', result.detected_language) }}
            </BaseBadge>
            <BaseBadge tone="neutral" size="sm">
              {{ tDynamic('ai.tone', result.tone) }}
            </BaseBadge>
            <BaseBadge v-if="result.needs_human" tone="warning" size="sm">
              {{ t('ai.summary.needsReply') }}
            </BaseBadge>
          </div>
          <p class="mt-2 text-body leading-relaxed text-ink">{{ result.summary }}</p>
        </section>

        <BaseAlert
          v-if="result.needs_human"
          tone="warning"
          :title="t('ai.copilot.handoffTitle')"
        >
          <p>{{ handoffReason(result) }}</p>
          <BaseButton
            v-if="canAssign"
            size="sm"
            variant="secondary"
            :icon="Users"
            class="mt-2"
            @click="emit('handoff')"
          >
            {{ t('ai.copilot.handoffAction') }}
          </BaseButton>
        </BaseAlert>

        <section v-if="result.suggested_reply.trim() !== ''">
          <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('ai.copilot.reply') }}
          </h3>
          <BaseTextarea
            v-model="editedReply"
            class="mt-2"
            :rows="6"
            :hint="t('ai.copilot.replyHint')"
          />
        </section>

        <section v-if="result.missing_information.length > 0">
          <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('ai.copilot.missing') }}
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="(item, index) in result.missing_information"
              :key="index"
              class="flex items-start gap-2 text-sm text-ink"
            >
              <Check class="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('ai.copilot.products') }}
          </h3>
          <p v-if="result.products.length === 0" class="mt-2 text-sm text-muted">
            {{ t('ai.copilot.noProducts') }}
          </p>
          <ul v-else class="mt-2 grid gap-2 sm:grid-cols-2">
            <li
              v-for="product in result.products"
              :key="product.variant_id"
              class="rounded-lg border border-line bg-surface-2 p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 text-sm font-medium text-ink">{{ product.name }}</p>
                <BaseBadge :tone="stockTone(product.sufficient_stock)" size="sm" class="shrink-0">
                  {{ stockLabel(product.sufficient_stock) }}
                </BaseBadge>
              </div>
              <p v-if="product.sku" class="mt-0.5 text-caption text-subtle">{{ product.sku }}</p>
              <p class="mt-1 text-sm font-semibold text-ink tabular-nums">
                {{ formatCurrency(product.unit_price, product.currency) }}
              </p>
              <p class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-muted">
                <span v-if="product.requested_quantity !== null">
                  {{ t('ai.copilot.requested', { quantity: product.requested_quantity }) }}
                </span>
                <span v-if="product.available !== null">
                  {{ t('ai.copilot.productStock', { available: product.available }) }}
                </span>
              </p>
              <p v-if="product.reason" class="mt-1 text-small text-muted">{{ product.reason }}</p>
            </li>
          </ul>
        </section>

        <section v-if="result.draft_order">
          <div class="flex items-center gap-2">
            <ShoppingCart class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('ai.copilot.draft') }}
            </h3>
            <BaseBadge tone="warning" size="sm">{{ t('ai.suggestion') }}</BaseBadge>
          </div>

          <BaseAlert class="mt-2" tone="warning">
            {{ t('ai.copilot.draftNotice') }}
          </BaseAlert>

          <div class="mt-3 overflow-hidden rounded-lg border border-line">
            <ul class="divide-y divide-line">
              <li
                v-for="item in result.draft_order.items"
                :key="item.variant_id"
                class="flex items-start justify-between gap-3 px-3 py-2"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink">{{ item.name }}</p>
                  <p class="text-caption text-muted">
                    {{ item.quantity }} × {{ formatCurrency(item.unit_price, result.draft_order.currency) }}
                  </p>
                </div>
                <p class="shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {{ formatCurrency(item.line_total, result.draft_order.currency) }}
                </p>
              </li>
            </ul>

            <dl class="space-y-1 border-t border-line bg-surface-2 px-3 py-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('ai.copilot.subtotal') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(result.draft_order.subtotal, result.draft_order.currency) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('ai.copilot.tax') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(result.draft_order.tax_total, result.draft_order.currency) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">{{ t('ai.copilot.shipping') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(result.draft_order.shipping_total, result.draft_order.currency) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 border-t border-line pt-1 font-semibold">
                <dt class="text-ink">{{ t('ai.copilot.total') }}</dt>
                <dd class="tabular-nums text-ink">
                  {{ formatCurrency(result.draft_order.grand_total, result.draft_order.currency) }}
                </dd>
              </div>
            </dl>
          </div>

          <ul v-if="result.draft_order.issues.length > 0" class="mt-2 space-y-1">
            <li
              v-for="(issue, index) in result.draft_order.issues"
              :key="`${issue.code}-${index}`"
              class="flex items-start gap-2 text-small text-warning-ink"
            >
              <AlertTriangle class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {{ issueLabel(issue.code) }}<template v-if="issue.product"> — {{ issue.product }}</template>
              </span>
            </li>
          </ul>

          <BaseButton
            v-if="canBuildOrder"
            size="sm"
            variant="secondary"
            :icon="ShoppingCart"
            class="mt-3"
            @click="emit('buildOrder')"
          >
            {{ t('ai.copilot.draftBuild') }}
          </BaseButton>
        </section>

        <section v-if="warningItems.length > 0">
          <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('ai.copilot.warnings') }}
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="warning in warningItems"
              :key="warning.code"
              class="flex items-start gap-2 text-sm text-muted"
            >
              <AlertTriangle class="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
              <span>{{ warning.text }}</span>
            </li>
          </ul>
        </section>

        <BaseAlert v-if="result.ignored_references.length > 0" tone="warning">
          {{ t('ai.copilot.ignored', { count: result.ignored_references.length }) }}
        </BaseAlert>

        <p class="flex items-start gap-1.5 border-t border-line pt-3 text-caption text-subtle">
          <Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ t('ai.copilot.usage', { model: result.usage.model, tokens: result.usage.total_tokens }) }}
        </p>
      </template>
    </div>

    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="emit('close')">
        {{ t('action.cancel') }}
      </BaseButton>
      <BaseButton
        v-if="result"
        variant="secondary"
        :icon="RefreshCw"
        :loading="loading"
        :disabled="loading"
        @click="generate"
      >
        {{ t('ai.copilot.regenerate') }}
      </BaseButton>
      <BaseButton v-if="result" :disabled="!canSubmitReply" @click="useReply">
        {{ t('ai.copilot.useReply') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
