<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp, ExternalLink, FileText, Plus, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  fetchContentPages,
  updateContentPage,
} from '@/services/platformContentService'
import type {
  ContentPage,
  ContentPagePayload,
  ContentSection,
} from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * Content-page administration (Terms, Privacy, About).
 *
 * The three pages are fixed: they exist because the site needs them, so there
 * is no create and no delete here — only editing. A page's sections are the
 * only structure the editor exposes, and saving replaces them wholesale, which
 * keeps the editor and the stored document in step.
 */

const { t } = useI18n()
const toast = useToast()

const pages = ref<ContentPage[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)

const selectedId = ref<number | null>(null)

const formTitle = ref('')
const formIntro = ref('')
const formMetaTitle = ref('')
const formMetaDescription = ref('')
const formActive = ref(false)
const formSections = ref<ContentSection[]>([])

const active = computed(() => pages.value.find((page) => page.id === selectedId.value) ?? null)

const groups = computed(() => {
  const map = new Map<string, ContentPage[]>()

  for (const page of pages.value) {
    const list = map.get(page.key) ?? []
    list.push(page)
    map.set(page.key, list)
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const ordered = [...items].sort((a, b) => (a.locale === 'en' ? -1 : b.locale === 'en' ? 1 : 0))
    const label = (items.find((item) => item.locale === 'en') ?? items[0])?.title ?? key

    return { key, label, items: ordered }
  })
})

function localeLabel(locale: string): string {
  return locale.toUpperCase()
}

const layoutChoices = computed(() => [
  { value: 'prose', label: t('layout.prose') },
  { value: 'steps', label: t('layout.steps') },
  { value: 'cards', label: t('layout.cards') },
  { value: 'cta', label: t('layout.cta') },
])

function publicPath(key: string): string {
  return `/${key}`
}

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError && caught.isNetworkError) {
    return t('auth.networkError')
  }
  if (caught instanceof ApiError && caught.message) {
    return caught.message
  }
  return t('error.title')
}

function syncForm(page: ContentPage): void {
  formTitle.value = page.title
  formIntro.value = page.intro ?? ''
  formMetaTitle.value = page.meta_title ?? ''
  formMetaDescription.value = page.meta_description ?? ''
  formActive.value = page.active
  formSections.value = page.sections.map((section) => ({ ...section }))
}

function select(id: number): void {
  const page = pages.value.find((item) => item.id === id)
  if (!page) return

  selectedId.value = id
  syncForm(page)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    pages.value = await fetchContentPages()

    if (pages.value.length > 0) {
      const current = pages.value.find((page) => page.id === selectedId.value) ?? pages.value[0]

      if (current) {
        select(current.id)
      }
    }
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

/* ------------------------------------------------------------- sections */

let sectionSeq = 0

function addSection(): void {
  sectionSeq += 1
  formSections.value.push({
    id: `section-${sectionSeq}`,
    title: '',
    layout: 'prose',
    body: '',
  })
}

function removeSection(index: number): void {
  formSections.value.splice(index, 1)
}

function moveSection(index: number, direction: -1 | 1): void {
  const target = index + direction

  if (target < 0 || target >= formSections.value.length) {
    return
  }

  const [moved] = formSections.value.splice(index, 1)

  if (!moved) {
    return
  }

  formSections.value.splice(target, 0, moved)
}

/* ---------------------------------------------------------------- save */

function buildPayload(): ContentPagePayload {
  return {
    title: formTitle.value.trim(),
    intro: formIntro.value.trim() || null,
    meta_title: formMetaTitle.value.trim() || null,
    meta_description: formMetaDescription.value.trim() || null,
    active: formActive.value,
    sections: formSections.value.map((section) => ({
      id: section.id.trim(),
      title: section.title.trim(),
      layout: section.layout,
      body: section.body,
    })),
  }
}

async function save(): Promise<void> {
  if (selectedId.value === null) {
    return
  }

  saving.value = true
  error.value = null

  try {
    const updated = await updateContentPage(selectedId.value, buildPayload())
    const index = pages.value.findIndex((page) => page.id === updated.id)

    if (index !== -1) {
      pages.value[index] = updated
    }

    syncForm(updated)
    toast.success(t('platform.content.saved'))
  } catch (caught) {
    error.value = errorMessage(caught)
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.content.title')" :description="t('platform.content.subtitle')">
      <template #actions>
        <BaseButton
          v-if="active"
          variant="secondary"
          :icon="ExternalLink"
          :to="publicPath(active.key)"
        >
          {{ t('platform.content.preview') }}
        </BaseButton>
        <BaseButton :loading="saving" :disabled="!active" @click="save">
          {{ t('platform.content.save') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div v-if="loading" class="surface flex items-center gap-2 p-8 text-muted">
      <RefreshCw class="size-4 animate-spin" aria-hidden="true" />
      <span>{{ t('state.loading') }}</span>
    </div>

    <BaseEmptyState
      v-else-if="pages.length === 0"
      :icon="FileText"
      :title="t('platform.content.empty')"
    />

    <div v-else class="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside class="surface h-fit p-2">
        <p class="px-3 py-2 text-caption font-semibold uppercase tracking-wide text-subtle">
          {{ t('platform.content.pickPage') }}
        </p>
        <div class="space-y-3">
          <div v-for="group in groups" :key="group.key" class="space-y-0.5">
            <p class="truncate px-3 pt-1 text-small font-medium text-muted">{{ group.label }}</p>
            <button
              v-for="page in group.items"
              :key="page.id"
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm transition"
              :class="page.id === selectedId ? 'bg-brand-soft font-medium text-brand-ink' : 'text-ink hover:bg-surface-2'"
              @click="select(page.id)"
            >
              <span class="inline-flex items-center gap-2">
                <span
                  class="rounded px-1.5 py-0.5 text-caption font-semibold uppercase"
                  :class="page.id === selectedId ? 'bg-brand-ink/10 text-brand-ink' : 'bg-surface-3 text-subtle'"
                >
                  {{ localeLabel(page.locale) }}
                </span>
                <span>{{ page.locale === 'en' ? t('platform.content.english') : t('platform.content.arabic') }}</span>
              </span>
              <BaseBadge :tone="page.active ? 'success' : 'neutral'">
                {{ page.active ? t('platform.content.published') : t('platform.content.draft') }}
              </BaseBadge>
            </button>
          </div>
        </div>
      </aside>

      <div v-if="active" class="space-y-5">
        <div class="surface space-y-4 p-5">
          <div class="flex items-center gap-2">
            <BaseBadge tone="neutral">{{ localeLabel(active.locale) }}</BaseBadge>
            <span class="text-small text-subtle">
              {{ active.locale === 'en' ? t('platform.content.english') : t('platform.content.arabic') }}
            </span>
          </div>

          <BaseInput v-model="formTitle" :label="t('platform.content.titleField')" maxlength="200" required />

          <BaseTextarea
            v-model="formIntro"
            :label="t('platform.content.introField')"
            :hint="t('platform.content.introHint')"
            :rows="2"
            :maxlength="500"
          />

          <BaseSwitch v-model="formActive" :label="t('platform.content.published')" />

          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="formMetaTitle" :label="t('platform.content.metaTitle')" maxlength="255" />
            <BaseInput
              v-model="formMetaDescription"
              :label="t('platform.content.metaDescription')"
              :hint="t('platform.content.metaHint')"
              maxlength="255"
            />
          </div>

          <p v-if="active.updated_at" class="text-small text-subtle">
            {{ t('platform.content.updated', { date: formatDateTime(active.updated_at) }) }}
          </p>
        </div>

        <div class="surface p-5">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-h4 font-semibold text-ink">{{ t('platform.content.sectionsTitle') }}</h2>
            <BaseButton size="sm" variant="secondary" :icon="Plus" @click="addSection">
              {{ t('platform.content.addSection') }}
            </BaseButton>
          </div>

          <div v-if="formSections.length === 0" class="mt-4">
            <BaseEmptyState compact :title="t('platform.content.sectionsTitle')" />
          </div>

          <div v-else class="mt-4 space-y-4">
            <div
              v-for="(section, index) in formSections"
              :key="index"
              class="rounded-xl border border-line p-4"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-muted">#{{ index + 1 }}</span>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="btn-icon size-8"
                    :disabled="index === 0"
                    :aria-label="t('platform.content.moveUp')"
                    :title="t('platform.content.moveUp')"
                    @click="moveSection(index, -1)"
                  >
                    <ArrowUp class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn-icon size-8"
                    :disabled="index === formSections.length - 1"
                    :aria-label="t('platform.content.moveDown')"
                    :title="t('platform.content.moveDown')"
                    @click="moveSection(index, 1)"
                  >
                    <ArrowDown class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn-icon size-8 text-danger-ink"
                    :aria-label="t('platform.content.removeSection')"
                    :title="t('platform.content.removeSection')"
                    @click="removeSection(index)"
                  >
                    <Trash2 class="size-4" />
                  </button>
                </div>
              </div>

              <div class="mt-3 grid gap-4 sm:grid-cols-2">
                <BaseInput v-model="section.id" :label="t('platform.content.sectionAnchor')" maxlength="80" />
                <BaseSelect
                  v-model="section.layout"
                  :label="t('platform.content.sectionLayout')"
                  :options="layoutChoices"
                />
              </div>

              <BaseInput
                v-model="section.title"
                class="mt-4"
                :label="t('platform.content.sectionHeading')"
                maxlength="200"
              />

              <BaseTextarea
                v-model="section.body"
                class="mt-4"
                :label="t('platform.content.sectionBody')"
                :hint="t('platform.content.sectionBodyHint')"
                :rows="6"
                :maxlength="8000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
