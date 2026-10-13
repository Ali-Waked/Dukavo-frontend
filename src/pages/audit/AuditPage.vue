<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Eye, RefreshCw, ShieldCheck } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  fetchAuditActions,
  fetchAuditLogs,
  type AuditBase,
} from '@/services/auditService'
import type { AuditLog } from '@/types/admin'
import type { Paginated } from '@/types/api'
import { formatDateTime } from '@/utils/format'

/**
 * Read-only record of every change made in the workspace.
 *
 * Two things the screen has to get right: the date range is sent only when
 * both ends are set (a half-open range would quietly hide the other side), and
 * the detail view renders `old_values` / `new_values` as they arrived — the
 * server knows what changed, the UI's job is only to make the change legible
 * in either script.
 *
 * The same backend controller serves the workspace trail (`/tenant/audit-logs`)
 * and the platform trail (`/platform/audit-logs`). In platform mode the
 * `platform=1` switch includes the tenant-less events — a suspension, a role
 * change — that belong to no workspace at all.
 */

const PER_PAGE = 20

const props = defineProps<{ platform?: boolean }>()

const { t } = useI18n()
const { store: auth } = useAuth()

const base = computed<AuditBase>(() => (props.platform ? 'platform' : 'tenant'))

const canView = computed(() => auth.can('audit.view'))

const rows = ref<AuditLog[]>([])
const meta = ref<Paginated<AuditLog>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const actions = ref<string[]>([])
const action = ref('')
const from = ref('')
const until = ref('')

const selected = ref<AuditLog | null>(null)

const hasFilters = computed(
  () => action.value !== '' || from.value !== '' || until.value !== '',
)

const actionOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...actions.value.map((value) => ({ value, label: humanise(value) })),
])

const columns = computed<TableColumn[]>(() => [
  { key: 'when', label: t('audit.when'), width: '11rem' },
  { key: 'actor', label: t('audit.actor') },
  { key: 'action', label: t('audit.action') },
  { key: 'subject', label: t('audit.subject') },
  { key: 'ip', label: t('audit.ipAddress'), width: '9rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '4rem' },
])

const beforeRows = computed(() => Object.entries(selected.value?.old_values ?? {}))
const afterRows = computed(() => Object.entries(selected.value?.new_values ?? {}))
const hasChanges = computed(() => beforeRows.value.length > 0 || afterRows.value.length > 0)

/**
 * `App\Models\Product` → `Product`, `first_name` → `First Name`.
 * Class names, action slugs and value keys arrive as code, not copy, so they
 * are humanised here instead of being carried as translation keys.
 */
function humanise(value: string): string {
  return value
    .replace(/^App\\Models\\/, '')
    .replace(/[\\_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function recordLabel(log: AuditLog): string {
  if (!log.auditable_type) return '—'
  const name = humanise(log.auditable_type)
  return log.auditable_id != null ? `${name} #${log.auditable_id}` : name
}

/** Audit values arrive as raw JSON; render each shape the way a reader expects. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    // The API takes the range as a pair; a single bound would silently widen
    // the result set to one side of the intent.
    const ranged = from.value !== '' && until.value !== ''
    const result = await fetchAuditLogs(
      {
        page: page.value,
        per_page: PER_PAGE,
        action: action.value || undefined,
        from: ranged ? from.value : undefined,
        until: ranged ? until.value : undefined,
        // Only the platform listing can include tenant-less events; for the
        // workspace trail this param must stay absent.
        platform: props.platform ? 1 : undefined,
      },
      base.value,
    )
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

/** Optional filter source: without it the table still answers the main question. */
async function loadActions(): Promise<void> {
  try {
    actions.value = await fetchAuditActions(base.value)
  } catch {
    actions.value = []
  }
}

watch([action, from, until], () => {
  if (page.value !== 1) {
    // Moving the page back to 1 lets the page watcher drive the one reload.
    page.value = 1
    return
  }
  void load()
})

watch(page, () => void load())

/** The filter watcher reloads, so clearing only clears. */
function clearFilters(): void {
  action.value = ''
  from.value = ''
  until.value = ''
}

onMounted(() => {
  if (!canView.value) {
    loading.value = false
    return
  }
  void load()
  void loadActions()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      :title="t(props.platform ? 'platform.audit.title' : 'audit.title')"
      :description="t(props.platform ? 'platform.audit.subtitle' : 'audit.subtitle')"
    />

    <BaseEmptyState
      v-if="!canView"
      :icon="ShieldCheck"
      :title="t('table.noPermissionTitle')"
      :description="t('table.noPermissionBody')"
    />

    <template v-else>
      <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{{ error }}</span>
          <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
            {{ t('action.retry') }}
          </BaseButton>
        </div>
      </BaseAlert>

      <!-- Filters -->
      <div class="surface flex flex-wrap items-end gap-3 p-4">
        <BaseSelect
          v-model="action"
          class="w-56"
          :label="t('audit.action')"
          :options="actionOptions"
        />

        <BaseInput v-model="from" class="w-44" type="date" :label="t('filter.from')" />

        <BaseInput v-model="until" class="w-44" type="date" :label="t('filter.until')" />

        <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
          {{ t('action.clearAll') }}
        </BaseButton>
      </div>

      <!-- Table -->
      <div class="surface overflow-hidden">
        <BaseTable :columns="columns" :loading="loading" :rows="rows">
          <tr v-for="log in rows" :key="log.id">
            <td class="px-4 py-3 text-muted tabular-nums">
              {{ formatDateTime(log.created_at) }}
            </td>

            <td class="px-4 py-3 text-ink">
              {{ log.user?.name ?? '—' }}
            </td>

            <td class="px-4 py-3 font-medium text-ink">
              {{ log.action_label }}
            </td>

            <td class="px-4 py-3 text-muted">
              {{ recordLabel(log) }}
            </td>

            <td class="px-4 py-3">
              <span v-if="log.ip_address" class="font-mono text-caption text-muted">
                {{ log.ip_address }}
              </span>
              <span v-else class="text-subtle">—</span>
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn-icon"
                  :aria-label="t('action.view')"
                  :title="t('action.view')"
                  @click="selected = log"
                >
                  <Eye class="size-5" />
                </button>
              </div>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              v-if="error && rows.length === 0"
              :title="t('state.loadFailed')"
              :description="t('state.loadFailedBody')"
            >
              <template #action>
                <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
                  {{ t('action.retry') }}
                </BaseButton>
              </template>
            </BaseEmptyState>

            <BaseEmptyState
              v-else-if="rows.length === 0 && hasFilters"
              :title="t('common.noResults')"
            >
              <template #action>
                <BaseButton variant="secondary" @click="clearFilters">
                  {{ t('action.clearAll') }}
                </BaseButton>
              </template>
            </BaseEmptyState>

            <BaseEmptyState
              v-else-if="rows.length === 0"
              :icon="ShieldCheck"
              :title="t('audit.emptyTitle')"
              :description="t('audit.emptyBody')"
            />
          </template>

          <template #footer>
            <BasePagination
              v-if="meta"
              :meta="meta"
              :disabled="loading"
              @change="page = $event"
            />
          </template>
        </BaseTable>
      </div>

      <!-- Entry detail -->
      <BaseModal
        :open="selected !== null"
        :title="selected?.action_label ?? ''"
        size="lg"
        @close="selected = null"
      >
        <div class="space-y-4">
          <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('audit.when') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">{{ formatDateTime(selected?.created_at) }}</dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('audit.actor') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">{{ selected?.user?.name ?? '—' }}</dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('audit.action') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">{{ selected?.action_label ?? '—' }}</dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('audit.ipAddress') }}
              </dt>
              <dd class="mt-1 font-mono text-caption text-ink">
                {{ selected?.ip_address ?? '—' }}
              </dd>
            </div>
          </dl>

          <section v-if="beforeRows.length > 0">
            <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('audit.oldValues') }}
            </h3>
            <dl class="mt-2 divide-y divide-line rounded-lg border border-line">
              <div
                v-for="[key, value] in beforeRows"
                :key="key"
                class="flex items-start justify-between gap-4 px-3 py-2"
              >
                <dt class="text-sm text-muted">{{ humanise(key) }}</dt>
                <dd class="break-words text-end text-sm text-ink">{{ formatValue(value) }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="afterRows.length > 0">
            <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('audit.newValues') }}
            </h3>
            <dl class="mt-2 divide-y divide-line rounded-lg border border-line">
              <div
                v-for="[key, value] in afterRows"
                :key="key"
                class="flex items-start justify-between gap-4 px-3 py-2"
              >
                <dt class="text-sm text-muted">{{ humanise(key) }}</dt>
                <dd class="break-words text-end text-sm text-ink">{{ formatValue(value) }}</dd>
              </div>
            </dl>
          </section>

          <p v-if="!hasChanges" class="text-sm text-muted">
            {{ t('audit.noChanges') }}
          </p>
        </div>

        <template #footer>
          <BaseButton variant="secondary" @click="selected = null">
            {{ t('action.close') }}
          </BaseButton>
        </template>
      </BaseModal>
    </template>
  </div>
</template>
