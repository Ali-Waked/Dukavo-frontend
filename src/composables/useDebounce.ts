import { ref, watch, type Ref } from 'vue'

/**
 * Debounce a reactive value. Pass its ref through here and read the returned
 * ref, which only changes after `delay` ms of quiet. Ideal for search-as-you-type
 * inputs that must not fire a request per keystroke.
 */
export function useDebounce<T>(value: Ref<T>, delay = 250): Ref<T> {
  const debounced = ref(value.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(value, (next) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      debounced.value = next
    }, delay)
  })

  return debounced
}