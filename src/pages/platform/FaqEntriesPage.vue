<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { HelpCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createFaqEntry,
  deleteFaqEntry,
  fetchFaqEntries,
  updateFaqEntry,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { FaqEntry, FaqEntryPayload } from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * FAQ administration.
 *
 * Platform-level marketing content: the order is decided by `sort_order`,
 * which the public endpoint reads verbatim. Entry is active/inactive for the
 * website; edits are full CRUD.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const rows = ref<FaqEntry[]>([])
const meta = ref<Paginated<FaqEntry>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const categoryFilter = ref('')
const activeFilter = ref('')

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formQuestion = ref('')
const formAnswer = ref('')
const formQuestionAr = ref('')
const formAnswerAr = ref('')
const formCategory = ref('')
const formSortOrder = ref('0')
const formActive = ref(true)
const questionError = ref<string | null>(null)
const answerError = ref<string | null>(null)
const questionArError = ref<string | null>(null)
const answerArError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const pendingDelete = ref<FaqEntry | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(
  () => query.value.trim() !== '' || categoryFilter.value !== '' || activeFilter.value !== '',
)

const categories = computed<string[]>(() =>
  Array.from(new Set(rows.value.map((entry) => entry.category ?? '').filter(Boolean))),
)

const categoryChoices = computed(() => [
  { value: '', label: t('filter.anyCategory') },
  ...categories.value.map((category) => ({ value: category, label: category })),
])

const activeChoices = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'true', label: t('status.product.active') },
  { value: 'false', label: t('status.product.archived') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'question', label: t('platform.faq.question') },
  { key: 'category', label: t('platform.faq.category') },
  { key: 'sort', label: t('platform.faq.sortOrder') },
  { key: 'active', label: t('common.status'), width: '7rem' },
  { key: 'updated', label: t('common.updatedAt') },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchFaqEntries({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      category: categoryFilter.value || undefined,
      active: activeFilter.value === 'true' ? true : activeFilter.value === 'false' ? false : undefined,
    })
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('error.title')
  } finally {
    loading.value = false
  }
}

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch([categoryFilter, activeFilter], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  categoryFilter.value = ''
  activeFilter.value = ''
}

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  questionError.value = null
  answerError.value = null
  questionArError.value = null
  answerArError.value = null
  formError.value = null
}

function openCreate(): void {
  editingId.value = null
  formQuestion.value = ''
  formAnswer.value = ''
  formQuestionAr.value = ''
  formAnswerAr.value = ''
  formCategory.value = ''
  formSortOrder.value = '0'
  formActive.value = true
  clearFormErrors()
  formOpen.value = true
}

function openEdit(entry: FaqEntry): void {
  editingId.value = entry.id
  formQuestion.value = entry.question
  formAnswer.value = entry.answer
  formQuestionAr.value = entry.question_ar ?? ''
  formAnswerAr.value = entry.answer_ar ?? ''
  formCategory.value = entry.category ?? ''
  formSortOrder.value = String(entry.sort_order)
  formActive.value = entry.active
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

function validateForm(): boolean {
  clearFormErrors()
  if (!formQuestion.value.trim()) {
    questionError.value = t('validation.required')
  }
  if (!formAnswer.value.trim()) {
    answerError.value = t('validation.required')
  }
  return questionError.value === null && answerError.value === null
}

function buildPayload(): FaqEntryPayload {
  return {
    question: formQuestion.value.trim(),
    question_ar: formQuestionAr.value.trim() || null,
    answer: formAnswer.value.trim(),
    answer_ar: formAnswerAr.value.trim() || null,
    category: formCategory.value.trim() || null,
    sort_order: Number(formSortOrder.value) || 0,
    active: formActive.value,
  }
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const fields = caught.fields
    questionError.value = fields['question']?.[0] ?? null
    answerError.value = fields['answer']?.[0] ?? null
    questionArError.value = fields['question_ar']?.[0] ?? null
    answerArError.value = fields['answer_ar']?.[0] ?? null

    if (
      questionError.value === null
      && answerError.value === null
      && questionArError.value === null
      && answerArError.value === null
    ) {
      formError.value = caught.message || t('error.title')
    }
    return
  }
  formError.value = errorMessage(caught)
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return

  saving.value = true
  try {
    if (editingId.value !== null) {
      await updateFaqEntry(editingId.value, buildPayload())
      toast.success(t('platform.faq.updated'))
    } else {
      await createFaqEntry(buildPayload())
      toast.success(t('platform.faq.created'))
    }
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(): Promise<void> {
  const entry = pendingDelete.value
  if (!entry) return

  deleting.value = true
  try {
    await deleteFaqEntry(entry.id)
    toast.success(t('platform.faq.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('platform.faq.title')" :description="t('platform.faq.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('platform.faq.create') }}
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

    <div class="surface flex flex-wrap items-end gap-3 p-4">
      <BaseInput
        v-model="query"
        class="min-w-56 flex-1"
        type="search"
        :label="t('filter.search')"
        :placeholder="t('filter.searchPlaceholder')"
      />
      <BaseSelect v-model="categoryFilter" class="w-48" :label="t('platform.faq.category')" :options="categoryChoices" />
      <BaseSelect v-model="activeFilter" class="w-44" :label="t('common.status')" :options="activeChoices" />
      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="entry in rows" :key="entry.id">
          <td class="max-w-md px-4 py-3">
            <span class="line-clamp-2 block font-medium text-ink">{{ entry.question }}</span>
          </td>

          <td class="px-4 py-3">
            <span v-if="entry.category">
              <BaseBadge tone="brand" size="sm">{{ entry.category }}</BaseBadge>
            </span>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ entry.sort_order }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="entry.active ? 'success' : 'neutral'" dot>
              {{ entry.active ? t('content.live') : t('content.hidden') }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(entry.updated_at ?? entry.created_at) }}
          </td>

          <td class="px-4 py-3">
            <div v-if="canManage" class="flex justify-end">
              <BaseDropdown align="end">
                <template #trigger>
                  <span class="btn-icon" role="button" :aria-label="t('action.moreActions')" :title="t('action.moreActions')">
                    <MoreHorizontal class="size-5" />
                  </span>
                </template>

                <template #default="{ close }">
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); openEdit(entry)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = entry"
                  >
                    <Trash2 class="size-4" />
                    {{ t('action.delete') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </td>
        </tr>

        <template #empty>
          <BaseEmptyState
            v-if="error && !loading"
            :title="t('state.loadFailed')"
            :description="t('state.loadFailedBody')"
          >
            <template #action>
              <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                {{ t('action.retry') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState v-else-if="rows.length === 0 && hasFilters" :title="t('common.noResults')">
            <template #action>
              <BaseButton variant="secondary" @click="clearFilters">
                {{ t('action.clearAll') }}
              </BaseButton>
            </template>
          </BaseEmptyState>

          <BaseEmptyState
            v-else-if="rows.length === 0"
            :icon="HelpCircle"
            :title="t('platform.faq.emptyTitle')"
            :description="t('platform.faq.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('platform.faq.create') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('platform.faq.create') : t('platform.faq.edit')"
      size="lg"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <BaseInput
          v-model="formQuestion"
          :label="t('platform.faq.question')"
          :error="questionError"
          :placeholder="t('platform.faq.questionPlaceholder')"
          maxlength="200"
          required
        />

        <BaseTextarea
          v-model="formAnswer"
          :label="t('platform.faq.answer')"
          :error="answerError"
          :placeholder="t('platform.faq.answerPlaceholder')"
          :rows="6"
          :maxlength="2000"
          required
        />

        <div class="space-y-4 border-t border-line pt-4">
          <h3 class="text-sm font-semibold text-ink">{{ t('platform.faq.arabic') }}</h3>
          <p class="text-small text-muted">{{ t('platform.faq.arabicHint') }}</p>

          <BaseInput
            v-model="formQuestionAr"
            :label="t('platform.faq.questionAr')"
            :error="questionArError"
            :placeholder="t('platform.faq.questionPlaceholderAr')"
            maxlength="200"
            dir="rtl"
          />

          <BaseTextarea
            v-model="formAnswerAr"
            :label="t('platform.faq.answerAr')"
            :error="answerArError"
            :placeholder="t('platform.faq.answerPlaceholderAr')"
            :rows="6"
            :maxlength="2000"
            dir="rtl"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model="formCategory"
            :label="t('platform.faq.category')"
            :placeholder="t('platform.faq.categoryPlaceholder')"
            :hint="t('common.optional')"
          />

          <BaseInput
            v-model="formSortOrder"
            type="number"
            min="0"
            :label="t('platform.faq.sortOrder')"
          />
        </div>

        <BaseSwitch
          v-model="formActive"
          :label="t('platform.faq.active')"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="saving" @click="submitForm">
          {{ editingId === null ? t('action.create') : t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.faq.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.faq.deleteBody', { question: pendingDelete?.question ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>