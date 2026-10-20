<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { FileText, LoaderCircle, RefreshCw } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicContentPage } from '@/services/marketingService'
import type { ContentPage } from '@/types/marketing'
import { parseLabeledItems } from '@/utils/content'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import RichText from '@/components/marketing/RichText.vue'

/**
 * Public About page.
 *
 * Unlike the two legal documents, this page is not a wall of prose: it mixes
 * copy with a step-by-step story, a grid of what Dukavo believes, and a closing
 * call to action. The section `layout` decides which of those each block is;
 * an author changes the feel of the page from the platform editor without any
 * front-end change.
 *
 * Only what the product does today is stated as fact. Anything that is not
 * built is written as a plan, and that wording lives in the stored content, not
 * here.
 */

const { t, locale } = useI18n()
const { set: setSeo } = useSeo()

const page = ref<ContentPage | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError && caught.isNetworkError) {
    return t('auth.networkError')
  }
  if (caught instanceof ApiError && caught.message) {
    return caught.message
  }
  return t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false

  try {
    const result = await fetchPublicContentPage('about')
    page.value = result
    setSeo({
      title: result.meta_title || result.title,
      description: result.meta_description,
    })
  } catch (caught) {
    page.value = null
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      error.value = errorMessage(caught)
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: false, offset: 120 })
  void load()
})

// The About copy is stored per language, so a language switch must refetch.
watch(locale, () => void load())
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center gap-2 py-32 text-muted">
      <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
      <span>{{ t('state.loading') }}</span>
    </div>

    <BaseEmptyState
      v-else-if="notFound"
      :icon="FileText"
      :title="t('legal.unavailableTitle')"
      :description="t('legal.unavailableBody')"
    >
      <template #action>
        <BaseButton variant="secondary" to="/">{{ t('legal.backHome') }}</BaseButton>
      </template>
    </BaseEmptyState>

    <BaseAlert v-else-if="error" tone="danger" :title="t('state.loadFailed')" class="mx-auto mt-16 max-w-3xl">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <template v-else-if="page">
      <!-- Hero -->
      <section class="relative overflow-hidden border-b border-line py-16 md:py-24">
        <div class="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-700/20"></div>
        <div class="mx-auto max-w-4xl px-4 text-center md:px-6">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted"
            data-aos="fade-up"
          >
            <span class="size-1.5 rounded-full bg-brand-700"></span>
            {{ t('about.heroBadge') }}
          </span>
          <h1
            class="mt-6 text-h1 font-semibold tracking-tight text-ink md:text-display"
            data-aos="fade-up"
            data-aos-delay="50"
          >
            {{ page.title }}
          </h1>
          <p v-if="page.intro" class="mx-auto mt-5 max-w-2xl text-lead text-muted" data-aos="fade-up" data-aos-delay="100">
            {{ page.intro }}
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-3" data-aos="fade-up" data-aos-delay="150">
            <BaseButton size="lg" variant="secondary" to="/contact">
              {{ t('about.contactCta') }}
            </BaseButton>
          </div>
        </div>
      </section>

      <!-- Sections -->
      <section class="py-16 md:py-24">
        <div class="mx-auto max-w-5xl space-y-16 px-4 md:px-6">
          <div
            v-for="section in page.sections"
            :id="section.id"
            :key="section.id"
            class="scroll-mt-24"
            data-aos="fade-up"
          >
            <template v-if="section.layout === 'prose'">
              <h2 class="text-h2 font-semibold text-ink">{{ section.title }}</h2>
              <div class="mt-4 max-w-3xl">
                <RichText :body="section.body" />
              </div>
            </template>

            <template v-else-if="section.layout === 'steps'">
              <h2 class="text-h2 font-semibold text-ink">{{ section.title }}</h2>
              <ol class="mt-6 grid gap-6 md:grid-cols-2">
                <li
                  v-for="(step, index) in parseLabeledItems(section.body)"
                  :key="index"
                  class="surface flex gap-4 p-5"
                >
                  <span
                    class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink"
                  >
                    {{ index + 1 }}
                  </span>
                  <div class="min-w-0">
                    <h3 class="text-h4 font-semibold text-ink">{{ step.title }}</h3>
                    <p v-if="step.description" class="mt-1 text-body text-muted">{{ step.description }}</p>
                  </div>
                </li>
              </ol>
            </template>

            <template v-else-if="section.layout === 'cards'">
              <h2 class="text-h2 font-semibold text-ink">{{ section.title }}</h2>
              <div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="(card, index) in parseLabeledItems(section.body)"
                  :key="index"
                  class="surface p-6"
                >
                  <h3 class="text-h4 font-semibold text-ink">{{ card.title }}</h3>
                  <p v-if="card.description" class="mt-2 text-body text-muted">{{ card.description }}</p>
                </div>
              </div>
            </template>

            <template v-else-if="section.layout === 'cta'">
              <div class="flex flex-col items-center gap-4 rounded-2xl border border-brand-soft-border bg-brand-soft p-8 text-center md:p-12">
                <h2 class="text-h2 font-semibold text-brand-ink">{{ section.title }}</h2>
                <div class="mx-auto max-w-2xl">
                  <RichText :body="section.body" />
                </div>
                <div class="mt-2 flex flex-wrap justify-center gap-3">
                  <BaseButton size="lg" variant="secondary" to="/contact">
                    {{ t('about.contactCta') }}
                  </BaseButton>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
