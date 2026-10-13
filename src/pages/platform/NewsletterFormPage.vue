<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, LoaderCircle } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useSlugAvailability } from '@/composables/useSlugAvailability'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
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
} from '@/services/platformContentService'
import type { NewsletterArticle, NewsletterArticlePayload } from '@/types/marketing'
import type { NewsletterArticleStatus } from '@/types/enums'

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

const coverFile = ref<File | null>(null)
const removeCover = ref(false)
const currentCoverUrl = ref<string | null>(null)

const formError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const slugError = ref<string | null>(null)
const bodyError = ref<string | null>(null)
const excerptError = ref<string | null>(null)
const coverError = ref<string | null>(null)

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

    const handled = [titleError, slugError, bodyError, excerptError, coverError].some(
      (field) => field.value !== null,
    )

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
    slug: slug.value.trim() || null,
    excerpt: excerpt.value.trim() || null,
    body: body.value,
    status: (published.value ? 'published' : 'draft') as NewsletterArticleStatus,
    meta_title: metaTitle.value.trim() || null,
    meta_description: metaDescription.value.trim() || null,
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
            <BaseInput
              v-model="title"
              :label="t('platform.newsletters.titleField')"
              :error="titleError"
              :placeholder="t('platform.newsletters.titlePlaceholder')"
              maxlength="200"
              required
            />

            <BaseInput
              :model-value="slug"
              :label="t('common.slug')"
              :error="slugError"
              :hint="slugHint ?? undefined"
              :placeholder="t('platform.newsletters.slugPlaceholder')"
              @update:model-value="onSlugInput"
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
              required
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
