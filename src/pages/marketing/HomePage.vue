<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  Boxes,
  Check,
  CheckCircle2,
  Home as HomeIcon,
  MessageCircle,
  MessageSquare,
  ShoppingBag,
  Store,
  Tags,
} from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import BaseButton from '@/components/ui/BaseButton.vue'
import WaveUnderline from '@/components/motion/WaveUnderline.vue'
import DashboardMockup from '@/components/marketing/home/DashboardMockup.vue'
import HomeStory from '@/components/marketing/home/HomeStory.vue'
import HomeCompare from '@/components/marketing/home/HomeCompare.vue'
import HomeFeatures from '@/components/marketing/home/HomeFeatures.vue'
import HomeAi from '@/components/marketing/home/HomeAi.vue'
import HomePricing from '@/components/marketing/home/HomePricing.vue'
import HomeBlog from '@/components/marketing/home/HomeBlog.vue'
import HomeFaq from '@/components/marketing/home/HomeFaq.vue'

/**
 * The landing page.
 *
 * The sections themselves live in `components/marketing/home/*` so each one
 * owns its data and its states; this file composes the narrative — hero,
 * capability marquee, story, comparison, features, audience, pricing, writing,
 * questions, closing call — and is the single place that boots AOS for all of
 * them (children only declare `data-aos`).
 *
 * Every call to action points at the invite-only waitlist: registration is
 * closed by design, so no path here can imply self-serve signup.
 */

const { t } = useI18n()
const { set: setSeo } = useSeo()

const marqueeItems = [
  'marketing.home.marqueeProducts',
  'marketing.home.marqueeInventory',
  'marketing.home.marqueeOrders',
  'marketing.home.marqueeCustomers',
  'marketing.home.marqueeConversations',
  'marketing.home.marqueeTeam',
  'marketing.home.marqueeReports',
] as const

const audience = [
  { icon: Boxes, nameKey: 'marketing.home.audienceEcommerce', hintKey: 'marketing.home.audienceEcommerceHint' },
  { icon: Store, nameKey: 'marketing.home.audienceRestaurants', hintKey: 'marketing.home.audienceRestaurantsHint' },
  { icon: Tags, nameKey: 'marketing.home.audienceClothing', hintKey: 'marketing.home.audienceClothingHint' },
  { icon: HomeIcon, nameKey: 'marketing.home.audienceHome', hintKey: 'marketing.home.audienceHomeHint' },
  { icon: MessageCircle, nameKey: 'marketing.home.audienceWhatsapp', hintKey: 'marketing.home.audienceWhatsappHint' },
] as const

const TICKS = [
  'marketing.home.tickArabic',
  'marketing.home.tickWhatsapp',
  'marketing.home.tickTeam',
] as const

onMounted(() => {
  setSeo({
    title: 'Dukavo',
    description: t('marketing.home.heroSubtitle'),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Dukavo',
        logo: `${window.location.origin}/favicon.png`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Dukavo',
        url: `${window.location.origin}/`,
      },
    ],
  })
  AOS.init({
    duration: 600,
    easing: 'ease-out-quart',
    once: true,
    offset: 120,
  })
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden pb-8 pt-16 md:pt-24">
      <div class="absolute inset-0 -z-10">
        <div
          class="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-brand-100/40 to-transparent dark:from-brand-700/20"
          aria-hidden="true"
        />
      </div>

      <div class="mx-auto max-w-5xl px-4 text-center md:px-6">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted shadow-xs"
          data-aos="fade-up"
        >
          <span class="size-1.5 rounded-full bg-brand-700" aria-hidden="true" />
          {{ t('marketing.home.heroBadge') }}
        </span>

        <h1
          class="mt-6 text-display font-semibold tracking-tight text-ink"
          data-aos="fade-up"
          data-aos-delay="80"
        >
          <span class="block">{{ t('marketing.home.heroTitleLine1') }}</span>
          <span class="block">
            {{ t('marketing.home.heroTitleFrom') }}
            <span class="text-brand-700">
              <WaveUnderline>{{ t('marketing.home.heroTitleAccent') }}</WaveUnderline>
            </span>
          </span>
        </h1>

        <p
          class="mx-auto mt-6 max-w-2xl text-lead text-muted"
          data-aos="fade-up"
          data-aos-delay="140"
        >
          {{ t('marketing.home.heroSubtitle') }}
        </p>

        <div
          class="mt-8 flex flex-wrap items-center justify-center gap-3"
          data-aos="fade-up"
          data-aos-delay="200"
        >
          <BaseButton size="lg" to="/waitlist">
            {{ t('marketing.home.heroPrimary') }}
          </BaseButton>
          <BaseButton size="lg" variant="secondary" to="/how-it-works">
            {{ t('marketing.home.heroSecondary') }}
          </BaseButton>
        </div>

        <!-- Trust ticks -->
        <ul
          class="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          data-aos="fade-up"
          data-aos-delay="260"
        >
          <li
            v-for="tick in TICKS"
            :key="tick"
            class="flex items-center gap-1.5 text-small text-muted"
          >
            <Check class="size-4 shrink-0 text-success" aria-hidden="true" />
            {{ t(tick) }}
          </li>
        </ul>
      </div>

      <!-- Interactive product demo -->
      <div data-aos="fade-up" data-aos-delay="300">
        <DashboardMockup />
      </div>
    </section>

    <!-- Capability marquee -->
    <section
      class="border-y border-line bg-surface-2 py-5"
      :aria-label="t('marketing.home.marqueeLabel')"
    >
      <!--
        Inner direction stays LTR so the loop travels the same physical
        direction in both scripts; the labels themselves render per language.
      -->
      <div dir="ltr" class="overflow-hidden">
        <div class="marquee-track flex w-max items-center gap-8 pe-8">
          <template v-for="copy in 2" :key="copy">
            <span
              v-for="key in marqueeItems"
              :key="`${copy}-${key}`"
              class="flex items-center gap-8"
              :aria-hidden="copy === 2 ? 'true' : undefined"
            >
              <span class="text-label font-semibold uppercase tracking-[0.14em] text-muted">
                {{ t(key) }}
              </span>
              <span class="size-1.5 rotate-45 bg-accent-400" aria-hidden="true" />
            </span>
          </template>
        </div>
      </div>
    </section>

    <!-- Story -->
    <HomeStory />

    <!-- Before / after -->
    <HomeCompare />

    <!-- Feature bento -->
    <HomeFeatures />

    <!-- AI with human approval -->
    <HomeAi />

    <!-- Audience -->
    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
          >
            {{ t('marketing.home.audienceEyebrow') }}
          </span>
          <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
            {{ t('marketing.home.audienceTitle') }}
          </h2>
        </div>

        <ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="(segment, index) in audience"
            :key="segment.nameKey"
            class="surface flex items-start gap-4 p-5"
            data-aos="fade-up"
            :data-aos-delay="index * 50"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
              <component :is="segment.icon" class="size-5" aria-hidden="true" />
            </span>
            <span class="min-w-0">
              <b class="block text-body font-semibold text-ink">{{ t(segment.nameKey) }}</b>
              <span class="mt-0.5 block text-small text-muted">{{ t(segment.hintKey) }}</span>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Pricing -->
    <HomePricing />

    <!-- Blog + newsletter -->
    <HomeBlog />

    <!-- FAQ -->
    <HomeFaq />

    <!-- Closing call -->
    <section class="pb-20 md:pb-28">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div
          class="overflow-hidden rounded-3xl bg-brand-700 px-6 py-14 text-center shadow-md md:px-12 md:py-16"
          data-aos="fade-up"
        >
          <span class="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-white/10 text-white">
            <MessageSquare class="size-6" aria-hidden="true" />
          </span>
          <h2 class="mx-auto max-w-xl text-h1 font-semibold tracking-tight text-white">
            {{ t('marketing.home.ctaTitle') }}
          </h2>
          <p class="mx-auto mt-3 max-w-xl text-lead text-white/80">
            {{ t('marketing.home.ctaBody') }}
          </p>
          <div class="mt-8 flex justify-center">
            <BaseButton size="lg" variant="secondary" to="/waitlist">
              {{ t('marketing.home.ctaAction') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marquee-track {
  animation: home-marquee 34s linear infinite;
}

@keyframes home-marquee {
  to {
    transform: translateX(-50%);
  }
}
</style>
