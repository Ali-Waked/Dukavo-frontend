<script setup lang="ts">
import AOS from 'aos'
import 'aos/dist/aos.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeft,
  Clock,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Newspaper,
} from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import Breadcrumbs from '@/components/marketing/Breadcrumbs.vue'
import BlogCard from '@/components/marketing/BlogCard.vue'
import { fetchPublicNewsletter, fetchPublicNewsletters } from '@/services/marketingService'
import type { NewsletterArticle, NewsletterSummary } from '@/types/marketing'
import { formatDate } from '@/utils/format'

interface TocItem {
  id: string
  text: string
  level: number
}

/**
 * A single published edition.
 *
 * The body arrives as sanitised HTML, so it is rendered as markup. After paint
 * the headings are given stable ids and collected into a table of contents;
 * that keeps the API's prose allow-list unchanged while still giving readers
 * deep links and a scroll spy. Related editions come from the same public
 * archive and exclude the current slug.
 */

const { t } = useI18n()
const { set: setSeo } = useSeo()
const route = useRoute()

const edition = ref<NewsletterArticle | null>(null)
const related = ref<NewsletterSummary[]>([])
const loading = ref(true)
const notFound = ref(false)
const error = ref<string | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const toc = ref<TocItem[]>([])
const activeId = ref('')
const copied = ref(false)

let observer: IntersectionObserver | null = null
let copyTimer: ReturnType<typeof setTimeout> | null = null

const slug = computed(() => String(route.params.slug ?? ''))
const shareUrl = computed(() => (typeof window === 'undefined' ? '' : window.location.href))
const shareText = computed(() => edition.value?.title ?? '')
const encodedUrl = computed(() => encodeURIComponent(shareUrl.value))
const encodedText = computed(() => encodeURIComponent(shareText.value))

const shareLinks = computed(() => [
  {
    label: 'WhatsApp',
    href: `https://wa.me/?text=${encodedText.value}%20${encodedUrl.value}`,
    icon: MessageCircle,
  },
  {
    label: 'X',
    href: `https://twitter.com/intent/tweet?text=${encodedText.value}&url=${encodedUrl.value}`,
    icon: ExternalLink,
  },
  {
    label: 'LinkedIn',
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl.value}`,
    icon: ExternalLink,
  },
])

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

function teardownObserver(): void {
  observer?.disconnect()
  observer = null
}

function buildToc(): void {
  teardownObserver()
  const root = bodyEl.value
  if (!root) {
    toc.value = []
    return
  }

  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
  toc.value = headings.map((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index + 1}`
    }
    return {
      id: heading.id,
      text: heading.textContent?.trim() ?? '',
      level: heading.tagName === 'H2' ? 2 : 3,
    }
  })

  activeId.value = toc.value[0]?.id ?? ''

  if (typeof IntersectionObserver === 'undefined' || toc.value.length === 0) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) {
        activeId.value = visible[0].target.id
      }
    },
    { rootMargin: '-100px 0px -65% 0px', threshold: [0, 1] },
  )

  for (const item of toc.value) {
    const element = document.getElementById(item.id)
    if (element) observer.observe(element)
  }
}

async function loadRelated(): Promise<void> {
  try {
    const result = await fetchPublicNewsletters({ per_page: 4 })
    related.value = result.data.filter((item) => item.slug !== slug.value).slice(0, 3)
  } catch {
    related.value = []
  }
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  error.value = null
  edition.value = null
  toc.value = []
  copied.value = false
  teardownObserver()

  try {
    const result = await fetchPublicNewsletter(slug.value)
    edition.value = result

    const articleUrl = `${window.location.origin}/blog/${result.slug}`
    setSeo({
      title: result.meta_title || result.title,
      description: result.meta_description || result.excerpt || undefined,
      canonical: articleUrl,
      image: result.cover_image_url,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: result.title,
        description: result.meta_description || result.excerpt || undefined,
        image: result.cover_image_url || undefined,
        datePublished: result.published_at || undefined,
        dateModified: result.updated_at || result.published_at || undefined,
        author: { '@type': 'Organization', name: 'Dukavo' },
        publisher: { '@type': 'Organization', name: 'Dukavo' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
      },
    })

    await nextTick()
    buildToc()
    void loadRelated()
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
      return
    }
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

async function copyLink(): Promise<void> {
  if (!navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = false
  }
}

onMounted(() => {
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
  void load()
})

watch(slug, () => void load())

onBeforeUnmount(() => {
  teardownObserver()
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
  <section class="py-10 md:py-16">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <Breadcrumbs
        :items="[
          { label: t('blog.title'), to: '/blog' },
          { label: edition?.title ?? t('blog.articleFallback') },
        ]"
        class="mb-8"
      />

      <div v-if="loading" class="mx-auto max-w-3xl" role="status">
        <span class="sr-only">{{ t('state.loading') }}</span>
        <div class="h-8 w-32 animate-pulse rounded bg-surface-3" />
        <div class="mt-5 h-12 w-full animate-pulse rounded bg-surface-3" />
        <div class="mt-3 h-12 w-3/4 animate-pulse rounded bg-surface-3" />
        <div class="mt-8 aspect-video w-full animate-pulse rounded-2xl bg-surface-3" />
        <div class="mt-8 space-y-3">
          <div v-for="n in 6" :key="n" class="h-4 w-full animate-pulse rounded bg-surface-3" />
        </div>
      </div>

      <BaseEmptyState
        v-else-if="notFound"
        :icon="Newspaper"
        :title="t('blog.notFoundTitle')"
        :description="t('blog.notFoundBody')"
      >
        <template #action>
          <BaseButton variant="secondary" to="/blog">{{ t('blog.backToArchive') }}</BaseButton>
        </template>
      </BaseEmptyState>

      <div v-else-if="error" class="mx-auto max-w-md text-center">
        <p class="text-muted">{{ error }}</p>
        <BaseButton class="mt-4" variant="secondary" @click="load">{{ t('action.retry') }}</BaseButton>
      </div>

      <article v-else-if="edition" class="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <div class="min-w-0">
          <header data-aos="fade-up">
            <p class="text-caption font-semibold uppercase tracking-[0.14em] text-brand-ink">
              {{ t('blog.edition') }}
            </p>
            <h1 class="mt-3 text-display font-semibold tracking-tight text-ink">{{ edition.title }}</h1>
            <p v-if="edition.excerpt" class="mt-4 text-lead text-muted">{{ edition.excerpt }}</p>

            <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-subtle">
              <span>{{ t('blog.byTeam') }}</span>
              <span v-if="edition.published_at" class="inline-flex items-center gap-1.5">
                <time :datetime="edition.published_at">{{ formatDate(edition.published_at) }}</time>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <Clock class="size-3.5" aria-hidden="true" />
                {{ t('blog.readingTime', { minutes: edition.reading_minutes ?? 1 }) }}
              </span>
            </div>
          </header>

          <img
            v-if="edition.cover_image_url"
            :src="edition.cover_image_url"
            :alt="edition.title"
            decoding="async"
            class="mt-8 aspect-[16/8] w-full rounded-2xl object-cover"
            data-aos="fade-up"
          />

          <!-- Sanitised server-side against a prose allow-list. -->
          <div ref="bodyEl" class="rich-content mt-8" v-html="edition.body" />

          <div class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <BaseButton variant="ghost" :icon="ArrowLeft" to="/blog">
              {{ t('blog.backToArchive') }}
            </BaseButton>
            <a
              v-for="link in shareLinks"
              :key="link.label"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-small font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
              :aria-label="t('blog.shareOn', { network: link.label })"
            >
              <component :is="link.icon" class="size-4" aria-hidden="true" />
              {{ link.label }}
            </a>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-small font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
              @click="copyLink"
            >
              <Copy class="size-4" aria-hidden="true" />
              {{ copied ? t('blog.linkCopied') : t('blog.copyLink') }}
            </button>
          </div>
        </div>

        <aside v-if="toc.length > 1" class="hidden lg:block">
          <nav class="sticky top-28" :aria-label="t('blog.onThisPage')">
            <p class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('blog.onThisPage') }}
            </p>
            <ul class="mt-3 space-y-0.5 border-s border-line">
              <li v-for="item in toc" :key="item.id">
                <a
                  :href="`#${item.id}`"
                  class="block border-s-2 py-1.5 text-small transition"
                  :class="[
                    item.level === 3 ? 'ps-5' : 'ps-3',
                    activeId === item.id
                      ? '-ms-px border-brand-700 font-medium text-brand-ink'
                      : '-ms-px border-transparent text-muted hover:text-ink',
                  ]"
                >
                  {{ item.text }}
                </a>
              </li>
            </ul>
          </nav>
        </aside>
      </article>
    </div>

    <section v-if="related.length > 0" class="mx-auto mt-20 max-w-6xl border-t border-line px-4 pt-12 md:px-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-caption font-semibold uppercase tracking-[0.14em] text-subtle">
            {{ t('blog.keepReading') }}
          </p>
          <h2 class="mt-2 text-h2 font-semibold text-ink">{{ t('blog.relatedTitle') }}</h2>
        </div>
        <BaseButton variant="ghost" to="/blog">{{ t('blog.backToArchive') }}</BaseButton>
      </div>

      <div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <BlogCard v-for="item in related" :key="item.id" :edition="item" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4) {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.75em 0 0.6em;
  color: var(--text-ink);
  scroll-margin-top: 7rem;
}

.rich-content :deep(h2) {
  font-size: 1.5rem;
}

.rich-content :deep(h3) {
  font-size: 1.25rem;
}

.rich-content :deep(p) {
  margin: 0 0 1.1em;
  font-size: 1.0625rem;
  line-height: 1.8;
  color: var(--text-muted);
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin: 0 0 1.1em;
  padding-inline-start: 1.5em;
  color: var(--text-muted);
}

.rich-content :deep(ul) {
  list-style: disc;
}

.rich-content :deep(ol) {
  list-style: decimal;
}

.rich-content :deep(li) {
  margin: 0.35em 0;
  line-height: 1.7;
}

.rich-content :deep(blockquote) {
  border-inline-start: 3px solid var(--brand-soft-border);
  background: var(--brand-soft);
  padding: 0.75rem 1rem;
  margin: 0 0 1.1em;
  border-radius: var(--radius-lg);
  color: var(--brand-ink);
}

.rich-content :deep(a) {
  color: var(--brand-ink);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.rich-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-xl);
}
</style>
