<script setup lang="ts">
import { useId } from 'vue'

export interface TabItem {
  key: string
  label: string
  /** Optional count badge (e.g. conversation queues). */
  count?: number
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    tabs: TabItem[]
    modelValue?: string
  }>(),
  { modelValue: '' },
)

const emit = defineEmits<{ 'update:modelValue': [key: string] }>()
const id = useId()

function select(tab: TabItem): void {
  if (tab.disabled) return
  emit('update:modelValue', tab.key)
}

/** Roving arrow-key navigation, as the ARIA tabs pattern expects. */
function onKeydown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()

  const enabled = props.tabs.filter((tab) => !tab.disabled)
  if (enabled.length === 0) return

  const currentIndex = enabled.findIndex((tab) => tab.key === props.modelValue)
  let nextIndex = currentIndex

  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = enabled.length - 1
  else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabled.length
  else nextIndex = (currentIndex - 1 + enabled.length) % enabled.length

  const next = enabled[nextIndex]
  if (next) select(next)
}
</script>

<template>
  <div
    class="flex items-center gap-1 overflow-x-auto border-b border-line"
    role="tablist"
    :aria-label="id"
    @keydown="onKeydown"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="tab.key === modelValue"
      :tabindex="tab.key === modelValue ? 0 : -1"
      :disabled="tab.disabled"
      class="relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        tab.key === modelValue
          ? 'border-brand-700 text-brand-ink'
          : 'border-transparent text-muted hover:border-line hover:text-ink'
      "
      @click="select(tab)"
    >
      {{ tab.label }}
      <span
        v-if="tab.count !== undefined"
        class="rounded-full px-1.5 py-0.5 text-caption font-semibold"
        :class="tab.key === modelValue ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-muted'"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>