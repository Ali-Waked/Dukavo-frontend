<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { CheckCircle2, CircleMinus, LoaderCircle, RefreshCw, Sparkles } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { BILLING_INTERVAL } from '@/constants/statuses'
import { fetchPublicPricing } from '@/services/marketingService'
import type { PricingPlan } from '@/types/marketing'
import { formatCurrency } from '@/utils/format'

/**
 * Public pricing page.
 *
 * The plans come from the platform editor, so this page is pure presentation:
 * it renders exactly what the admin published, ordered by sort order, with a
 * nullable price rendered as the "coming soon" state rather than as zero.
 *
 * It also never invents a checkout. A plan is offered a real signup CTA only
 * when the server says `purchase_available`; anything else (coming soon, or a
 * published paid plan with no payment provider behind it) routes to the
 * waitlist so interest is captured instead of implying a purchase that cannot
 * be completed.
 */

const { t } = useI18n()

const plans = ref<PricingPlan[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const sorted = computed(() => plans.value.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order))

onMounted(async () => {
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: false, offset: 120 })
  await load()
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
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('pricing.title') }}</h1>
        <p class="mt-3 text-muted">{{ t('pricing.subtitle') }}</p>
      </div>

      <div class="mt-12">
        <!-- Loading -->
        <div v-if="loading" class="mx-auto flex max-w-md items-center justify-center gap-2 py-16 text-muted">
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
        <div
          v-else
          class="grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="(plan, index) in sorted"
            :key="plan.id"
            class="surface relative flex flex-col p-6"
            :class="plan.highlighted ? 'border-2 border-brand-700 ring-1 ring-brand-ring' : ''"
            :data-aos="'fade-up'"
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

            <div class="mt-6 flex items-baseline gap-2">
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

            <BaseButton
              v-if="plan.purchase_available"
              class="mt-6 w-full"
              :variant="plan.highlighted ? 'primary' : 'secondary'"
              to="/register"
            >
              {{ t('pricing.startFree') }}
            </BaseButton>
            <template v-else>
              <BaseButton class="mt-6 w-full" variant="secondary" :to="`/waitlist?plan=${plan.slug}`">
                {{ t('pricing.notifyMe') }}
              </BaseButton>
              <p v-if="plan.price !== null" class="mt-3 text-small text-muted">
                {{ t('pricing.paidUnavailable') }}
              </p>
            </template>

            <ul v-if="plan.features && plan.features.length > 0" class="mt-6 space-y-2.5 border-t border-line pt-6">
              <li
                v-for="feature in plan.features"
                :key="feature"
                class="flex items-start gap-2.5 text-body text-ink"
              >
                <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {{ feature }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>