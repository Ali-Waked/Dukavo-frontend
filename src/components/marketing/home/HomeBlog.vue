<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, CheckCircle2, Newspaper, RefreshCw } from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import HoneypotField from '@/components/marketing/HoneypotField.vue'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicNewsletters, subscribeNewsletter } from '@/services/marketingService'
import type { NewsletterSummary } from '@/types/marketing'
import { formatDate } from '@/utils/format'

/**
 * Latest editions plus the homepage's own newsletter capture.
 *
 * The archive feed is the real one (published editions only, newest first,
 * capped at three); an empty, loading or failing feed all get honest states
 * instead of a decorative placeholder. The footer carries the same subscribe
 * form on every other page — the home route hides it so the form never shows
 * up twice in one view.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()

const editions = ref<NewsletterSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const email = ref('')
const website = ref('')
const emailError = ref<string | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)
const subscribed = ref(false)

onMounted(() => {
  void load()
})

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchPublicNewsletters({ per_page: 3 })
    editions.value = result.data
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

async function subscribe(): Promise<void> {
  emailError.value = null
  formError.value = null

  if (!email.value.trim()) {
    emailError.value = t('validation.required')
    return
  }
  if (!EMAIL_PATTERN.test(email.value.trim())) {
    emailError.value = t('validation.email')
    return
  }

  submitting.value = true
  try {
    await subscribeNewsletter({
      email: email.value.trim(),
      source: 'home',
      website: website.value,
    })
    subscribed.value = true
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      emailError.value = caught.fields['email']?.[0] ?? null
      if (!emailError.value) formError.value = caught.message || t('error.title')
    } else if (caught instanceof ApiError && caught.status === 429) {
      formError.value = t('error.rateLimitedBody')
    } else {
      formError.value = errorMessage(caught)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section id="blog" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div class="flex flex-wrap items-end justify-between gap-4" data-aos="fade-up">
        <div>
          <span
            class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
          >
            {{ t('marketing.home.blogEyebrow') }}
          </span>
          <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
            {{ t('marketing.home.blogTitle') }}
          </h2>
        </div>

        <RouterLink
          to="/blog"
          class="inline-flex items-center gap-1.5 text-small font-medium text-brand-ink hover:underline"
        >
          {{ t('marketing.home.allArticles') }}
          <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </RouterLink>
      </div>

      <!-- Feed: loading -->
      <div v-if="loading" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 3" :key="n" class="surface h-56 animate-pulse-soft" />
      </div>

      <!-- Feed: error -->
      <BaseAlert
        v-else-if="error"
        tone="danger"
        :title="t('error.title')"
        class="mt-10"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{{ error }}</span>
          <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <!-- Feed: empty -->
      <BaseEmptyState
        v-else-if="editions.length === 0"
        class="mt-6"
        :icon="Newspaper"
        :title="t('blog.emptyTitle')"
        :description="t('blog.emptyBody')"
      />

      <!-- Feed: editions -->
      <div v-else class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-aos="fade-up" data-aos-delay="100">
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
            <h3 class="line-clamp-2 text-h4 font-semibold text-ink">{{ edition.title }}</h3>
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

      <!-- Newsletter capture -->
      <div class="surface mt-8 p-6 md:p-8" data-aos="fade-up" data-aos-delay="150">
        <div class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h3 class="text-h3 font-semibold text-ink">{{ t('marketing.home.newsletterTitle') }}</h3>
            <p class="mt-1.5 max-w-xl text-muted">{{ t('marketing.home.newsletterBody') }}</p>
          </div>

          <form v-if="!subscribed" class="w-full max-w-sm shrink-0" @submit.prevent="subscribe">
            <HoneypotField v-model="website" />
            <div class="flex gap-2">
              <BaseInput
                v-model="email"
                type="email"
                :label="t('common.email')"
                :error="emailError"
                :placeholder="t('newsletter.emailPlaceholder')"
                autocomplete="email"
                class="flex-1"
                required
              />
              <BaseButton type="submit" :loading="submitting" class="mt-6">
                {{ t('newsletter.submit') }}
              </BaseButton>
            </div>
            <p v-if="formError" class="text-small text-danger-ink" role="alert">
              {{ formError }}
            </p>
          </form>

          <p v-else class="flex items-center gap-2 text-body text-ink">
            <CheckCircle2 class="size-5 text-success" aria-hidden="true" />
            {{ t('newsletter.successTitle') }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
