<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { ArrowRight } from '@/components/icons'
import { useI18n } from '@/i18n'
import AOS from 'aos'
import 'aos/dist/aos.css'

const { t } = useI18n()
const heroRef = ref<HTMLElement>()

onMounted(() => {
  AOS.init({
    duration: 600,
    easing: 'ease-out-quart',
    once: false,
    mirror: false,
    offset: 120,
  })
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden pb-20 pt-16 md:pb-32 md:pt-24">
      <div class="mx-auto max-w-7xl px-4 md:px-6">
        <div class="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted" data-aos="fade-up">
              <span class="size-1.5 rounded-full bg-brand-700"></span>
              <span>{{ t('marketing.hero.badge') }}</span>
            </div>
            <h1 class="text-display font-semibold tracking-tight text-ink" data-aos="fade-up" data-aos-delay="100">
              {{ t('marketing.home.heroTitle') }}
            </h1>
            <p class="mt-6 text-lead text-muted" data-aos="fade-up" data-aos-delay="150">
              {{ t('marketing.home.heroSubtitle') }}
            </p>
            <div class="mt-8 flex flex-wrap items-center gap-3" data-aos="fade-up" data-aos-delay="200">
              <BaseButton size="lg" to="/waitlist">
                {{ t('marketing.cta.startFree') }}
                <ArrowRight class="size-4" />
              </BaseButton>
              <BaseButton size="lg" variant="secondary" to="/how-it-works">
                {{ t('marketing.home.heroSecondary') }}
              </BaseButton>
            </div>
          </div>
          <div class="relative" data-aos="fade-up" data-aos-delay="250">
            <div class="relative rounded-2xl border border-line bg-surface shadow-xl overflow-hidden">
              <img src="@/assets/images/dashboard-preview.png" :alt="t('marketing.home.heroAlt')" class="w-full h-auto" onerror="this.src='https://placehold.co/1200x800/e2e8f0/0f172a?text=Dukavo+Dashboard'" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Problem/Solution teaser -->
    <section class="border-t border-line bg-surface-2 py-16 md:py-24">
      <div class="mx-auto max-w-7xl px-4 md:px-6">
        <div class="grid gap-8 md:grid-cols-2 lg:gap-12">
          <div class="surface p-6 md:p-8" data-aos="fade-up">
            <h2 class="text-h2 font-semibold text-ink">{{ t('marketing.home.beforeTitle') }}</h2>
            <p class="mt-2 text-muted">{{ t('marketing.home.beforeSubtitle') }}</p>
            <ul class="mt-6 space-y-3 text-muted">
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-danger"></span>
                <span>{{ t('marketing.home.beforeItem1') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-danger"></span>
                <span>{{ t('marketing.home.beforeItem2') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-danger"></span>
                <span>{{ t('marketing.home.beforeItem3') }}</span>
              </li>
            </ul>
          </div>
          <div class="surface p-6 md:p-8" data-aos="fade-up" data-aos-delay="100">
            <h2 class="text-h2 font-semibold text-ink">{{ t('marketing.home.afterTitle') }}</h2>
            <p class="mt-2 text-muted">{{ t('marketing.home.afterSubtitle') }}</p>
            <ul class="mt-6 space-y-3 text-muted">
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-success"></span>
                <span>{{ t('marketing.home.afterItem1') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-success"></span>
                <span>{{ t('marketing.home.afterItem2') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 rounded-full bg-success"></span>
                <span>{{ t('marketing.home.afterItem3') }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Core pillars -->
    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-7xl px-4 md:px-6">
        <div class="mb-10 text-center" data-aos="fade-up">
          <h2 class="text-h1 font-semibold text-ink">{{ t('marketing.home.pillarsTitle') }}</h2>
          <p class="mt-3 text-muted">{{ t('marketing.home.pillarsSubtitle') }}</p>
        </div>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarProductsTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarProductsBody') }}</p>
          </div>
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up" data-aos-delay="50">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarOrdersTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarOrdersBody') }}</p>
          </div>
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up" data-aos-delay="100">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarCustomersTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarCustomersBody') }}</p>
          </div>
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up" data-aos-delay="150">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarWhatsappTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarWhatsappBody') }}</p>
          </div>
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up" data-aos-delay="200">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarTeamTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarTeamBody') }}</p>
          </div>
          <div class="surface p-6 transition hover:shadow-md" data-aos="fade-up" data-aos-delay="250">
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.pillarStoresTitle') }}</h3>
            <p class="mt-2 text-muted">{{ t('marketing.home.pillarStoresBody') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="border-t border-line py-16 md:py-24">
      <div class="mx-auto max-w-3xl px-4 text-center md:px-6" data-aos="fade-up">
        <h2 class="text-h1 font-semibold text-ink">{{ t('marketing.home.ctaTitle') }}</h2>
        <p class="mt-3 text-muted">{{ t('marketing.home.ctaBody') }}</p>
        <div class="mt-8">
          <BaseButton size="lg" to="/waitlist">
            {{ t('marketing.home.ctaAction') }}
            <ArrowRight class="size-4" />
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
