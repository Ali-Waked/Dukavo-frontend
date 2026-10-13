<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Dropdown menu anchored to a trigger button.
 *
 * Closes on outside click and Escape, returns focus to the trigger on close,
 * and repositions itself against the viewport edge so a right-aligned action
 * column never spills off the page.
 */

const props = withDefaults(
  defineProps<{
    /** Aligns the menu's end edge with the trigger (for row-level actions). */
    align?: 'start' | 'end'
  }>(),
  { align: 'start' },
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value ? close() : show()
}

function show(): void {
  open.value = true
  requestAnimationFrame(() => {
    const menu = root.value?.querySelector<HTMLElement>('[role="menu"]')
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  })
}

function close(focusTrigger = true): void {
  if (!open.value) return
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}

function onDocumentClick(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close(false)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({ open: () => show(), close: () => close() })
</script>

<template>
  <div ref="root" class="relative inline-block">
    <div
      ref="trigger"
      @click.prevent.stop="toggle"
      @keydown.enter.prevent.stop="toggle"
      @keydown.space.prevent.stop="toggle"
    >
      <slot name="trigger" :open="open" />
    </div>

    <Transition name="pop">
      <div
        v-if="open"
        role="menu"
        class="absolute top-full z-40 mt-1 min-w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-xl"
        :class="align === 'end' ? 'end-0' : 'start-0'"
        @keydown.esc="close()"
      >
        <slot :close="() => close()" />
      </div>
    </Transition>
  </div>
</template>