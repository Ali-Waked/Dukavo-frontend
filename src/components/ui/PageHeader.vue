<script setup lang="ts">
/** Page title block: heading, description, and the row of page-level actions. */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ title }}</h1>
      <p v-if="description || $slots.description" class="mt-1.5 text-body text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>