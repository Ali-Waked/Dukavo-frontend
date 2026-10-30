<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  CircleMinus,
  Layers,
  LoaderCircle,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Settings,
  ShoppingCart,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { hasMessage, useI18n, type MessageKey } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import PageHero from '@/components/marketing/PageHero.vue'
import SectionHeading from '@/components/marketing/SectionHeading.vue'
import CtaSection from '@/components/marketing/CtaSection.vue'
import { fetchPublicFeatures } from '@/services/marketingService'
import type { MarketingFeature } from '@/types/marketing'

interface FeatureCategory {
  id: string
  titleKey: MessageKey
  bodyKey: MessageKey
  icon: LucideIcon
  slugs: string[]
}

const CATEGORIES: FeatureCategory[] = [
  {
    id: 'catalogue',
    titleKey: 'marketing.features.categories.catalogue.title',
    bodyKey: 'marketing.features.categories.catalogue.body',
    icon: Boxes,
    slugs: ['products', 'inventory', 'bundles'],
  },
  {
    id: 'sales',
    titleKey: 'marketing.features.categories.sales.title',
    bodyKey: 'marketing.features.categories.sales.body',
    icon: ShoppingCart,
    slugs: ['orders', 'customers', 'conversations', 'recovery'],
  },
  {
    id: 'operations',
    titleKey: 'marketing.features.categories.operations.title',
    bodyKey: 'marketing.features.categories.operations.body',
    icon: Settings,
    slugs: ['whatsapp', 'analytics', 'automation', 'team'],
  },
  {
    id: 'ai',
    titleKey: 'marketing.features.categories.ai.title',
    bodyKey: 'marketing.features.categories.ai.body',
    icon: Bot,
    slugs: ['ai-copilot'],
  },
]

const FEATURE_ICONS: Record<string, LucideIcon> = {
  products: Package,
  inventory: Boxes,
  bundles: Layers,
  orders: ShoppingCart,
  customers: Users,
  conversations: MessageCircle,
  recovery: Wallet,
  whatsapp: Phone,
  analytics: TrendingUp,
  automation: Settings,
  team: UserCog,
  'ai-copilot': Bot,
}

const STATS: { value: string; key: MessageKey }[] = [
  { value: '12', key: 'marketing.features.statModules' },
  { value: '2', key: 'marketing.features.statLanguages' },
  { value: '1', key: 'marketing.features.statWorkspace' },
  { value: '100%', key: 'marketing.features.statApproval' },
]

const STEPS = [
  'marketing.home.stepConversation',
  'marketing.home.stepCustomer',
  'marketing.home.stepOrder',
  'marketing.home.stepInventory',
  'marketing.home.stepTeam',
] as const

const { t } = useI18n()
const { set: setSeo } = useSeo()

const features = ref<MarketingFeature[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const groups = computed(() =>
  CATEGORIES.map((category) => ({
    ...category,
    features: category.slugs
      .map((slug) => features.value.find((feature) => feature.slug === slug))
      .filter((feature): feature is MarketingFeature => feature !== undefined),
  })).filter((category) => category.features.length > 0),
)

function localized(key: string, fallback: string): string {
  return hasMessage(key) ? t(key) : fallback
}

function featureName(feature: MarketingFeature): string {
  return localized(`marketing.features.item.${feature.slug}.name`, feature.name)
}

function featureDescription(feature: MarketingFeature): string {
  return localized(`marketing.features.item.${feature.slug}.description`, feature.description)
}

function featureIcon(slug: string): LucideIcon {
  return FEATURE_ICONS[slug] ?? Layers
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchPublicFeatures()
    features.value = result.features
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  setSeo({
    title: t('marketing.features.title'),
    description: t('marketing.features.heroBody'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
  void load()
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('marketing.features.eyebrow')"
      :title="t('marketing.features.title')"
      :description="t('marketing.features.heroBody')"
    >
      <template #actions>
        <BaseButton size="lg" to="/waitlist">{{ t('marketing.nav.waitlistCta') }}</BaseButton>
        <BaseButton size="lg" variant="secondary" to="/how-it-works">
          {{ t('marketing.features.seeWorkflow') }}
        </BaseButton>
      </template>

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          v-for="stat in STATS"
          :key="stat.key"
          class="rounded-2xl border border-line bg-surface/80 p-4 text-center shadow-xs backdrop-blur"
        >
          <dt class="order-2 mt-1 text-caption text-muted">{{ t(stat.key) }}</dt>
          <dd class="metric text-h2 font-semibold text-ink">{{ stat.value }}</dd>
        </div>
      </dl>
    </PageHero>

    <section class="sticky top-16 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <nav class="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 md:px-6" :aria-label="t('marketing.features.categoriesLabel')">
        <a
          v-for="group in groups"
          :key="group.id"
          :href="`#${group.id}`"
          class="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-small font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <component :is="group.icon" class="size-4" aria-hidden="true" />
          {{ t(group.titleKey) }}
        </a>
      </nav>
    </section>

    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div v-if="loading" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status">
          <span class="sr-only">{{ t('state.loading') }}</span>
          <div v-for="n in 6" :key="n" class="surface h-52 animate-pulse-soft" />
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
          v-else-if="groups.length === 0"
          :icon="CircleMinus"
          :title="t('marketing.features.emptyTitle')"
          :description="t('marketing.features.emptyBody')"
        />

        <div v-else class="space-y-20">
          <section
            v-for="group in groups"
            :id="group.id"
            :key="group.id"
            class="scroll-mt-32"
            :aria-labelledby="`${group.id}-heading`"
          >
            <SectionHeading
              :eyebrow="t('marketing.features.categoriesLabel')"
              :title="t(group.titleKey)"
              :description="t(group.bodyKey)"
              align="start"
            />

            <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <article
                v-for="(feature, index) in group.features"
                :key="feature.slug"
                class="surface flex flex-col p-6"
                data-aos="fade-up"
                :data-aos-delay="index * 40"
              >
                <div class="flex items-start justify-between gap-3">
                  <span class="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
                    <component :is="featureIcon(feature.slug)" class="size-5" aria-hidden="true" />
                  </span>
                  <BaseBadge
                    :tone="feature.status === 'available' ? 'success' : 'info'"
                    size="sm"
                    :dot="feature.status === 'available'"
                  >
                    {{ feature.status === 'available' ? t('marketing.features.available') : t('marketing.features.comingSoon') }}
                  </BaseBadge>
                </div>

                <h3 class="mt-4 text-h3 font-semibold text-ink">{{ featureName(feature) }}</h3>
                <p class="mt-2 text-body leading-relaxed text-muted">{{ featureDescription(feature) }}</p>

                <span class="mt-auto inline-flex items-center gap-1.5 pt-5 text-small font-medium text-brand-ink">
                  {{ t('marketing.features.included') }}
                  <CheckCircle2 class="size-4" aria-hidden="true" />
                </span>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>

    <section class="border-y border-line bg-surface-2 py-16 md:py-24">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          :eyebrow="t('marketing.home.storyEyebrow')"
          :title="t('marketing.features.workflowTitle')"
          :description="t('marketing.features.workflowBody')"
        />

        <ol class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <li
            v-for="(step, index) in STEPS"
            :key="step"
            class="surface flex flex-col p-5"
            data-aos="fade-up"
            :data-aos-delay="index * 50"
          >
            <span class="metric grid size-9 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">
              {{ index + 1 }}
            </span>
            <h3 class="mt-4 text-h4 font-semibold text-ink">{{ t(step) }}</h3>
            <span class="mt-4 inline-flex items-center gap-1 text-caption text-subtle">
              {{ index < STEPS.length - 1 ? t('marketing.features.nextStep') : t('marketing.features.done') }}
              <ArrowRight v-if="index < STEPS.length - 1" class="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
              <CheckCircle2 v-else class="size-3.5 text-success" aria-hidden="true" />
            </span>
          </li>
        </ol>

        <div class="mt-8 text-center">
          <BaseButton variant="secondary" to="/how-it-works">
            {{ t('marketing.features.seeWorkflow') }}
          </BaseButton>
        </div>
      </div>
    </section>

    <div class="pt-16 md:pt-24">
      <CtaSection
        :title="t('marketing.features.ctaTitle')"
        :body="t('marketing.features.ctaBody')"
        :primary-label="t('marketing.nav.waitlistCta')"
        :secondary-label="t('marketing.nav.contact')"
        secondary-to="/contact"
      />
    </div>
  </div>
</template>
