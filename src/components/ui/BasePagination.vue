<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@/components/icons'
import { useI18n } from '@/i18n'

/**
 * Pagination footer driven by the backend's `meta` envelope.
 *
 * Windowed page numbers (first, last, neighbours around current with ellipses)
 * so a 900-row table does not render 900 buttons — plus the "showing X–Y of Z"
 * line, which is the answer to "did my filter do anything?".
 */

const props = withDefaults(
  defineProps<{
    meta: { current_page: number; last_page: number; from?: number | null; to?: number | null; total: number }
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ change: [page: number] }>()
const { t, dir } = useI18n()

/**
 * In RTL the flex `nav` already reverses button order (previous on the right,
 * next on the left), so the icons must be mirrored to match — one mechanism,
 * not two. Left/right names here are the *visual* directions.
 */
const prevIcon = computed(() => (dir.value === 'rtl' ? ChevronRight : ChevronLeft))
const nextIcon = computed(() => (dir.value === 'rtl' ? ChevronLeft : ChevronRight))

const pages = computed<Array<number | 'gap'>>(() => {
  const { current_page: current, last_page: last } = props.meta
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const wanted = new Set<number>([1, last, current - 1, current, current + 1])
  const sorted = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)

  const result: Array<number | 'gap'> = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('gap')
    result.push(page)
    previous = page
  }
  return result
})

const showing = computed(() =>
  t('pagination.showing', {
    from: props.meta.from ?? 0,
    to: props.meta.to ?? 0,
    total: props.meta.total,
  }),
)

function go(page: number): void {
  if (props.disabled) return
  if (page < 1 || page > props.meta.last_page || page === props.meta.current_page) return
  emit('change', page)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
    <p class="text-small text-muted" aria-live="polite">{{ showing }}</p>

    <nav class="flex items-center gap-1" :aria-label="t('pagination.label')">
      <button
        type="button"
        class="btn-icon"
        :disabled="meta.current_page <= 1 || disabled"
        :aria-label="t('pagination.previous')"
        @click="go(meta.current_page - 1)"
      >
        <component :is="prevIcon" class="size-4" />
      </button>

      <template v-for="(item, index) in pages" :key="index">
        <span v-if="item === 'gap'" class="px-1.5 text-small text-subtle" aria-hidden="true">
          …
        </span>
        <button
          v-else
          type="button"
          class="min-w-8 rounded-md px-2 py-1.5 text-sm font-medium transition"
          :class="
            item === meta.current_page
              ? 'bg-brand-soft text-brand-ink'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          "
          :aria-current="item === meta.current_page ? 'page' : undefined"
          :aria-label="t('pagination.goToPage', { page: item })"
          :disabled="disabled"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </template>

      <button
        type="button"
        class="btn-icon"
        :disabled="meta.current_page >= meta.last_page || disabled"
        :aria-label="t('pagination.next')"
        @click="go(meta.current_page + 1)"
      >
        <component :is="nextIcon" class="size-4" />
      </button>
    </nav>
  </div>
</template>