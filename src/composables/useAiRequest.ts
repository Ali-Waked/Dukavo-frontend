import { ref, type Ref } from 'vue'
import { useI18n } from '@/i18n'
import { aiErrorMessage } from '@/utils/ai'

/**
 * One AI request's lifecycle.
 *
 * Every AI call can end in one of four ways — it is running, it produced a
 * result, it failed for a reason worth retrying, or the feature is simply not
 * available — and each of those needs a different thing on screen. This
 * composable keeps that state in one place so every panel handles it the same
 * way and none of them invents its own loading or error copy.
 *
 * It does not fire on mount: an AI call costs money, so the caller decides when
 * to spend it. `run` can be called again to retry; `reset` clears a stale
 * result when its inputs change.
 */
export function useAiRequest<TResult>() {
  const { t } = useI18n()

  const data = ref<TResult | null>(null) as Ref<TResult | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run(request: () => Promise<TResult>): Promise<TResult | null> {
    loading.value = true
    error.value = null

    try {
      const result = await request()
      data.value = result

      return result
    } catch (caught) {
      error.value = aiErrorMessage(caught, t)

      return null
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    data.value = null
    error.value = null
  }

  return { data, loading, error, run, reset }
}
