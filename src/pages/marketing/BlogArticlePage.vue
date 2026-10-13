<script setup lang="ts">
import AOS from 'aos'
import 'aos/dist/aos.css'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, LoaderCircle, Newspaper } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { fetchPublicNewsletter } from '@/services/marketingService'
import type { NewsletterArticle } from '@/types/marketing'
import { formatDate } from '@/utils/format'

/**
 * A single published edition.
 *
 * The body arrives as sanitised HTML — the server has already run it through
 * the allow-list, so it is rendered as markup rather than escaped. A draft or
 * unknown slug is a 404 from the API, which becomes the not-found state here
 * instead of an error: a half-written edition should read as "not here", not
 * as a failure.
 */

const { t } = useI18n()
const { set: setSeo } = useSeo()
const route = useRoute()

const edition = ref<NewsletterArticle | null>(null)
const loading = ref(true)
const notFound = ref(false)
const error = ref<string | null>(null)

const slug = computed(() => String(route.params.slug ?? ''))

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  error.value = null
  try {
    const result = await fetchPublicNewsletter(slug.value)
    edition.value = result
    setSeo({
      title: result.meta_title || result.title,
      description: result.meta_description || result.excerpt || undefined,
    })
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

onMounted(() => {
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: false, offset: 120 })
  void load()
})

watch(slug, () => void load())
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-3xl px-4 md:px-6">
      <div class="mb-8">
        <BaseButton variant="ghost" size="sm" :icon="ArrowLeft" to="/blog">
          {{ t('blog.backToArchive') }}
        </BaseButton>
      </div>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted">
        <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
        <span>{{ t('state.loading') }}</span>
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

      <div v-else-if="error" class="text-center">
        <p class="text-muted">{{ error }}</p>
        <BaseButton class="mt-4" variant="secondary" @click="load">{{ t('action.retry') }}</BaseButton>
      </div>

      <article v-else-if="edition" data-aos="fade-up">
        <header class="text-center">
          <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ edition.title }}</h1>
          <p v-if="edition.published_at" class="mt-3 text-small text-subtle">
            {{ t('blog.publishedOn', { date: formatDate(edition.published_at) }) }}
          </p>
        </header>

        <img
          v-if="edition.cover_image_url"
          :src="edition.cover_image_url"
          :alt="edition.title"
          class="mt-10 w-full rounded-xl object-cover"
        />

        <p v-if="edition.excerpt" class="mt-8 text-body leading-relaxed text-muted">
          {{ edition.excerpt }}
        </p>

        <!-- Sanitised server-side against a prose allow-list. -->
        <div class="rich-content mt-8" v-html="edition.body" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4) {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.5em 0 0.5em;
  color: var(--text-ink);
}

.rich-content :deep(h2) {
  font-size: 1.5rem;
}

.rich-content :deep(h3) {
  font-size: 1.25rem;
}

.rich-content :deep(p) {
  margin: 0 0 1em;
  line-height: 1.75;
  color: var(--text-muted);
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin: 0 0 1em;
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
  margin: 0.25em 0;
}

.rich-content :deep(blockquote) {
  border-inline-start: 3px solid var(--border-brand, currentColor);
  padding-inline-start: 1em;
  margin: 0 0 1em;
  font-style: italic;
  color: var(--text-muted);
}

.rich-content :deep(a) {
  color: var(--text-brand-ink, currentColor);
  text-decoration: underline;
}
</style>
