<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; label?: string }>(), {
  size: 'md',
  label: undefined,
})
</script>

<template>
  <span
    class="inline-flex animate-spin items-center justify-center text-brand-ink"
    :class="size === 'sm' ? 'size-4' : size === 'lg' ? 'size-8' : 'size-5'"
    role="status"
    :aria-label="label ?? 'Loading'"
  >
    <svg viewBox="0 0 24 24" fill="none" class="size-full" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" class="opacity-20" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>