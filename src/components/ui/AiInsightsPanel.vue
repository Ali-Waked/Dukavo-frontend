<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, Info, RefreshCw, Sparkles } from '@/components/icons'
import { useI18n } from '@/i18n'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { fetchPlatformInsights, fetchTenantInsights } from '@/services/aiService'
import type { PlatformDashboardRangeKey } from '@/services/platformService'
import type { AiInsights } from '@/types/ai'
import { aiErrorMessage, severityTone } from '@/utils/ai'

/**
 * A grounded AI briefing over figures the server already computed.
 *
 * It is generated on request rather than on mount: the call costs tokens and a
 * merchant should decide when to spend them. The panel is a reader only — it
 * never acts on the numbers — and always carries a reminder that the text is
 * generated and must be checked before it informs a decision.
 */

const props = withDefaults(
  defineProps<{
    scope: 'tenant' | 'platform'
    /** Narrows a tenant briefing to one store. */
    storeId?: number
    /** The window a platform briefing covers. */
    range?: PlatformDashboardRangeKey
  }>(),
  { storeId: undefined, range: undefined },
)

const { t, tDynamic } = useI18n()

const insights = ref<AiInsights | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function generate(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    insights.value =
      props.scope === 'platform'
        ? await fetchPlatformInsights(props.range)
        : await fetchTenantInsights(props.storeId)
  } catch (caught) {
    error.value = aiErrorMessage(caught, t)
  } finally {
    loading.value = false
  }
}

// A different scope or window makes the shown briefing stale, so it is cleared
// rather than left beside figures it no longer describes.
watch(
  () => [props.scope, props.storeId, props.range],
  () => {
    insights.value = null
    error.value = null
  },
)
</script>

<template>
  <section class="surface p-5" :aria-label="t('ai.insights.title')">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <Sparkles class="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 class="text-h4 font-semibold text-ink">{{ t('ai.insights.title') }}</h2>
          <p class="mt-0.5 text-small text-muted">{{ t('ai.insights.description') }}</p>
        </div>
      </div>

      <BaseButton
        v-if="insights || error"
        variant="secondary"
        size="sm"
        :icon="RefreshCw"
        :loading="loading"
        :disabled="loading"
        @click="generate"
      >
        {{ t('ai.insights.regenerate') }}
      </BaseButton>
    </div>

    <!-- Idle -->
    <div v-if="!insights && !loading && !error" class="mt-4 space-y-3">
      <p class="text-small text-muted">{{ t('ai.insights.intro') }}</p>
      <BaseButton size="sm" :icon="Sparkles" @click="generate">
        {{ t('ai.insights.generate') }}
      </BaseButton>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="mt-4 space-y-3" aria-hidden="true">
      <BaseSkeleton height="h-4" block />
      <BaseSkeleton class="w-5/6" height="h-4" block />
      <BaseSkeleton class="w-2/3" height="h-4" block />
      <p class="text-small text-muted">{{ t('ai.insights.loading') }}</p>
    </div>

    <!-- Error -->
    <BaseAlert v-else-if="error" class="mt-4" tone="danger" dismissible @dismiss="error = null">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="generate">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <!-- Result -->
    <div v-else-if="insights" class="mt-4 space-y-5">
      <p class="text-body leading-relaxed text-ink">{{ insights.summary }}</p>

      <div v-if="insights.highlights.length > 0">
        <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
          {{ t('ai.insights.highlights') }}
        </h3>
        <ul class="mt-2 space-y-3">
          <li v-for="(highlight, index) in insights.highlights" :key="index" class="flex gap-2.5">
            <BaseBadge :tone="severityTone(highlight.severity)" size="sm" class="mt-0.5 shrink-0">
              {{ tDynamic('ai.severity', highlight.severity) }}
            </BaseBadge>
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ highlight.title }}</p>
              <p class="text-small text-muted">{{ highlight.detail }}</p>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="insights.recommendations.length > 0">
        <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
          {{ t('ai.insights.recommendations') }}
        </h3>
        <ul class="mt-2 space-y-3">
          <li
            v-for="(recommendation, index) in insights.recommendations"
            :key="index"
            class="flex gap-2.5"
          >
            <Sparkles class="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ recommendation.title }}</p>
              <p class="text-small text-muted">{{ recommendation.detail }}</p>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="insights.data_gaps.length > 0">
        <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
          {{ t('ai.insights.dataGaps') }}
        </h3>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li v-for="(gap, index) in insights.data_gaps" :key="index">
            <BaseBadge tone="neutral" size="sm">
              <AlertTriangle class="size-3" aria-hidden="true" />
              {{ gap }}
            </BaseBadge>
          </li>
        </ul>
      </div>

      <p class="flex items-start gap-1.5 border-t border-line pt-3 text-caption text-subtle">
        <Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ t('ai.insights.disclaimer') }}
      </p>
    </div>
  </section>
</template>
