<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { formatNumber } from '@/utils/format'

/**
 * Trend over time — a pure SVG multi-series line chart, no charting dependency.
 *
 * Mirrors RevenueChart's choices: the SVG carries its own `viewBox` so it scales
 * to any width, `dir="ltr"` is pinned because a mirrored time axis would flip the
 * meaning of "recent", the y-axis is rounded to a *nice* ceiling so gridlines
 * land on readable numbers, and hover snaps to the nearest bucket so the readout
 * always corresponds to a real point in the payload. A legend is always rendered
 * so the meaning of each line never depends on colour alone. With `toggleable`
 * the legend becomes a set of buttons that hide and reveal whole series — the
 * axis scale, hover dots and tooltip recompute from what is actually visible.
 */

export interface TrendSeries {
  key: string
  label: string
  /** Any CSS colour, e.g. `var(--color-brand-700)`. */
  color: string
  values: number[]
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: TrendSeries[]
    loading?: boolean
    height?: number
    ariaLabel?: string
    emptyTitle?: string
    emptyDescription?: string
    /** Renders the legend as toggle buttons that show and hide whole series. */
    toggleable?: boolean
    /** Shown only when data exists but every series has been toggled off. */
    hiddenTitle?: string
    hiddenDescription?: string
  }>(),
  {
    loading: false,
    height: 260,
    ariaLabel: 'Trend over time',
    emptyTitle: '',
    emptyDescription: undefined,
    toggleable: false,
    hiddenTitle: '',
    hiddenDescription: undefined,
  },
)

const W = 640
const PAD = { top: 16, right: 16, bottom: 28, left: 40 }

const hoveredIndex = ref<number | null>(null)
const hidden = ref<Set<string>>(new Set())

const count = computed(() => props.labels.length)

/** Every series, hidden or not — drives the "no data at all" empty state. */
const dataTotal = computed(() =>
  props.series.reduce((sum, entry) => sum + entry.values.reduce((a, b) => a + b, 0), 0),
)

/** The lines actually drawn; everything rendered below is derived from these. */
const visibleSeries = computed(() => props.series.filter((entry) => !hidden.value.has(entry.key)))

function toggleSeries(key: string): void {
  const next = new Set(hidden.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  hidden.value = next
  hoveredIndex.value = null
}

// Drop toggles for series that no longer exist (range change, fresh payload).
watch(
  () => props.series.map((entry) => entry.key).join(','),
  () => {
    const present = new Set(props.series.map((entry) => entry.key))
    hidden.value = new Set([...hidden.value].filter((key) => present.has(key)))
    hoveredIndex.value = null
  },
)

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * magnitude
}

const yMax = computed(() => {
  let max = 0
  for (const entry of visibleSeries.value) {
    for (const value of entry.values) max = Math.max(max, value)
  }
  return niceCeil(max)
})

const innerW = W - PAD.left - PAD.right
const innerH = computed(() => props.height - PAD.top - PAD.bottom)

function x(index: number): number {
  const n = count.value
  return PAD.left + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
}

function y(value: number): number {
  return PAD.top + innerH.value - (value / yMax.value) * innerH.value
}

const paths = computed(() =>
  visibleSeries.value.map((entry) => ({
    key: entry.key,
    color: entry.color,
    d: entry.values
      .slice(0, count.value)
      .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`)
      .join(' '),
  })),
)

const grid = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: PAD.top + innerH.value - fraction * innerH.value,
    value: yMax.value * fraction,
  })),
)

const xTicks = computed(() => {
  if (count.value === 0) return []
  const indexes = [...new Set([0, Math.floor((count.value - 1) / 2), count.value - 1])].sort(
    (a, b) => a - b,
  )
  return indexes.map((index) => ({ x: x(index), label: props.labels[index] ?? '' }))
})

function onPointerMove(event: PointerEvent): void {
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  if (rect.width === 0 || count.value === 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  hoveredIndex.value = Math.round(ratio * (count.value - 1))
}
</script>

<template>
  <div class="relative" dir="ltr">
    <div v-if="loading">
      <BaseSkeleton :height="`${height - 40}px`" block />
    </div>

    <BaseEmptyState
      v-else-if="count === 0 || dataTotal === 0"
      compact
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <BaseEmptyState
      v-else-if="visibleSeries.length === 0"
      compact
      :title="hiddenTitle"
      :description="hiddenDescription"
    />

    <template v-else>
      <svg
        :viewBox="`0 0 ${W} ${height}`"
        class="w-full"
        role="img"
        :aria-label="ariaLabel"
        @pointermove="onPointerMove"
        @pointerleave="hoveredIndex = null"
      >
        <g>
          <line
            v-for="line in grid"
            :key="line.y"
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="line.y"
            :y2="line.y"
            class="stroke-line"
            stroke-dasharray="3 4"
            stroke-width="1"
          />
          <text
            v-for="line in grid"
            :key="`label-${line.y}`"
            :x="PAD.left - 8"
            :y="line.y + 3.5"
            text-anchor="end"
            class="fill-subtle text-[10px] tabular-nums"
          >
            {{ formatNumber(line.value) }}
          </text>
        </g>

        <path
          v-for="path in paths"
          :key="path.key"
          :d="path.d"
          fill="none"
          :stroke="path.color"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g>
          <text
            v-for="tick in xTicks"
            :key="tick.x"
            :x="tick.x"
            :y="height - 8"
            :text-anchor="tick.x <= PAD.left ? 'start' : tick.x >= W - PAD.right ? 'end' : 'middle'"
            class="fill-subtle text-[10px]"
          >
            {{ tick.label }}
          </text>
        </g>

        <g v-if="hoveredIndex !== null">
          <line
            :x1="x(hoveredIndex)"
            :x2="x(hoveredIndex)"
            :y1="PAD.top"
            :y2="PAD.top + innerH"
            class="stroke-line-strong"
            stroke-dasharray="3 3"
            stroke-width="1"
          />
          <circle
            v-for="entry in visibleSeries"
            :key="`dot-${entry.key}`"
            :cx="x(hoveredIndex)"
            :cy="y(entry.values[hoveredIndex] ?? 0)"
            r="3.5"
            :fill="entry.color"
            class="stroke-white"
            stroke-width="2"
          />
        </g>
      </svg>

      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          v-if="toggleable"
          v-for="entry in series"
          :key="`legend-toggle-${entry.key}`"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-caption font-medium text-muted transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:text-ink"
          :class="hidden.has(entry.key) ? 'opacity-50 line-through' : ''"
          :aria-pressed="!hidden.has(entry.key)"
          @click="toggleSeries(entry.key)"
        >
          <span
            class="size-2.5 rounded-full"
            aria-hidden="true"
            :style="{
              backgroundColor: hidden.has(entry.key) ? 'var(--color-line-strong)' : entry.color,
            }"
          />
          {{ entry.label }}
        </button>

        <span
          v-else
          v-for="entry in series"
          :key="`legend-${entry.key}`"
          class="inline-flex items-center gap-1.5 text-caption text-muted"
        >
          <span class="size-2.5 rounded-full" :style="{ backgroundColor: entry.color }" aria-hidden="true" />
          {{ entry.label }}
        </span>
      </div>

      <div
        v-if="hoveredIndex !== null"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-lg"
        :style="{ left: `${(x(hoveredIndex) / W) * 100}%` }"
      >
        <p class="whitespace-nowrap text-caption font-medium text-muted">
          {{ labels[hoveredIndex] }}
        </p>
        <p
          v-for="entry in visibleSeries"
          :key="`tip-${entry.key}`"
          class="flex items-center justify-between gap-4 whitespace-nowrap text-caption"
        >
          <span class="inline-flex items-center gap-1.5 text-subtle">
            <span class="size-2 rounded-full" :style="{ backgroundColor: entry.color }" aria-hidden="true" />
            {{ entry.label }}
          </span>
          <span class="font-semibold tabular-nums text-ink">
            {{ formatNumber(entry.values[hoveredIndex] ?? 0) }}
          </span>
        </p>
      </div>
    </template>
  </div>
</template>