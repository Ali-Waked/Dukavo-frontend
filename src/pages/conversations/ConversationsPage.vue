<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Users,
} from '@/components/icons'
import ConversationDetails from '@/components/conversations/ConversationDetails.vue'
import OrderBuilderModal from '@/components/conversations/OrderBuilderModal.vue'
import SalesCopilotPanel from '@/components/conversations/SalesCopilotPanel.vue'
import VoiceOrderPanel from '@/components/conversations/VoiceOrderPanel.vue'
import MediaAttachment from '@/components/conversations/MediaAttachment.vue'
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
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAuth } from '@/composables/useAuth'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { draftReply } from '@/services/aiService'
import {
  assignConversation,
  fetchAssignees,
  fetchConversation,
  fetchConversations,
  fetchMessages,
  fetchSummary,
  markConversationRead,
  newIdempotencyKey,
  retryMessage as retryMessageRequest,
  sendNote,
  sendReply,
  sendTemplate,
  updateConversation,
} from '@/services/conversationService'
import type { User } from '@/types/admin'
import type { AiReplyDraft } from '@/types/ai'
import type { Paginated } from '@/types/api'
import type { Channel, ConversationStatus, MessageType } from '@/types/enums'
import type {
  Conversation,
  ConversationMessage,
  ConversationSummary,
  DeliveryStatus,
} from '@/types/inbox'
import type { VoiceMessage } from '@/types/voice'
import { aiErrorMessage } from '@/utils/ai'
import { formatDate, formatDateTime, formatNumber, formatRelative, formatTime } from '@/utils/format'
import { statusTone } from '@/utils/status'
import { BADGE_DOT_CLASSES } from '@/components/ui/badgeTones'

/**
 * The inbox: queue, thread and customer context.
 *
 * The list and the thread load independently, so a row is readable while the
 * conversation is still arriving. Below `xl` the context pane becomes a modal
 * rather than shrinking the thread; below `lg` the queue and thread swap as
 * full views. Reads are marked read after the thread opens, never before, so
 * an interrupted load does not silently clear the unread badge.
 */

const PER_PAGE = 25
const THREAD_PER_PAGE = 50

const { t, tDynamic } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

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

const TYPE_KEYS: Partial<Record<MessageType, string>> = {
  image: 'conversations.typeImage',
  audio: 'conversations.typeAudio',
  file: 'conversations.typeFile',
  video: 'conversations.typeVideo',
  template: 'conversations.typeTemplate',
  note: 'conversations.typeNote',
}

const DELIVERY_META = {
  pending: { icon: Clock, key: 'conversations.deliveryPending', tone: 'text-subtle' },
  sent: { icon: Check, key: 'conversations.deliverySent', tone: 'text-muted' },
  delivered: { icon: CheckCheck, key: 'conversations.deliveryDelivered', tone: 'text-info-ink' },
  read: { icon: CheckCheck, key: 'conversations.deliveryRead', tone: 'text-success-ink' },
  failed: { icon: AlertTriangle, key: 'conversations.deliveryFailed', tone: 'text-danger-ink' },
} as const

type Mailbox = 'all' | 'unread' | 'mine' | 'unassigned'
type ComposerMode = 'reply' | 'note'

/* ------------------------------------------------------------------- list */

const query = ref('')
const status = ref<ConversationStatus | ''>('')
const channel = ref<Channel | ''>('')
const mailbox = ref<Mailbox>('all')
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
const threadMeta = ref<Paginated<ConversationMessage>['meta'] | null>(null)
const threadLoading = ref(false)
const threadError = ref<string | null>(null)
const loadingEarlier = ref(false)

/** Bumped per request so a slow thread never overwrites a newer selection. */
let threadRequest = 0

const threadBody = ref<HTMLElement | null>(null)

const reply = ref('')
const note = ref('')
const composerMode = ref<ComposerMode>('reply')
const composing = ref(false)
const composerError = ref<string | null>(null)

let pendingReply: { body: string; key: string } | null = null
let pendingTemplate: { signature: string; key: string } | null = null

/* ------------------------------------------------------------------ modals */

const detailsOpen = ref(false)

const statusOpen = ref(false)
const statusValue = ref('open')
const savingStatus = ref(false)

const assignOpen = ref(false)
const assignValue = ref('')
const assigning = ref(false)
const assignees = ref<User[]>([])
const assigneesLoading = ref(false)

const templateOpen = ref(false)
const templateName = ref('')
const templateLanguage = ref('en_US')
const templateParameters = ref('')
const templateSending = ref(false)
const templateError = ref<string | null>(null)

const retryingId = ref<number | null>(null)

/* --------------------------------------------------------------- ai draft */

const draftOpen = ref(false)
const draftInstruction = ref('')
const draftLoading = ref(false)
const draftError = ref<string | null>(null)
const draftResult = ref<AiReplyDraft | null>(null)
const draftText = ref('')

const copilotOpen = ref(false)

/* -------------------------------------------------------------- computed */

const canReply = computed(() => auth.can('conversations.reply'))
const canAssign = computed(() => auth.can('conversations.assign'))
const canCreateOrder = computed(() => auth.can('orders.create'))
const orderBuilderOpen = ref(false)
const canUseAi = computed(() => auth.can('ai.use'))

const hasFilters = computed(
  () =>
    query.value !== '' ||
    status.value !== '' ||
    channel.value !== '' ||
    mailbox.value !== 'all',
)

const isClosed = computed(() => conversation.value?.status === 'closed')
const windowClosed = computed(
  () => conversation.value?.channel === 'whatsapp' && !conversation.value.reply_window.is_open,
)
const textReplyBlocked = computed(() => isClosed.value || windowClosed.value)

const threadTitle = computed(() => {
  const current = conversation.value
  if (!current) return ''
  return (
    current.customer?.name ||
    current.display_name ||
    current.phone ||
    current.subject?.trim() ||
    channelLabel(current.channel)
  )
})

const threadSubtitle = computed(() => {
  const current = conversation.value
  if (!current) return ''
  const parts = [channelLabel(current.channel)]
  if (current.phone) parts.push(current.phone)
  const assignee = current.assignee
    ? `${t('conversations.assignedTo')}: ${current.assignee.name}`
    : t('conversations.notAssigned')
  parts.push(assignee)
  return parts.join(' · ')
})

const statusFilterOptions = computed(() => [
  { value: '', label: t('conversations.filterAll') },
  { value: 'open', label: t('status.conversation.open') },
  { value: 'pending', label: t('status.conversation.pending') },
  { value: 'closed', label: t('status.conversation.closed') },
])

const channelFilterOptions = computed(() => [
  { value: '', label: t('conversations.allChannels') },
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
  ...assignees.value.map((user) => ({ value: String(user.id), label: user.name })),
])

const composerBody = computed(() => (composerMode.value === 'note' ? note.value : reply.value))
const composerPlaceholder = computed(() =>
  composerMode.value === 'note'
    ? t('conversations.notePlaceholder')
    : textReplyBlocked.value
      ? t('conversations.replyBlockedPlaceholder')
      : t('conversations.replyPlaceholder'),
)
const canSendComposer = computed(() => {
  if (!conversation.value || composing.value || composerBody.value.trim() === '') return false
  return composerMode.value === 'note' || !textReplyBlocked.value
})

/* ------------------------------------------------------------- formatting */

function statusLabel(value: ConversationStatus): string {
  return t(STATUS_KEYS[value])
}

function channelLabel(value: Channel): string {
  return t(CHANNEL_KEYS[value])
}

function rowTitle(target: Conversation): string {
  return (
    target.customer?.name ||
    target.display_name ||
    target.phone ||
    target.subject?.trim() ||
    channelLabel(target.channel)
  )
}

function rowSnippet(target: Conversation): string {
  const last = target.last_message
  if (!last) return t('conversations.noMessages')

  const type = last.type
  if (last.is_internal || type === 'note') {
    return `${t('conversations.notePrefix')} ${last.body ?? ''}`.trim()
  }
  if (type === 'template') return t('conversations.templatePrefix')
  if (type && TYPE_KEYS[type]) return t(TYPE_KEYS[type] as Parameters<typeof t>[0])

  const body = last.body?.trim()
  if (body) return last.direction === 'outbound' ? `${t('conversations.youPrefix')} ${body}` : body
  return last ? t('conversations.attachment') : t('conversations.noMessages')
}

function rowDot(target: Conversation): string {
  return BADGE_DOT_CLASSES[statusTone(target.status)]
}

function messageTime(message: ConversationMessage): string {
  return formatTime(message.sent_at ?? message.created_at)
}

function messageFullTime(message: ConversationMessage): string {
  return formatDateTime(message.sent_at ?? message.created_at)
}

function dayKey(message: ConversationMessage): string {
  const value = message.sent_at ?? message.created_at
  return value ? value.slice(0, 10) : ''
}

function showsDay(index: number): boolean {
  const current = messages.value[index]
  const previous = messages.value[index - 1]
  if (!current) return false
  return !previous || dayKey(current) !== dayKey(previous)
}

function dayLabel(message: ConversationMessage): string {
  return formatDate(message.sent_at ?? message.created_at)
}

function deliveryMeta(value: DeliveryStatus | null | undefined) {
  return value ? DELIVERY_META[value] : null
}

function deliveryLabel(value: DeliveryStatus | null | undefined): string {
  const meta = deliveryMeta(value)
  return meta ? t(meta.key as Parameters<typeof t>[0]) : ''
}

function hasAttachmentSnippet(target: Conversation): boolean {
  const type = target.last_message?.type
  return type === 'image' || type === 'audio' || type === 'file' || type === 'video'
}

function messageTypeLabel(message: ConversationMessage): string | null {
  if (message.type === 'note') return t('conversations.internalNote')
  const key = TYPE_KEYS[message.type]
  return key ? t(key as Parameters<typeof t>[0]) : null
}

function bubbleClasses(message: ConversationMessage): string[] {
  if (message.type === 'system') return ['self-center', 'bg-surface-2', 'text-muted', 'text-center']
  if (message.type === 'note' || message.is_internal)
    return ['self-start', 'bg-warning-soft', 'text-warning-ink', 'border', 'border-warning-border']
  if (message.direction === 'outbound') return ['self-end', 'bg-brand-soft', 'text-brand-ink']
  return ['self-start', 'bg-surface-2', 'text-ink']
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.message ? caught.message : fallback
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
      status: status.value || undefined,
      channel: channel.value || undefined,
      mine: mailbox.value === 'mine' ? true : undefined,
      unread: mailbox.value === 'unread' ? true : undefined,
      unassigned: mailbox.value === 'unassigned' ? true : undefined,
    })
    rows.value = result.data
    meta.value = result.meta
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('error.title'))
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

function sortMessages(list: ConversationMessage[]): ConversationMessage[] {
  return [...list].sort((a, b) => {
    const left = a.sent_at ?? a.created_at ?? ''
    const right = b.sent_at ?? b.created_at ?? ''
    return left === right ? a.id - b.id : left.localeCompare(right)
  })
}

async function openThread(id: number): Promise<void> {
  const request = ++threadRequest
  threadLoading.value = true
  threadError.value = null
  conversation.value = null
  messages.value = []
  threadMeta.value = null
  reply.value = ''
  note.value = ''
  composerMode.value = 'reply'
  composerError.value = null
  pendingReply = null
  pendingTemplate = null
  detailsOpen.value = false
  copilotOpen.value = false

  try {
    const [detail, thread] = await Promise.all([
      fetchConversation(id),
      fetchMessages(id, { per_page: THREAD_PER_PAGE }),
    ])
    if (request !== threadRequest) return
    conversation.value = detail
    messages.value = sortMessages(thread.data)
    threadMeta.value = thread.meta
    composerMode.value = detail.status === 'closed' ? 'note' : 'reply'
    void scrollToLatest()
    void markRead(detail)
  } catch (caught) {
    if (request !== threadRequest) return
    threadError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : errorMessage(caught, t('state.loadFailed'))
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

async function loadEarlier(): Promise<void> {
  const current = conversation.value
  const thread = threadMeta.value
  if (!current || !thread || loadingEarlier.value || thread.current_page >= thread.last_page) return

  loadingEarlier.value = true
  const element = threadBody.value
  const previousHeight = element?.scrollHeight ?? 0
  const previousTop = element?.scrollTop ?? 0

  try {
    const result = await fetchMessages(current.id, {
      page: thread.current_page + 1,
      per_page: THREAD_PER_PAGE,
    })
    if (conversation.value?.id !== current.id) return

    const known = new Set(messages.value.map((message) => message.id))
    const older = result.data.filter((message) => !known.has(message.id))
    messages.value = [...sortMessages(older), ...messages.value]
    threadMeta.value = result.meta

    await nextTick()
    if (element) element.scrollTop = element.scrollHeight - previousHeight + previousTop
  } catch (caught) {
    toast.error(errorMessage(caught, t('state.loadFailed')))
  } finally {
    loadingEarlier.value = false
  }
}

async function markRead(target: Conversation): Promise<void> {
  if (target.unread_count <= 0) return

  try {
    const updated = await markConversationRead(target.id)
    if (conversation.value?.id !== target.id) return

    conversation.value = { ...conversation.value, ...updated, unread_count: 0 }
    const row = rows.value.find((item) => item.id === target.id)
    if (row) row.unread_count = 0
    if (summary.value) {
      summary.value = {
        ...summary.value,
        unread: Math.max(0, summary.value.unread - target.unread_count),
      }
    }
  } catch {
    // Reading the thread still succeeds; the badge stays until the next visit.
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

function refresh(): void {
  void load()
  void loadSummary()
}

function clearFilters(): void {
  query.value = ''
  status.value = ''
  channel.value = ''
  mailbox.value = 'all'
  page.value = 1
  void load()
}

function setMailbox(value: Mailbox): void {
  mailbox.value = mailbox.value === value ? 'all' : value
}

function updateRow(updated: Conversation): void {
  const row = rows.value.find((item) => item.id === updated.id)
  if (row) Object.assign(row, updated)
}

function updateMessageVoice(messageId: number, voice: VoiceMessage): void {
  const message = messages.value.find((item) => item.id === messageId)
  if (message) message.voice = voice
}

function onVoiceApplied(): void {
  toast.success(t('voice.appliedToast'))
}

/* --------------------------------------------------------------- mutations */

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
  void loadAssignees()
}

async function loadAssignees(): Promise<void> {
  if (assigneesLoading.value || assignees.value.length > 0) return

  assigneesLoading.value = true
  try {
    assignees.value = await fetchAssignees()
  } catch (caught) {
    toast.error(errorMessage(caught, t('state.loadFailed')))
  } finally {
    assigneesLoading.value = false
  }
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
    updateRow(updated)
    toast.success(t('conversations.statusUpdated'))
    statusOpen.value = false
    void loadSummary()
    if (status.value !== '' && status.value !== updated.status) void load()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
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
    updateRow(updated)
    toast.success(t('conversations.assigned'))
    assignOpen.value = false
    void loadSummary()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    assigning.value = false
  }
}

async function assignToMe(): Promise<void> {
  const target = conversation.value
  const me = auth.user
  if (!target || !me || assigning.value) return

  assigning.value = true
  try {
    const updated = await assignConversation(target.id, me.id)
    conversation.value = { ...target, ...updated }
    updateRow(updated)
    toast.success(t('conversations.assigned'))
    void loadSummary()
  } catch (caught) {
    toast.error(errorMessage(caught, t('error.title')))
  } finally {
    assigning.value = false
  }
}

async function submitComposer(): Promise<void> {
  if (!canSendComposer.value) return

  const target = conversation.value
  if (!target) return

  composing.value = true
  composerError.value = null

  const internal = composerMode.value === 'note'
  const body = internal ? note.value.trim() : reply.value.trim()

  try {
    if (internal) {
      const message = await sendNote(target.id, body)
      appendMessage(message)
      note.value = ''
      toast.success(t('conversations.noteAdded'))
    } else {
      const key = pendingReply?.body === body ? pendingReply.key : newIdempotencyKey()
      pendingReply = { body, key }
      const message = await sendReply(target.id, body, key)
      appendMessage(message)
      reply.value = ''
      pendingReply = null
      toast.success(t('conversations.replySent'))
    }

    updateRowAfterMessage(target, internal, body)
    void scrollToLatest()
  } catch (caught) {
    const failure = errorMessage(caught, t('conversations.messageFailed'))
    composerError.value = failure
    toast.error(failure)
  } finally {
    composing.value = false
  }
}

function appendMessage(message: ConversationMessage): void {
  const known = new Set(messages.value.map((item) => item.id))
  if (!known.has(message.id)) messages.value = [...messages.value, message]
}

function updateRowAfterMessage(
  target: Conversation,
  internal: boolean,
  body: string,
  type: MessageType = internal ? 'note' : 'text',
): void {
  const row = rows.value.find((item) => item.id === target.id)
  if (!row) return
  const sentAt = new Date().toISOString()
  row.last_message = {
    body,
    type,
    direction: 'outbound',
    is_internal: internal,
    sent_at: sentAt,
  }
  row.last_message_at = sentAt
}

/** Ctrl/Cmd+Enter sends; a bare Enter is left to the textarea's newline. */
function onComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.isComposing) return
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    void submitComposer()
  }
}

async function retryDelivery(message: ConversationMessage): Promise<void> {
  const target = conversation.value
  if (!target || retryingId.value !== null) return

  retryingId.value = message.id
  try {
    const retried = await retryMessageRequest(target.id, message.id)
    appendMessage(retried)
    toast.success(t('conversations.retrySent'))
    void scrollToLatest()
  } catch (caught) {
    toast.error(errorMessage(caught, t('conversations.messageFailed')))
  } finally {
    retryingId.value = null
  }
}

function openTemplateModal(): void {
  templateError.value = null
  templateOpen.value = true
}

async function submitTemplate(): Promise<void> {
  const target = conversation.value
  if (!target || templateSending.value) return

  templateSending.value = true
  templateError.value = null
  try {
    const parameters = templateParameters.value
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value !== '')

    const signature = JSON.stringify([
      templateName.value.trim(),
      templateLanguage.value.trim(),
      parameters,
    ])
    const key = pendingTemplate?.signature === signature ? pendingTemplate.key : newIdempotencyKey()
    pendingTemplate = { signature, key }
    const message = await sendTemplate(
      target.id,
      {
        template_name: templateName.value.trim(),
        language_code: templateLanguage.value.trim(),
        parameters,
      },
      key,
    )
    appendMessage(message)
    updateRowAfterMessage(
      target,
      false,
      message.template?.name ?? t('conversations.templatePrefix'),
      'template',
    )
    toast.success(t('conversations.templateSent'))
    pendingTemplate = null
    templateOpen.value = false
    templateName.value = ''
    templateParameters.value = ''
    void scrollToLatest()
  } catch (caught) {
    templateError.value = errorMessage(caught, t('conversations.templateFailed'))
  } finally {
    templateSending.value = false
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
  composerMode.value = 'reply'
  composerError.value = null
  draftOpen.value = false
}

/** The copilot's reply is placed in the composer, never sent from the panel. */
function useCopilotReply(value: string): void {
  reply.value = value
  composerMode.value = 'reply'
  composerError.value = null
  copilotOpen.value = false
}

watch(debouncedQuery, () => {
  if (page.value !== 1) page.value = 1
  else void load()
})

watch([status, channel, mailbox], () => {
  if (page.value !== 1) page.value = 1
  else void load()
})

watch(page, () => void load())

watch(
  () => conversation.value?.status,
  (next, previous) => {
    if (next === 'closed') composerMode.value = 'note'
    else if (previous === 'closed' && composerMode.value === 'note') composerMode.value = 'reply'
  },
)

onMounted(() => {
  void load()
  void loadSummary()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('conversations.title')" :description="t('conversations.subtitle')">
      <template #actions>
        <BaseButton variant="secondary" :icon="RefreshCw" :loading="loading" @click="refresh">
          {{ t('action.refresh') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
      {{ error }}
    </BaseAlert>

    <div
      class="surface grid min-h-[32rem] grid-cols-1 overflow-hidden lg:h-[calc(100dvh_-_13rem)] lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_20rem]"
    >
      <!-- ------------------------------------------------------------ queue -->
      <aside
        class="flex min-h-0 flex-col border-e border-line bg-surface"
        :class="mobileView === 'list' ? 'flex' : 'hidden lg:flex'"
        :aria-label="t('conversations.queue')"
      >
        <div class="shrink-0 border-b border-line px-4 pb-3 pt-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="flex items-center gap-2 text-h3 font-semibold text-ink">
                {{ t('conversations.inbox') }}
                <span
                  v-if="summary && summary.unread > 0"
                  class="rounded-full bg-brand-700 px-2 py-0.5 text-caption font-semibold text-white tabular-nums"
                >
                  {{ formatNumber(summary.unread) }}
                </span>
              </h2>
              <p v-if="summary" class="mt-1 text-caption text-muted">
                {{ t('conversations.queueSummary', {
                  open: formatNumber(summary.open),
                  pending: formatNumber(summary.pending),
                  unassigned: formatNumber(summary.unassigned),
                }) }}
              </p>
            </div>
          </div>

          <BaseInput
            v-model="query"
            type="search"
            class="mt-3"
            :placeholder="t('conversations.searchPlaceholder')"
          >
            <template #prefix><Search class="size-4" /></template>
          </BaseInput>

          <div class="mt-3 flex gap-1 overflow-x-auto pb-0.5" role="tablist">
            <button
              v-for="option in statusFilterOptions"
              :key="option.value"
              type="button"
              role="tab"
              class="shrink-0 rounded-full px-3 py-1.5 text-small font-medium transition"
              :class="
                status === option.value
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              "
              :aria-selected="status === option.value"
              @click="status = option.value as ConversationStatus | ''"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              class="rounded-full border px-2.5 py-1 text-caption font-medium transition"
              :class="
                mailbox === 'unread'
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-muted hover:bg-surface-2'
              "
              @click="setMailbox('unread')"
            >
              {{ t('conversations.unreadFilter') }}
            </button>
            <button
              type="button"
              class="rounded-full border px-2.5 py-1 text-caption font-medium transition"
              :class="
                mailbox === 'mine'
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-muted hover:bg-surface-2'
              "
              @click="setMailbox('mine')"
            >
              {{ t('conversations.onlyMine') }}
            </button>
            <button
              type="button"
              class="rounded-full border px-2.5 py-1 text-caption font-medium transition"
              :class="
                mailbox === 'unassigned'
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-muted hover:bg-surface-2'
              "
              @click="setMailbox('unassigned')"
            >
              {{ t('conversations.unassigned') }}
            </button>
            <button
              v-if="mailbox !== 'all'"
              type="button"
              class="rounded-full border border-line px-2.5 py-1 text-caption font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
              @click="setMailbox('all')"
            >
              {{ t('action.clearAll') }}
            </button>
          </div>

          <div class="mt-2">
            <BaseSelect
              v-model="channel"
              :options="channelFilterOptions"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="loading" class="space-y-5 p-4" aria-hidden="true">
            <div v-for="index in 6" :key="index" class="flex gap-3">
              <BaseSkeleton height="h-10" class="size-10 shrink-0 rounded-full" block />
              <div class="flex-1 space-y-2">
                <BaseSkeleton height="h-3.5" block />
                <BaseSkeleton class="w-2/3" height="h-3" block />
              </div>
            </div>
          </div>

          <div v-else-if="rows.length === 0" class="p-4">
            <BaseEmptyState
              v-if="hasFilters"
              compact
              :icon="Search"
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
              :icon="Inbox"
              :title="t('conversations.emptyTitle')"
              :description="t('conversations.emptyBody')"
            />
          </div>

          <template v-else>
            <button
              v-for="target in rows"
              :key="target.id"
              type="button"
              class="group flex w-full gap-3 border-s-2 px-4 py-3 text-start transition"
              :class="
                target.id === selectedId
                  ? 'border-brand bg-brand-soft/60'
                  : 'border-transparent hover:bg-surface-2'
              "
              @click="selectConversation(target)"
            >
              <span class="relative shrink-0">
                <UserAvatar :name="rowTitle(target)" size="md" />
                <span
                  v-if="target.unread_count > 0"
                  class="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-brand-700"
                  aria-hidden="true"
                />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span
                    class="min-w-0 flex-1 truncate text-sm"
                    :class="target.unread_count > 0 ? 'font-semibold text-ink' : 'font-medium text-ink'"
                  >
                    {{ rowTitle(target) }}
                  </span>
                  <span class="shrink-0 text-caption text-subtle">
                    {{ formatRelative(target.last_message_at ?? target.created_at) }}
                  </span>
                </span>

                <span class="mt-0.5 flex items-center gap-1.5">
                  <StickyNote
                    v-if="target.last_message?.is_internal || target.last_message?.type === 'note'"
                    class="size-3 shrink-0 text-warning-ink"
                    aria-hidden="true"
                  />
                  <Paperclip
                    v-else-if="hasAttachmentSnippet(target)"
                    class="size-3 shrink-0 text-subtle"
                    aria-hidden="true"
                  />
                  <span
                    class="min-w-0 flex-1 truncate text-small"
                    :class="
                      target.unread_count > 0
                        ? 'font-medium text-ink'
                        : 'text-muted'
                    "
                  >
                    {{ rowSnippet(target) }}
                  </span>
                  <span
                    v-if="target.unread_count > 0"
                    class="shrink-0 rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-white tabular-nums"
                  >
                    {{ target.unread_count }}
                  </span>
                </span>

                <span class="mt-1.5 flex items-center gap-2">
                  <span class="flex items-center gap-1 text-caption text-subtle">
                    <span class="size-1.5 rounded-full" :class="rowDot(target)" aria-hidden="true" />
                    {{ statusLabel(target.status) }}
                  </span>
                  <span class="text-caption text-subtle">·</span>
                  <span class="truncate text-caption text-subtle">{{ channelLabel(target.channel) }}</span>
                  <span v-if="target.assignee" class="ms-auto truncate text-caption text-subtle">
                    {{ target.assignee.name }}
                  </span>
                  <span v-else class="ms-auto text-caption text-warning-ink">
                    {{ t('conversations.unassigned') }}
                  </span>
                </span>
              </span>
            </button>
          </template>
        </div>

        <div v-if="meta && !loading && rows.length > 0" class="shrink-0">
          <BasePagination :meta="meta" :disabled="loading" @change="page = $event" />
        </div>
      </aside>

      <!-- ----------------------------------------------------------- thread -->
      <section
        class="flex min-h-0 flex-col bg-surface-2/40"
        :class="mobileView === 'thread' ? 'flex' : 'hidden lg:flex'"
      >
        <div v-if="threadLoading" class="flex-1 space-y-5 p-5" aria-hidden="true">
          <div class="flex items-center gap-3">
            <BaseSkeleton height="h-10" class="size-10 rounded-full" block />
            <div class="flex-1 space-y-2">
              <BaseSkeleton class="w-1/3" height="h-4" block />
              <BaseSkeleton class="w-1/2" height="h-3" block />
            </div>
          </div>
          <div class="ms-auto w-2/3 space-y-2">
            <BaseSkeleton height="h-16" block />
          </div>
          <div class="w-2/3 space-y-2">
            <BaseSkeleton height="h-12" block />
          </div>
          <div class="ms-auto w-1/2 space-y-2">
            <BaseSkeleton height="h-12" block />
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
          <!-- Conversation header -->
          <header class="flex shrink-0 items-start gap-3 border-b border-line bg-surface px-4 py-3">
            <button
              type="button"
              class="btn-icon -ms-1 mt-0.5 shrink-0 lg:hidden"
              :aria-label="t('action.back')"
              @click="backToList"
            >
              <ArrowLeft class="size-5 rtl:-scale-x-100" />
            </button>

            <UserAvatar :name="threadTitle" size="md" class="mt-0.5 hidden sm:grid" />

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 class="truncate text-h4 font-semibold text-ink">{{ threadTitle }}</h2>
                <BaseBadge size="sm" dot :tone="statusTone(conversation.status)">
                  {{ statusLabel(conversation.status) }}
                </BaseBadge>
                <BaseBadge
                  v-if="conversation.channel === 'whatsapp' && !conversation.reply_window.is_open"
                  size="sm"
                  tone="warning"
                >
                  {{ t('conversations.templateRequired') }}
                </BaseBadge>
              </div>
              <p class="mt-0.5 truncate text-small text-muted">{{ threadSubtitle }}</p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <BaseButton
                v-if="canUseAi"
                size="sm"
                variant="secondary"
                :icon="Sparkles"
                class="hidden sm:inline-flex"
                @click="copilotOpen = true"
              >
                {{ t('ai.copilot.button') }}
              </BaseButton>

              <BaseButton
                v-if="canCreateOrder"
                size="sm"
                variant="secondary"
                :icon="ShoppingCart"
                class="hidden sm:inline-flex"
                @click="orderBuilderOpen = true"
              >
                {{ t('conversations.buildOrder') }}
              </BaseButton>

              <button
                type="button"
                class="btn-icon xl:hidden"
                :aria-label="t('conversations.details')"
                @click="detailsOpen = true"
              >
                <PanelRight class="size-5" />
              </button>

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
                    v-if="canUseAi"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); copilotOpen = true"
                  >
                    <Sparkles class="size-4 text-muted" />
                    {{ t('ai.copilot.button') }}
                  </button>

                  <button
                    v-if="canCreateOrder"
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); orderBuilderOpen = true"
                  >
                    <ShoppingCart class="size-4 text-muted" />
                    {{ t('conversations.buildOrder') }}
                  </button>

                  <button
                    v-if="canAssign"
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

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                    @click="close(); retryThread()"
                  >
                    <RefreshCw class="size-4 text-muted" />
                    {{ t('action.refresh') }}
                  </button>
                </template>
              </BaseDropdown>
            </div>
          </header>

          <!-- Messages -->
          <div
            ref="threadBody"
            class="min-h-0 flex-1 overflow-y-auto px-4 py-5"
            :aria-label="t('conversations.messages')"
            role="log"
          >
            <div v-if="threadMeta && threadMeta.current_page < threadMeta.last_page" class="mb-4 text-center">
              <BaseButton
                size="sm"
                variant="secondary"
                :loading="loadingEarlier"
                :disabled="loadingEarlier"
                @click="loadEarlier"
              >
                {{ t('conversations.loadEarlier') }}
              </BaseButton>
            </div>

            <div v-if="messages.length === 0" class="flex h-full items-center justify-center">
              <BaseEmptyState
                compact
                :icon="MessageSquare"
                :title="t('conversations.noMessages')"
                :description="t('conversations.noMessagesBody')"
              />
            </div>

            <div v-else class="flex flex-col gap-2.5">
              <template v-for="(message, index) in messages" :key="message.id">
                <div v-if="showsDay(index)" class="flex items-center gap-3 py-2">
                  <span class="h-px flex-1 bg-line" aria-hidden="true" />
                  <span class="text-caption font-medium text-subtle">{{ dayLabel(message) }}</span>
                  <span class="h-px flex-1 bg-line" aria-hidden="true" />
                </div>

                <div
                  class="max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs sm:max-w-[72%]"
                  :class="bubbleClasses(message)"
                >
                  <div
                    v-if="message.author || message.type === 'template' || message.is_internal"
                    class="mb-1 flex flex-wrap items-center gap-1.5 text-caption font-semibold opacity-80"
                  >
                    <span v-if="message.is_internal">{{ t('conversations.internalNote') }}</span>
                    <span v-else-if="message.author">{{ message.author.name }}</span>
                    <BaseBadge v-if="message.type === 'template'" size="sm" tone="brand">
                      {{ t('conversations.templateBadge') }}
                    </BaseBadge>
                  </div>

                  <p
                    v-if="message.body"
                    class="whitespace-pre-wrap break-words text-sm leading-relaxed"
                  >
                    {{ message.body }}
                  </p>

                  <p v-else-if="message.type !== 'text'" class="text-sm italic opacity-80">
                    {{ messageTypeLabel(message) ?? t('conversations.attachment') }}
                  </p>

                  <MediaAttachment v-if="message.media" :message="message" />
                  <p
                    v-else-if="message.meta?.media_error"
                    class="mt-1.5 rounded-lg bg-danger-soft px-3 py-2 text-caption text-danger-ink"
                  >
                    {{ t('conversations.attachmentFailed') }}
                  </p>

                  <VoiceOrderPanel
                    v-if="message.voice"
                    :voice="message.voice"
                    :can-use-ai="canUseAi"
                    :can-create-order="canCreateOrder"
                    @updated="updateMessageVoice(message.id, $event)"
                    @applied="onVoiceApplied"
                    @open-order-builder="orderBuilderOpen = true"
                  />

                  <div
                    v-if="message.template?.name"
                    class="mt-1 flex flex-wrap items-center gap-1.5 text-caption opacity-75"
                  >
                    <span>{{ message.template.name }}</span>
                    <span v-if="message.template.language || message.template.language_code">
                      · {{ message.template.language ?? message.template.language_code }}
                    </span>
                  </div>

                  <p
                    v-if="message.location"
                    class="mt-1 flex items-center gap-1 text-caption opacity-75"
                  >
                    <span>{{ message.location.name ?? message.location.address ?? t('conversations.location') }}</span>
                    <span v-if="message.location.latitude != null && message.location.longitude != null" dir="ltr">
                      · {{ message.location.latitude }}, {{ message.location.longitude }}
                    </span>
                  </p>

                  <div
                    v-if="message.delivery_status === 'failed' && message.failure_reason"
                    class="mt-2 rounded-lg border border-current/20 bg-surface/40 px-2.5 py-2 text-caption"
                  >
                    <p>{{ message.failure_reason }}</p>
                    <BaseButton
                      v-if="message.can_retry"
                      size="sm"
                      variant="secondary"
                      :icon="RefreshCw"
                      :loading="retryingId === message.id"
                      class="mt-1.5"
                      @click="retryDelivery(message)"
                    >
                      {{ t('action.retry') }}
                    </BaseButton>
                  </div>

                  <div class="mt-1 flex items-center justify-end gap-1 text-caption opacity-65">
                    <span :title="messageFullTime(message)">{{ messageTime(message) }}</span>
                    <component
                      :is="deliveryMeta(message.delivery_status)?.icon"
                      v-if="message.direction === 'outbound' && deliveryMeta(message.delivery_status)"
                      class="size-3.5"
                      :class="deliveryMeta(message.delivery_status)?.tone"
                      :aria-label="deliveryLabel(message.delivery_status)"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Composer -->
          <div v-if="canReply" class="shrink-0 border-t border-line bg-surface p-3 sm:p-4">
            <BaseAlert
              v-if="composerError"
              class="mb-3"
              tone="danger"
              dismissible
              @dismiss="composerError = null"
            >
              {{ composerError }}
            </BaseAlert>

            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div class="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist">
                <button
                  type="button"
                  role="tab"
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-small font-medium transition"
                  :class="
                    composerMode === 'reply'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-muted hover:text-ink'
                  "
                  :aria-selected="composerMode === 'reply'"
                  @click="composerMode = 'reply'"
                >
                  <MessageSquare class="size-3.5" aria-hidden="true" />
                  {{ t('conversations.replyTab') }}
                </button>
                <button
                  type="button"
                  role="tab"
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-small font-medium transition"
                  :class="
                    composerMode === 'note'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-muted hover:text-ink'
                  "
                  :aria-selected="composerMode === 'note'"
                  @click="composerMode = 'note'"
                >
                  <StickyNote class="size-3.5" aria-hidden="true" />
                  {{ t('conversations.noteTab') }}
                </button>
              </div>

              <BaseButton
                v-if="composerMode === 'reply' && canUseAi"
                size="sm"
                variant="ghost"
                :icon="Sparkles"
                :disabled="textReplyBlocked || composing"
                @click="openDraftModal"
              >
                {{ t('ai.reply.button') }}
              </BaseButton>
            </div>

            <BaseAlert
              v-if="composerMode === 'reply' && textReplyBlocked"
              class="mb-3"
              :tone="isClosed ? 'info' : 'warning'"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {{ isClosed ? t('conversations.closedNotice') : t('conversations.windowClosedNotice') }}
                </span>
                <div class="flex flex-wrap gap-1.5">
                  <BaseButton
                    v-if="windowClosed && !isClosed"
                    size="sm"
                    variant="secondary"
                    @click="openTemplateModal"
                  >
                    {{ t('conversations.sendTemplate') }}
                  </BaseButton>
                  <BaseButton
                    v-if="isClosed && canAssign"
                    size="sm"
                    variant="secondary"
                    @click="openStatusModal"
                  >
                    {{ t('conversations.reopen') }}
                  </BaseButton>
                </div>
              </div>
            </BaseAlert>

            <form class="flex items-end gap-2" @submit.prevent="submitComposer">
              <div
                class="flex-1 rounded-lg"
                :class="composerMode === 'note' ? 'ring-1 ring-warning-border rounded-lg' : ''"
              >
                <BaseTextarea
                  v-if="composerMode === 'reply'"
                  v-model="reply"
                  :rows="2"
                  :placeholder="composerPlaceholder"
                  :disabled="textReplyBlocked || composing"
                  @keydown="onComposerKeydown"
                />
                <BaseTextarea
                  v-else
                  v-model="note"
                  :rows="2"
                  :placeholder="composerPlaceholder"
                  :disabled="composing"
                  :hint="t('conversations.noteHint')"
                  @keydown="onComposerKeydown"
                />
              </div>

              <BaseButton
                type="submit"
                :icon="composerMode === 'note' ? StickyNote : Send"
                :loading="composing"
                :disabled="!canSendComposer"
              >
                {{ composerMode === 'note' ? t('conversations.addNote') : t('conversations.sendReply') }}
              </BaseButton>
            </form>
          </div>
        </template>

        <div v-else class="flex flex-1 items-center justify-center p-6">
          <BaseEmptyState
            :icon="MessageSquare"
            :title="t('conversations.emptyThreadTitle')"
            :description="t('conversations.emptyThreadBody')"
          />
        </div>
      </section>

      <!-- ---------------------------------------------------------- context -->
      <div class="hidden min-h-0 border-s border-line xl:block">
        <ConversationDetails
          v-if="conversation"
          :conversation="conversation"
          :can-assign="canAssign"
          @assign="detailsOpen = false; openAssignModal()"
          @status="detailsOpen = false; openStatusModal()"
          @assign-to-me="detailsOpen = false; assignToMe()"
        />
      </div>
    </div>

    <!-- Context on laptops and phones -->
    <BaseModal
      :open="detailsOpen"
      :title="t('conversations.details')"
      size="sm"
      @close="detailsOpen = false"
    >
      <div v-if="conversation" class="h-[65dvh]">
        <ConversationDetails
          :conversation="conversation"
          :can-assign="canAssign"
          :show-header="false"
          @assign="detailsOpen = false; openAssignModal()"
          @status="detailsOpen = false; openStatusModal()"
          @assign-to-me="detailsOpen = false; assignToMe()"
        />
      </div>
    </BaseModal>

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
        :disabled="assigneesLoading"
        :hint="assigneesLoading ? t('state.loading') : undefined"
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

    <!-- Approved WhatsApp template -->
    <BaseModal
      :open="templateOpen"
      :title="t('conversations.templateTitle')"
      :description="t('conversations.templateDescription')"
      @close="templateOpen = false"
    >
      <div class="space-y-4">
        <BaseInput
          v-model="templateName"
          :label="t('conversations.templateName')"
          placeholder="order_update"
          required
        />
        <BaseInput
          v-model="templateLanguage"
          :label="t('conversations.templateLanguage')"
          placeholder="en_US"
          required
          dir="ltr"
        />
        <BaseTextarea
          v-model="templateParameters"
          :label="t('conversations.templateParameters')"
          :hint="t('conversations.templateParametersHint')"
          :rows="4"
          :placeholder="t('conversations.templateParametersPlaceholder')"
        />
        <BaseAlert v-if="templateError" tone="danger" dismissible @dismiss="templateError = null">
          {{ templateError }}
        </BaseAlert>
        <BaseAlert tone="info">{{ t('conversations.templateApprovalHint') }}</BaseAlert>
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="templateSending" @click="templateOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton
          :loading="templateSending"
          :disabled="templateName.trim() === '' || templateLanguage.trim() === ''"
          @click="submitTemplate"
        >
          {{ t('conversations.sendTemplate') }}
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
    <!-- Sales copilot: suggestions only; it never sends or confirms anything. -->
    <SalesCopilotPanel
      :open="copilotOpen && conversation !== null"
      :conversation-id="conversation?.id ?? null"
      :can-assign="canAssign"
      :can-build-order="canCreateOrder"
      :can-use-reply="canReply && !textReplyBlocked"
      @close="copilotOpen = false"
      @use-reply="useCopilotReply"
      @handoff="copilotOpen = false; openAssignModal()"
      @build-order="copilotOpen = false; orderBuilderOpen = true"
    />
    <!-- Conversation order builder -->
    <OrderBuilderModal
      :open="orderBuilderOpen && conversation !== null"
      :conversation="conversation"
      @close="orderBuilderOpen = false"
    />
  </div>
</template>
