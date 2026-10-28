<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const maskId = `story-connector-${useId()}`
const CONNECTOR = 'M30 0 C 30 16 70 16 70 32'
</script>

<template>
  <div class="flex w-full flex-col">
    <div
      class="scene-fade max-w-[80%] rounded-2xl rounded-ss-sm border border-line bg-surface p-3 text-small text-ink shadow-xs"
    >
      {{ t('marketing.home.demoMsgJackets') }}
    </div>

    <!-- A dashed line that draws itself from the bubble down to the ticket -->
    <svg
      class="scene-connector my-1 h-8 w-full"
      viewBox="0 0 200 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask :id="maskId">
          <path
            :d="CONNECTOR"
            class="scene-connector-draw"
            fill="none"
            stroke="white"
            stroke-width="8"
            stroke-linecap="round"
            pathLength="1"
            vector-effect="non-scaling-stroke"
          />
        </mask>
      </defs>
      <path
        :d="CONNECTOR"
        :mask="`url(#${maskId})`"
        class="text-brand-700"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray="4 4"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <div class="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
      <div class="scene-row flex items-center justify-between gap-2" style="--d: 0.9s">
        <b class="text-small font-semibold text-ink">#1043</b>
        <span
          class="rounded-full bg-info-soft px-2 py-0.5 text-caption font-medium text-info-ink"
        >
          {{ t('status.order.confirmed') }}
        </span>
      </div>
      <p class="scene-row mt-2 text-caption text-muted" style="--d: 1.1s">
        {{ t('marketing.home.demoMsgJackets') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.scene-fade {
  animation: scene-fade 0.3s ease both;
}

.scene-row {
  animation: scene-rise 0.4s var(--ease-out-quart) var(--d, 0s) both;
}

.scene-connector-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: scene-draw 0.6s ease-out 0.35s both;
}

/* The connector starts on the reader's side — mirror the whole line for RTL. */
[dir='rtl'] .scene-connector {
  transform: scaleX(-1);
}

@keyframes scene-fade {
  from {
    opacity: 0;
  }
}

@keyframes scene-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}

@keyframes scene-draw {
  from {
    stroke-dashoffset: 1;
  }
}
</style>
