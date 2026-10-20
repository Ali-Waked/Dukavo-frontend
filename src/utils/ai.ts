import type { MessageKey } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import type { BadgeTone } from '@/components/ui/badgeTones'
import type { AiHighlightSeverity } from '@/types/ai'

/**
 * Shared presentation helpers for the AI features.
 *
 * The AI client is deliberately fallible in ways an ordinary request is not —
 * the provider may be down, the feature may be switched off, or the caller may
 * simply be over their daily allowance — so the raw transport message is not
 * the most useful thing to show. These translate a failure into the clearest
 * sentence the catalogue has, falling back to the server's own wording.
 */
export function aiErrorMessage(
  caught: unknown,
  t: (key: MessageKey) => string,
): string {
  if (caught instanceof ApiError) {
    if (caught.code === 'ai_rate_limited' || caught.status === 429) {
      return t('ai.limited')
    }

    if (caught.code === 'ai_feature_disabled') {
      return t('ai.disabled')
    }

    if (caught.status === 502 || caught.status === 503) {
      return t('ai.unavailable')
    }

    if (caught.isNetworkError) {
      return t('auth.networkError')
    }

    if (caught.message) {
      return caught.message
    }
  }

  return t('ai.failed')
}

/** Map a model-chosen severity to the badge tone that reads correctly. */
export function severityTone(severity: AiHighlightSeverity): BadgeTone {
  switch (severity) {
    case 'positive':
      return 'success'
    case 'warning':
      return 'warning'
    default:
      return 'neutral'
  }
}
