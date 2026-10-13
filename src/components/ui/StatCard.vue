<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from '@/components/icons'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'

/**
 * Dashboard KPI tile: one number, its direction, and where it came from.
 *
 * The delta is always directional (up/down/flat) *and* signed — colour alone
 * never carries the meaning, which is both an accessibility rule and the
 * difference between "revenue is up" and "refunds are up".
 */
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    /** Signed percentage change; null renders no delta row. */
    delta?: number | null
    /** What the delta is measured against ("vs last month"). */
    deltaLabel?: string
    /** true = higher is better (revenue); false = higher is worse (refunds). */
    higherIsBetter?: boolean
    icon?: LucideIcon
    loading?: boolean
    hint?: string
  }>(),
  {
    delta: null,
    deltaLabel: undefined,
    higherIsBetter: true,
    icon: undefined,
    loading: false,
    hint: undefined,
  },
)

const flat = computed(() => props.delta === null || props.delta === 0)

const positive = computed(() => {
  if (props.delta === null) return false
  return props.higherIsBetter ? props.delta > 0 : props.delta < 0
})

const negative = computed(() => {
  if (props.delta === null) return false
  return props.higherIsBetter ? props.delta < 0 : props.delta > 0
})

const DeltaIcon = computed<LucideIcon>(() => {
  if (flat.value) return Minus
  return props.delta! > 0 ? ArrowUpRight : ArrowDownRight
})

const deltaClasses = computed(() => {
  if (flat.value) return 'bg-surface-2 text-muted'
  return positive.value ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
})
</script>

<template>
  <div class="surface p-5">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-medium text-muted">{{ label }}</p>
      <span
        v-if="icon"
        class="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"
        aria-hidden="true"
      >
        <component :is="icon" class="size-4.5" />
      </span>
    </div>

    <template v-if="loading">
      <BaseSkeleton class="mt-3 w-2/3" height="h-8" block />
      <BaseSkeleton class="mt-3 w-1/2" height="h-5" block />
    </template>

    <template v-else>
      <p class="mt-2 text-h1 font-semibold tracking-tight tabular-nums text-ink">{{ value }}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span
          v-if="delta !== null"
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption font-semibold tabular-nums"
          :class="deltaClasses"
        >
          <DeltaIcon class="size-3.5" />
          {{ delta > 0 ? '+' : '' }}{{ delta.toFixed(1) }}%
        </span>
        <span v-if="deltaLabel && delta !== null" class="text-small text-subtle">
          {{ deltaLabel }}
        </span>
        <span v-else-if="hint" class="text-small text-subtle">{{ hint }}</span>
      </div>
    </template>
  </div>
</template>