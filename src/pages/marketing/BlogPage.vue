<script setup lang="ts">
import AOS from 'aos'
import 'aos/dist/aos.css'
import { onMounted, ref } from 'vue'
import { Newspaper, RefreshCw } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import { fetchPublicNewsletters } from '@/services/marketingService'
import type { Paginated } from '@/types/api'
import type { NewsletterSummary } from '@/types/marketing'
import { formatDate } from '@/utils/format'

/**
 * The public newsletter archive.
 *
 * Editions the platform team has published, newest first. A draft is simply not
 * here — the server never serves one — so the page needs no visibility logic of
 * its own. The card leads with the cover when there is one and falls back to a
 * plain title block when there is not.
 */

const PER_PAGE = 9

const { t } = useI18n()
const { set: setSeo } = useSeo()

const editions = ref<NewsletterSummary[]>([])
const meta = ref<Paginated<NewsletterSummary>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

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

onMounted(() => {
  setSeo({ title: t('blog.title'), description: t('blog.subtitle') })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: false, offset: 120 })
  void load()
})
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-5xl px-4 md:px-6">
      <div class="text-center" data-aos="fade-up">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('blog.title') }}</h1>
        <p class="mt-3 text-muted">{{ t('blog.subtitle') }}</p>
      </div>

      <div class="mt-12">
        <div v-if="loading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="n in 3" :key="n" class="surface h-72 animate-pulse-soft" />
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

        <div v-else class="space-y-10" data-aos="fade-up" data-aos-delay="100">
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <RouterLink
              v-for="edition in editions"
              :key="edition.id"
              :to="{ name: 'marketing.blog.article', params: { slug: edition.slug } }"
              class="surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div v-if="edition.cover_image_url" class="aspect-video overflow-hidden bg-inset">
                <img
                  :src="edition.cover_image_url"
                  :alt="edition.title"
                  class="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>

              <div class="flex flex-1 flex-col gap-2 p-5">
                <h2 class="line-clamp-2 text-h4 font-semibold text-ink">{{ edition.title }}</h2>

                <p v-if="edition.excerpt" class="line-clamp-3 text-sm leading-relaxed text-muted">
                  {{ edition.excerpt }}
                </p>

                <div class="mt-auto flex items-center justify-between pt-3">
                  <time v-if="edition.published_at" class="text-small text-subtle">
                    {{ formatDate(edition.published_at) }}
                  </time>
                  <span class="text-small font-medium text-brand-ink group-hover:underline">
                    {{ t('blog.readMore') }}
                  </span>
                </div>
              </div>
            </RouterLink>
          </div>

          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event; load()" />
        </div>
      </div>
    </div>
  </section>
</template>
