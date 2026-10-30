<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CircleMinus, LoaderCircle, RefreshCw } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import PageHero from '@/components/marketing/PageHero.vue'
import SectionHeading from '@/components/marketing/SectionHeading.vue'
import PricingCard from '@/components/marketing/PricingCard.vue'
import FaqAccordion from '@/components/marketing/FaqAccordion.vue'
import CtaSection from '@/components/marketing/CtaSection.vue'
import { fetchPublicFaq, fetchPublicPricing } from '@/services/marketingService'
import type { FaqEntry, PricingPlan } from '@/types/marketing'

/**
 * Public pricing.
 *
 * Plans come from the platform editor, so the page only presents what has been
 * published. A null price is a real state ("not decided yet"), never zero, and
 * onboarding is invite-only — every plan routes to the waitlist carrying its
 * slug instead of implying a checkout that does not exist.
 */

const { t } = useI18n()
const { set: setSeo } = useSeo()

const plans = ref<PricingPlan[]>([])
const faq = ref<FaqEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const sorted = computed(() =>
  plans.value.filter((plan) => plan.active).sort((a, b) => a.sort_order - b.sort_order),
)

const pricingFaq = computed(() => {
  const relevant = faq.value.filter((entry) => {
    const category = entry.category?.toLowerCase()
    return !category || category === 'pricing' || category === 'plans' || category === 'general'
  })
  return (relevant.length > 0 ? relevant : faq.value).slice(0, 6)
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

onMounted(async () => {
  setSeo({
    title: t('pricing.title'),
    description: t('pricing.heroBody'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
  await Promise.all([
    load(),
    fetchPublicFaq()
      .then((entries) => {
        faq.value = entries
      })
      .catch(() => {
        faq.value = []
      }),
  ])
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('pricing.eyebrow')"
      :title="t('pricing.title')"
      :description="t('pricing.heroBody')"
    />

    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-7xl px-4 md:px-6">
        <div class="mx-auto mb-10 flex max-w-3xl items-start gap-3 rounded-xl border border-brand-soft-border bg-brand-soft p-4 text-small text-brand-ink">
          <span class="mt-0.5 size-2 shrink-0 rounded-full bg-brand-700" aria-hidden="true" />
          <p>{{ t('pricing.inviteNote') }}</p>
        </div>

        <div v-if="loading" class="mx-auto flex max-w-md items-center justify-center gap-2 py-16 text-muted" role="status">
          <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
          <span>{{ t('state.loading') }}</span>
        </div>

        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')" class="mx-auto max-w-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <BaseEmptyState
          v-else-if="sorted.length === 0"
          :icon="CircleMinus"
          :title="t('pricing.emptyTitle')"
          :description="t('pricing.emptyBody')"
        />

        <div v-else class="grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PricingCard
            v-for="(plan, index) in sorted"
            :key="plan.id"
            :plan="plan"
            data-aos="fade-up"
            :data-aos-delay="index * 60"
          />
        </div>

        <p class="mx-auto mt-8 max-w-2xl text-center text-small text-muted">
          {{ t('pricing.taxNote') }}
        </p>
      </div>
    </section>

    <section v-if="pricingFaq.length > 0" class="border-y border-line bg-surface-2 py-16 md:py-24">
      <div class="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeading
          :eyebrow="t('marketing.home.faqEyebrow')"
          :title="t('pricing.faqTitle')"
          :description="t('pricing.faqBody')"
        />
        <div class="mt-8" data-aos="fade-up">
          <FaqAccordion :items="pricingFaq" id-prefix="pricing-faq" />
        </div>
        <p class="mt-6 text-center text-small text-muted">
          {{ t('pricing.faqMore') }}
          <RouterLink to="/help" class="font-medium text-brand-ink hover:underline">
            {{ t('marketing.nav.help') }}
          </RouterLink>
        </p>
      </div>
    </section>

    <div class="pt-16 md:pt-24">
      <CtaSection
        :title="t('pricing.ctaTitle')"
        :body="t('pricing.ctaBody')"
        :primary-label="t('marketing.nav.waitlistCta')"
        :secondary-label="t('marketing.nav.contact')"
        secondary-to="/contact"
      />
    </div>
  </div>
</template>
