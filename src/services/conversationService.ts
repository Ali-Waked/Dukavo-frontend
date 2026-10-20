import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { Channel, ConversationStatus } from '@/types/enums'
import type {
  Conversation,
  ConversationMessage,
  ConversationSummary,
} from '@/types/inbox'

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
}

export interface ConversationPayload {
  status?: ConversationStatus
  subject?: string | null
  assigned_to?: number | null
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

export function updateConversation(id: number, payload: ConversationPayload): Promise<Conversation> {
  return api.patch<Conversation>(`/tenant/conversations/${id}`, payload)
}

export function deleteConversation(id: number): Promise<void> {
  return api.delete<void>(`/tenant/conversations/${id}`)
}

/** Send a reply into the thread. */
export function sendReply(id: number, body: string): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(`/tenant/conversations/${id}/messages`, { body })
}

export function assignConversation(id: number, userId: number | null): Promise<Conversation> {
  return api.post<Conversation>(`/tenant/conversations/${id}/assign`, { user_id: userId })
}
