<script setup lang="ts">
import { BADGE_DOT_CLASSES, BADGE_TONE_CLASSES, type BadgeTone } from './badgeTones'

/** Small pill for statuses and counts. Tones are semantic, never decorative. */
const props = withDefaults(
  defineProps<{
    tone?: BadgeTone
    /** Renders a small leading dot — useful when a colour alone is the signal. */
    dot?: boolean
    size?: 'sm' | 'md'
  }>(),
  { tone: 'neutral', dot: false, size: 'md' },
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border font-medium"
    :class="[
      BADGE_TONE_CLASSES[props.tone],
      size === 'sm' ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-1 text-small',
    ]"
  >
    <span
      v-if="dot"
      class="size-1.5 shrink-0 rounded-full"
      :class="BADGE_DOT_CLASSES[props.tone]"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>