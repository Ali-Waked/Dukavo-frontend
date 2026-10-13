<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, FileText, Printer, RefreshCw } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicContentPage } from '@/services/marketingService'
import type { ContentPage } from '@/types/marketing'
import { formatDate } from '@/utils/format'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import RichText from '@/components/marketing/RichText.vue'

/**
 * The shared shell for the two legal documents (Terms, Privacy Policy).
 *
 * Both pages are the same object rendered with the same chrome — a title, the
 * "last updated" date, a sticky table of contents, and the body sections — so
 * they are one component that takes a key rather than two that drift apart.
 * The About page is deliberate in every page and does not reuse this.
 *
 * The body is fetched live from the platform editor, so the page always shows
 * what Dukavo published without a redeploy.
 */
const props = defineProps<{ pageKey: string }>()

const { t, locale } = useI18n()
const { set: setSeo } = useSeo()

const page = ref<ContentPage | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const activeId = ref('')

let observer: IntersectionObserver | null = null

function teardownObserver(): void {
  observer?.disconnect()
  observer = null
}

/**
 * Highlight the section currently under the sticky header. `rootMargin` lifts
 * the detection line below the header and cuts off the lower two-thirds of the
 * viewport so the "active" section is the one the reader is looking at, not any
 * section that is merely on screen.
 */
function setupObserver(): void {
  teardownObserver()

  if (typeof IntersectionObserver === 'undefined') {
    return
  }

  const targets = (page.value?.sections ?? [])
    .map((section) => document.getElementById(section.id))
    .filter((element): element is HTMLElement => element !== null)

  if (targets.length === 0) {
    return
  }

  const first = targets[0]

  if (first) {
    activeId.value = first.id
  }

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

      const next = visible[0]

      if (next) {
        activeId.value = next.target.id
      }
    },
    { rootMargin: '-96px 0px -65% 0px', threshold: [0, 1] },
  )

  for (const target of targets) {
    observer.observe(target)
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false

  try {
    const result = await fetchPublicContentPage(props.pageKey)
    page.value = result
    setSeo({
      title: result.meta_title || result.title,
      description: result.meta_description,
    })
    await nextTick()
    setupObserver()
  } catch (caught) {
    page.value = null

    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else if (caught instanceof ApiError && caught.isNetworkError) {
      error.value = t('auth.networkError')
    } else if (caught instanceof ApiError && caught.message) {
      error.value = caught.message
    } else {
      error.value = t('error.title')
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => props.pageKey,
  () => void load(),
)

// The body is stored per language, so switching the interface language must
// refetch rather than leave the previous language's document on screen.
watch(locale, () => void load())

onMounted(load)
onBeforeUnmount(teardownObserver)

function print(): void {
  window.print()
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
    <!-- Loading -->
    <div v-if="loading" class="mx-auto max-w-3xl" aria-busy="true">
      <p class="sr-only">{{ t('legal.loading') }}</p>
      <div class="h-10 w-2/3 animate-pulse rounded-lg bg-surface-3"></div>
      <div class="mt-4 h-5 w-1/2 animate-pulse rounded bg-surface-3"></div>
      <div class="mt-10 space-y-3">
        <div v-for="n in 6" :key="n" class="h-4 w-full animate-pulse rounded bg-surface-3"></div>
      </div>
    </div>

    <!-- Not published -->
    <BaseEmptyState
      v-else-if="notFound"
      :icon="FileText"
      :title="t('legal.unavailableTitle')"
      :description="t('legal.unavailableBody')"
    >
      <template #action>
        <BaseButton variant="secondary" to="/"> {{ t('legal.backHome') }} </BaseButton>
      </template>
    </BaseEmptyState>

    <!-- Failed to load -->
    <BaseAlert v-else-if="error" tone="danger" :title="t('state.loadFailed')" class="mx-auto max-w-3xl">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div v-else-if="page" class="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
      <article class="min-w-0">
        <header class="border-b border-line pb-8">
          <h1 class="text-h1 font-semibold tracking-tight text-ink md:text-display">{{ page.title }}</h1>
          <p v-if="page.intro" class="mt-4 max-w-3xl text-lead text-muted">{{ page.intro }}</p>
          <p v-if="page.published_at" class="mt-4 text-small text-subtle">
            {{ t('legal.lastUpdated', { date: formatDate(page.published_at) }) }}
          </p>
        </header>

        <div class="mt-10 space-y-12">
          <section
            v-for="section in page.sections"
            :id="section.id"
            :key="section.id"
            class="scroll-mt-28"
          >
            <h2 class="text-h2 font-semibold text-ink">{{ section.title }}</h2>
            <div class="mt-4">
              <RichText :body="section.body" />
            </div>
          </section>
        </div>

        <div class="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <BaseButton variant="ghost" :icon="ArrowLeft" to="/">
            {{ t('legal.backHome') }}
          </BaseButton>
          <BaseButton variant="secondary" :icon="Printer" class="print:hidden" @click="print">
            {{ t('legal.print') }}
          </BaseButton>
        </div>
      </article>

      <aside class="hidden lg:block print:hidden">
        <nav class="sticky top-24" aria-labelledby="legal-toc-heading">
          <p id="legal-toc-heading" class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('legal.onThisPage') }}
          </p>
          <ul class="mt-3 space-y-0.5">
            <li v-for="section in page.sections" :key="section.id">
              <a
                :href="`#${section.id}`"
                class="block rounded-md px-3 py-1.5 text-small transition"
                :class="
                  activeId === section.id
                    ? 'bg-brand-soft font-medium text-brand-ink'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                "
              >
                {{ section.title }}
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  </div>
</template>
