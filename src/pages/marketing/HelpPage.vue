<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { HelpCircle, LoaderCircle, RefreshCw, Search } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import PageHero from '@/components/marketing/PageHero.vue'
import FaqAccordion from '@/components/marketing/FaqAccordion.vue'
import { fetchPublicFaq } from '@/services/marketingService'
import type { FaqEntry } from '@/types/marketing'

/**
 * Public help centre.
 *
 * The same FAQ entries the platform editor maintains, with a live text filter
 * and category tabs. Search is client-side because the answer set is small and
 * the endpoint is public; filtering happens over question, answer and category
 * so a merchant can find an answer without knowing the category name.
 */

const { t } = useI18n()
const { set: setSeo } = useSeo()

const entries = ref<FaqEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const query = ref('')
const activeCategory = ref('all')

const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const entry of entries.value) {
    const category = entry.category?.trim() || t('help.general')
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
})

const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return entries.value.filter((entry) => {
    const category = entry.category?.trim() || t('help.general')
    if (activeCategory.value !== 'all' && category !== activeCategory.value) {
      return false
    }
    if (!needle) return true
    return (
      entry.question.toLocaleLowerCase().includes(needle) ||
      entry.answer.toLocaleLowerCase().includes(needle) ||
      category.toLocaleLowerCase().includes(needle)
    )
  })
})

const groups = computed(() => {
  const map = new Map<string, FaqEntry[]>()
  for (const entry of filtered.value) {
    const category = entry.category?.trim() || t('help.general')
    const bucket = map.get(category)
    if (bucket) {
      bucket.push(entry)
    } else {
      map.set(category, [entry])
    }
  }
  return [...map.entries()].map(([category, items]) => ({
    category,
    items: items.sort((a, b) => a.sort_order - b.sort_order),
  }))
})

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    entries.value = await fetchPublicFaq()
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  setSeo({
    title: t('help.title'),
    description: t('help.subtitle'),
    type: 'website',
  })
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: true, offset: 120 })
  void load()
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('help.eyebrow')"
      :title="t('help.title')"
      :description="t('help.subtitle')"
      compact
    >
      <div class="mx-auto max-w-2xl">
        <BaseInput
          v-model="query"
          type="search"
          :label="t('help.searchLabel')"
          :placeholder="t('help.searchPlaceholder')"
          autocomplete="off"
        >
          <template #prefix>
            <Search class="size-4" />
          </template>
        </BaseInput>
      </div>
    </PageHero>

    <section class="py-12 md:py-16">
      <div class="mx-auto max-w-4xl px-4 md:px-6">
        <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted" role="status">
          <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
          <span>{{ t('state.loading') }}</span>
        </div>

        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')" class="mx-auto max-w-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <template v-else>
          <div v-if="entries.length > 0" class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-small font-medium transition"
              :class="
                activeCategory === 'all'
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-surface text-muted hover:text-ink'
              "
              :aria-pressed="activeCategory === 'all'"
              @click="activeCategory = 'all'"
            >
              {{ t('help.allTopics') }}
              <span class="ms-1 opacity-70">{{ entries.length }}</span>
            </button>
            <button
              v-for="category in categories"
              :key="category.name"
              type="button"
              class="rounded-full border px-3 py-1.5 text-small font-medium transition"
              :class="
                activeCategory === category.name
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-surface text-muted hover:text-ink'
              "
              :aria-pressed="activeCategory === category.name"
              @click="activeCategory = category.name"
            >
              {{ category.name }}
              <span class="ms-1 opacity-70">{{ category.count }}</span>
            </button>
          </div>

          <p class="mt-4 text-small text-muted" aria-live="polite">
            {{ t('help.resultCount', { count: filtered.length }) }}
          </p>

          <BaseEmptyState
            v-if="groups.length === 0"
            class="mt-6"
            :icon="HelpCircle"
            :title="query ? t('help.noResultsTitle') : t('help.emptyTitle')"
            :description="query ? t('help.noResultsBody') : t('help.emptyBody')"
          >
            <template v-if="query" #action>
              <BaseButton variant="secondary" @click="query = ''">
                {{ t('help.clearSearch') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <div v-else class="mt-6 space-y-8" data-aos="fade-up">
            <section
              v-for="(group, index) in groups"
              :key="group.category"
              :aria-labelledby="`help-group-${index}`"
            >
              <h2 :id="`help-group-${index}`" class="text-h4 font-semibold text-ink">
                {{ group.category }}
              </h2>
              <div class="mt-3">
                <FaqAccordion :items="group.items" :id-prefix="`help-group-${index}`" />
              </div>
            </section>
          </div>
        </template>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2 py-16">
      <div class="mx-auto max-w-4xl px-4 md:px-6">
        <div class="grid gap-5 md:grid-cols-2">
          <div class="surface p-6">
            <h2 class="text-h3 font-semibold text-ink">{{ t('help.stillStuckTitle') }}</h2>
            <p class="mt-2 text-body text-muted">{{ t('help.stillStuckBody') }}</p>
            <BaseButton class="mt-5" variant="secondary" to="/contact">
              {{ t('help.contactCta') }}
            </BaseButton>
          </div>
          <div class="surface p-6">
            <h2 class="text-h3 font-semibold text-ink">{{ t('help.accessTitle') }}</h2>
            <p class="mt-2 text-body text-muted">{{ t('help.accessBody') }}</p>
            <BaseButton class="mt-5" to="/waitlist">{{ t('marketing.nav.waitlistCta') }}</BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
