<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Bot,
  CircleDollarSign,
  Clock,
  ListFilter,
  RefreshCw,
  Send,
  TrendingDown,
  Wallet,
} from '@/components/icons'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { PERMISSIONS } from '@/constants/permissions'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import {
  assignRecoveryOpportunity,
  contactRecoveryOpportunity,
  dismissRecoveryOpportunity,
  draftRecoveryReply,
  fetchRecoveryOpportunities,
  fetchRecoveryOpportunity,
  fetchRecoverySummary,
  optOutRecoveryCustomer,
  snoozeRecoveryOpportunity,
} from '@/services/recoveryService'
import { fetchAssignees } from '@/services/conversationService'
import { useAuthStore } from '@/stores/authStore'
import type { MessageKey } from '@/i18n'
import type { User } from '@/types/admin'
import type { Paginated } from '@/types/api'
import type { RecoveryOpportunityStatus, RecoveryReason } from '@/types/enums'
import type {
  RecoveryCurrencyTotal,
  RecoveryDraft,
  RecoveryOpportunity,
  RecoverySummary,
} from '@/types/recovery'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'
import { activeCurrency } from '@/utils/currency'

/**
 * Lost-sale recovery workspace.
 *
 * Every row is a customer Dukavo can point to a concrete unfinished cart or
 * unanswered question. The page never sends anything by itself: an agent opens
 * an opportunity, reviews the context, optionally asks for a draft, edits it,
 * and only then chooses to contact the customer.
 */

const { t, tDynamic } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const PER_PAGE = 20

const query = ref('')
const status = ref('')
const reason = ref('')
const page = ref(1)
const debouncedQuery = useDebounce(query, 300)

const rows = ref<RecoveryOpportunity[]>([])
const meta = ref<Paginated<RecoveryOpportunity>['meta'] | null>(null)
const summary = ref<RecoverySummary | null>(null)
const loading = ref(true)
const summaryLoading = ref(true)
const listError = ref<string | null>(null)
const summaryError = ref<string | null>(null)

const detailOpen = ref(false)
const selected = ref<RecoveryOpportunity | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const busy = ref<string | null>(null)
const assignees = ref<User[]>([])
const assigneeId = ref('')

const contactMode = ref<'text' | 'template'>('text')
const contactBody = ref('')
const templateName = ref('')
const languageCode = ref('en')
const templateParameters = ref('')
const contactError = ref<string | null>(null)

const aiInstruction = ref('')
const aiDraft = ref<RecoveryDraft | null>(null)
const aiError = ref<string | null>(null)

const snoozeDays = ref('3')
const dismissalReason = ref('')
const optOutArmed = ref(false)

const canView = computed(() => auth.can(PERMISSIONS.recovery.view))
const canManage = computed(() => auth.can(PERMISSIONS.recovery.manage))
const canUseAi = computed(() => auth.can(PERMISSIONS.ai.use))

const hasFilters = computed(
  () => query.value !== '' || status.value !== '' || reason.value !== '',
)

const isEmpty = computed(() => rows.value.length === 0)

const statusOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'open', label: t('recovery.statusOpen') },
  { value: 'eligible', label: t('recovery.status.eligible') },
  { value: 'contacted', label: t('recovery.status.contacted') },
  { value: 'snoozed', label: t('recovery.status.snoozed') },
  { value: 'recovered', label: t('recovery.status.recovered') },
  { value: 'dismissed', label: t('recovery.status.dismissed') },
  { value: 'expired', label: t('recovery.status.expired') },
])

const reasonOptions = computed(() => [
  { value: '', label: t('recovery.anyReason') },
  { value: 'abandoned_cart', label: t('recovery.reason.abandoned_cart') },
  { value: 'unconfirmed_quote', label: t('recovery.reason.unconfirmed_quote') },
  { value: 'unanswered_inquiry', label: t('recovery.reason.unanswered_inquiry') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'customer', label: t('common.customer') },
  { key: 'reason', label: t('recovery.reasonLabel') },
  { key: 'value', label: t('recovery.estimatedValue'), align: 'end' },
  { key: 'status', label: t('common.status'), width: '10rem' },
  { key: 'detected', label: t('recovery.detected'), width: '11rem' },
  { key: 'assignee', label: t('recovery.assignee'), width: '10rem' },
  { key: 'actions', label: t('common.actions'), align: 'end', width: '5rem' },
])

const assigneeOptions = computed(() => [
  { value: '', label: t('recovery.unassigned') },
  ...assignees.value.map((user) => ({ value: String(user.id), label: user.name })),
])

const contactModeOptions = computed(() => {
  const options = [{ value: 'template', label: t('recovery.contact.template') }]
  if (selected.value?.can_text) {
    options.unshift({ value: 'text', label: t('recovery.contact.text') })
  }
  return options
})

const isOpen = computed(() =>
  selected.value !== null
    ? ['eligible', 'contacted', 'snoozed'].includes(selected.value.status)
    : false,
)

const canContact = computed(
  () => canManage.value && isOpen.value && selected.value?.can_contact === true,
)

let requestId = 0

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.isNetworkError ? t('auth.networkError') : caught.message
  }
  return t('error.title')
}

function moneyTotal(totals: RecoveryCurrencyTotal[] | undefined): string {
  if (!totals || totals.length === 0) {
    return t('recovery.noValue')
  }
  return totals.map((entry) => formatCurrency(entry.total, entry.currency)).join(' · ')
}

function recoveryTone(value: string): BadgeTone {
  switch (value) {
    case 'eligible':
      return 'info'
    case 'contacted':
      return 'warning'
    case 'snoozed':
      return 'warning'
    case 'recovered':
      return 'success'
    case 'expired':
      return 'danger'
    default:
      return 'neutral'
  }
}

async function loadSummary(): Promise<void> {
  summaryLoading.value = true
  summaryError.value = null
  try {
    summary.value = await fetchRecoverySummary()
  } catch (caught) {
    summaryError.value = errorMessage(caught)
  } finally {
    summaryLoading.value = false
  }
}

async function loadRows(): Promise<void> {
  const id = ++requestId
  loading.value = true
  listError.value = null
  try {
    const result = await fetchRecoveryOpportunities({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value ? (status.value as RecoveryOpportunityStatus | 'open') : undefined,
      reason: reason.value ? (reason.value as RecoveryReason) : undefined,
    })
    if (id !== requestId) return
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    if (id !== requestId) return
    listError.value = errorMessage(caught)
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadSummary(), loadRows()])
}

async function loadDetail(id: number, resetForm = false): Promise<void> {
  detailLoading.value = true
  detailError.value = null
  try {
    const opportunity = await fetchRecoveryOpportunity(id)
    selected.value = opportunity
    assigneeId.value = opportunity.assigned_to ? String(opportunity.assigned_to) : ''

    if (!opportunity.can_text && contactMode.value === 'text') {
      contactMode.value = 'template'
    }

    if (resetForm) {
      contactMode.value = opportunity.can_text ? 'text' : 'template'
      contactBody.value = ''
      templateName.value = ''
      languageCode.value = opportunity.customer?.locale || 'en'
      templateParameters.value = ''
      aiInstruction.value = ''
      aiDraft.value = null
      aiError.value = null
      contactError.value = null
      dismissalReason.value = ''
      optOutArmed.value = false
    }
  } catch (caught) {
    detailError.value = errorMessage(caught)
  } finally {
    detailLoading.value = false
  }
}

async function openDetail(opportunity: RecoveryOpportunity): Promise<void> {
  selected.value = opportunity
  detailOpen.value = true
  await loadDetail(opportunity.id, true)
}

function closeDetail(): void {
  detailOpen.value = false
  selected.value = null
  optOutArmed.value = false
  busy.value = null
}

async function run(
  key: string,
  request: () => Promise<RecoveryOpportunity>,
  successKey: MessageKey,
): Promise<RecoveryOpportunity | null> {
  if (busy.value) return null
  busy.value = key
  try {
    const updated = await request()
    toast.success(t(successKey))
    await Promise.all([
      loadSummary(),
      loadRows(),
      selected.value ? loadDetail(updated.id) : Promise.resolve(),
    ])
    return updated
  } catch (caught) {
    toast.error(errorMessage(caught))
    return null
  } finally {
    busy.value = null
  }
}

function setStatusFilter(): void {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  void loadRows()
}

function clearFilters(): void {
  query.value = ''
  status.value = ''
  reason.value = ''
  page.value = 1
  void loadRows()
}

watch(debouncedQuery, () => {
  page.value = 1
  void loadRows()
})

watch([status, reason], setStatusFilter)
watch(page, () => void loadRows())

async function requestDraft(): Promise<void> {
  if (!selected.value || busy.value) return
  busy.value = 'draft'
  aiError.value = null
  try {
    const draft = await draftRecoveryReply(selected.value.id, aiInstruction.value)
    aiDraft.value = draft
    if (selected.value.can_text) {
      contactBody.value = draft.suggested_reply
      contactMode.value = 'text'
    }
    toast.success(t('recovery.toast.draftReady'))
  } catch (caught) {
    aiError.value = errorMessage(caught)
  } finally {
    busy.value = null
  }
}

function submitContact(): void {
  if (!selected.value || busy.value) return
  contactError.value = null

  if (contactMode.value === 'text') {
    if (!contactBody.value.trim()) {
      contactError.value = t('recovery.contact.bodyRequired')
      return
    }
    void run(
      'contact',
      () => contactRecoveryOpportunity(selected.value!.id, {
        mode: 'text',
        body: contactBody.value.trim(),
      }),
      'recovery.toast.sent',
    ).then((updated) => {
      if (!updated) return
      contactBody.value = ''
      aiDraft.value = null
      templateParameters.value = ''
    })
    return
  }

  if (!templateName.value.trim()) {
    contactError.value = t('recovery.contact.templateRequired')
    return
  }

  const parameters = templateParameters.value
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value !== '')

  void run(
    'contact',
    () => contactRecoveryOpportunity(selected.value!.id, {
      mode: 'template',
      template_name: templateName.value.trim(),
      language_code: languageCode.value.trim() || 'en',
      parameters,
    }),
    'recovery.toast.sent',
  ).then((updated) => {
    if (!updated) return
    templateParameters.value = ''
  })
}

function assign(): void {
  if (!selected.value || busy.value) return
  void run(
    'assign',
    () => assignRecoveryOpportunity(
      selected.value!.id,
      assigneeId.value ? Number(assigneeId.value) : null,
    ),
    'recovery.toast.assigned',
  )
}

function snooze(): void {
  if (!selected.value || busy.value) return
  const days = Number(snoozeDays.value)
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  void run(
    'snooze',
    () => snoozeRecoveryOpportunity(selected.value!.id, until),
    'recovery.toast.snoozed',
  )
}

function dismiss(): void {
  if (!selected.value || busy.value) return
  void run(
    'dismiss',
    () => dismissRecoveryOpportunity(selected.value!.id, dismissalReason.value),
    'recovery.toast.dismissed',
  )
}

function optOut(): void {
  if (!selected.value || busy.value) return

  if (!optOutArmed.value) {
    optOutArmed.value = true
    return
  }

  void run(
    'optOut',
    () => optOutRecoveryCustomer(selected.value!.id, dismissalReason.value),
    'recovery.toast.optedOut',
  ).then((updated) => {
    if (updated) optOutArmed.value = false
  })
}

function loadAssignees(): void {
  if (!canManage.value) return
  void fetchAssignees()
    .then((users) => {
      assignees.value = users
    })
    .catch(() => {
      assignees.value = []
    })
}

onMounted(() => {
  if (!canView.value) return
  void refreshAll()
  loadAssignees()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('recovery.title')" :description="t('recovery.subtitle')">
      <template #actions>
        <BaseButton
          variant="secondary"
          :icon="RefreshCw"
          :loading="loading || summaryLoading"
          @click="refreshAll"
        >
          {{ t('recovery.refresh') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="summaryError" tone="warning" dismissible @dismiss="summaryError = null">
      {{ summaryError }}
    </BaseAlert>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        :label="t('recovery.stat.open')"
        :value="formatNumber(summary?.counts.open ?? 0)"
        :icon="TrendingDown"
        :loading="summaryLoading"
        :hint="t('recovery.stat.openHint')"
      />
      <StatCard
        :label="t('recovery.stat.valueAtRisk')"
        :value="moneyTotal(summary?.open_value)"
        :icon="Wallet"
        :loading="summaryLoading"
        :hint="t('recovery.stat.valueAtRiskHint')"
      />
      <StatCard
        :label="t('recovery.stat.recovered')"
        :value="formatNumber(summary?.counts.recovered ?? 0)"
        :icon="CircleDollarSign"
        :loading="summaryLoading"
        :hint="t('recovery.stat.recoveredHint')"
      />
      <StatCard
        :label="t('recovery.stat.recoveredRevenue')"
        :value="moneyTotal(summary?.recovered_revenue)"
        :icon="CircleDollarSign"
        :loading="summaryLoading"
        :hint="t('recovery.stat.recoveredRevenueHint')"
      />
    </div>

    <BaseAlert v-if="!canView" tone="warning">
      {{ t('recovery.noPermission') }}
    </BaseAlert>

    <template v-else>
      <BaseAlert v-if="listError" tone="danger" dismissible @dismiss="listError = null">
        {{ listError }}
      </BaseAlert>

      <div class="surface flex flex-wrap items-end gap-3 p-4">
        <BaseInput
          v-model="query"
          class="min-w-56 flex-1"
          type="search"
          :label="t('filter.search')"
          :placeholder="t('recovery.searchPlaceholder')"
        />
        <BaseSelect v-model="status" class="w-48" :label="t('common.status')" :options="statusOptions" />
        <BaseSelect v-model="reason" class="w-56" :label="t('recovery.reasonLabel')" :options="reasonOptions" />
        <BaseButton v-if="hasFilters" variant="ghost" @click="clearFilters">
          {{ t('action.clearAll') }}
        </BaseButton>
      </div>

      <div class="surface overflow-hidden">
        <BaseTable :columns="columns" :loading="loading" :rows="rows">
          <tr v-for="opportunity in rows" :key="opportunity.id">
            <td class="px-4 py-3">
              <button
                type="button"
                class="block max-w-64 truncate text-start font-medium text-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                @click="openDetail(opportunity)"
              >
                {{ opportunity.customer?.name || opportunity.conversation?.display_name || t('recovery.unknownCustomer') }}
              </button>
              <span dir="ltr" class="mt-0.5 block max-w-max whitespace-nowrap text-caption text-subtle [unicode-bidi:isolate]">
                {{ opportunity.customer?.phone || opportunity.conversation?.phone || '—' }}
              </span>
            </td>
            <td class="px-4 py-3 text-muted">
              {{ tDynamic('recovery.reason', opportunity.reason) }}
            </td>
            <td class="px-4 py-3 text-end font-medium tabular-nums text-ink">
              <span v-if="opportunity.estimated_value !== null" dir="ltr" class="whitespace-nowrap [unicode-bidi:isolate]">
                {{ formatCurrency(opportunity.estimated_value, opportunity.currency ?? activeCurrency()) }}
              </span>
              <span v-else class="text-subtle">—</span>
            </td>
            <td class="px-4 py-3">
              <BaseBadge :tone="recoveryTone(opportunity.status)" dot>
                {{ tDynamic('recovery.status', opportunity.status) }}
              </BaseBadge>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-muted">
              {{ formatDateTime(opportunity.detected_at) }}
            </td>
            <td class="px-4 py-3 text-muted">
              {{ opportunity.assignee?.name || t('recovery.unassigned') }}
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end">
                <BaseButton size="sm" variant="secondary" @click="openDetail(opportunity)">
                  {{ t('action.view') }}
                </BaseButton>
              </div>
            </td>
          </tr>

          <template #empty>
            <BaseEmptyState
              v-if="isEmpty && hasFilters"
              :title="t('recovery.emptyFilterTitle')"
              :description="t('recovery.emptyFilterBody')"
              :icon="ListFilter"
            >
              <template #action>
                <BaseButton variant="secondary" @click="clearFilters">
                  {{ t('action.clearAll') }}
                </BaseButton>
              </template>
            </BaseEmptyState>

            <BaseEmptyState
              v-else-if="isEmpty"
              :title="t('recovery.emptyTitle')"
              :description="t('recovery.emptyBody')"
              :icon="TrendingDown"
            />
          </template>

          <template #footer>
            <BasePagination v-if="meta" :meta="meta" :disabled="loading" @change="page = $event" />
          </template>
        </BaseTable>
      </div>
    </template>

    <BaseModal
      :open="detailOpen"
      size="xl"
      :title="selected?.customer?.name || selected?.conversation?.display_name || t('recovery.detailTitle')"
      :description="selected ? tDynamic('recovery.reason', selected.reason) : undefined"
      @close="closeDetail"
    >
      <div v-if="detailLoading" class="flex items-center justify-center py-16">
        <BaseSpinner />
      </div>

      <BaseAlert v-else-if="detailError" tone="danger">
        {{ detailError }}
      </BaseAlert>

      <div v-else-if="selected" class="space-y-6">
        <div class="flex flex-wrap items-center gap-2">
          <BaseBadge :tone="recoveryTone(selected.status)" dot>
            {{ tDynamic('recovery.status', selected.status) }}
          </BaseBadge>
          <BaseBadge v-if="selected.customer?.whatsapp_opt_out_at" tone="danger">
            {{ t('recovery.optedOut') }}
          </BaseBadge>
          <BaseBadge v-if="selected.order && selected.order.status !== 'cancelled'" tone="success">
            {{ t('recovery.attributedToOrder', { number: selected.order.order_number }) }}
          </BaseBadge>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-line bg-surface-2 p-3">
            <p class="text-caption font-medium uppercase tracking-wide text-muted">{{ t('recovery.estimatedValue') }}</p>
            <p class="mt-1 font-semibold tabular-nums text-ink">
              <span v-if="selected.estimated_value !== null" dir="ltr" class="whitespace-nowrap [unicode-bidi:isolate]">
                {{ formatCurrency(selected.estimated_value, selected.currency ?? activeCurrency()) }}
              </span>
              <span v-else>—</span>
            </p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 p-3">
            <p class="text-caption font-medium uppercase tracking-wide text-muted">{{ t('recovery.recoveredValue') }}</p>
            <p class="mt-1 font-semibold tabular-nums text-ink">
              <span v-if="selected.recovered_value !== null" dir="ltr" class="whitespace-nowrap [unicode-bidi:isolate]">
                {{ formatCurrency(selected.recovered_value, selected.recovered_currency ?? activeCurrency()) }}
              </span>
              <span v-else>—</span>
            </p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 p-3">
            <p class="text-caption font-medium uppercase tracking-wide text-muted">{{ t('recovery.contactAttempts') }}</p>
            <p class="mt-1 font-semibold tabular-nums text-ink">{{ formatNumber(selected.contact_attempts) }}</p>
          </div>
          <div class="rounded-lg border border-line bg-surface-2 p-3">
            <p class="text-caption font-medium uppercase tracking-wide text-muted">{{ t('recovery.detected') }}</p>
            <p class="mt-1 font-semibold text-ink">{{ formatDateTime(selected.detected_at) }}</p>
          </div>
        </div>

        <section class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-lg border border-line p-4">
            <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.customerTitle') }}</h3>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('recovery.name') }}</dt>
                <dd class="text-end font-medium text-ink">{{ selected.customer?.name || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('recovery.phone') }}</dt>
                <dd dir="ltr" class="text-end font-medium text-ink [unicode-bidi:isolate]">{{ selected.customer?.phone || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('recovery.preferredLanguage') }}</dt>
                <dd class="text-end font-medium text-ink">{{ selected.customer?.locale || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('recovery.replyWindow') }}</dt>
                <dd class="text-end font-medium text-ink">
                  {{ selected.can_text ? t('recovery.replyWindowOpen') : t('recovery.replyWindowClosed') }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="rounded-lg border border-line p-4">
            <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.orderTitle') }}</h3>
            <div v-if="selected.order" class="mt-3 space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <span class="text-muted">{{ t('recovery.orderNumber') }}</span>
                <RouterLink
                  :to="{ name: 'orders.show', params: { orderNumber: selected.order.order_number } }"
                  class="font-medium text-brand-ink hover:underline"
                  @click="closeDetail"
                >
                  {{ selected.order.order_number }}
                </RouterLink>
              </div>
              <div class="flex justify-between gap-3">
                <span class="text-muted">{{ t('common.status') }}</span>
                <span class="font-medium text-ink">{{ selected.order.status_label }}</span>
              </div>
              <div class="flex justify-between gap-3">
                <span class="text-muted">{{ t('common.total') }}</span>
                <span dir="ltr" class="font-medium tabular-nums text-ink [unicode-bidi:isolate]">
                  {{ formatCurrency(selected.order.grand_total, selected.order.currency) }}
                </span>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-muted">{{ t('recovery.noOrder') }}</p>
          </div>
        </section>

        <section v-if="selected.cart" class="rounded-lg border border-line p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.cartTitle') }}</h3>
            <span dir="ltr" class="text-sm font-semibold tabular-nums text-ink [unicode-bidi:isolate]">
              {{ formatCurrency(selected.cart.grand_total, selected.cart.currency) }}
            </span>
          </div>
          <ul v-if="selected.cart.items.length" class="mt-3 divide-y divide-line">
            <li
              v-for="item in selected.cart.items"
              :key="item.id"
              class="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-ink">{{ item.name }}</p>
                <p class="text-caption text-subtle">
                  {{ item.sku || '—' }} · {{ t('recovery.quantity', { count: item.quantity }) }}
                </p>
              </div>
              <span dir="ltr" class="shrink-0 font-medium tabular-nums text-ink [unicode-bidi:isolate]">
                {{ formatCurrency(item.line_total, selected.cart.currency) }}
              </span>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-muted">{{ t('recovery.cartEmpty') }}</p>
        </section>

        <section v-if="canManage && isOpen" class="rounded-lg border border-line p-4">
          <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.actionsTitle') }}</h3>

          <div class="mt-3 flex flex-wrap items-end gap-3">
            <BaseSelect
              v-model="assigneeId"
              class="w-56"
              :label="t('recovery.assignee')"
              :options="assigneeOptions"
              :disabled="busy !== null"
            />
            <BaseButton
              variant="secondary"
              :loading="busy === 'assign'"
              :disabled="busy !== null"
              @click="assign"
            >
              {{ t('recovery.assignAction') }}
            </BaseButton>

            <BaseSelect v-model="snoozeDays" class="w-40" :label="t('recovery.snoozeFor')" :options="[
              { value: '1', label: t('recovery.days', { count: 1 }) },
              { value: '3', label: t('recovery.days', { count: 3 }) },
              { value: '7', label: t('recovery.days', { count: 7 }) },
            ]" :disabled="busy !== null" />
            <BaseButton
              variant="secondary"
              :icon="Clock"
              :loading="busy === 'snooze'"
              :disabled="busy !== null"
              @click="snooze"
            >
              {{ t('recovery.snoozeAction') }}
            </BaseButton>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <BaseInput
              v-model="dismissalReason"
              :label="t('recovery.reasonOptional')"
              :placeholder="t('recovery.reasonPlaceholder')"
              :disabled="busy !== null"
            />
            <BaseButton variant="secondary" :loading="busy === 'dismiss'" :disabled="busy !== null" @click="dismiss">
              {{ t('recovery.dismissAction') }}
            </BaseButton>
            <BaseButton
              variant="danger"
              :loading="busy === 'optOut'"
              :disabled="busy !== null"
              @click="optOut"
            >
              {{ optOutArmed ? t('recovery.optOutConfirm') : t('recovery.optOutAction') }}
            </BaseButton>
          </div>

          <p v-if="optOutArmed" class="mt-2 text-small text-danger-ink">
            {{ t('recovery.optOutWarning') }}
          </p>
        </section>

        <section class="rounded-lg border border-line p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.contactTitle') }}</h3>
            <BaseButton
              v-if="canUseAi && canContact"
              variant="ghost"
              size="sm"
              :icon="Bot"
              :loading="busy === 'draft'"
              :disabled="busy !== null"
              @click="requestDraft"
            >
              {{ t('recovery.draftAction') }}
            </BaseButton>
          </div>

          <BaseAlert v-if="!selected.can_contact" tone="warning" class="mt-3">
            {{ selected.customer?.whatsapp_opt_out_at ? t('recovery.contactOptedOut') : t('recovery.contactUnavailable') }}
          </BaseAlert>

          <template v-if="canContact">
            <BaseInput
              v-model="aiInstruction"
              class="mt-3"
              :label="t('recovery.aiInstruction')"
              :placeholder="t('recovery.aiInstructionPlaceholder')"
              :disabled="busy !== null"
            />

            <BaseAlert v-if="aiError" tone="danger" class="mt-3">{{ aiError }}</BaseAlert>

            <div v-if="aiDraft" class="mt-3 rounded-lg border border-line bg-surface-2 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <BaseBadge :tone="aiDraft.needs_human ? 'warning' : 'info'">
                  {{ aiDraft.needs_human ? t('recovery.aiNeedsHuman') : t('recovery.aiDraftReady') }}
                </BaseBadge>
                <span class="text-caption text-muted">{{ aiDraft.tone }} · {{ aiDraft.language }}</span>
              </div>
              <p v-if="aiDraft.suggested_reply && !selected.can_text" class="mt-2 whitespace-pre-line text-sm text-ink">
                {{ aiDraft.suggested_reply }}
              </p>
              <p v-if="aiDraft.rationale" class="mt-2 text-sm text-muted">{{ aiDraft.rationale }}</p>
              <p v-if="aiDraft.handoff_reason" class="mt-2 text-sm text-warning-ink">{{ aiDraft.handoff_reason }}</p>
              <p v-if="aiDraft.risk_flags.length" class="mt-2 text-caption text-warning-ink">
                {{ t('recovery.aiRisk', { flags: aiDraft.risk_flags.join(', ') }) }}
              </p>
            </div>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <BaseSelect
                v-model="contactMode"
                :label="t('recovery.contactMode')"
                :options="contactModeOptions"
                :disabled="busy !== null"
              />

              <BaseInput
                v-if="contactMode === 'template'"
                v-model="templateName"
                :label="t('recovery.templateName')"
                placeholder="order_follow_up"
                :disabled="busy !== null"
              />
            </div>

            <BaseTextarea
              v-if="contactMode === 'text'"
              v-model="contactBody"
              class="mt-3"
              :label="t('recovery.message')"
              :placeholder="t('recovery.messagePlaceholder')"
              :rows="5"
              :maxlength="4096"
              :error="contactError"
              :disabled="busy !== null"
            />

            <template v-else>
              <BaseInput
                v-model="languageCode"
                class="mt-3"
                :label="t('recovery.languageCode')"
                placeholder="en"
                :disabled="busy !== null"
              />
              <BaseTextarea
                v-model="templateParameters"
                class="mt-3"
                :label="t('recovery.templateParameters')"
                :hint="t('recovery.templateParametersHint')"
                :rows="3"
                :error="contactError"
                :disabled="busy !== null"
              />
            </template>

            <BaseAlert v-if="!selected.can_text" tone="info" class="mt-3">
              {{ t('recovery.templateRequired') }}
            </BaseAlert>

            <div class="mt-4 flex justify-end">
              <BaseButton
                :icon="Send"
                :loading="busy === 'contact'"
                :disabled="busy !== null"
                @click="submitContact"
              >
                {{ t('recovery.sendAction') }}
              </BaseButton>
            </div>
          </template>
        </section>

        <section class="rounded-lg border border-line p-4">
          <h3 class="text-h4 font-semibold text-ink">{{ t('recovery.timelineTitle') }}</h3>
          <ol v-if="selected.events.length" class="mt-4 space-y-4">
            <li v-for="event in selected.events" :key="event.id" class="relative flex gap-3">
              <span class="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">
                  {{ tDynamic('recovery.event', event.type) }}
                  <span v-if="event.user" class="font-normal text-muted">· {{ event.user.name }}</span>
                </p>
                <p v-if="event.note" class="mt-0.5 text-sm text-muted">{{ event.note }}</p>
                <p class="mt-0.5 text-caption text-subtle">{{ formatDateTime(event.created_at) }}</p>
              </div>
            </li>
          </ol>
          <p v-else class="mt-3 text-sm text-muted">{{ t('recovery.timelineEmpty') }}</p>
        </section>
      </div>
    </BaseModal>
  </div>
</template>
