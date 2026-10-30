<script setup lang="ts">
import { Bot, CheckCircle2, MessageSquare, ShieldCheck, TrendingUp, type LucideIcon } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'

interface AiCard {
  icon: LucideIcon
  titleKey: MessageKey
  bodyKey: MessageKey
}

const { t } = useI18n()

const CARDS: AiCard[] = [
  {
    icon: MessageSquare,
    titleKey: 'marketing.home.aiSalesTitle',
    bodyKey: 'marketing.home.aiSalesBody',
  },
  {
    icon: TrendingUp,
    titleKey: 'marketing.home.aiInsightsTitle',
    bodyKey: 'marketing.home.aiInsightsBody',
  },
  {
    icon: ShieldCheck,
    titleKey: 'marketing.home.aiApprovalTitle',
    bodyKey: 'marketing.home.aiApprovalBody',
  },
]

const APPROVALS = [
  'marketing.home.aiApprovalItem1',
  'marketing.home.aiApprovalItem2',
  'marketing.home.aiApprovalItem3',
] as const
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div class="overflow-hidden rounded-3xl bg-brand-900 text-white shadow-md" data-aos="fade-up">
        <div class="grid gap-10 p-6 md:grid-cols-[1.05fr_1fr] md:items-center md:p-12">
          <div>
            <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-caption font-medium text-white/80">
              <Bot class="size-3.5" aria-hidden="true" />
              {{ t('marketing.home.aiEyebrow') }}
            </span>
            <h2 class="mt-5 text-h1 font-semibold tracking-tight text-white">
              {{ t('marketing.home.aiTitle') }}
            </h2>
            <p class="mt-4 max-w-xl text-lead text-white/75">
              {{ t('marketing.home.aiBody') }}
            </p>

            <ul class="mt-8 grid gap-3 sm:grid-cols-3">
              <li v-for="card in CARDS" :key="card.titleKey" class="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <component :is="card.icon" class="size-5 text-accent-400" aria-hidden="true" />
                <h3 class="mt-3 text-small font-semibold text-white">{{ t(card.titleKey) }}</h3>
                <p class="mt-1 text-caption leading-relaxed text-white/65">{{ t(card.bodyKey) }}</p>
              </li>
            </ul>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-lg backdrop-blur">
            <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <span class="inline-flex items-center gap-2 text-small font-medium text-white">
                <span class="size-2 rounded-full bg-accent-400" aria-hidden="true" />
                {{ t('marketing.home.aiQueueTitle') }}
              </span>
              <span class="rounded-full bg-white/10 px-2 py-0.5 text-caption text-white/70">
                {{ t('marketing.home.aiQueueCount') }}
              </span>
            </div>

            <ul class="mt-3 space-y-2.5">
              <li
                v-for="(item, index) in APPROVALS"
                :key="item"
                class="flex items-start gap-3 rounded-xl border border-white/10 bg-brand-950/40 p-3.5"
              >
                <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-400/15 text-accent-300">
                  <CheckCircle2 class="size-4" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-small font-medium text-white">{{ t(item) }}</p>
                  <p class="mt-0.5 text-caption text-white/55">
                    {{ index === 2 ? t('marketing.home.aiQueueInsight') : t('marketing.home.aiQueueReply') }}
                  </p>
                </div>
                <span class="rounded-full border border-white/15 px-2 py-0.5 text-caption text-white/70">
                  {{ t('marketing.home.aiQueueReview') }}
                </span>
              </li>
            </ul>

            <p class="mt-4 flex items-center gap-2 text-caption text-white/55">
              <ShieldCheck class="size-3.5 shrink-0" aria-hidden="true" />
              {{ t('marketing.home.aiQueueNote') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
