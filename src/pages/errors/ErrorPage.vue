<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ServerCrash } from '@/components/icons'
import { useI18n } from '@/i18n'
import { fetchBackendHealth, type BackendHealth } from '@/services/healthService'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

/**
 * The 500 landing page.
 *
 * Before telling the user to try again, it asks the backend whether it is
 * actually up — "our end is down" and "that one request failed" deserve
 * different advice, and only the health probe can tell them apart.
 */

const { t } = useI18n()
const route = useRoute()

const checking = ref(true)
const backendUp = ref<boolean | null>(null)
const health = ref<BackendHealth | null>(null)

onMounted(async () => {
  try {
    health.value = await fetchBackendHealth()
    backendUp.value = true
  } catch {
    backendUp.value = false
  } finally {
    checking.value = false
  }
})

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
    <span
      class="mb-5 grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-ink ring-1 ring-warning-border"
    >
      <ServerCrash class="size-7" aria-hidden="true" />
    </span>

    <p class="text-caption font-semibold uppercase tracking-widest text-subtle">500</p>
    <h1 class="mt-2 text-h1 font-semibold tracking-tight text-ink">
      {{ t('error.serverTitle') }}
    </h1>
    <p class="mt-2 max-w-md text-body text-muted">{{ t('error.serverBody') }}</p>

    <div
      class="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-small text-muted"
      aria-live="polite"
    >
      <template v-if="checking">{{ t('common.updatedJustNow') }}…</template>
      <template v-else-if="backendUp">
        <BaseBadge tone="success" dot>{{ t('common.yes') }}</BaseBadge>
        <span>{{ health?.status ?? 'ok' }}</span>
      </template>
      <template v-else>
        <BaseBadge tone="danger" dot>{{ t('error.networkTitle') }}</BaseBadge>
        <span>{{ t('error.networkBody') }}</span>
      </template>
    </div>

    <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
      <BaseButton @click="reload">{{ t('error.reload') }}</BaseButton>
      <RouterLink to="/dashboard">
        <BaseButton variant="secondary">{{ t('error.goHome') }}</BaseButton>
      </RouterLink>
    </div>

    <p v-if="route.query.code" class="mt-6 text-small text-subtle">
      <code>{{ route.query.code }}</code>
    </p>
  </div>
</template>