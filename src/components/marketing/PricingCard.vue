<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CheckCircle2, Sparkles } from '@/components/icons'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useI18n } from '@/i18n'
import type { PricingPlan } from '@/types/marketing'
import { formatCurrency, formatNumber } from '@/utils/format'

const props = defineProps<{ plan: PricingPlan }>()
const { t, tDynamic } = useI18n()

const limitRows = computed(() => {
  const limits = props.plan.limits
  if (!limits) return []

  return Object.entries(limits)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => {
      const label = tDynamic('pricing.limit', key)
      let display: string
      if (typeof value === 'boolean') {
        display = value ? t('pricing.limitIncluded') : t('pricing.limitNotIncluded')
      } else if (typeof value === 'number') {
        display = formatNumber(value)
      } else {
        display = String(value)
      }
      return { key, label, display, included: value !== false }
    })
})

const target = computed(() => `/waitlist?plan=${encodeURIComponent(props.plan.slug)}`)

const periodSuffix = computed(() => {
  if (props.plan.billing_interval === 'one_time') return t('billing.once')
  if (props.plan.billing_interval === 'yearly') return t('billing.perYear')
  return t('billing.perMonth')
})

const ctaLabel = computed(() =>
  props.plan.price === null ? t('pricing.notifyMe') : t('pricing.joinWaitlist'),
)
</script>

<template>
  <article
    class="surface relative flex h-full flex-col p-6"
    :class="plan.highlighted ? 'border-2 border-brand-700 shadow-md ring-1 ring-brand-ring' : ''"
  >
    <span
      v-if="plan.highlighted"
      class="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-0.5 text-caption font-medium text-white"
    >
      <Sparkles class="size-3.5" aria-hidden="true" />
      {{ t('pricing.featured') }}
    </span>

    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-h3 font-semibold text-ink">{{ plan.name }}</h3>
        <p v-if="plan.description" class="mt-2 text-body text-muted">{{ plan.description }}</p>
      </div>
      <BaseBadge v-if="plan.price === null" tone="info" size="sm">
        {{ t('pricing.comingSoon') }}
      </BaseBadge>
    </div>

    <div class="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <template v-if="plan.price !== null">
        <span class="text-h1 font-semibold tracking-tight text-ink">
          {{ formatCurrency(plan.price, plan.currency) }}
        </span>
        <span class="text-caption text-muted">{{ periodSuffix }}</span>
      </template>
      <span v-else class="text-h3 font-semibold text-ink">{{ t('pricing.comingSoon') }}</span>
    </div>

    <p v-if="!plan.purchase_available && plan.price !== null" class="mt-2 text-small text-muted">
      {{ t('pricing.paidUnavailable') }}
    </p>

    <ul v-if="plan.features && plan.features.length > 0" class="mt-6 space-y-2.5 border-t border-line pt-6">
      <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2.5 text-body text-ink">
        <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span>{{ feature }}</span>
      </li>
    </ul>

    <div v-if="limitRows.length > 0" class="mt-6 border-t border-line pt-5">
      <p class="text-caption font-semibold uppercase tracking-wide text-subtle">
        {{ t('pricing.limitsTitle') }}
      </p>
      <dl class="mt-3 space-y-2">
        <div v-for="row in limitRows" :key="row.key" class="flex items-center justify-between gap-4 text-small">
          <dt class="text-muted">{{ row.label }}</dt>
          <dd :class="row.included ? 'font-medium text-ink' : 'text-subtle line-through'">
            {{ row.display }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="mt-auto pt-7">
      <BaseButton :to="target" :variant="plan.highlighted ? 'primary' : 'secondary'" block>
        {{ ctaLabel }}
        <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </BaseButton>
    </div>
  </article>
</template>
