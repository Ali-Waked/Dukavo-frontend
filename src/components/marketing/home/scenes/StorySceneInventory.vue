<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CheckCircle2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useReducedMotion } from '@/composables/useReducedMotion'

const { t } = useI18n()
const reduced = useReducedMotion()

const STOCK_START = 14
const STOCK_END = 12

const stock = ref(STOCK_START)
const low = ref(false)

let counter: ReturnType<typeof setInterval> | null = null

function settle(): void {
  stock.value = STOCK_END
  low.value = true
}

onMounted(() => {
  if (reduced.value) {
    settle()
    return
  }
  counter = setInterval(() => {
    stock.value -= 1
    if (stock.value <= STOCK_END) {
      settle()
      if (counter !== null) {
        clearInterval(counter)
        counter = null
      }
    }
  }, 450)
})

onBeforeUnmount(() => {
  if (counter !== null) clearInterval(counter)
})
</script>

<template>
  <div class="flex w-full flex-col gap-3">
    <!-- Jacket: bars grow, stock ticks 14 → 12, the low bar turns amber -->
    <div class="scene-row rounded-xl border border-line bg-surface p-3.5 shadow-xs" style="--d: 0.2s">
      <div class="flex items-center justify-between gap-2 text-small">
        <span class="text-ink">{{ t('marketing.home.demoProductJacket') }}</span>
        <b class="metric">{{ stock }}</b>
      </div>
      <span class="relative mt-2 block h-2 overflow-hidden rounded-full bg-surface-3">
        <span
          class="story-bar absolute inset-y-0 start-0 block w-[60%] rounded-full bg-brand-700"
          style="--bar-d: 0.3s"
        />
        <span
          class="absolute inset-y-0 start-0 block w-[60%] rounded-full bg-warning transition-opacity duration-300"
          :class="low ? 'opacity-100' : 'opacity-0'"
        />
      </span>
      <p class="mt-2 flex items-center gap-1.5 text-caption text-warning-ink">
        <CheckCircle2 class="size-3.5" aria-hidden="true" />
        {{ t('marketing.home.demoStockAlert') }}
      </p>
    </div>

    <!-- Second product bar grows alongside it -->
    <div class="scene-row rounded-xl border border-line bg-surface p-3.5 shadow-xs" style="--d: 0.5s">
      <div class="flex items-center justify-between gap-2 text-small">
        <span class="text-ink">{{ t('marketing.home.demoProductShirt') }}</span>
      </div>
      <span class="relative mt-2 block h-2 overflow-hidden rounded-full bg-surface-3">
        <span
          class="story-bar absolute inset-y-0 start-0 block w-[75%] rounded-full bg-brand-700"
          style="--bar-d: 0.55s"
        />
      </span>
    </div>
  </div>
</template>

<style scoped>
.scene-row {
  animation: scene-rise 0.4s var(--ease-out-quart) var(--d, 0s) both;
}

.story-bar {
  transform-origin: left center;
  animation: scene-grow 0.7s var(--ease-out-quart) var(--bar-d, 0.3s) both;
}

[dir='rtl'] .story-bar {
  transform-origin: right center;
}

@keyframes scene-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}

@keyframes scene-grow {
  from {
    transform: scaleX(0);
  }
}
</style>
