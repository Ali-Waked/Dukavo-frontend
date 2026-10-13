import { ref } from 'vue'

/**
 * A minimal open/close state for dialogs and drawers. Keeps the "is this modal
 * open?" concern out of every page that needs one, and gives templates one
 * consistent trio: `open`, `close`, `toggle`.
 */
export function useModal(initial = false) {
  const isOpen = ref(initial)

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  return { isOpen, open, close, toggle }
}