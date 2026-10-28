<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()

const PERMISSIONS = [
  'marketing.home.demoPermViewOrders',
  'marketing.home.demoPermEditStock',
  'marketing.home.demoPermDeleteOrders',
] as const
</script>

<template>
  <div class="flex w-full flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xs">
    <div
      v-for="(permission, index) in PERMISSIONS"
      :key="permission"
      class="scene-row flex items-center justify-between gap-2 text-small"
      :style="{ '--d': `${0.3 + index * 0.35}s` }"
    >
      <span class="text-ink">{{ t(permission) }}</span>
      <!-- Decorative switch — flips on, one by one -->
      <span class="story-toggle" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.scene-row {
  animation: scene-rise 0.4s var(--ease-out-quart) var(--d, 0s) both;
}

.story-toggle {
  position: relative;
  display: inline-block;
  width: 2.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background-color: var(--color-brand-700);
  animation: toggle-on 0.3s var(--ease-out-quart) var(--d, 0s) both;
}

.story-toggle::before {
  content: '';
  position: absolute;
  top: 0.125rem;
  inset-inline-start: 0.125rem;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background-color: #fff;
  transform: translateX(1rem);
  animation: knob-on 0.3s var(--ease-out-quart) var(--d, 0s) both;
}

[dir='rtl'] .story-toggle::before {
  transform: translateX(-1rem);
}

@keyframes scene-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}

@keyframes toggle-on {
  from {
    background-color: var(--color-surface-3);
  }
}

@keyframes knob-on {
  from {
    transform: translateX(0);
  }
}
</style>
