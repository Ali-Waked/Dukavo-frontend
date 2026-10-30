<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Compass, HelpCircle, MessageCircle, Package } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const { set: setSeo } = useSeo()
const router = useRouter()

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
  } else {
    void router.push('/')
  }
}

onMounted(() => {
  setSeo({ title: t('notFound.title'), description: t('notFound.body'), noindex: true })
})
</script>

<template>
  <section class="relative overflow-hidden py-20 md:py-32">
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-700/20" />
    </div>

    <div class="mx-auto max-w-3xl px-4 text-center md:px-6">
      <span class="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink ring-1 ring-brand-soft-border">
        <Compass class="size-7" aria-hidden="true" />
      </span>

      <p class="metric text-label font-semibold uppercase tracking-[0.2em] text-subtle">
        {{ t('notFound.eyebrow') }}
      </p>
      <h1 class="mt-3 text-display font-semibold tracking-tight text-ink">{{ t('notFound.title') }}</h1>
      <p class="mx-auto mt-4 max-w-md text-lead text-muted">{{ t('notFound.body') }}</p>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <BaseButton to="/">{{ t('notFound.home') }}</BaseButton>
        <BaseButton variant="secondary" :icon="ArrowLeft" @click="goBack">
          {{ t('notFound.back') }}
        </BaseButton>
      </div>

      <div class="mt-12 grid gap-4 text-start sm:grid-cols-3">
        <RouterLink to="/features" class="surface group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <Package class="size-5 text-brand-ink" aria-hidden="true" />
          <h2 class="mt-3 text-h4 font-semibold text-ink">{{ t('notFound.features') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('notFound.featuresBody') }}</p>
        </RouterLink>
        <RouterLink to="/help" class="surface group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <HelpCircle class="size-5 text-brand-ink" aria-hidden="true" />
          <h2 class="mt-3 text-h4 font-semibold text-ink">{{ t('notFound.help') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('notFound.helpBody') }}</p>
        </RouterLink>
        <RouterLink to="/contact" class="surface group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <MessageCircle class="size-5 text-brand-ink" aria-hidden="true" />
          <h2 class="mt-3 text-h4 font-semibold text-ink">{{ t('notFound.contact') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('notFound.contactBody') }}</p>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
