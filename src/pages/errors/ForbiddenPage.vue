<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import { ShieldAlert } from '@/components/icons'
import { useI18n } from '@/i18n'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * 403 — reached either by the router guard (a route whose permission the role
 * does not hold) or by the backend refusing a direct call. Naming the missing
 * capability when we know it turns "you can't" into "ask for X".
 */

const { t } = useI18n()
const route = useRoute()

const permission = typeof route.meta.permission === 'string' ? route.meta.permission : null
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
    <span
      class="mb-5 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger-ink ring-1 ring-danger-border"
    >
      <ShieldAlert class="size-7" aria-hidden="true" />
    </span>

    <p class="text-caption font-semibold uppercase tracking-widest text-subtle">403</p>
    <h1 class="mt-2 text-h1 font-semibold tracking-tight text-ink">
      {{ t('error.forbiddenTitle') }}
    </h1>
    <p class="mt-2 max-w-md text-body text-muted">{{ t('error.forbiddenBody') }}</p>
    <p v-if="permission" class="mt-3">
      <code class="rounded-md bg-surface-2 px-2 py-1 text-small text-muted">{{ permission }}</code>
    </p>

    <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
      <RouterLink to="/dashboard">
        <BaseButton>{{ t('error.goHome') }}</BaseButton>
      </RouterLink>
    </div>
  </div>
</template>