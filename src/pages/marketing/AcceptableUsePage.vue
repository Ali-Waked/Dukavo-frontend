<script setup lang="ts">
import { onMounted } from 'vue'
import { ShieldCheck } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n, type MessageKey } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import BaseButton from '@/components/ui/BaseButton.vue'
import PageHero from '@/components/marketing/PageHero.vue'

interface Section {
  id: string
  titleKey: MessageKey
  bodyKey: MessageKey
}

const SECTIONS: Section[] = [
  { id: 'lawful-use', titleKey: 'acceptable.respectTitle', bodyKey: 'acceptable.respectBody' },
  { id: 'prohibited-use', titleKey: 'acceptable.prohibitedTitle', bodyKey: 'acceptable.prohibitedBody' },
  { id: 'messaging', titleKey: 'acceptable.messagingTitle', bodyKey: 'acceptable.messagingBody' },
  { id: 'security', titleKey: 'acceptable.securityTitle', bodyKey: 'acceptable.securityBody' },
  { id: 'content', titleKey: 'acceptable.contentTitle', bodyKey: 'acceptable.contentBody' },
  { id: 'enforcement', titleKey: 'acceptable.enforcementTitle', bodyKey: 'acceptable.enforcementBody' },
]

const { t } = useI18n()
const { set: setSeo } = useSeo()

onMounted(() => {
  setSeo({
    title: t('acceptable.title'),
    description: t('acceptable.subtitle'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('acceptable.eyebrow')"
      :title="t('acceptable.title')"
      :description="t('acceptable.subtitle')"
      align="start"
    >
      <div class="flex items-start gap-3 rounded-xl border border-brand-soft-border bg-brand-soft p-4 text-body text-brand-ink">
        <ShieldCheck class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>{{ t('acceptable.intro') }}</p>
      </div>
    </PageHero>

    <section class="py-14 md:py-20">
      <div class="mx-auto max-w-4xl px-4 md:px-6">
        <div class="space-y-10">
          <section
            v-for="(section, index) in SECTIONS"
            :id="section.id"
            :key="section.id"
            class="scroll-mt-28"
            data-aos="fade-up"
            :data-aos-delay="index * 30"
          >
            <h2 class="text-h2 font-semibold text-ink">{{ t(section.titleKey) }}</h2>
            <p class="mt-3 text-body leading-relaxed text-muted">{{ t(section.bodyKey) }}</p>
          </section>
        </div>

        <div class="mt-12 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-h3 font-semibold text-ink">{{ t('acceptable.contactTitle') }}</h2>
            <p class="mt-1 text-body text-muted">{{ t('acceptable.contactBody') }}</p>
          </div>
          <BaseButton variant="secondary" to="/contact">{{ t('marketing.nav.contact') }}</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
