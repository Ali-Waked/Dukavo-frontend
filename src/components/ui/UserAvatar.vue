<script setup lang="ts">
import { computed } from 'vue'
import { initials } from '@/utils/format'

/**
 * A user's avatar: their uploaded picture when there is one, their initials
 * otherwise.
 *
 * One component for the whole application so the fallback is never a stray
 * "?" sitting next to a photo elsewhere. The image is decorative to a screen
 * reader that already has the name beside it, so `alt` is empty unless a caller
 * passes a meaningful `label`.
 */

const props = withDefaults(
  defineProps<{
    name?: string | null
    src?: string | null
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Accessible label for the image; omit when the name is already read out. */
    label?: string
  }>(),
  {
    name: null,
    src: null,
    size: 'md',
    label: '',
  },
)

const SIZE = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-sm',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
} as const

const initial = computed(() => {
  const value = (props.name ?? '').trim()
  return value ? initials(value) : '?'
})
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-ink"
    :class="SIZE[size]"
  >
    <img
      v-if="src"
      :src="src"
      :alt="label"
      class="size-full object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <span v-else aria-hidden="true">{{ initial }}</span>
  </span>
</template>
