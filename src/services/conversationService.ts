import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { User } from '@/types/admin'
import type { Cart } from '@/types/cart'
import type { Channel, ConversationStatus } from '@/types/enums'
import type {
  Conversation,
  ConversationEvent,
  ConversationMessage,
  ConversationSummary,
} from '@/types/inbox'
import type { VoiceApplyPayload, VoiceMessage } from '@/types/voice'

/**
 * The inbox.
 *
 * Messages and conversations are fetched separately because a thread loads
 * page-by-page (newest last, paginated backwards) while the conversation list
 * is a single scan. Collapsing them would mean loading an entire thread to
 * render a row.
 */

export interface ConversationListParams {
  page?: number
  per_page?: number
  search?: string
  status?: ConversationStatus | ''
  channel?: Channel | ''
  mine?: boolean
  unassigned?: boolean
  unread?: boolean
  store_id?: number
}

export interface ConversationPayload {
  status?: ConversationStatus
  subject?: string | null
}

export interface TemplatePayload {
  template_name: string
  language_code: string
  parameters?: string[]
  idempotency_key?: string
}

/** A client key kept stable across retries of the same outbound draft. */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function fetchSummary(): Promise<ConversationSummary> {
  return api.get<ConversationSummary>('/tenant/conversations/summary')
}

export function fetchConversations(
  params: ConversationListParams = {},
): Promise<Paginated<Conversation>> {
  return api.list<Conversation>('/tenant/conversations', { ...(params as Record<string, unknown>) })
}

export function fetchConversation(id: number): Promise<Conversation> {
  return api.get<Conversation>(`/tenant/conversations/${id}`)
}

export function fetchMessages(
  id: number,
  params: { page?: number; per_page?: number } = {},
): Promise<Paginated<ConversationMessage>> {
  return api.list<ConversationMessage>(`/tenant/conversations/${id}/messages`, {
    ...(params as Record<string, unknown>),
  })
}

/** The team-facing audit trail for one thread, newest first. */
export function fetchConversationEvents(
  id: number,
  params: { page?: number; per_page?: number } = {},
): Promise<Paginated<ConversationEvent>> {
  return api.list<ConversationEvent>(`/tenant/conversations/${id}/events`, {
    ...(params as Record<string, unknown>),
  })
}

export function updateConversation(id: number, payload: ConversationPayload): Promise<Conversation> {
  return api.patch<Conversation>(`/tenant/conversations/${id}`, payload)
}

export function deleteConversation(id: number): Promise<void> {
  return api.delete<void>(`/tenant/conversations/${id}`)
}

/** Send a reply into the thread. */
export function sendReply(
  id: number,
  body: string,
  key: string = newIdempotencyKey(),
): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(`/tenant/conversations/${id}/messages`, {
    body,
    idempotency_key: key,
  })
}

/** An internal note is stored in the thread but never handed to a provider. */
export function sendNote(id: number, body: string): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(`/tenant/conversations/${id}/notes`, { body })
}

/** The only outbound path once a WhatsApp reply window has closed. */
export function sendTemplate(
  id: number,
  payload: TemplatePayload,
  key: string = newIdempotencyKey(),
): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(`/tenant/conversations/${id}/templates`, {
    ...payload,
    idempotency_key: payload.idempotency_key ?? key,
  })
}

export function retryMessage(id: number, messageId: number): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(`/tenant/conversations/${id}/messages/${messageId}/retry`)
}

/* ------------------------------------------------------------------ voice */

const voiceBase = (conversationId: number, voiceId: number) =>
  `/tenant/conversations/${conversationId}/voice-messages/${voiceId}`

export function fetchVoiceMessage(
  conversationId: number,
  voiceId: number,
): Promise<VoiceMessage> {
  return api.get<VoiceMessage>(voiceBase(conversationId, voiceId))
}

/** Retrying is explicit: it spends another transcription and extraction call. */
export function retryVoiceMessage(
  conversationId: number,
  voiceId: number,
): Promise<VoiceMessage> {
  return api.post<VoiceMessage>(`${voiceBase(conversationId, voiceId)}/retry`)
}

/**
 * Add confirmed voice lines to the conversation's Smart Cart.
 *
 * This creates a cart, never an order: the cart still has to be reviewed and
 * confirmed through the existing order builder.
 */
export function applyVoiceMessage(
  conversationId: number,
  voiceId: number,
  payload: VoiceApplyPayload,
): Promise<Cart> {
  return api.post<Cart>(`${voiceBase(conversationId, voiceId)}/apply`, payload)
}

export function assignConversation(id: number, userId: number | null): Promise<Conversation> {
  return api.post<Conversation>(`/tenant/conversations/${id}/assign`, { user_id: userId })
}

export function fetchAssignees(): Promise<User[]> {
  return api.list<User>('/tenant/conversations/assignees').then((result) => result.data)
}

export function markConversationRead(id: number): Promise<Conversation> {
  return api.post<Conversation>(`/tenant/conversations/${id}/read`)
}

/**
 * Fetch an authenticated attachment as a blob. The media route is protected by
 * the same session/tenant headers as every other request, so a plain `<img
 * src>` would arrive unauthenticated; components turn this blob into an object
 * URL and revoke it when they unmount.
 */
export async function fetchMessageMedia(message: ConversationMessage): Promise<Blob> {
  if (!message.media?.url) throw new Error('This message has no attachment.')

  const response = await api.raw.get(message.media.url, { responseType: 'blob' })

  return response.data as Blob
}
