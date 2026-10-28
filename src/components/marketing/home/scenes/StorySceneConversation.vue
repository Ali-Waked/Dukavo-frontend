<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex w-full flex-col gap-3">
    <!-- The message is typed in, wipe-revealed in reading direction -->
    <div
      class="scene-type max-w-[80%] rounded-2xl rounded-ss-sm border border-line bg-surface p-3 text-small text-ink shadow-xs"
    >
      {{ t('marketing.home.demoMsgJackets') }}
    </div>

    <!-- ...then the arrival chip slides up -->
    <div
      class="scene-chip ms-auto rounded-full bg-brand-700 px-2.5 py-1 text-caption font-medium text-white shadow-xs"
    >
      {{ t('marketing.home.demoNew') }} · {{ t('marketing.home.demoWhatsapp') }}
    </div>
  </div>
</template>

<style scoped>
.scene-type {
  animation: scene-wipe 0.9s steps(22, end) 0.15s both;
}

@keyframes scene-wipe {
  from {
    clip-path: inset(0 100% 0 0);
  }

  to {
    clip-path: inset(0 0 0 0);
  }
}

[dir='rtl'] .scene-type {
  animation-name: scene-wipe-rtl;
}

@keyframes scene-wipe-rtl {
  from {
    clip-path: inset(0 0 0 100%);
  }

  to {
    clip-path: inset(0 0 0 0);
  }
}

.scene-chip {
  animation: scene-rise 0.45s var(--ease-out-quart) 1.1s both;
}

@keyframes scene-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}
</style>
