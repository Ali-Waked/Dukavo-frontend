import { onUnmounted } from 'vue'

/**
 * Minimal document metadata for the public marketing pages.
 *
 * The app has no head-management dependency, and the marketing pages are the
 * only place a specific `<title>` and description genuinely matter (search
 * results and shared links). This sets the two tags directly and restores the
 * description when the page unmounts, so a re-render cannot strand a stale
 * description on the next page.
 */

const BASE_TITLE = 'Dukavo'

function descriptionTag(): HTMLMetaElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', 'description')
    document.head.appendChild(tag)
  }

  return tag
}

export interface SeoInput {
  title?: string | null
  description?: string | null
}

export function useSeo(): { set: (input: SeoInput) => void } {
  const previousDescription =
    typeof document !== 'undefined'
      ? (document.querySelector<HTMLMetaElement>('meta[name="description"]')?.getAttribute('content') ?? null)
      : null

  function set(input: SeoInput): void {
    if (typeof document === 'undefined') {
      return
    }

    if (input.title) {
      document.title = `${input.title} · ${BASE_TITLE}`
    }

    if (input.description) {
      descriptionTag()?.setAttribute('content', input.description)
    }
  }

  onUnmounted(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.title = BASE_TITLE

    if (previousDescription !== null) {
      descriptionTag()?.setAttribute('content', previousDescription)
    }
  })

  return { set }
}
