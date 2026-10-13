<script setup lang="ts">
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'

export interface MeterItem {
  id: number | string
  label: string
  meta?: string
  /** Trailing figure, already formatted (revenue, units…). */
  value: string
  /** 0–1 share of the leader; drives the bar length. */
  ratio: number
}

/**
 * Ranked list with proportional bars — top sellers, share of any whole.
 *
 * The bar is a plain block inside a track, so under RTL it grows from the right
 * edge with no direction logic here: flow does the work.
 */
withDefaults(
  defineProps<{
    items: MeterItem[]
    loading?: boolean
    /** Renders rows as clickable buttons; false keeps them inert text. */
    selectable?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    loading: false,
    selectable: true,
    emptyTitle: undefined,
    emptyDescription: undefined,
  },
)

defineEmits<{ select: [id: number | string] }>()
</script>

<template>
  <div v-if="loading" class="space-y-4">
    <BaseSkeleton v-for="index in 4" :key="index" height="h-10" />
  </div>

  <BaseEmptyState
    v-else-if="items.length === 0"
    compact
    :title="emptyTitle ?? ''"
    :description="emptyDescription"
  />

  <ul v-else class="space-y-4">
    <li v-for="item in items" :key="item.id">
      <component
        :is="selectable ? 'button' : 'div'"
        :type="selectable ? 'button' : undefined"
        class="block w-full rounded-md text-start transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :class="selectable ? 'cursor-pointer hover:opacity-80' : ''"
        @click="selectable && $emit('select', item.id)"
      >
        <div class="flex items-baseline justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink">{{ item.label }}</p>
            <p v-if="item.meta" class="truncate text-caption text-subtle">{{ item.meta }}</p>
          </div>
          <p class="shrink-0 text-sm font-semibold tabular-nums text-ink">{{ item.value }}</p>
        </div>

        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            class="h-full rounded-full bg-brand-700 transition-[inline-size] duration-500 ease-out motion-reduce:transition-none"
            :style="{ inlineSize: `${Math.max(2, Math.round(item.ratio * 100))}%` }"
          />
        </div>
      </component>
    </li>
  </ul>
</template>