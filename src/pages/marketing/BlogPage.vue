<script setup lang="ts">
import AOS from 'aos'
import 'aos/dist/aos.css'
import { computed, onMounted, ref } from 'vue'
import { Newspaper, RefreshCw } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import PageHero from '@/components/marketing/PageHero.vue'
import SectionHeading from '@/components/marketing/SectionHeading.vue'
import BlogCard from '@/components/marketing/BlogCard.vue'
import { fetchPublicNewsletters } from '@/services/marketingService'
import type { Paginated } from '@/types/api'
import type { NewsletterSummary } from '@/types/marketing'

/**
 * The public newsletter archive.
 *
 * Published editions only, newest first. The first edition gets a wider
 * featured treatment on the opening page; the rest read as a normal grid, so
 * the page still has a clear entry point when the archive grows.
 */

const PER_PAGE = 9

const { t } = useI18n()
const { set: setSeo } = useSeo()

const editions = ref<NewsletterSummary[]>([])
const meta = ref<Paginated<NewsletterSummary>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const featured = computed(() => (page.value === 1 ? (editions.value[0] ?? null) : null))
const rest = computed(() => (featured.value ? editions.value.slice(1) : editions.value))
const showInitialSkeleton = computed(() => loading.value && editions.value.length === 0)

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchPublicNewsletters({ page: page.value, per_page: PER_PAGE })
    editions.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

function changePage(next: number): void {
  page.value = next
  void load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  setSeo({
    title: t('blog.title'),
    description: t('blog.subtitle'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
  void load()
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('blog.eyebrow')"
      :title="t('blog.title')"
      :description="t('blog.subtitle')"
      compact
    />

    <section class="py-16 md:py-24">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div v-if="showInitialSkeleton" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status">
          <span class="sr-only">{{ t('state.loading') }}</span>
          <div v-for="n in 3" :key="n" class="surface h-80 animate-pulse-soft" />
        </div>

        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')" class="mx-auto max-w-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <BaseEmptyState
          v-else-if="editions.length === 0"
          :icon="Newspaper"
          :title="t('blog.emptyTitle')"
          :description="t('blog.emptyBody')"
        />

        <div v-else class="space-y-14">
          <section v-if="featured" aria-labelledby="featured-edition-heading">
            <SectionHeading
              :eyebrow="t('blog.featuredEyebrow')"
              :title="t('blog.featuredTitle')"
              align="start"
            />
            <h3 id="featured-edition-heading" class="sr-only">{{ t('blog.featuredTitle') }}</h3>
            <div class="mt-6" data-aos="fade-up">
              <BlogCard :edition="featured" featured />
            </div>
          </section>

          <section v-if="rest.length > 0" aria-labelledby="archive-heading">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <h2 id="archive-heading" class="text-h2 font-semibold text-ink">
                {{ page === 1 ? t('blog.moreEditions') : t('blog.pageTitle', { page }) }}
              </h2>
              <span v-if="meta" class="text-small text-muted">
                {{ t('blog.editionCount', { count: meta.total }) }}
              </span>
            </div>

            <div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <BlogCard
                v-for="(edition, index) in rest"
                :key="edition.id"
                :edition="edition"
                data-aos="fade-up"
                :data-aos-delay="index * 40"
              />
            </div>
          </section>

          <BasePagination v-if="meta && meta.last_page > 1" :meta="meta" :disabled="loading" @change="changePage" />
        </div>
      </div>
    </section>
  </div>
</template>
