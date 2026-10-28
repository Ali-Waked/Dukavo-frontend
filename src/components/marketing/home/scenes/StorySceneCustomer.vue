<script setup lang="ts">
import { CheckCircle2 } from '@/components/icons'
import { useI18n } from '@/i18n'

const { t } = useI18n()
</script>

<template>
  <div
    class="scene-card flex w-full flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 shadow-xs"
  >
    <!-- Identity row builds first -->
    <div class="scene-row flex items-center gap-3" style="--d: 0.35s">
      <span
        class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink"
      >
        {{ t('marketing.home.demoCustomerAhmed').charAt(0) }}
      </span>
      <b class="min-w-0 truncate text-small font-semibold text-ink">
        {{ t('marketing.home.demoCustomerAhmed') }}
      </b>
      <CheckCircle2 class="ms-auto size-4 shrink-0 text-success" aria-hidden="true" />
    </div>

    <!-- History row follows, carrying the recognition chip -->
    <div
      class="scene-row flex items-center justify-between gap-2 border-t border-line pt-2.5"
      style="--d: 0.6s"
    >
      <span class="text-caption text-muted">
        {{ t('marketing.home.demoPreviousOrders') }} · 12
      </span>
      <span
        class="scene-chip-pop rounded-full bg-brand-soft px-2 py-0.5 text-caption font-medium text-brand-ink ring-1 ring-brand-ring"
      >
        {{ t('marketing.home.demoIdentified') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.scene-card {
  animation: scene-pop 0.4s var(--ease-out-quart) 0.1s both;
}

.scene-row {
  animation: scene-rise 0.4s var(--ease-out-quart) var(--d, 0s) both;
}

.scene-chip-pop {
  animation: scene-bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.85s both;
}

@keyframes scene-pop {
  from {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.97);
  }
}

@keyframes scene-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}

@keyframes scene-bounce {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
}
</style>
