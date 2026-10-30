<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Clock } from '@/components/icons'
import { useI18n } from '@/i18n'
import type { NewsletterSummary } from '@/types/marketing'
import { formatDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    edition: NewsletterSummary
    featured?: boolean
  }>(),
  { featured: false },
)

const { t } = useI18n()

const href = computed(() => ({
  name: 'marketing.blog.article',
  params: { slug: props.edition.slug },
}))
</script>

<template>
  <RouterLink
    :to="href"
    class="surface group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    :class="featured ? 'md:grid md:grid-cols-2' : ''"
  >
    <div
      class="overflow-hidden bg-inset"
      :class="featured ? 'aspect-[16/10] md:aspect-auto md:h-full' : 'aspect-video'"
    >
      <img
        v-if="edition.cover_image_url"
        :src="edition.cover_image_url"
        :alt="edition.title"
        loading="lazy"
        decoding="async"
        class="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div
        v-else
        class="grid size-full place-items-center bg-gradient-to-br from-brand-100 via-surface-2 to-accent-400/10 text-brand-ink dark:from-brand-700/30 dark:via-surface-2 dark:to-accent-400/10"
      >
        <span class="text-label font-semibold uppercase tracking-[0.16em]">{{ t('blog.edition') }}</span>
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-3 p-5 md:p-6">
      <div class="flex flex-wrap items-center gap-2 text-caption text-subtle">
        <time v-if="edition.published_at" :datetime="edition.published_at">
          {{ formatDate(edition.published_at) }}
        </time>
        <span class="size-1 rounded-full bg-line-strong" aria-hidden="true" />
        <span class="inline-flex items-center gap-1">
          <Clock class="size-3.5" aria-hidden="true" />
          {{ t('blog.readingTime', { minutes: edition.reading_minutes ?? 1 }) }}
        </span>
      </div>

      <h3
        class="font-semibold text-ink"
        :class="featured ? 'text-h2' : 'line-clamp-2 text-h4'"
      >
        {{ edition.title }}
      </h3>

      <p
        v-if="edition.excerpt"
        class="text-sm leading-relaxed text-muted"
        :class="featured ? 'line-clamp-4' : 'line-clamp-3'"
      >
        {{ edition.excerpt }}
      </p>

      <span class="mt-auto inline-flex items-center gap-1.5 pt-1 text-small font-medium text-brand-ink group-hover:underline">
        {{ t('blog.readMore') }}
        <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </div>
  </RouterLink>
</template>
