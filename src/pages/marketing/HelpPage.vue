<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, HelpCircle, LoaderCircle, RefreshCw } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { fetchPublicFaq } from '@/services/marketingService'
import type { FaqEntry } from '@/types/marketing'

/**
 * Public help centre.
 *
 * Rendered from the same FAQ entries the platform editor maintains, grouped by
 * category. The page is one accordion rather than a routing subtree — the
 * content is short and there is nothing to deep-link to yet.
 */

const { t } = useI18n()

const entries = ref<FaqEntry[]>([])
const openQuestion = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const groups = computed(() => {
  const map = new Map<string, FaqEntry[]>()
  for (const entry of entries.value) {
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

onMounted(async () => {
  AOS.init({ duration: 600, easing: 'ease-out-quart', once: false, offset: 120 })
  await load()
})

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    entries.value = await fetchPublicFaq()
    if (openQuestion.value && !entries.value.some((e) => e.question === openQuestion.value)) {
      openQuestion.value = null
    }
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

function toggle(question: string): void {
  openQuestion.value = openQuestion.value === question ? null : question
}
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-3xl px-4 md:px-6">
      <div class="text-center" data-aos="fade-up">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('help.title') }}</h1>
        <p class="mt-3 text-muted">{{ t('help.subtitle') }}</p>
      </div>

      <div class="mt-12">
        <!-- Loading -->
        <div v-if="loading" class="mx-auto flex items-center justify-center gap-2 py-16 text-muted">
          <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
          <span>{{ t('state.loading') }}</span>
        </div>

        <!-- Error -->
        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')" class="mx-auto max-w-md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <!-- Empty -->
        <BaseEmptyState
          v-else-if="groups.length === 0"
          :icon="HelpCircle"
          :title="t('help.emptyTitle')"
          :description="t('help.emptyBody')"
        />

        <!-- FAQ -->
        <div v-else class="space-y-8" data-aos="fade-up" data-aos-delay="100">
          <div v-for="group in groups" :key="group.category">
            <h2 class="text-h4 font-semibold text-ink">{{ group.category }}</h2>
            <div class="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              <div v-for="(entry, index) in group.items" :key="entry.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:px-5"
                  :aria-expanded="openQuestion === entry.question"
                  :aria-controls="`faq-panel-${entry.id}`"
                  @click="toggle(entry.question)"
                >
                  <span class="font-medium text-ink">{{ entry.question }}</span>
                  <ChevronDown
                    class="size-5 shrink-0 text-muted transition-transform duration-200"
                    :class="openQuestion === entry.question ? 'rotate-180' : ''"
                    aria-hidden="true"
                  />
                </button>

                <div
                  :id="`faq-panel-${entry.id}`"
                  v-show="openQuestion === entry.question"
                  class="border-t border-line px-4 py-4 text-body text-muted md:px-5"
                >
                  {{ entry.answer }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>