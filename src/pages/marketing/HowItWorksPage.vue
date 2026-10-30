<script setup lang="ts">
import { onMounted } from 'vue'
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  type LucideIcon,
} from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n, type MessageKey } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import BaseButton from '@/components/ui/BaseButton.vue'
import PageHero from '@/components/marketing/PageHero.vue'
import SectionHeading from '@/components/marketing/SectionHeading.vue'
import CtaSection from '@/components/marketing/CtaSection.vue'

interface Step {
  icon: LucideIcon
  titleKey: MessageKey
  bodyKey: MessageKey
  detailKey: MessageKey
}

const STEPS: Step[] = [
  {
    icon: MessageCircle,
    titleKey: 'marketing.home.stepConversation',
    bodyKey: 'marketing.home.stepConversationBody',
    detailKey: 'marketing.how.step1Detail',
  },
  {
    icon: Users,
    titleKey: 'marketing.home.stepCustomer',
    bodyKey: 'marketing.home.stepCustomerBody',
    detailKey: 'marketing.how.step2Detail',
  },
  {
    icon: ShoppingCart,
    titleKey: 'marketing.home.stepOrder',
    bodyKey: 'marketing.home.stepOrderBody',
    detailKey: 'marketing.how.step3Detail',
  },
  {
    icon: Package,
    titleKey: 'marketing.home.stepInventory',
    bodyKey: 'marketing.home.stepInventoryBody',
    detailKey: 'marketing.how.step4Detail',
  },
  {
    icon: UserCog,
    titleKey: 'marketing.home.stepTeam',
    bodyKey: 'marketing.home.stepTeamBody',
    detailKey: 'marketing.how.step5Detail',
  },
]

const SETUP = [
  {
    icon: Settings,
    titleKey: 'marketing.how.setupCatalogueTitle',
    bodyKey: 'marketing.how.setupCatalogueBody',
  },
  {
    icon: MessageCircle,
    titleKey: 'marketing.how.setupWhatsappTitle',
    bodyKey: 'marketing.how.setupWhatsappBody',
  },
  {
    icon: Users,
    titleKey: 'marketing.how.setupTeamTitle',
    bodyKey: 'marketing.how.setupTeamBody',
  },
] as const

const { t } = useI18n()
const { set: setSeo } = useSeo()

onMounted(() => {
  setSeo({
    title: t('marketing.how.title'),
    description: t('marketing.how.heroBody'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('marketing.how.eyebrow')"
      :title="t('marketing.how.title')"
      :description="t('marketing.how.heroBody')"
    >
      <template #actions>
        <BaseButton size="lg" to="/waitlist">{{ t('marketing.nav.waitlistCta') }}</BaseButton>
        <BaseButton size="lg" variant="secondary" to="/features">
          {{ t('marketing.nav.features') }}
        </BaseButton>
      </template>
    </PageHero>

    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <SectionHeading
          :eyebrow="t('marketing.home.storyEyebrow')"
          :title="t('marketing.how.loopTitle')"
          :description="t('marketing.how.loopBody')"
        />

        <ol class="relative mt-12 space-y-5">
          <span
            class="absolute start-[1.375rem] top-6 bottom-6 hidden w-px bg-line sm:block"
            aria-hidden="true"
          />
          <li
            v-for="(step, index) in STEPS"
            :key="step.titleKey"
            class="surface relative flex gap-4 p-5 sm:gap-6 sm:p-6"
            data-aos="fade-up"
            :data-aos-delay="index * 50"
          >
            <span
              class="relative z-10 grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring"
            >
              <component :is="step.icon" class="size-5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <span class="text-caption font-semibold uppercase tracking-[0.14em] text-subtle">
                {{ t('marketing.how.stepLabel', { step: index + 1 }) }}
              </span>
              <h3 class="mt-1 text-h3 font-semibold text-ink">{{ t(step.titleKey) }}</h3>
              <p class="mt-2 text-body text-muted">{{ t(step.bodyKey) }}</p>
              <p class="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-small text-muted">{{ t(step.detailKey) }}</p>
            </div>
            <ArrowRight class="mt-3 hidden size-4 shrink-0 self-start text-subtle rtl:-scale-x-100 sm:block" aria-hidden="true" />
          </li>
        </ol>
      </div>
    </section>

    <section class="border-y border-line bg-surface-2 py-16 md:py-24">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          :eyebrow="t('marketing.how.setupEyebrow')"
          :title="t('marketing.how.setupTitle')"
          :description="t('marketing.how.setupBody')"
        />

        <div class="mt-10 grid gap-5 md:grid-cols-3">
          <article
            v-for="(item, index) in SETUP"
            :key="item.titleKey"
            class="surface p-6"
            data-aos="fade-up"
            :data-aos-delay="index * 60"
          >
            <span class="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
              <component :is="item.icon" class="size-5" aria-hidden="true" />
            </span>
            <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t(item.titleKey) }}</h3>
            <p class="mt-2 text-body text-muted">{{ t(item.bodyKey) }}</p>
          </article>
        </div>

        <div class="surface mt-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8" data-aos="fade-up">
          <div class="flex items-start gap-4">
            <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-success-soft text-success-ink">
              <ShieldCheck class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.how.securityTitle') }}</h3>
              <p class="mt-1 max-w-2xl text-body text-muted">{{ t('marketing.how.securityBody') }}</p>
            </div>
          </div>
          <ul class="flex flex-wrap gap-x-4 gap-y-2 text-small text-muted">
            <li class="inline-flex items-center gap-1.5">
              <CheckCircle2 class="size-4 text-success" aria-hidden="true" />
              {{ t('marketing.how.securityPoint1') }}
            </li>
            <li class="inline-flex items-center gap-1.5">
              <CheckCircle2 class="size-4 text-success" aria-hidden="true" />
              {{ t('marketing.how.securityPoint2') }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div class="pt-16 md:pt-24">
      <CtaSection
        :title="t('marketing.how.ctaTitle')"
        :body="t('marketing.how.ctaBody')"
        :primary-label="t('marketing.nav.waitlistCta')"
        :secondary-label="t('marketing.nav.pricing')"
        secondary-to="/pricing"
      />
    </div>
  </div>
</template>
