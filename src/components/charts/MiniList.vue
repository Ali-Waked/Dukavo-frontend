<script setup lang="ts">
import type { BadgeTone } from '@/components/ui/badgeTones'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'

export interface MiniListItem {
  id: number | string
  title: string
  meta?: string
  /** Right-aligned figure or badge content. */
  trailing?: string
  trailingTone?: BadgeTone
}

/**
 * Dense secondary list: low stock, dead stock, recent activity — anywhere the
 * row itself is the link and the details are one line deep.
 */
withDefaults(
  defineProps<{
    items: MiniListItem[]
    loading?: boolean
    /** Renders rows as clickable buttons; false keeps them inert text. */
    selectable?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  { loading: false, selectable: true, emptyTitle: undefined, emptyDescription: undefined },
)

defineEmits<{ select: [id: number | string] }>()
</script>

<template>
  <div v-if="loading" class="space-y-3">
    <BaseSkeleton v-for="index in 4" :key="index" height="h-9" />
  </div>

  <BaseEmptyState
    v-else-if="items.length === 0"
    compact
    :title="emptyTitle ?? ''"
    :description="emptyDescription"
  />

  <ul v-else class="divide-y divide-line">
    <li v-for="item in items" :key="item.id">
      <component
        :is="selectable ? 'button' : 'div'"
        :type="selectable ? 'button' : undefined"
        class="flex w-full items-center justify-between gap-3 py-2.5 text-start transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :class="selectable ? 'cursor-pointer hover:bg-surface-2/70' : ''"
        @click="selectable && $emit('select', item.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium text-ink">{{ item.title }}</span>
          <span v-if="item.meta" class="block truncate text-caption text-subtle">
            {{ item.meta }}
          </span>
        </span>

        <span
          v-if="item.trailing"
          class="shrink-0 rounded-md px-2 py-0.5 text-caption font-semibold tabular-nums"
          :class="{
            'bg-surface-2 text-muted': (item.trailingTone ?? 'neutral') === 'neutral',
            'bg-brand-soft text-brand-ink': item.trailingTone === 'brand',
            'bg-success-soft text-success-ink': item.trailingTone === 'success',
            'bg-warning-soft text-warning-ink': item.trailingTone === 'warning',
            'bg-danger-soft text-danger-ink': item.trailingTone === 'danger',
            'bg-info-soft text-info-ink': item.trailingTone === 'info',
          }"
        >
          {{ item.trailing }}
        </span>
      </component>
    </li>
  </ul>
</template>