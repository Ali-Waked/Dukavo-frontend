import { ref, watch, type Ref } from 'vue'
import { useDebounce } from '@/composables/useDebounce'
import { ApiError } from '@/lib/axiosClient'

/**
 * Where a slug stands relative to the active tenant's catalogue.
 *
 * `idle` means "nothing to check yet" (the field is empty), which is different
 * from `available`: an empty slug is not a claim, it just lets the server derive
 * one from the name.
 */
export type SlugAvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export interface SlugCheckResult {
  slug: string
  available: boolean
}

export interface UseSlugAvailability {
  state: Ref<SlugAvailabilityState>
}

/**
 * Watch a slug field and ask the server whether it is free.
 *
 * Typing is debounced, then each request is tagged so a slow earlier answer can
 * never overwrite a newer one — the classic out-of-order-response race. The
 * checker is injected so the same composable serves products and categories.
 *
 * @param slug   the field being typed into.
 * @param check  the tenant-scoped availability endpoint for this resource.
 * @param ignore id of the record being edited, so its own slug stays valid.
 */
export function useSlugAvailability(
  slug: Ref<string>,
  check: (slug: string, ignore?: number) => Promise<SlugCheckResult>,
  options: { ignore?: Ref<number | null>; delay?: number } = {},
): UseSlugAvailability {
  const debounced = useDebounce(slug, options.delay ?? 350)
  const state = ref<SlugAvailabilityState>('idle')
  let latest = 0

  watch(debounced, async (value): Promise<void> => {
    const candidate = value.trim()

    if (candidate === '') {
      state.value = 'idle'
      return
    }

    const requestId = ++latest
    state.value = 'checking'

    try {
      const result = await check(candidate, options.ignore?.value ?? undefined)

      // A newer keystroke has already fired; this answer is stale.
      if (requestId !== latest) {
        return
      }

      state.value = result.available ? 'available' : 'taken'
    } catch (caught) {
      if (requestId !== latest) {
        return
      }

      // A 404 means the endpoint itself is unknown here, not that the slug is
      // contested, so fall silent rather than block the form on a false alarm.
      state.value = caught instanceof ApiError && caught.status === 404 ? 'idle' : 'error'
    }
  })

  return { state }
}
