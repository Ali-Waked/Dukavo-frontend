<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, CheckCircle2, CircleMinus, LoaderCircle, RefreshCw, Sparkles } from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicPricing } from '@/services/marketingService'
import type { PricingPlan } from '@/types/marketing'
import { formatCurrency } from '@/utils/format'

/**
 * The homepage pricing section — the same published plans the pricing page
 * shows, condensed, with the same states for missing, empty or failing data.
 *
 * There is no self-serve signup to route to: onboarding is invite-only, so
 * every plan points at the waitlist, carrying the plan slug so interest in a
 * specific plan can be recorded against it.
 */

const { t } = useI18n()

const plans = ref<PricingPlan[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const sorted = computed(() =>
  plans.value.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order),
)

onMounted(() => {
  void load()
})

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    plans.value = await fetchPublicPricing()
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

function periodSuffix(plan: PricingPlan): string {
  if (plan.billing_interval === 'one_time') return t('billing.once')
  if (plan.billing_interval === 'yearly') return t('billing.perYear')
  return t('billing.perMonth')
}

function waitlistTarget(plan: PricingPlan): string {
  return `/waitlist?plan=${encodeURIComponent(plan.slug)}`
}
</script>

<template>
  <section id="pricing" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
        >
          {{ t('marketing.home.pricingEyebrow') }}
        </span>
        <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
          {{ t('marketing.home.pricingTitle') }}
        </h2>
        <p class="mt-3 text-lead text-muted">{{ t('marketing.home.pricingLead') }}</p>
      </div>

      <div class="mt-10">
        <!-- Loading -->
        <div
          v-if="loading"
          class="mx-auto flex items-center justify-center gap-2 py-16 text-muted"
          role="status"
        >
          <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
          <span>{{ t('state.loading') }}</span>
        </div>

        <!-- Error -->
        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')" class="mx-auto max-w-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <!-- Empty -->
        <BaseEmptyState
          v-else-if="sorted.length === 0"
          :icon="CircleMinus"
          :title="t('pricing.emptyTitle')"
          :description="t('pricing.emptyBody')"
        />

        <!-- Plans -->
        <div v-else class="grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(plan, index) in sorted"
            :key="plan.id"
            class="surface relative flex flex-col p-6"
            :class="plan.highlighted ? 'border-2 border-brand-700 ring-1 ring-brand-ring' : ''"
            data-aos="fade-up"
            :data-aos-delay="index * 50"
          >
            <span
              v-if="plan.highlighted"
              class="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-0.5 text-caption font-medium text-white"
            >
              <Sparkles class="size-3.5" aria-hidden="true" />
              {{ t('pricing.featured') }}
            </span>

            <h3 class="text-h3 font-semibold text-ink">{{ plan.name }}</h3>
            <p v-if="plan.description" class="mt-2 text-body text-muted">{{ plan.description }}</p>

            <div class="mt-5 flex items-baseline gap-2">
              <template v-if="plan.price !== null">
                <span class="text-h1 font-semibold tracking-tight text-ink">
                  {{ formatCurrency(plan.price, plan.currency) }}
                </span>
                <span class="text-caption text-muted">{{ periodSuffix(plan) }}</span>
              </template>
              <template v-else>
                <span class="text-h3 font-semibold text-ink">{{ t('pricing.comingSoon') }}</span>
              </template>
            </div>

            <ul v-if="plan.features && plan.features.length > 0" class="mt-5 space-y-2.5 border-t border-line pt-5">
              <li
                v-for="feature in plan.features"
                :key="feature"
                class="flex items-start gap-2.5 text-body text-ink"
              >
                <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {{ feature }}
              </li>
            </ul>

            <div class="mt-6 pt-1">
              <BaseButton
                :to="waitlistTarget(plan)"
                variant="secondary"
                class="w-full justify-center"
                :aria-label="plan.price === null ? t('pricing.notifyMe') : t('marketing.home.pricingWaitlist')"
              >
                {{ plan.price === null ? t('pricing.notifyMe') : t('marketing.home.pricingWaitlist') }}
                <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
