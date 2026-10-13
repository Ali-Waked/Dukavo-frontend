<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, ChevronsUpDown } from '@/components/icons'
import { useI18n } from '@/i18n'

export interface TableColumn {
  key: string
  label: string
  align?: 'start' | 'center' | 'end'
  width?: string
  sortable?: boolean
}

/**
 * Table shell: header rendered from `columns`, body supplied by the caller as
 * rows. Handles the three states that decide whether a data page is trustworthy
 * — loading (skeleton rows at the right column widths), empty (slot), and
 * settled (content). Sorting is controlled from the page so the URL stays the
 * source of truth for what the user is looking at.
 */
const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    loading?: boolean
    sortKey?: string | null
    sortDirection?: 'asc' | 'desc'
    /** Number of skeleton rows while loading. */
    skeletonRows?: number
    /**
     * The exact array the row slot iterates. When provided, the empty state
     * renders only when the list has no rows and the footer (pagination) only
     * when it has some — so a filtered page never shows "no results" under a
     * settled table. Without it the legacy behaviour is kept so every existing
     * caller behaves exactly as before.
     */
    rows?: unknown[]
  }>(),
  {
    loading: false,
    sortKey: null,
    sortDirection: 'asc',
    skeletonRows: 5,
    rows: undefined,
  },
)

const emit = defineEmits<{ sort: [key: string] }>()
const { t } = useI18n()

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const

/** `true` when the table has a settled, non-empty body to pair with the footer. */
const showFooter = computed(() => {
  if (props.loading) return false
  if (props.rows === undefined) return true
  return props.rows.length > 0
})

/** `true` when there is nothing to list but the state itself. */
const showEmpty = computed(() => {
  if (props.loading) return false
  if (props.rows === undefined) return true
  return props.rows.length === 0
})

function onSort(column: TableColumn): void {
  if (!column.sortable) return
  emit('sort', column.key)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="bg-surface-2">
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="border-b border-line px-4 py-2.5 text-caption font-semibold uppercase tracking-wide"
            :class="[ALIGN[column.align ?? 'start'], column.sortable ? 'select-none' : 'text-muted']"
            :style="column.width ? { width: column.width } : undefined"
            :aria-sort="
              sortKey === column.key
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
          >
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              :class="sortKey === column.key ? 'text-brand-ink' : 'text-muted'"
              @click="onSort(column)"
            >
              {{ column.label }}
              <ChevronsUpDown v-if="sortKey !== column.key" class="size-3.5 opacity-60" />
              <ArrowUp v-else-if="sortDirection === 'asc'" class="size-3.5" />
              <ArrowDown v-else class="size-3.5" />
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>

      <tbody v-if="loading" class="[&>tr]:border-b [&>tr]:border-line">
        <tr v-for="row in skeletonRows" :key="row">
          <td v-for="column in columns" :key="column.key" class="px-4 py-3.5">
            <div class="shimmer h-4 rounded-md" :class="column.key === columns[0]?.key ? 'w-2/3' : 'w-1/2'" />
          </td>
        </tr>
      </tbody>

      <tbody v-else class="divide-y divide-line [&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
        <slot />
      </tbody>
    </table>

    <div v-if="!loading" class="border-t border-line">
      <slot v-if="showEmpty" name="empty">
        <div class="px-4 py-10 text-center text-sm text-muted">
          {{ t('common.noResults') }}
        </div>
      </slot>
      <slot v-if="showFooter" name="footer" />
    </div>
  </div>
</template>