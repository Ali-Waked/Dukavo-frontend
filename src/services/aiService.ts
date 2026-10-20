import { api } from '@/lib/axiosClient'
import type { PlatformDashboardRangeKey } from '@/services/platformService'
import type {
  AiInsights,
  AiNewsletterAction,
  AiNewsletterContent,
  AiReplyDraft,
} from '@/types/ai'

/**
 * AI assistance.
 *
 * Every call here only ever returns a suggestion. Nothing is sent, saved or
 * published by these endpoints, and every route is guarded server-side by the
 * `ai.use` permission — the UI hides the controls when it is absent, which is
 * convenience, not the security boundary.
 */

/* ------------------------------------------------------------------ reply */

/**
 * Ask for a suggested reply to a conversation.
 *
 * The `instruction` is optional free text from the agent. The result is a draft
 * only: the agent edits it and sends it through the normal reply endpoint.
 */
export function draftReply(conversationId: number, instruction?: string): Promise<AiReplyDraft> {
  return api.post<AiReplyDraft>(`/tenant/conversations/${conversationId}/ai-reply-draft`, {
    instruction: instruction?.trim() ? instruction.trim() : undefined,
  })
}

/* --------------------------------------------------------------- insights */

/** A briefing over this workspace's dashboard aggregates. */
export function fetchTenantInsights(storeId?: number): Promise<AiInsights> {
  return api.get<AiInsights>('/tenant/ai/insights', { store_id: storeId })
}

/** A briefing over the platform overview for the selected window. */
export function fetchPlatformInsights(range?: PlatformDashboardRangeKey): Promise<AiInsights> {
  return api.get<AiInsights>('/platform/ai/insights', { range })
}

/* ----------------------------------------------------------------- content */

export interface NewsletterContentParams {
  action: AiNewsletterAction
  /** What the edition should be about. */
  brief: string
  audience?: string | null
  /** Existing draft HTML, required for the `improve` action. */
  body?: string | null
}

/** Propose newsletter content for the editor to review and carry over. */
export function generateNewsletterContent(
  params: NewsletterContentParams,
): Promise<AiNewsletterContent> {
  return api.post<AiNewsletterContent>('/platform/ai/newsletter-content', params)
}
