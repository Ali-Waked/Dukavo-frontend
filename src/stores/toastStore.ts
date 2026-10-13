import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title?: string
  message: string
  /** Milliseconds before auto-dismiss; 0 keeps the toast until closed. */
  duration: number
}

let nextId = 1

/**
 * Transient feedback.
 *
 * Toasts are fire-and-forget by design: nothing awaits a toast, a toast never
 * blocks navigation, and a mutating action that wants to surface an error does
 * so by *calling* one, not by returning a flag the caller must remember to
 * check. The host component renders the queue; this store is the queue.
 */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function push(
    tone: ToastTone,
    message: string,
    options: { title?: string; duration?: number } = {},
  ): number {
    const id = nextId++
    const duration = options.duration ?? (tone === 'error' ? 8000 : 5000)

    toasts.value.push({ id, tone, title: options.title, message, duration })

    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    }

    return id
  }

  function success(message: string, options?: { title?: string; duration?: number }): number {
    return push('success', message, options)
  }

  function error(message: string, options?: { title?: string; duration?: number }): number {
    return push('error', message, options)
  }

  function warning(message: string, options?: { title?: string; duration?: number }): number {
    return push('warning', message, options)
  }

  function info(message: string, options?: { title?: string; duration?: number }): number {
    return push('info', message, options)
  }

  function dismiss(id: number): void {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return { toasts, push, success, error, warning, info, dismiss }
})