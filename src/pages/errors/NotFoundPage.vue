<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { Compass } from '@/components/icons'
import { useI18n } from '@/i18n'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const router = useRouter()

function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/dashboard')
}
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
    <span
      class="mb-5 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink ring-1 ring-brand-soft-border"
    >
      <Compass class="size-7" aria-hidden="true" />
    </span>

    <p class="text-caption font-semibold uppercase tracking-widest text-subtle">404</p>
    <h1 class="mt-2 text-h1 font-semibold tracking-tight text-ink">
      {{ t('error.notFoundTitle') }}
    </h1>
    <p class="mt-2 max-w-md text-body text-muted">{{ t('error.notFoundBody') }}</p>

    <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
      <RouterLink to="/dashboard">
        <BaseButton>{{ t('error.goHome') }}</BaseButton>
      </RouterLink>
      <BaseButton variant="secondary" @click="goBack">{{ t('pagination.previous') }}</BaseButton>
    </div>
  </div>
</template>