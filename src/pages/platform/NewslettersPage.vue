<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MoreHorizontal, Newspaper, Pencil, Plus, RefreshCw, Trash2 } from '@/components/icons'
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
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  deleteNewsletterArticle,
  fetchNewsletterArticles,
} from '@/services/platformContentService'
import type { Paginated } from '@/types/api'
import type { NewsletterSummary } from '@/types/marketing'
import { formatDateTime } from '@/utils/format'

/**
 * Newsletter editions.
 *
 * Platform-level content: the written editions Dukavo publishes to its
 * audience. This is authoring only — publishing makes an edition readable on
 * the public archive, it does not send email. The subscriber list is a separate
 * surface entirely.
 */

const PER_PAGE = 15

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()
const router = useRouter()

const rows = ref<NewsletterSummary[]>([])
const meta = ref<Paginated<NewsletterSummary>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const statusFilter = ref('')

const pendingDelete = ref<NewsletterSummary | null>(null)
const deleting = ref(false)

const canManage = computed(() => auth.isPlatformUser)
const hasFilters = computed(() => query.value.trim() !== '' || statusFilter.value !== '')

const statusChoices = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'published', label: t('platform.newsletters.published') },
  { value: 'draft', label: t('platform.newsletters.draft') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'title', label: t('platform.newsletters.titleField') },
  { key: 'status', label: t('common.status'), width: '9rem' },
  { key: 'published', label: t('platform.newsletters.publishedAt') },
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
    const result = await fetchNewsletterArticles({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: (statusFilter.value || undefined) as NewsletterSummary['status'] | undefined,
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

watch(statusFilter, () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  query.value = ''
  statusFilter.value = ''
}

function openCreate(): void {
  void router.push({ name: 'platform.newsletters.create' })
}

function openEdit(edition: NewsletterSummary): void {
  void router.push({ name: 'platform.newsletters.edit', params: { id: edition.id } })
}

async function confirmDelete(): Promise<void> {
  const edition = pendingDelete.value
  if (!edition) return

  deleting.value = true
  try {
    await deleteNewsletterArticle(edition.id)
    toast.success(t('platform.newsletters.deleted'))
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
    <PageHeader :title="t('platform.newsletters.title')" :description="t('platform.newsletters.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('platform.newsletters.create') }}
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
      <BaseSelect v-model="statusFilter" class="w-48" :label="t('common.status')" :options="statusChoices" />
      <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
        {{ t('action.clearAll') }}
      </BaseButton>
    </div>

    <div class="surface overflow-hidden">
      <BaseTable :columns="columns" :loading="loading" :rows="rows">
        <tr v-for="edition in rows" :key="edition.id">
          <td class="max-w-md px-4 py-3">
            <button
              type="button"
              class="flex items-center gap-3 text-start"
              @click="openEdit(edition)"
            >
              <img
                v-if="edition.cover_image_url"
                :src="edition.cover_image_url"
                alt=""
                class="size-10 shrink-0 rounded-md object-cover"
              />
              <span
                v-else
                class="flex size-10 shrink-0 items-center justify-center rounded-md bg-inset text-subtle"
              >
                <Newspaper class="size-4" aria-hidden="true" />
              </span>
              <span class="min-w-0">
                <span class="line-clamp-1 block font-medium text-ink">{{ edition.title }}</span>
                <span v-if="edition.excerpt" class="line-clamp-1 block text-small text-muted">
                  {{ edition.excerpt }}
                </span>
              </span>
            </button>
          </td>

          <td class="px-4 py-3">
            <BaseBadge :tone="edition.status === 'published' ? 'success' : 'neutral'" dot>
              {{ edition.status_label }}
            </BaseBadge>
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            <span v-if="edition.published_at">{{ formatDateTime(edition.published_at) }}</span>
            <span v-else class="text-subtle">—</span>
          </td>

          <td class="px-4 py-3 text-muted tabular-nums">
            {{ formatDateTime(edition.updated_at) }}
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
                    @click="close(); openEdit(edition)"
                  >
                    <Pencil class="size-4 text-muted" />
                    {{ t('action.edit') }}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                    @click="close(); pendingDelete = edition"
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
            :icon="Newspaper"
            :title="t('platform.newsletters.emptyTitle')"
            :description="t('platform.newsletters.emptyBody')"
          >
            <template v-if="canManage" #action>
              <BaseButton :icon="Plus" @click="openCreate">
                {{ t('platform.newsletters.create') }}
              </BaseButton>
            </template>
          </BaseEmptyState>
        </template>

        <template #footer>
          <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
        </template>
      </BaseTable>
    </div>

    <BaseModal
      :open="pendingDelete !== null"
      :title="t('platform.newsletters.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('platform.newsletters.deleteBody', { title: pendingDelete?.title ?? '' }) }}
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
