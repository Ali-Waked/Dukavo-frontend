import { onUnmounted } from 'vue'

/**
 * Document metadata for the public marketing pages.
 *
 * The app deliberately has no head-management dependency. This composes the
 * handful of tags that actually matter — title, description, canonical, Open
 * Graph, Twitter card, robots and optional JSON-LD — and removes anything it
 * created when the page unmounts, so public metadata cannot leak into the
 * authenticated app.
 */

const BASE_TITLE = 'Dukavo'
const BASE_DESCRIPTION = 'Dukavo — commerce operations for growing businesses.'
const JSON_LD_ID = 'seo-structured-data'

export interface SeoInput {
  title?: string | null
  description?: string | null
  canonical?: string | null
  image?: string | null
  type?: 'website' | 'article'
  noindex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null
}

interface CreatedTag {
  element: Element
  previous: string | null
}

type Remember = (element: Element, previous: string | null) => void

function namedMeta(name: string, content: string | null, remember: Remember): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
    remember(tag, null)
  }
  if (content === null) {
    tag.removeAttribute('content')
  } else {
    tag.setAttribute('content', content)
  }
}

function propertyMeta(property: string, content: string | null, remember: Remember): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
    remember(tag, null)
  }
  if (content === null) {
    tag.removeAttribute('content')
  } else {
    tag.setAttribute('content', content)
  }
}

function canonicalTag(href: string | null, remember: Remember): void {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', 'canonical')
    document.head.appendChild(tag)
    remember(tag, null)
  }
  if (href === null) {
    tag.removeAttribute('href')
  } else {
    tag.setAttribute('href', href)
  }
}

export function useSeo(): { set: (input: SeoInput) => void } {
  const created: CreatedTag[] = []
  let jsonLdElement: Element | null = null

  function remember(element: Element, previous: string | null): void {
    created.push({ element, previous })
  }

  const previousTitle = typeof document !== 'undefined' ? document.title : BASE_TITLE
  const previousDescription =
    typeof document !== 'undefined'
      ? (document.querySelector<HTMLMetaElement>('meta[name="description"]')?.getAttribute('content') ??
        BASE_DESCRIPTION)
      : BASE_DESCRIPTION

  function setJsonLd(data: SeoInput['jsonLd']): void {
    document.getElementById(JSON_LD_ID)?.remove()
    jsonLdElement = null

    if (!data) return

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = JSON_LD_ID
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
    jsonLdElement = script
  }

  function set(input: SeoInput): void {
    if (typeof document === 'undefined') {
      return
    }

    const title = input.title?.trim()
    document.title = !title
      ? previousTitle || BASE_TITLE
      : title === BASE_TITLE
        ? BASE_TITLE
        : `${title} · ${BASE_TITLE}`

    const description = input.description?.trim() || BASE_DESCRIPTION
    namedMeta('description', description, remember)
    namedMeta('robots', input.noindex ? 'noindex, nofollow' : 'index, follow', remember)

    const href = input.canonical ?? `${window.location.origin}${window.location.pathname}`
    canonicalTag(href, remember)

    propertyMeta('og:title', document.title, remember)
    propertyMeta('og:description', description, remember)
    propertyMeta('og:type', input.type ?? 'website', remember)
    propertyMeta('og:url', href, remember)
    propertyMeta('og:site_name', BASE_TITLE, remember)
    propertyMeta('og:locale', document.documentElement.lang === 'ar' ? 'ar_AR' : 'en_US', remember)
    if (input.image) {
      propertyMeta('og:image', input.image, remember)
    }

    namedMeta('twitter:card', input.image ? 'summary_large_image' : 'summary', remember)
    namedMeta('twitter:title', document.title, remember)
    namedMeta('twitter:description', description, remember)
    if (input.image) {
      namedMeta('twitter:image', input.image, remember)
    }

    setJsonLd(input.jsonLd)
  }

  onUnmounted(() => {
    if (typeof document === 'undefined') {
      return
    }

    for (const tag of created.reverse()) {
      if (tag.previous === null) {
        tag.element.remove()
      } else if (tag.element instanceof HTMLMetaElement) {
        tag.element.setAttribute('content', tag.previous)
      }
    }
    created.length = 0

    if (jsonLdElement?.isConnected) {
      jsonLdElement.remove()
    }
    jsonLdElement = null

    document.title = previousTitle || BASE_TITLE
    namedMeta('description', previousDescription, () => undefined)
  })

  return { set }
}
