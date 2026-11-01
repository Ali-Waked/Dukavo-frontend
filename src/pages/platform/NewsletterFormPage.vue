<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Globe, LoaderCircle, Sparkles } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { useSlugAvailability } from '@/composables/useSlugAvailability'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import ImageUpload from '@/components/ui/ImageUpload.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import RichTextEditor from '@/components/ui/RichTextEditor.vue'
import {
  checkNewsletterSlug,
  createNewsletterArticle,
  fetchNewsletterArticle,
  updateNewsletterArticle,
  uploadNewsletterContentImage,
} from '@/services/platformContentService'
import { generateNewsletterContent } from '@/services/aiService'
import type { NewsletterArticle, NewsletterArticlePayload } from '@/types/marketing'
import type { NewsletterArticleStatus } from '@/types/enums'
import type { AiNewsletterAction, AiNewsletterContent } from '@/types/ai'
import { aiErrorMessage } from '@/utils/ai'

/**
 * Author one newsletter edition.
 *
 * Create and edit share a single page because the fields are identical; only
 * the initial read and the endpoint differ. The slug is offered automatically
 * for a Latin title, but an Arabic title can produce no honest identifier, so
 * the field is left for the author with a hint rather than silently
 * transliterated into something that would not read as a URL.
 */

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { store: auth } = useAuth()

const canUseAi = computed(() => auth.can('ai.use'))

const editingId = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)

const title = ref('')
const slug = ref('')
const slugEdited = ref(false)
const excerpt = ref('')
const body = ref('')
const published = ref(false)
const metaTitle = ref('')
const metaDescription = ref('')

/**
 * Arabic copy for the same article.
 *
 * One row holds both languages, so the slug, cover and publication state stay
 * shared while the prose changes. Blank fields are valid: the public API falls
 * back to English rather than publishing an empty translation.
 */
const activeLanguage = ref<'en' | 'ar'>('en')
const titleAr = ref('')
const excerptAr = ref('')
const bodyAr = ref('')
const metaTitleAr = ref('')
const metaDescriptionAr = ref('')

const coverFile = ref<File | null>(null)
const removeCover = ref(false)
const currentCoverUrl = ref<string | null>(null)

const formError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const slugError = ref<string | null>(null)
const bodyError = ref<string | null>(null)
const excerptError = ref<string | null>(null)
const coverError = ref<string | null>(null)
const titleArError = ref<string | null>(null)
const bodyArError = ref<string | null>(null)
const excerptArError = ref<string | null>(null)

/* ------------------------------------------------------- ai content helper */

const aiAction = ref<AiNewsletterAction>('draft')
const aiBrief = ref('')
const aiAudience = ref('')
const aiLoading = ref(false)
const aiError = ref<string | null>(null)
const aiResult = ref<AiNewsletterContent | null>(null)

const aiActionOptions = computed<Array<{ value: AiNewsletterAction; label: string }>>(() => [
  { value: 'outline', label: t('ai.content.action.outline') },
  { value: 'draft', label: t('ai.content.action.draft') },
  { value: 'improve', label: t('ai.content.action.improve') },
])

const { state: slugState } = useSlugAvailability(slug, checkNewsletterSlug, { ignore: editingId })

const isEdit = computed(() => editingId.value !== null)
const pageTitle = computed(() =>
  isEdit.value ? t('platform.newsletters.edit') : t('platform.newsletters.create'),
)

const titleIsLatin = computed(() => /^[\x00-\x7F]*$/.test(title.value))

const slugHint = computed<string | null>(() => {
  switch (slugState.value) {
    case 'checking':
      return t('slug.checking')
    case 'available':
      return t('slug.available')
    case 'taken':
      return t('slug.taken')
    default:
      if (!titleIsLatin.value && slug.value.trim() === '') {
        return t('platform.newsletters.slugRequiredHint')
      }
      return t('slug.autoHint')
  }
})

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function onSlugInput(value: string): void {
  slugEdited.value = true
  slug.value = value
}

watch(title, (value) => {
  if (slugEdited.value) {
    return
  }
  slug.value = /^[\x00-\x7F]*$/.test(value) ? slugify(value) : ''
})

function isBlankHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

function populate(edition: NewsletterArticle): void {
  title.value = edition.title
  slug.value = edition.slug
  slugEdited.value = true
  excerpt.value = edition.excerpt ?? ''
  body.value = edition.body
  published.value = edition.status === 'published'
  metaTitle.value = edition.meta_title ?? ''
  metaDescription.value = edition.meta_description ?? ''
  titleAr.value = edition.title_ar ?? ''
  excerptAr.value = edition.excerpt_ar ?? ''
  bodyAr.value = edition.body_ar ?? ''
  metaTitleAr.value = edition.meta_title_ar ?? ''
  metaDescriptionAr.value = edition.meta_description_ar ?? ''
  currentCoverUrl.value = edition.cover_image_url
}

async function load(): Promise<void> {
  const id = Number(route.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    void router.replace({ name: 'platform.newsletters' })
    return
  }

  editingId.value = id
  loading.value = true
  try {
    populate(await fetchNewsletterArticle(id))
  } catch (caught) {
    toast.error(errorMessage(caught))
    void router.replace({ name: 'platform.newsletters' })
  } finally {
    loading.value = false
  }
}

function clearErrors(): void {
  formError.value = null
  titleError.value = null
  slugError.value = null
  bodyError.value = null
  excerptError.value = null
  coverError.value = null
  titleArError.value = null
  bodyArError.value = null
  excerptArError.value = null
}

function validate(): boolean {
  clearErrors()

  if (title.value.trim() === '') {
    titleError.value = t('validation.required')
  }

  if (!titleIsLatin.value && slug.value.trim() === '') {
    slugError.value = t('platform.newsletters.slugRequiredHint')
  } else if (slugState.value === 'taken') {
    slugError.value = t('slug.taken')
  }

  if (isBlankHtml(body.value)) {
    bodyError.value = t('validation.required')
  }

  return titleError.value === null && slugError.value === null && bodyError.value === null
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const fields = caught.fields

    titleError.value = fields['title']?.[0] ?? null
    slugError.value = fields['slug']?.[0] ?? null
    bodyError.value = fields['body']?.[0] ?? null
    excerptError.value = fields['excerpt']?.[0] ?? null
    coverError.value = fields['cover_image']?.[0] ?? null
    titleArError.value = fields['title_ar']?.[0] ?? null
    bodyArError.value = fields['body_ar']?.[0] ?? null
    excerptArError.value = fields['excerpt_ar']?.[0] ?? null

    const handled = [
      titleError,
      slugError,
      bodyError,
      excerptError,
      coverError,
      titleArError,
      bodyArError,
      excerptArError,
    ].some((field) => field.value !== null)

    if (!handled) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = errorMessage(caught)
}

async function submit(): Promise<void> {
  if (!validate()) {
    return
  }

  const payload: NewsletterArticlePayload = {
    title: title.value.trim(),
    title_ar: titleAr.value.trim() || null,
    slug: slug.value.trim() || null,
    excerpt: excerpt.value.trim() || null,
    excerpt_ar: excerptAr.value.trim() || null,
    body: body.value,
    body_ar: bodyAr.value.trim() === '' ? null : bodyAr.value,
    status: (published.value ? 'published' : 'draft') as NewsletterArticleStatus,
    meta_title: metaTitle.value.trim() || null,
    meta_title_ar: metaTitleAr.value.trim() || null,
    meta_description: metaDescription.value.trim() || null,
    meta_description_ar: metaDescriptionAr.value.trim() || null,
    cover_image: coverFile.value,
    remove_cover: removeCover.value,
  }

  saving.value = true
  try {
    if (editingId.value !== null) {
      await updateNewsletterArticle(editingId.value, payload)
      toast.success(t('platform.newsletters.updated'))
    } else {
      await createNewsletterArticle(payload)
      toast.success(t('platform.newsletters.created'))
    }
    await router.push({ name: 'platform.newsletters' })
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

function cancel(): void {
  void router.push({ name: 'platform.newsletters' })
}

/** Inline images are uploaded before save; the body only stores their URL. */
async function uploadContentImage(file: File): Promise<string> {
  const uploaded = await uploadNewsletterContentImage(file)

  return uploaded.url
}

/* ------------------------------------------------------------ ai assistant */

function onAiActionChange(value: string): void {
  aiAction.value = value as AiNewsletterAction
}

/** Ask the assistant for content. Anything it returns stays in the editor. */
async function runContentAssistant(): Promise<void> {
  if (aiLoading.value) return

  const brief = aiBrief.value.trim()
  if (brief === '') {
    aiError.value = t('ai.content.brief')
    return
  }

  if (aiAction.value === 'improve' && isBlankHtml(body.value)) {
    aiError.value = t('ai.content.improveNeedsBody')
    return
  }

  aiLoading.value = true
  aiError.value = null
  try {
    aiResult.value = await generateNewsletterContent({
      action: aiAction.value,
      brief,
      audience: aiAudience.value.trim() || null,
      body: aiAction.value === 'improve' ? body.value : null,
    })
  } catch (caught) {
    aiError.value = aiErrorMessage(caught, t)
  } finally {
    aiLoading.value = false
  }
}

/** Carry a suggested field into the form; the author still saves it. */
function useAiTitle(): void {
  if (aiResult.value) title.value = aiResult.value.title
}

function useAiExcerpt(): void {
  if (aiResult.value) excerpt.value = aiResult.value.excerpt
}

function useAiBody(): void {
  if (aiResult.value) body.value = aiResult.value.body
}

function useAiAll(): void {
  if (!aiResult.value) return
  title.value = aiResult.value.title
  excerpt.value = aiResult.value.excerpt
  body.value = aiResult.value.body
  toast.success(t('ai.content.applied'))
}

onMounted(() => {
  if (route.params.id) {
    void load()
  }
})
</script>

<template>
  <div class="space-y-5">
    <div>
      <BaseButton variant="ghost" size="sm" :icon="ArrowLeft" @click="cancel">
        {{ t('platform.newsletters.backToList') }}
      </BaseButton>
    </div>

    <PageHeader :title="pageTitle" :description="t('platform.newsletters.formSubtitle')" />

    <div v-if="loading" class="surface flex items-center justify-center gap-2 p-16 text-muted">
      <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
      <span>{{ t('state.loading') }}</span>
    </div>

    <form v-else class="space-y-5" @submit.prevent="submit">
      <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
        {{ formError }}
      </BaseAlert>

      <div class="grid gap-5 lg:grid-cols-3">
        <div class="space-y-5 lg:col-span-2">
          <div class="surface space-y-4 p-5">
            <div
              class="inline-flex rounded-lg border border-line bg-inset p-0.5"
              role="tablist"
              :aria-label="t('platform.newsletters.languageTabs')"
            >
              <button
                v-for="language in (['en', 'ar'] as const)"
                :key="language"
                type="button"
                role="tab"
                :aria-selected="activeLanguage === language"
                class="rounded-md px-3 py-1.5 text-small font-medium transition"
                :class="activeLanguage === language ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
                @click="activeLanguage = language"
              >
                {{ language === 'en' ? t('platform.newsletters.english') : t('platform.newsletters.arabic') }}
              </button>
            </div>

            <template v-if="activeLanguage === 'en'">
              <BaseInput
                v-model="title"
                :label="t('platform.newsletters.titleField')"
                :error="titleError"
                :placeholder="t('platform.newsletters.titlePlaceholder')"
                maxlength="200"
                required
              />

              <BaseTextarea
                v-model="excerpt"
                :label="t('platform.newsletters.excerpt')"
                :error="excerptError"
                :hint="t('platform.newsletters.excerptHint')"
                :placeholder="t('platform.newsletters.excerptPlaceholder')"
                :rows="2"
                :maxlength="300"
              />

              <RichTextEditor
                v-model="body"
                :label="t('platform.newsletters.body')"
                :error="bodyError"
                :placeholder="t('platform.newsletters.bodyPlaceholder')"
                :upload-image="uploadContentImage"
                required
              />
            </template>

            <template v-else>
              <p class="rounded-lg bg-inset px-3 py-2 text-small text-muted" dir="rtl">
                {{ t('platform.newsletters.arabicHint') }}
              </p>

              <BaseInput
                v-model="titleAr"
                :label="t('platform.newsletters.titleFieldAr')"
                :error="titleArError"
                :placeholder="t('platform.newsletters.titlePlaceholderAr')"
                maxlength="200"
                dir="rtl"
              />

              <BaseTextarea
                v-model="excerptAr"
                :label="t('platform.newsletters.excerptAr')"
                :error="excerptArError"
                :placeholder="t('platform.newsletters.excerptPlaceholderAr')"
                :rows="2"
                :maxlength="300"
                dir="rtl"
              />

              <RichTextEditor
                v-model="bodyAr"
                :label="t('platform.newsletters.bodyAr')"
                :error="bodyArError"
                :placeholder="t('platform.newsletters.bodyPlaceholderAr')"
                :upload-image="uploadContentImage"
                dir="rtl"
              />
            </template>

            <BaseInput
              :model-value="slug"
              :label="t('common.slug')"
              :error="slugError"
              :hint="slugHint ?? undefined"
              :placeholder="t('platform.newsletters.slugPlaceholder')"
              @update:model-value="onSlugInput"
            />
          </div>
        </div>

        <div class="space-y-5">
          <div class="surface space-y-4 p-5">
            <ImageUpload
              v-model:file="coverFile"
              v-model:remove="removeCover"
              :current-url="currentCoverUrl"
              :label="t('platform.newsletters.cover')"
              :error="coverError"
              :hint="t('platform.newsletters.coverHint')"
            />

            <BaseSwitch
              v-model="published"
              :label="t('platform.newsletters.published')"
            />
          </div>

          <div class="surface space-y-4 p-5">
            <h2 class="text-sm font-semibold text-ink">{{ t('platform.newsletters.seo') }}</h2>

            <BaseInput
              v-model="metaTitle"
              :label="t('platform.newsletters.metaTitle')"
              :placeholder="t('platform.newsletters.metaTitlePlaceholder')"
              maxlength="200"
            />

            <BaseTextarea
              v-model="metaDescription"
              :label="t('platform.newsletters.metaDescription')"
              :placeholder="t('platform.newsletters.metaDescriptionPlaceholder')"
              :rows="3"
              :maxlength="300"
            />

            <div class="border-t border-line pt-4">
              <h3 class="text-sm font-semibold text-ink">{{ t('platform.newsletters.seoArabic') }}</h3>

              <BaseInput
                v-model="metaTitleAr"
                :label="t('platform.newsletters.metaTitleAr')"
                :placeholder="t('platform.newsletters.metaTitlePlaceholderAr')"
                maxlength="200"
                dir="rtl"
                class="mt-3"
              />

              <BaseTextarea
                v-model="metaDescriptionAr"
                :label="t('platform.newsletters.metaDescriptionAr')"
                :placeholder="t('platform.newsletters.metaDescriptionPlaceholderAr')"
                :rows="3"
                :maxlength="300"
                dir="rtl"
                class="mt-3"
              />
            </div>
          </div>

          <div v-if="canUseAi" class="surface space-y-4 p-5">
            <div class="flex items-center gap-2">
              <span class="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                <Sparkles class="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 class="text-h4 font-semibold text-ink">{{ t('ai.content.title') }}</h2>
                <p class="mt-0.5 text-caption text-muted">{{ t('ai.content.description') }}</p>
              </div>
            </div>

            <BaseSelect
              :model-value="aiAction"
              :label="t('ai.content.action')"
              :options="aiActionOptions"
              @update:model-value="onAiActionChange"
            />

            <BaseTextarea
              v-model="aiBrief"
              :label="t('ai.content.brief')"
              :placeholder="t('ai.content.briefPlaceholder')"
              :rows="2"
            />

            <BaseInput
              v-model="aiAudience"
              :label="t('ai.content.audience')"
              :placeholder="t('ai.content.audiencePlaceholder')"
            />

            <BaseButton
              size="sm"
              :icon="Sparkles"
              :loading="aiLoading"
              :disabled="aiLoading"
              @click="runContentAssistant"
            >
              {{ t('ai.content.generate') }}
            </BaseButton>

            <BaseAlert v-if="aiError" tone="danger" dismissible @dismiss="aiError = null">
              {{ aiError }}
            </BaseAlert>

            <div v-if="aiLoading" class="space-y-3" aria-hidden="true">
              <BaseSkeleton height="h-4" block />
              <BaseSkeleton class="w-5/6" height="h-4" block />
              <p class="text-small text-muted">{{ t('ai.content.loading') }}</p>
            </div>

            <div v-else-if="aiResult" class="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
              <p class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('ai.content.resultTitle') }}
              </p>
              <div>
                <p class="text-sm font-medium text-ink">{{ aiResult.title }}</p>
                <p class="text-small text-muted">{{ aiResult.excerpt }}</p>
              </div>
              <div
                class="rich-content max-h-48 overflow-auto text-sm leading-relaxed text-ink"
                v-html="aiResult.body"
              />
              <div class="flex flex-wrap gap-1.5">
                <BaseButton size="sm" variant="secondary" @click="useAiTitle">
                  {{ t('ai.content.useTitle') }}
                </BaseButton>
                <BaseButton size="sm" variant="secondary" @click="useAiExcerpt">
                  {{ t('ai.content.useExcerpt') }}
                </BaseButton>
                <BaseButton size="sm" variant="secondary" @click="useAiBody">
                  {{ t('ai.content.useBody') }}
                </BaseButton>
                <BaseButton size="sm" @click="useAiAll">{{ t('ai.content.useAll') }}</BaseButton>
              </div>
              <p class="text-caption text-subtle">{{ t('ai.content.disclaimer') }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <BaseButton variant="secondary" :disabled="saving" @click="cancel">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton type="submit" :loading="saving">
          {{ isEdit ? t('action.saveChanges') : t('action.create') }}
        </BaseButton>
      </div>
    </form>
  </div>
</template>
