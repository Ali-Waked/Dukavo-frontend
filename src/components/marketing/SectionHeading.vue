<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    align?: 'center' | 'start'
  }>(),
  { eyebrow: undefined, description: undefined, align: 'center' },
)
</script>

<template>
  <div :class="align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl text-start'">
    <span
      v-if="eyebrow"
      class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
    >
      {{ eyebrow }}
    </span>
    <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">{{ title }}</h2>
    <p v-if="description" class="mt-3 text-lead text-muted">{{ description }}</p>
  </div>
</template>
