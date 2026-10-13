<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RevenuePoint } from '@/types/dashboard'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import { formatCompact, formatCurrency, formatDate, formatNumber } from '@/utils/format'

/**
 * Revenue over time — a pure SVG area chart, no charting dependency.
 *
 * Notes on the choices inside:
 *  - The SVG carries its own coordinate system (`viewBox`) so it scales to any
 *    card width without re-layout code, and `dir="ltr"` is pinned on the
 *    wrapper: a time axis that mirrors under RTL flips the meaning of "recent".
 *  - The y-axis is rounded to a *nice* ceiling (1/2/5 × 10ⁿ) so gridlines land
 *    on readable numbers instead of the data maximum.
 *  - Hover snaps to the nearest data point rather than tracking pixels, so the
 *    readout always corresponds to a real day that exists in the payload.
 */

const props = withDefaults(
  defineProps<{
    points: RevenuePoint[]
    currency?: string
    loading?: boolean
    height?: number
    /** Presentation strings arrive from the page — the chart never imports i18n. */
    dashboardNoRevenue?: string
    ariaLabel?: string
    ordersWord?: string
  }>(),
  {
    currency: 'USD',
    loading: false,
    height: 264,
    dashboardNoRevenue: '',
    ariaLabel: 'Revenue over time',
    ordersWord: '',
  },
)

const W = 760
const PAD = { top: 18, right: 16, bottom: 30, left: 56 }

const hoveredIndex = ref<number | null>(null)

const innerW = W - PAD.left - PAD.right
const innerH = computed(() => props.height - PAD.top - PAD.bottom)

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * magnitude
}

const yMax = computed(() => niceCeil(Math.max(1, ...props.points.map((point) => point.total))))

const coords = computed(() =>
  props.points.map((point, index) => {
    const count = props.points.length
    const x = PAD.left + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW)
    const y = PAD.top + innerH.value - (point.total / yMax.value) * innerH.value
    return { x, y, point }
  }),
)

const linePath = computed(() =>
  coords.value
    .map((entry, index) => `${index === 0 ? 'M' : 'L'}${entry.x.toFixed(2)},${entry.y.toFixed(2)}`)
    .join(' '),
)

const areaPath = computed(() => {
  const entries = coords.value
  if (entries.length === 0) return ''
  const first = entries[0]
  const last = entries[entries.length - 1]
  if (!first || !last) return ''
  const baseline = (PAD.top + innerH.value).toFixed(2)
  return `${linePath.value} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`
})

const grid = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: PAD.top + innerH.value - fraction * innerH.value,
    value: yMax.value * fraction,
  })),
)

const xTicks = computed(() => {
  const entries = coords.value
  if (entries.length === 0) return []
  const indexes = new Set([0, entries.length - 1, Math.floor((entries.length - 1) / 2)])
  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => ({ x: entries[index]?.x ?? 0, label: formatDate(entries[index]?.point.date ?? '') }))
})

const hovered = computed(() =>
  hoveredIndex.value === null ? null : (coords.value[hoveredIndex.value] ?? null),
)

const tooltipStyle = computed(() => {
  if (!hovered.value) return {}
  return {
    left: `${(hovered.value.x / W) * 100}%`,
    top: `${(hovered.value.y / props.height) * 100}%`,
  }
})

function onPointerMove(event: PointerEvent): void {
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  if (rect.width === 0 || props.points.length === 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const index = Math.round(ratio * (props.points.length - 1))
  hoveredIndex.value = index
}
</script>

<template>
  <div class="relative" dir="ltr">
    <div v-if="loading">
      <BaseSkeleton :height="`${height - 40}px`" block />
    </div>

    <BaseEmptyState
      v-else-if="points.length === 0"
      compact
      :title="formatCurrency(0, currency)"
      :description="dashboardNoRevenue"
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
        <defs>
          <linearGradient id="dukavo-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-brand-700)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--color-brand-700)" stop-opacity="0.02" />
          </linearGradient>
        </defs>

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
            :x="PAD.left - 10"
            :y="line.y + 3.5"
            text-anchor="end"
            class="fill-subtle text-[10px] tabular-nums"
          >
            {{ formatCompact(line.value) }}
          </text>
        </g>

        <path :d="areaPath" fill="url(#dukavo-revenue-fill)" />
        <path
          :d="linePath"
          fill="none"
          stroke="var(--color-brand-700)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g>
          <text
            v-for="tick in xTicks"
            :key="tick.label"
            :x="tick.x"
            :y="height - 10"
            :text-anchor="tick.x <= PAD.left ? 'start' : tick.x >= W - PAD.right ? 'end' : 'middle'"
            class="fill-subtle text-[10px]"
          >
            {{ tick.label }}
          </text>
        </g>

        <g v-if="hovered">
          <line
            :x1="hovered.x"
            :x2="hovered.x"
            :y1="PAD.top"
            :y2="PAD.top + innerH"
            class="stroke-brand-700"
            stroke-dasharray="3 3"
            stroke-width="1"
          />
          <circle
            :cx="hovered.x"
            :cy="hovered.y"
            r="4.5"
            class="fill-brand-700 stroke-white"
            stroke-width="2"
          />
        </g>
      </svg>

      <div
        v-if="hovered"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center shadow-lg"
        :style="tooltipStyle"
      >
        <p class="whitespace-nowrap text-caption font-medium text-muted">
          {{ formatDate(hovered.point.date) }}
        </p>
        <p class="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
          {{ formatCurrency(hovered.point.total, currency) }}
        </p>
        <p class="whitespace-nowrap text-caption text-subtle">
          {{ formatNumber(hovered.point.orders) }} {{ ordersWord }}
        </p>
      </div>
    </template>
  </div>
</template>