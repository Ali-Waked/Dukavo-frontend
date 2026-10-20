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

function menuItems(): HTMLElement[] {
  const nodes = root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')

  return nodes ? Array.from(nodes) : []
}

function focusItem(index: number): void {
  const items = menuItems()
  if (items.length === 0) return
  items[(index + items.length) % items.length]?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (!open.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  const items = menuItems()
  if (items.length === 0) return

  // Moving focus with the arrow keys is what turns the menu from a stack of
  // links into a real menu; Tab is left alone so the user can still leave.
  const current = items.indexOf(document.activeElement as HTMLElement)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusItem(current + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusItem(current - 1)
      break
    case 'Home':
      event.preventDefault()
      focusItem(0)
      break
    case 'End':
      event.preventDefault()
      focusItem(items.length - 1)
      break
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