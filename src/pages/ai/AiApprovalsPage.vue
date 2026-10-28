<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MessageKey } from '@/i18n'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import {
  approveAiAction,
  executeAiAction,
  fetchAiAction,
  fetchAiActions,
  fetchAiActionTypes,
  rejectAiAction,
  submitAiAction,
} from '@/services/aiService'
import type { AiAction, AiActionType } from '@/types/ai'
import type { Paginated } from '@/types/api'
import { AI_ACTION_STATUS, statusOptions } from '@/constants/statuses'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { Check, Eye, Play, RefreshCw, ShieldCheck, X } from '@/components/icons'
import { formatDateTime } from '@/utils/format'

/**
 * The human review queue for AI-proposed business actions.
 *
 * Nothing on this page changes data directly: a proposal arrives, a reviewer
 * submits it, an authorised person approves or rejects it with the explicit
 * confirmation the server demands for riskier classes, and execution happens
 * separately. Every response is the server's current record, so an expiry or a
 * stale-state refusal is reflected immediately rather than guessed at here.
 *
 * Buttons are hidden when the caller lacks `ai.approve`, or would fail the
 * executor's own permission. That is a convenience: the service still rechecks
 * both on every transition.
 */

const PER_PAGE = 20

const { t, tDynamic } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const canUse = computed(() => auth.can('ai.use'))
const canApprove = computed(() => auth.can('ai.approve'))

const rows = ref<AiAction[]>([])
const meta = ref<Paginated<AiAction>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)

const statusFilter = ref('')
const typeFilter = ref('')

const actionTypes = ref<AiActionType[]>([])

const statusFilterOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...statusOptions(AI_ACTION_STATUS).map(({ value, meta: status }) => ({
    value,
    label: t(status.key),
  })),
])

const typeFilterOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...actionTypes.value.map((type) => ({
    value: type.action_type,
    label: tDynamic('ai.actionType', type.action_type),
  })),
])

const hasFilters = computed(() => statusFilter.value !== '' || typeFilter.value !== '')

const columns = computed<TableColumn[]>(() => [
  { key: 'summary', label: t('ai.approvals.summary') },
  { key: 'type', label: t('ai.approvals.type') },
  { key: 'classification', label: t('ai.approvals.classification') },
  { key: 'status', label: t('ai.approvals.status') },
  { key: 'proposer', label: t('ai.approvals.proposer') },
  { key: 'expires', label: t('ai.approvals.expiresAt'), width: '11rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '5rem' },
])

function statusMeta(row: AiAction) {
  return AI_ACTION_STATUS[row.status]
}

function classificationLabel(row: AiAction): string {
  return row.classification
    ? tDynamic('ai.classification', row.classification)
    : (row.classification_label ?? '—')
}

function actionTypeLabel(type: string): string {
  return tDynamic('ai.actionType', type)
}

function messageFor(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.isNetworkError ? t('auth.networkError') : caught.message || t('error.title')
  }
  return t('error.title')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const result = await fetchAiActions({
      page: page.value,
      per_page: PER_PAGE,
      status: statusFilter.value ? (statusFilter.value as AiAction['status']) : undefined,
      action_type: typeFilter.value || undefined,
    })
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value = messageFor(caught)
  } finally {
    loading.value = false
  }
}

/** Type options are optional filtering; the queue still works without them. */
async function loadTypes(): Promise<void> {
  try {
    actionTypes.value = await fetchAiActionTypes()
  } catch {
    actionTypes.value = []
  }
}

watch([statusFilter, typeFilter], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  void load()
})

watch(page, () => void load())

function clearFilters(): void {
  statusFilter.value = ''
  typeFilter.value = ''
}

/* --------------------------------------------------------------- review */

const selected = ref<AiAction | null>(null)
const reviewOpen = ref(false)
const detailLoading = ref(false)
const busy = ref(false)
const actionError = ref<string | null>(null)
const confirmed = ref(false)
const decision = ref<'reject' | null>(null)
const rejectReason = ref('')
const rejectError = ref<string | null>(null)

const canOperate = computed(() => {
  const permission = selected.value?.required_permission
  return permission !== null && permission !== undefined && auth.can(permission)
})

const canSubmit = computed(
  () => selected.value?.status === 'draft' && canUse.value && canOperate.value,
)

const canDecide = computed(() => {
  const action = selected.value
  if (!action || !canApprove.value || !canOperate.value) return false
  return action.status === 'pending_approval' || action.status === 'failed'
})

const canExecute = computed(
  () =>
    selected.value?.status === 'approved'
    && selected.value.can_execute
    && canApprove.value
    && canOperate.value,
)

const approvalBlocked = computed(
  () =>
    !!selected.value?.requires_confirmation
    && canDecide.value
    && !confirmed.value,
)

function resetDecision(): void {
  decision.value = null
  rejectReason.value = ''
  rejectError.value = null
  confirmed.value = false
  actionError.value = null
}

async function openReview(action: AiAction): Promise<void> {
  selected.value = action
  reviewOpen.value = true
  resetDecision()

  detailLoading.value = true
  try {
    selected.value = await fetchAiAction(action.id)
  } catch (caught) {
    actionError.value = messageFor(caught)
  } finally {
    detailLoading.value = false
  }
}

function closeReview(): void {
  reviewOpen.value = false
  selected.value = null
  resetDecision()
}

async function refreshAfterFailure(id: number): Promise<void> {
  try {
    selected.value = await fetchAiAction(id)
  } catch {
    // The toast already explains the failure; keep the last known record.
  }
  await load()
}

async function runTransition(
  transition: (id: number) => Promise<AiAction>,
  successKey: MessageKey,
): Promise<void> {
  const action = selected.value
  if (!action) return

  busy.value = true
  actionError.value = null

  try {
    selected.value = await transition(action.id)
    resetDecision()
    toast.success(t(successKey))
    await load()
  } catch (caught) {
    actionError.value = messageFor(caught)
    toast.error(actionError.value)
    await refreshAfterFailure(action.id)
  } finally {
    busy.value = false
  }
}

function submit(): Promise<void> {
  return runTransition(submitAiAction, 'ai.approvals.submitted')
}

function approve(): Promise<void> {
  const id = selected.value?.id
  if (!id) return Promise.resolve()
  return runTransition((actionId) => approveAiAction(actionId, confirmed.value), 'ai.approvals.approved')
}

function execute(): Promise<void> {
  return runTransition(executeAiAction, 'ai.approvals.executed')
}

function beginReject(): void {
  decision.value = 'reject'
  actionError.value = null
}

function cancelReject(): void {
  decision.value = null
  rejectReason.value = ''
  rejectError.value = null
}

async function confirmReject(): Promise<void> {
  const id = selected.value?.id
  if (!id) return

  busy.value = true
  actionError.value = null
  rejectError.value = null

  try {
    selected.value = await rejectAiAction(id, rejectReason.value)
    resetDecision()
    toast.success(t('ai.approvals.rejected'))
    await load()
  } catch (caught) {
    actionError.value = messageFor(caught)
    toast.error(actionError.value)
    await refreshAfterFailure(id)
  } finally {
    busy.value = false
  }
}

/** Render the server-resolved payload as inert text, never as markup. */
function pretty(value: unknown): string {
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

onMounted(() => {
  if (!canUse.value) {
    loading.value = false
    return
  }
  void load()
  void loadTypes()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('ai.approvals.title')" :description="t('ai.approvals.subtitle')" />

    <BaseEmptyState
      v-if="!canUse"
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

      <div class="surface flex flex-wrap items-end gap-3 p-4">
        <BaseSelect
          v-model="statusFilter"
          class="w-52"
          :label="t('ai.approvals.status')"
          :options="statusFilterOptions"
        />

        <BaseSelect
          v-model="typeFilter"
          class="w-56"
          :label="t('ai.approvals.type')"
          :options="typeFilterOptions"
        />

        <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
          {{ t('action.clearAll') }}
        </BaseButton>
      </div>

      <div class="surface overflow-hidden">
        <BaseTable :columns="columns" :loading="loading" :rows="rows">
          <tr v-for="action in rows" :key="action.id">
            <td class="max-w-[24rem] px-4 py-3">
              <span class="block truncate font-medium text-ink">
                {{ action.summary || t('ai.approvals.untitled') }}
              </span>
              <span class="mt-0.5 block text-caption text-subtle">
                {{ action.use_case }}
              </span>
            </td>

            <td class="px-4 py-3 text-muted">
              {{ actionTypeLabel(action.action_type) }}
            </td>

            <td class="px-4 py-3 text-muted">
              {{ classificationLabel(action) }}
            </td>

            <td class="px-4 py-3">
              <BaseBadge :tone="statusMeta(action).tone" dot>
                {{ t(statusMeta(action).key) }}
              </BaseBadge>
            </td>

            <td class="px-4 py-3 text-muted">
              {{ action.proposer?.name ?? '—' }}
            </td>

            <td class="px-4 py-3 text-muted tabular-nums">
              <span :class="action.is_expired ? 'text-danger-ink' : ''">
                {{ formatDateTime(action.expires_at) }}
              </span>
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn-icon"
                  :aria-label="t('ai.approvals.review')"
                  :title="t('ai.approvals.review')"
                  @click="openReview(action)"
                >
                  <Eye class="size-4" />
                </button>
              </div>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              v-if="rows.length === 0 && hasFilters"
              :icon="ShieldCheck"
              :title="t('common.noResults')"
              :description="t('ai.approvals.emptyFiltered')"
            />
            <BaseEmptyState
              v-else-if="rows.length === 0"
              :icon="ShieldCheck"
              :title="t('ai.approvals.emptyTitle')"
              :description="t('ai.approvals.emptyBody')"
            />
          </template>

          <template #footer>
            <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
          </template>
        </BaseTable>
      </div>

      <BaseModal
        :open="reviewOpen"
        size="lg"
        :title="selected?.summary || t('ai.approvals.untitled')"
        :description="selected ? t('ai.approvals.reviewDescription') : undefined"
        @close="closeReview"
      >
        <div v-if="selected" class="space-y-5">
          <BaseAlert v-if="actionError" tone="danger" dismissible @dismiss="actionError = null">
            {{ actionError }}
          </BaseAlert>

          <dl class="grid gap-3 rounded-lg border border-line bg-surface-2 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.type') }}</dt>
              <dd class="mt-0.5 text-ink">{{ actionTypeLabel(selected.action_type) }}</dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.classification') }}</dt>
              <dd class="mt-0.5 text-ink">{{ classificationLabel(selected) }}</dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.status') }}</dt>
              <dd class="mt-0.5">
                <BaseBadge :tone="AI_ACTION_STATUS[selected.status].tone" dot>
                  {{ t(AI_ACTION_STATUS[selected.status].key) }}
                </BaseBadge>
              </dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.requiredPermission') }}</dt>
              <dd class="mt-0.5 font-mono text-caption text-muted">
                {{ selected.required_permission ?? '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.proposedBy') }}</dt>
              <dd class="mt-0.5 text-ink">{{ selected.proposer?.name ?? '—' }}</dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.createdAt') }}</dt>
              <dd class="mt-0.5 text-ink">{{ formatDateTime(selected.created_at) }}</dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.submittedAt') }}</dt>
              <dd class="mt-0.5 text-ink">{{ formatDateTime(selected.submitted_at) }}</dd>
            </div>

            <div>
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.expiresAt') }}</dt>
              <dd class="mt-0.5" :class="selected.is_expired ? 'text-danger-ink' : 'text-ink'">
                {{ formatDateTime(selected.expires_at) }}
              </dd>
            </div>

            <div v-if="selected.approver">
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.approvedBy') }}</dt>
              <dd class="mt-0.5 text-ink">{{ selected.approver.name }}</dd>
            </div>

            <div v-if="selected.executor">
              <dt class="text-caption uppercase tracking-wide text-muted">{{ t('ai.approvals.executedBy') }}</dt>
              <dd class="mt-0.5 text-ink">{{ selected.executor.name }}</dd>
            </div>
          </dl>

          <section class="space-y-2">
            <h3 class="text-sm font-semibold text-ink">{{ t('ai.approvals.payload') }}</h3>
            <pre class="max-h-64 overflow-auto rounded-lg border border-line bg-inset p-3 font-mono text-caption text-ink">{{ pretty(selected.resolved_payload) }}</pre>
          </section>

          <BaseAlert v-if="selected.rejection_reason" tone="warning">
            <span class="font-medium">{{ t('ai.approvals.rejectionReason') }}:</span>
            {{ selected.rejection_reason }}
          </BaseAlert>

          <BaseAlert v-if="selected.error" tone="danger">
            <span class="font-medium">{{ t('ai.approvals.error') }}:</span>
            {{ selected.error }}
          </BaseAlert>

          <section v-if="selected.result" class="space-y-2">
            <h3 class="text-sm font-semibold text-ink">{{ t('ai.approvals.result') }}</h3>
            <pre class="max-h-48 overflow-auto rounded-lg border border-line bg-inset p-3 font-mono text-caption text-ink">{{ pretty(selected.result) }}</pre>
          </section>

          <BaseCheckbox
            v-if="canDecide && selected.requires_confirmation"
            v-model="confirmed"
            :label="t('ai.approvals.confirmLabel')"
            :hint="t('ai.approvals.confirmHint')"
          />

          <BaseTextarea
            v-if="decision === 'reject'"
            v-model="rejectReason"
            :label="t('ai.approvals.rejectReason')"
            :placeholder="t('ai.approvals.rejectReasonPlaceholder')"
            :error="rejectError"
            :rows="3"
            :maxlength="1000"
          />

          <p v-if="detailLoading" class="text-small text-muted">
            {{ t('ai.approvals.loading') }}
          </p>
        </div>

        <template #footer>
          <template v-if="decision === 'reject'">
            <BaseButton variant="secondary" :disabled="busy" @click="cancelReject">
              {{ t('action.cancel') }}
            </BaseButton>
            <BaseButton variant="danger" :icon="X" :loading="busy" :disabled="rejectReason.length > 1000" @click="confirmReject">
              {{ t('ai.approvals.confirmReject') }}
            </BaseButton>
          </template>

          <template v-else>
            <BaseButton variant="secondary" @click="closeReview">
              {{ t('action.close') }}
            </BaseButton>

            <BaseButton
              v-if="canSubmit"
              :icon="Check"
              :loading="busy"
              @click="submit"
            >
              {{ t('ai.approvals.submit') }}
            </BaseButton>

            <template v-else-if="canDecide">
              <BaseButton variant="secondary" :icon="X" :disabled="busy" @click="beginReject">
                {{ t('ai.approvals.reject') }}
              </BaseButton>
              <BaseButton
                :icon="Check"
                :loading="busy"
                :disabled="approvalBlocked"
                @click="approve"
              >
                {{ t('ai.approvals.approve') }}
              </BaseButton>
            </template>

            <BaseButton
              v-else-if="canExecute"
              :icon="Play"
              :loading="busy"
              @click="execute"
            >
              {{ t('ai.approvals.execute') }}
            </BaseButton>
          </template>
        </template>
      </BaseModal>
    </template>
  </div>
</template>
