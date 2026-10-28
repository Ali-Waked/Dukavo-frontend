<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, HelpCircle, LoaderCircle, RefreshCw } from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { fetchPublicFaq } from '@/services/marketingService'
import type { FaqEntry } from '@/types/marketing'

/**
 * Homepage FAQ — the same entries the help centre renders, one flat list.
 *
 * One item open at a time, `aria-expanded` on every trigger and a panel id
 * each answer controls, so the accordion is navigable without a pointer.
 */

const { t } = useI18n()

const entries = ref<FaqEntry[]>([])
const openQuestion = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const sorted = computed(() => [...entries.value].sort((a, b) => a.sort_order - b.sort_order))

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
  <section id="faq" class="py-16 md:py-24">
    <div class="mx-auto max-w-3xl px-4 md:px-6">
      <div class="text-center" data-aos="fade-up">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
        >
          {{ t('marketing.home.faqEyebrow') }}
        </span>
        <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
          {{ t('marketing.home.faqTitle') }}
        </h2>
      </div>

      <div class="mt-10">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted" role="status">
          <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
          <span>{{ t('state.loading') }}</span>
        </div>

        <!-- Error -->
        <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ error }}</span>
            <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
              {{ t('action.retry') }}
            </BaseButton>
          </div>
        </BaseAlert>

        <!-- Empty -->
        <BaseEmptyState
          v-else-if="sorted.length === 0"
          :icon="HelpCircle"
          :title="t('help.emptyTitle')"
          :description="t('help.emptyBody')"
        />

        <!-- Accordion -->
        <div
          v-else
          class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div v-for="entry in sorted" :key="entry.id">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:px-5"
              :aria-expanded="openQuestion === entry.question"
              :aria-controls="`home-faq-panel-${entry.id}`"
              @click="toggle(entry.question)"
            >
              <span class="font-medium text-ink">{{ entry.question }}</span>
              <ChevronDown
                class="size-5 shrink-0 text-muted transition-transform duration-200"
                :class="openQuestion === entry.question ? 'rotate-180' : ''"
                aria-hidden="true"
              />
              <span class="sr-only">
                {{ openQuestion === entry.question ? t('marketing.home.faqCollapse') : t('marketing.home.faqExpand') }}
              </span>
            </button>

            <div
              :id="`home-faq-panel-${entry.id}`"
              v-show="openQuestion === entry.question"
              class="border-t border-line px-4 py-4 text-body text-muted md:px-5"
            >
              {{ entry.answer }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
