<script setup lang="ts">
import { ArrowLeft, ArrowRight, Pause, Play } from '@/components/icons'
import { useI18n } from '@/i18n'

/**
 * Prev / next arrows plus the visible Play/Pause control for the story's
 * autoplay. The pause button disappears entirely for reduced-motion visitors —
 * there is no timer for it to govern.
 */
defineProps<{
  current: number
  total: number
  userPaused: boolean
  reduced: boolean
}>()

defineEmits<{
  previous: []
  next: []
  toggle: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      class="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink disabled:opacity-45"
      :disabled="current === 0"
      :aria-label="t('action.previous')"
      @click="$emit('previous')"
    >
      <ArrowLeft class="size-4 rtl:-scale-x-100" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink disabled:opacity-45"
      :disabled="current === total - 1"
      :aria-label="t('action.next')"
      @click="$emit('next')"
    >
      <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
    </button>

    <button
      v-if="!reduced"
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-small font-medium text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      @click="$emit('toggle')"
    >
      <component :is="userPaused ? Play : Pause" class="size-4" aria-hidden="true" />
      {{ userPaused ? t('marketing.home.storyPlay') : t('marketing.home.storyPause') }}
    </button>
  </div>
</template>
