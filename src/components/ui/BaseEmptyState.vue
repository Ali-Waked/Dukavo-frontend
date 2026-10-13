<script setup lang="ts">
import type { LucideIcon } from '@/components/icons'
import { Inbox } from '@/components/icons'

/**
 * The empty state, in every use: no data yet, no search matches, no permission.
 * One component so "nothing here" always looks like a considered state rather
 * than a missing feature.
 */
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: LucideIcon
    compact?: boolean
  }>(),
  { description: undefined, icon: undefined, compact: false },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center" :class="compact ? 'p-6' : 'px-6 py-14'">
    <span class="mb-4 grid size-12 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
      <component :is="icon ?? Inbox" class="size-6" aria-hidden="true" />
    </span>
    <h3 class="text-h4 font-semibold text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 max-w-md text-body text-muted">{{ description }}</p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>