import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useReducedMotion } from './useReducedMotion'

export interface AutoplayOptions {
  /** Time one step stays active, in ms. */
  durationMs?: number
  /** The section to observe — autoplay only runs while this is in view. */
  container?: Ref<HTMLElement | null>
}

export interface Autoplay {
  /** Index of the active step. */
  current: Ref<number>
  /** Direction of the last step change — `1` forward, `-1` backward. */
  direction: Ref<1 | -1>
  /** Bump to restart the active tab's progress animation. */
  progressKey: Ref<number>
  /** Sticky pause toggled by the visible Play/Pause control. */
  userPaused: Ref<boolean>
  /** Whether the timer and progress fills are running right now. */
  running: ComputedRef<boolean>
  /** The visitor prefers reduced motion — autoplay stays off entirely. */
  reduced: Ref<boolean>
  /** The configured step duration, for the progress animation. */
  durationMs: number
  /** Jump to a step (clamped) and restart its progress. */
  goTo(index: number, dir?: 1 | -1): void
  next(): void
  previous(): void
  toggleUserPause(): void
}

/**
 * Self-advancing stepper with the usual carousel manners.
 *
 * The timer only runs while the section is meaningfully on screen (≥40% via
 * IntersectionObserver), the tab is visible, and nobody is hovering, focusing
 * or holding it down; any of those pause the current step mid-way and resume
 * it where it left off. `userPaused` is the visitor's own sticky choice via
 * the Play/Pause button. Reduced-motion visitors never get a timer at all.
 * Every observer, listener and timeout is torn down on unmount.
 */
export function useAutoplay(stepCount: number, options: AutoplayOptions = {}): Autoplay {
  const { durationMs = 4000, container } = options

  const current = ref(0)
  const direction = ref<1 | -1>(1)
  const progressKey = ref(0)
  const userPaused = ref(false)
  const reduced = useReducedMotion()

  const inView = ref(false)
  const tabHidden = ref(document.hidden)
  const hovered = ref(false)
  const focused = ref(false)
  const pointerDown = ref(false)

  const running = computed(
    () =>
      inView.value &&
      !userPaused.value &&
      !reduced.value &&
      !tabHidden.value &&
      !hovered.value &&
      !focused.value &&
      !pointerDown.value,
  )

  /* ------------------------------- timer ------------------------------- */

  let timer: ReturnType<typeof setTimeout> | null = null
  let startedAt: number | null = null
  let remaining = durationMs

  function startTimer(): void {
    if (timer !== null) return
    startedAt = performance.now()
    timer = setTimeout(() => {
      timer = null
      startedAt = null
      const target = (current.value + 1) % stepCount
      goTo(target, 1)
    }, remaining)
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (startedAt !== null) {
      remaining = Math.max(0, remaining - (performance.now() - startedAt))
      startedAt = null
    }
  }

  /** A step change: forget the old remainder and schedule afresh if allowed. */
  function restartTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    startedAt = null
    remaining = durationMs
    if (running.value) startTimer()
  }

  watch(running, (isRunning) => (isRunning ? startTimer() : stopTimer()))

  /* --------------------------- interaction ----------------------------- */

  function goTo(index: number, dir: 1 | -1 = 1): void {
    direction.value = dir
    current.value = Math.min(Math.max(index, 0), stepCount - 1)
    progressKey.value += 1
    restartTimer()
  }

  function next(): void {
    goTo(current.value + 1, 1)
  }

  function previous(): void {
    goTo(current.value - 1, -1)
  }

  function toggleUserPause(): void {
    userPaused.value = !userPaused.value
  }

  /* --------------------------- environment ----------------------------- */

  const onVisibility = (): void => {
    tabHidden.value = document.hidden
  }
  document.addEventListener('visibilitychange', onVisibility)

  let observer: IntersectionObserver | null = null
  const unbindListeners: Array<() => void> = []

  function bindContainer(): void {
    const el = container?.value
    if (!el) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inView.value = entry.intersectionRatio >= 0.4
      },
      { threshold: [0, 0.4] },
    )
    observer.observe(el)

    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      target: EventTarget = el,
    ): void => {
      target.addEventListener(type, handler as EventListener)
      unbindListeners.push(() => target.removeEventListener(type, handler as EventListener))
    }

    on('mouseenter', () => (hovered.value = true))
    on('mouseleave', () => (hovered.value = false))
    on('focusin', () => (focused.value = true))
    on('focusout', () => {
      focused.value = el.contains(document.activeElement)
    })
    on('pointerdown', () => (pointerDown.value = true))
    on('pointerup', () => (pointerDown.value = false), window)
    on('pointercancel', () => (pointerDown.value = false), window)
  }

  if (container) watch(container, bindContainer, { immediate: true })

  onBeforeUnmount(() => {
    stopTimer()
    observer?.disconnect()
    observer = null
    for (const off of unbindListeners) off()
    unbindListeners.length = 0
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    current,
    direction,
    progressKey,
    userPaused,
    running,
    reduced,
    durationMs,
    goTo,
    next,
    previous,
    toggleUserPause,
  }
}
