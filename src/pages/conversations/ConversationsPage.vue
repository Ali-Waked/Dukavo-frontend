<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Check, MoreHorizontal, RefreshCw, Send, Sparkles, Users } from '@/components/icons'
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
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  assignConversation,
  fetchConversation,
  fetchConversations,
  fetchMessages,
  fetchSummary,
  sendReply,
  updateConversation,
} from '@/services/conversationService'
import { fetchUsers } from '@/services/userService'
import { draftReply } from '@/services/aiService'
import type { AiReplyDraft } from '@/types/ai'
import type { User } from '@/types/admin'
import type { Paginated } from '@/types/api'
import type { Channel, ConversationStatus } from '@/types/enums'
import type { Conversation, ConversationMessage, ConversationSummary } from '@/types/inbox'
import { formatDateTime, formatNumber, formatRelative } from '@/utils/format'
import { aiErrorMessage } from '@/utils/ai'
import { statusTone } from '@/utils/status'

/**
 * The inbox: one route, two panes.
 *
 * List and thread load independently — a row is worth rendering while the
 * thread still waits on two requests — and below `lg` only one pane exists at
 * a time, so picking a conversation swaps the view and the thread header
 * carries the way back. Mutations answer with a toast and update the row in
 * place; nothing here navigates away from the inbox.
 */

const { t, tDynamic } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const PER_PAGE = 20
const THREAD_PER_PAGE = 50

const STATUS_KEYS = {
  open: 'status.conversation.open',
  pending: 'status.conversation.pending',
  closed: 'status.conversation.closed',
} as const

const CHANNEL_KEYS = {
  whatsapp: 'channel.whatsapp',
  web: 'channel.web',
  manual: 'channel.manual',
  other: 'channel.other',
} as const

/* ------------------------------------------------------------------- list */

const query = ref('')
const status = ref('')
const channel = ref('')
const page = ref(1)

const debouncedQuery = useDebounce(query, 300)

const rows = ref<Conversation[]>([])
const meta = ref<Paginated<Conversation>['meta'] | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const summary = ref<ConversationSummary | null>(null)

/* ----------------------------------------------------------------- thread */

const selectedId = ref<number | null>(null)
const mobileView = ref<'list' | 'thread'>('list')

const conversation = ref<Conversation | null>(null)
const messages = ref<ConversationMessage[]>([])
const threadLoading = ref(false)
const threadError = ref<string | null>(null)

/** Bumped per request so a slow thread never overwrites a newer selection. */
let threadRequest = 0

const threadBody = ref<HTMLElement | null>(null)

const reply = ref('')
const sending = ref(false)
const sendError = ref<string | null>(null)

/* ------------------------------------------------------------------ forms */

const statusOpen = ref(false)
const statusValue = ref('open')
const savingStatus = ref(false)

const assignOpen = ref(false)
const assignValue = ref('')
const assigning = ref(false)
const users = ref<User[]>([])
const usersLoading = ref(false)

/* --------------------------------------------------------------- ai draft */

const draftOpen = ref(false)
const draftInstruction = ref('')
const draftLoading = ref(false)
const draftError = ref<string | null>(null)
const draftResult = ref<AiReplyDraft | null>(null)
const draftText = ref('')

const canReply = computed(() => auth.can('conversations.reply'))
const canAssign = computed(() => auth.can('conversations.assign'))
const canUseAi = computed(() => auth.can('ai.use'))

const hasFilters = computed(
  () => query.value !== '' || status.value !== '' || channel.value !== '',
)

const isClosed = computed(() => conversation.value?.status === 'closed')

const statusFilterOptions = computed(() => [
  { value: '', label: t('filter.anyStatus') },
  { value: 'open', label: t('status.conversation.open') },
  { value: 'pending', label: t('status.conversation.pending') },
  { value: 'closed', label: t('status.conversation.closed') },
])

const channelFilterOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'whatsapp', label: t('channel.whatsapp') },
  { value: 'web', label: t('channel.web') },
  { value: 'manual', label: t('channel.manual') },
  { value: 'other', label: t('channel.other') },
])

const statusFormOptions = computed(() => [
  { value: 'open', label: t('status.conversation.open') },
  { value: 'pending', label: t('status.conversation.pending') },
  { value: 'closed', label: t('status.conversation.closed') },
])

const assignOptions = computed(() => [
  { value: '', label: t('conversations.unassigned') },
  ...users.value.map((user) => ({ value: String(user.id), label: user.name })),
])

const summaryItems = computed(() => {
  const data = summary.value
  if (!data) return []
  return [
    { key: 'open', label: t('status.conversation.open'), value: formatNumber(data.open) },
    { key: 'pending', label: t('status.conversation.pending'), value: formatNumber(data.pending) },
    { key: 'unassigned', label: t('conversations.unassigned'), value: formatNumber(data.unassigned) },
  ]
})

const threadTitle = computed(() => (conversation.value ? rowTitle(conversation.value) : ''))

const threadSubtitle = computed(() => {
  const current = conversation.value
  if (!current) return ''
  const assignee = current.assignee
    ? `${t('conversations.assignedTo')}: ${current.assignee.name}`
    : t('conversations.notAssigned')
  return `${channelLabel(current.channel)} · ${assignee}`
})

function statusLabel(value: ConversationStatus): string {
  return t(STATUS_KEYS[value])
}

function channelLabel(value: Channel): string {
  return t(CHANNEL_KEYS[value])
}

function rowTitle(target: Conversation): string {
  return target.subject?.trim() || target.customer?.name || channelLabel(target.channel)
}

function rowSnippet(target: Conversation): string {
  const last = target.last_message
  const body = last?.body?.trim()
  if (body) return body
  return last ? '—' : t('conversations.noMessages')
}

function messageTime(message: ConversationMessage): string {
  return formatRelative(message.created_at ?? message.sent_at)
}

function bubbleClasses(message: ConversationMessage): string[] {
  if (message.type === 'system') return ['self-center', 'text-center', 'bg-surface-2', 'text-muted']
  if (message.direction === 'outbound') return ['self-end', 'bg-brand-soft', 'text-brand-ink']
  return ['self-start', 'bg-surface-2', 'text-ink']
}

/* ------------------------------------------------------------------ data */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchConversations({
      page: page.value,
      per_page: PER_PAGE,
      search: debouncedQuery.value || undefined,
      status: status.value as ConversationStatus | '',
      channel: channel.value as Channel | '',
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

/** Counts are decoration: a failing summary never blocks the inbox. */
async function loadSummary(): Promise<void> {
  try {
    summary.value = await fetchSummary()
  } catch {
    summary.value = null
  }
}

async function openThread(id: number): Promise<void> {
  const request = ++threadRequest
  threadLoading.value = true
  threadError.value = null
  conversation.value = null
  messages.value = []
  reply.value = ''
  sendError.value = null

  try {
    const [detail, thread] = await Promise.all([
      fetchConversation(id),
      fetchMessages(id, { per_page: THREAD_PER_PAGE }),
    ])
    if (request !== threadRequest) return
    conversation.value = detail
    messages.value = thread.data
    void scrollToLatest()
  } catch (caught) {
    if (request !== threadRequest) return
    threadError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError && caught.message
          ? caught.message
          : t('state.loadFailed')
  } finally {
    if (request === threadRequest) threadLoading.value = false
  }
}

/** Threads read oldest → newest, so the pane opens pinned to the latest. */
async function scrollToLatest(): Promise<void> {
  await nextTick()
  const element = threadBody.value
  if (element) element.scrollTop = element.scrollHeight
}

async function loadUsers(): Promise<void> {
  if (usersLoading.value || users.value.length > 0) return

  usersLoading.value = true
  try {
    const result = await fetchUsers({ per_page: 100 })
    users.value = result.data
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('state.loadFailed'),
    )
  } finally {
    usersLoading.value = false
  }
}

/* --------------------------------------------------------------- reactions */

function selectConversation(target: Conversation): void {
  selectedId.value = target.id
  mobileView.value = 'thread'
  void openThread(target.id)
}

function backToList(): void {
  mobileView.value = 'list'
}

function retryThread(): void {
  const id = selectedId.value
  if (id !== null) void openThread(id)
}

function clearFilters(): void {
  query.value = ''
  status.value = ''
  channel.value = ''
  page.value = 1
  void load()
}

function openStatusModal(): void {
  if (!conversation.value) return
  statusValue.value = conversation.value.status
  statusOpen.value = true
}

function openAssignModal(): void {
  const current = conversation.value
  if (!current) return
  assignValue.value = current.assignee ? String(current.assignee.id) : ''
  assignOpen.value = true
  void loadUsers()
}

async function saveStatus(): Promise<void> {
  const target = conversation.value
  if (!target) return

  savingStatus.value = true
  try {
    const updated = await updateConversation(target.id, {
      status: statusValue.value as ConversationStatus,
    })
    conversation.value = { ...target, ...updated }
    const row = rows.value.find((item) => item.id === target.id)
    if (row) row.status = updated.status
    toast.success(t('conversations.statusUpdated'))
    statusOpen.value = false
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    savingStatus.value = false
  }
}

async function saveAssign(): Promise<void> {
  const target = conversation.value
  if (!target) return

  assigning.value = true
  try {
    const updated = await assignConversation(
      target.id,
      assignValue.value ? Number(assignValue.value) : null,
    )
    conversation.value = { ...target, ...updated }
    toast.success(t('conversations.assigned'))
    assignOpen.value = false
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    assigning.value = false
  }
}

async function submitReply(): Promise<void> {
  const target = conversation.value
  const body = reply.value.trim()
  if (!target || !body || sending.value || !canReply.value || target.status === 'closed') return

  sending.value = true
  sendError.value = null
  try {
    const message = await sendReply(target.id, body)
    messages.value = [...messages.value, message]
    reply.value = ''

    const row = rows.value.find((item) => item.id === target.id)
    if (row) {
      const sentAt = new Date().toISOString()
      row.last_message = { body, direction: 'outbound', sent_at: sentAt }
      row.last_message_at = sentAt
    }

    toast.success(t('conversations.replySent'))
    void scrollToLatest()
  } catch (caught) {
    // The server's sentence explains the refusal far better than a generic one.
    const failure =
      caught instanceof ApiError && caught.message ? caught.message : t('conversations.messageFailed')
    sendError.value = failure
    toast.error(failure)
  } finally {
    sending.value = false
  }
}

/** Ctrl/Cmd+Enter sends; a bare Enter is left to the textarea's newline. */
function onComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.isComposing) return
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    void submitReply()
  }
}

/* ------------------------------------------------------------- ai drafting */

function openDraftModal(): void {
  draftInstruction.value = ''
  draftError.value = null
  draftResult.value = null
  draftText.value = ''
  draftOpen.value = true
}

/** Ask for a suggestion. It is only ever placed in the composer, never sent. */
async function generateDraft(): Promise<void> {
  const target = conversation.value
  if (!target || draftLoading.value) return

  draftLoading.value = true
  draftError.value = null
  try {
    const result = await draftReply(target.id, draftInstruction.value)
    draftResult.value = result
    draftText.value = result.draft
  } catch (caught) {
    draftError.value = aiErrorMessage(caught, t)
  } finally {
    draftLoading.value = false
  }
}

function applySuggestion(value: string): void {
  const current = draftText.value.trim()
  draftText.value = current === '' ? value : `${current}\n${value}`
}

/** Carry the reviewed draft into the composer; the agent still presses send. */
function useDraft(): void {
  reply.value = draftText.value.trim()
  draftOpen.value = false
}

watch(debouncedQuery, () => {
  page.value = 1
  void load()
})

watch([status, channel], () => {
  page.value = 1
  void load()
})

watch(page, () => void load())

onMounted(() => {
  void load()
  void loadSummary()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('conversations.title')" :description="t('conversations.subtitle')" />

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- ------------------------------------------------------------ list -->
      <aside
        class="surface flex-col overflow-hidden lg:col-span-1 lg:h-[calc(100dvh_-_13rem)]"
        :class="mobileView === 'list' ? 'flex' : 'hidden lg:flex'"
        :aria-label="t('conversations.title')"
      >
        <dl
          v-if="summaryItems.length > 0"
          class="flex shrink-0 flex-wrap gap-x-6 gap-y-2 border-b border-line px-4 py-3"
        >
          <div v-for="item in summaryItems" :key="item.key">
            <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ item.label }}
            </dt>
            <dd class="mt-0.5 text-h4 font-semibold tabular-nums text-ink">{{ item.value }}</dd>
          </div>
        </dl>

        <!-- Filters -->
        <div class="shrink-0 space-y-3 border-b border-line p-4">
          <div class="flex flex-wrap gap-3">
            <BaseSelect
              v-model="status"
              class="min-w-36 flex-1"
              :label="t('conversations.filterStatus')"
              :options="statusFilterOptions"
            />
            <BaseSelect
              v-model="channel"
              class="min-w-36 flex-1"
              :label="t('conversations.filterChannel')"
              :options="channelFilterOptions"
            />
          </div>

          <BaseInput
            v-model="query"
            type="search"
            :label="t('filter.search')"
            :placeholder="t('filter.searchPlaceholder')"
          />

          <BaseButton v-if="hasFilters" size="sm" variant="ghost" @click="clearFilters">
            {{ t('action.clearAll') }}
          </BaseButton>
        </div>

        <!-- Rows -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="loading" class="space-y-4 p-4" aria-hidden="true">
            <div v-for="index in 5" :key="index" class="space-y-2">
              <BaseSkeleton height="h-4" block />
              <BaseSkeleton class="w-2/3" height="h-3" block />
            </div>
          </div>

          <div v-else-if="rows.length === 0" class="p-4">
            <BaseEmptyState
              v-if="hasFilters"
              compact
              :title="t('conversations.emptyThreadSearch')"
              :description="t('common.noResults')"
            >
              <template #action>
                <BaseButton size="sm" variant="secondary" @click="clearFilters">
                  {{ t('action.clearAll') }}
                </BaseButton>
              </template>
            </BaseEmptyState>

            <BaseEmptyState
              v-else
              compact
              :title="t('conversations.emptyTitle')"
              :description="t('conversations.emptyBody')"
            />
          </div>

          <template v-else>
            <button
              v-for="target in rows"
              :key="target.id"
              type="button"
              class="w-full border-s-2 px-4 py-3 text-start transition"
              :class="
                target.id === selectedId
                  ? 'border-brand bg-brand-soft'
                  : 'border-transparent hover:bg-surface-2'
              "
              @click="selectConversation(target)"
            >
              <span class="flex items-start justify-between gap-3">
                <span
                  class="min-w-0 truncate text-sm font-medium"
                  :class="target.id === selectedId ? 'text-brand-ink' : 'text-ink'"
                >
                  {{ rowTitle(target) }}
                </span>
                <span class="shrink-0 text-caption text-subtle">
                  {{ formatRelative(target.last_message_at ?? target.created_at) }}
                </span>
              </span>

              <span
                class="mt-0.5 block truncate text-sm"
                :class="target.id === selectedId ? 'text-brand-ink' : 'text-muted'"
              >
                {{ rowSnippet(target) }}
              </span>

              <span class="mt-2 flex flex-wrap items-center gap-1.5">
                <BaseBadge size="sm">{{ channelLabel(target.channel) }}</BaseBadge>
                <BaseBadge size="sm" dot :tone="statusTone(target.status)">
                  {{ statusLabel(target.status) }}
                </BaseBadge>
              </span>
            </button>
          </template>
        </div>

        <div v-if="meta && !loading && rows.length > 0" class="shrink-0">
          <BasePagination :meta="meta" :disabled="loading" @change="page = $event" />
        </div>
      </aside>

      <!-- ---------------------------------------------------------- thread -->
      <section
        class="surface flex-col overflow-hidden lg:col-span-2 lg:h-[calc(100dvh_-_13rem)]"
        :class="mobileView === 'thread' ? 'flex' : 'hidden lg:flex'"
      >
        <div v-if="threadLoading" class="flex-1 space-y-4 p-5" aria-hidden="true">
          <BaseSkeleton class="w-1/3" height="h-5" block />
          <div class="ms-auto w-2/3 space-y-2">
            <BaseSkeleton height="h-4" block />
            <BaseSkeleton class="w-1/2" height="h-3" block />
          </div>
          <div class="w-2/3 space-y-2">
            <BaseSkeleton height="h-4" block />
            <BaseSkeleton class="w-1/2" height="h-3" block />
          </div>
        </div>

        <div v-else-if="threadError" class="flex flex-1 items-center justify-center p-6">
          <BaseAlert tone="danger" :title="t('error.title')">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span>{{ threadError }}</span>
              <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="retryThread">
                {{ t('action.retry') }}
              </BaseButton>
            </div>
          </BaseAlert>
        </div>

        <template v-else-if="conversation">
          <!-- Header -->
          <header class="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
            <button
              type="button"
              class="btn-icon -ms-1 shrink-0 lg:hidden"
              :aria-label="t('action.back')"
              @click="backToList"
            >
              <ArrowLeft class="size-5 rtl:-scale-x-100" />
            </button>

            <div class="min-w-0 flex-1">
              <h2 class="truncate text-h4 font-semibold text-ink">{{ threadTitle }}</h2>
              <p class="mt-0.5 truncate text-small text-muted">{{ threadSubtitle }}</p>
            </div>

            <BaseBadge :tone="statusTone(conversation.status)" dot>
              {{ statusLabel(conversation.status) }}
            </BaseBadge>

            <BaseDropdown align="end">
              <template #trigger>
                <span
                  class="btn-icon"
                  role="button"
                  :aria-label="t('action.moreActions')"
                  :title="t('action.moreActions')"
                >
                  <MoreHorizontal class="size-5" />
                </span>
              </template>

              <template #default="{ close }">
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  @click="close(); openStatusModal()"
                >
                  <Check class="size-4 text-muted" />
                  {{ t('conversations.changeStatus') }}
                </button>

                <button
                  v-if="canAssign"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  @click="close(); openAssignModal()"
                >
                  <Users class="size-4 text-muted" />
                  {{ t('action.assign') }}
                </button>
              </template>
            </BaseDropdown>
          </header>

          <!-- Messages -->
          <div
            ref="threadBody"
            class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
            :aria-label="t('conversations.messages')"
            role="log"
          >
            <div
              v-if="messages.length === 0"
              class="flex h-full items-center justify-center"
            >
              <BaseEmptyState
                compact
                :title="t('conversations.noMessages')"
                :description="t('conversations.noMessagesBody')"
              />
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="message in messages"
                :key="message.id"
                class="max-w-[85%] rounded-2xl px-4 py-2.5"
                :class="bubbleClasses(message)"
              >
                <p v-if="message.author" class="text-caption font-semibold opacity-80">
                  {{ message.author.name }}
                </p>
                <p class="whitespace-pre-wrap break-words text-sm">{{ message.body || '—' }}</p>
                <p
                  class="mt-1 text-caption opacity-70"
                  :title="formatDateTime(message.created_at ?? message.sent_at)"
                >
                  {{ messageTime(message) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Composer -->
          <div v-if="canReply" class="shrink-0 border-t border-line bg-surface-2 p-4">
            <BaseAlert
              v-if="sendError"
              class="mb-3"
              tone="danger"
              dismissible
              @dismiss="sendError = null"
            >
              {{ sendError }}
            </BaseAlert>

            <div v-if="canUseAi" class="mb-2 flex flex-wrap items-center gap-2">
              <BaseButton
                size="sm"
                variant="secondary"
                :icon="Sparkles"
                :disabled="isClosed || sending"
                @click="openDraftModal"
              >
                {{ t('ai.reply.button') }}
              </BaseButton>
              <span class="text-caption text-subtle">{{ t('ai.reply.disclaimer') }}</span>
            </div>

            <form class="flex items-end gap-2" @submit.prevent="submitReply">
              <BaseTextarea
                v-model="reply"
                class="flex-1"
                :rows="2"
                :placeholder="t('conversations.replyPlaceholder')"
                :disabled="isClosed || sending"
                :hint="isClosed ? t('conversations.closedNotice') : undefined"
                @keydown="onComposerKeydown"
              />

              <BaseButton
                type="submit"
                :icon="Send"
                :loading="sending"
                :disabled="reply.trim() === '' || isClosed"
              >
                {{ t('conversations.sendReply') }}
              </BaseButton>
            </form>
          </div>
        </template>

        <div v-else class="flex flex-1 items-center justify-center p-6">
          <BaseEmptyState
            :title="t('conversations.emptyThreadTitle')"
            :description="t('conversations.emptyThreadBody')"
          />
        </div>
      </section>
    </div>

    <!-- Change status -->
    <BaseModal
      :open="statusOpen"
      :title="t('conversations.changeStatus')"
      size="sm"
      @close="statusOpen = false"
    >
      <BaseSelect
        v-model="statusValue"
        :label="t('common.status')"
        :options="statusFormOptions"
      />

      <template #footer>
        <BaseButton variant="secondary" :disabled="savingStatus" @click="statusOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="savingStatus" @click="saveStatus">
          {{ t('action.save') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Assign -->
    <BaseModal
      :open="assignOpen"
      :title="t('conversations.assignTitle')"
      size="sm"
      @close="assignOpen = false"
    >
      <BaseSelect
        v-model="assignValue"
        :label="t('conversations.assignedTo')"
        :options="assignOptions"
        :disabled="usersLoading"
        :hint="usersLoading ? t('state.loading') : undefined"
      />

      <template #footer>
        <BaseButton variant="secondary" :disabled="assigning" @click="assignOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="assigning" @click="saveAssign">
          {{ t('action.save') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- AI reply draft -->
    <BaseModal
      :open="draftOpen"
      :title="t('ai.reply.title')"
      :description="t('ai.reply.description')"
      @close="draftOpen = false"
    >
      <div class="space-y-4">
        <BaseInput
          v-model="draftInstruction"
          :label="t('ai.reply.instructionLabel')"
          :placeholder="t('ai.reply.instructionPlaceholder')"
        />

        <BaseButton
          size="sm"
          :icon="Sparkles"
          :loading="draftLoading"
          :disabled="draftLoading"
          @click="generateDraft"
        >
          {{ draftResult ? t('ai.reply.regenerate') : t('ai.reply.generate') }}
        </BaseButton>

        <BaseAlert v-if="draftError" tone="danger" dismissible @dismiss="draftError = null">
          {{ draftError }}
        </BaseAlert>

        <div v-if="draftLoading" class="space-y-3" aria-hidden="true">
          <BaseSkeleton height="h-4" block />
          <BaseSkeleton class="w-5/6" height="h-4" block />
          <BaseSkeleton class="w-2/3" height="h-4" block />
          <p class="text-small text-muted">{{ t('ai.reply.loading') }}</p>
        </div>

        <div v-else-if="draftResult" class="space-y-4">
          <div v-if="draftResult.tone" class="flex items-center gap-2">
            <span class="text-caption font-medium text-subtle">{{ t('ai.reply.tone') }}</span>
            <BaseBadge size="sm" tone="brand">{{ tDynamic('ai.tone', draftResult.tone) }}</BaseBadge>
          </div>

          <BaseTextarea v-model="draftText" :label="t('ai.reply.draftLabel')" :rows="6" />

          <div v-if="draftResult.suggestions.length > 0">
            <p class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('ai.reply.suggestions') }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="(suggestion, index) in draftResult.suggestions"
                :key="index"
                type="button"
                class="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-caption text-ink transition hover:bg-surface-3"
                @click="applySuggestion(suggestion)"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <p class="text-caption text-subtle">{{ t('ai.reply.disclaimer') }}</p>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="draftLoading" @click="draftOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton
          :disabled="draftText.trim() === '' || draftLoading"
          @click="useDraft"
        >
          {{ t('ai.reply.use') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
