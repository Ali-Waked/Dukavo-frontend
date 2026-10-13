import { useToastStore } from '@/stores/toastStore'

/** Collection of toast helpers for one component instance. */
export function useToast() {
  const store = useToastStore()

  function translateMessage(message: string): string {
    return message
  }

  return {
    show: store.push,
    success: (message: string, options?: { title?: string; duration?: number }) =>
      store.success(translateMessage(message), options),
    error: (message: string, options?: { title?: string; duration?: number }) =>
      store.error(translateMessage(message), options),
    warning: (message: string, options?: { title?: string; duration?: number }) =>
      store.warning(translateMessage(message), options),
    info: (message: string, options?: { title?: string; duration?: number }) =>
      store.info(translateMessage(message), options),
    dismiss: store.dismiss,
  }
}