import { onBeforeUnmount, ref, type Ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the visitor has asked the system to reduce motion.
 *
 * CSS side this is handled by the global `prefers-reduced-motion` block in
 * `base.css`; anything driven by JavaScript (timers, counters, autoplay) must
 * ask this instead — media queries do not stop JS.
 */
export function useReducedMotion(): Ref<boolean> {
  const media = window.matchMedia(QUERY)
  const reduced = ref(media.matches)

  const update = (): void => {
    reduced.value = media.matches
  }

  media.addEventListener('change', update)
  onBeforeUnmount(() => media.removeEventListener('change', update))

  return reduced
}
