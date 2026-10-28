<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '@/i18n'

/**
 * A single hand-drawn wave stroke under one phrase.
 *
 * The whole phrase lives in this component's wrapper (`relative inline-block
 * whitespace-nowrap`), so the stroke is one unbroken SVG spanning it — a plain
 * text-decoration would split per word and per line box. The dash animation
 * plays once after the headline entrance, replays immediately on locale
 * switch, and renders fully drawn without motion when the visitor prefers
 * reduced motion.
 */
withDefaults(
  defineProps<{
    /** Stroke colour — defaults to the brand lime. */
    color?: string
    /** Draw duration in ms. */
    duration?: number
    /** Delay before the first draw, matched to the headline entrance. */
    delay?: number
  }>(),
  { color: '#A3E635', duration: 1000, delay: 1400 },
)

const { locale } = useI18n()

// Remounting the path restarts the animation; only the first draw waits for
// the entrance — a locale switch replays it straight away.
const drawId = ref(0)
const drawnOnce = ref(false)
watch(locale, () => {
  drawId.value += 1
  drawnOnce.value = true
})
</script>

<template>
  <span
    class="relative inline-block whitespace-nowrap"
    :style="{
      '--wave-duration': `${duration}ms`,
      '--wave-delay': `${drawnOnce ? 0 : delay}ms`,
    }"
  >
    <slot />
    <svg
      class="wave-svg pointer-events-none absolute inset-x-0 -bottom-2 h-3 w-full overflow-visible"
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        :key="drawId"
        class="wave-stroke"
        d="M2 7 Q 27 1 52 6 T 102 6 T 152 6 T 198 5"
        pathLength="1"
        fill="none"
        :stroke="color"
        stroke-width="3.5"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  </span>
</template>

<style scoped>
/* Arabic reads right to left — mirror the stroke so it draws that way too. */
[dir='rtl'] .wave-svg {
  transform: scaleX(-1);
}

.wave-stroke {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: wave-draw var(--wave-duration, 1s) ease-out var(--wave-delay, 0s) both;
}

@keyframes wave-draw {
  from {
    stroke-dashoffset: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave-stroke {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
