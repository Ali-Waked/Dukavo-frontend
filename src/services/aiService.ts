import { api } from '@/lib/axiosClient'
import type { PlatformDashboardRangeKey } from '@/services/platformService'
import type { Paginated } from '@/types/api'
import type {
  AiAction,
  AiActionType,
  AiAvailability,
  AiInsights,
  AiNewsletterAction,
  AiNewsletterContent,
  AiReplyDraft,
  AiSalesCopilotSuggestion,
  AiSummaryRequestResult,
} from '@/types/ai'
import type { AiActionStatus } from '@/types/enums'

/**
 * AI assistance.
 *
 * Every call here only ever returns a suggestion. Nothing is sent, saved or
 * published by these endpoints, and every route is guarded server-side by the
 * `ai.use` permission — the UI hides the controls when it is absent, which is
 * convenience, not the security boundary.
 */

/* ------------------------------------------------------------- availability */

/**
 * The use cases this actor can actually run now.
 *
 * The answer is computed server-side from the master switch, the feature
 * switches, the configured provider's capabilities and the caller's
 * permissions, so the UI can trust it rather than guessing from a local flag.
 */
export function fetchAiAvailability(): Promise<AiAvailability[]> {
  return api.get<AiAvailability[]>('/tenant/ai/availability')
}

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

/* ----------------------------------------------------------- sales copilot */

/**
 * A grounded sales suggestion for one conversation.
 *
 * The server resolves products, stock and money against the tenant's catalogue
 * and drops anything it cannot verify. The response is a proposal only: it
 * creates no order and sends no message.
 */
export function suggestSalesCopilot(
  conversationId: number,
  instruction?: string,
): Promise<AiSalesCopilotSuggestion> {
  return api.post<AiSalesCopilotSuggestion>(
    `/tenant/conversations/${conversationId}/ai-sales-copilot`,
    {
      instruction: instruction?.trim() ? instruction.trim() : undefined,
    },
  )
}

/* ------------------------------------------------------------- summary */

/**
 * Ask the server to summarise a conversation in the background.
 *
 * Summarising a long thread can take longer than a request should stay open, so
 * this queues the work and returns immediately. The result lands on the
 * conversation and is read back with the thread.
 */
export function requestConversationSummary(
  conversationId: number,
): Promise<AiSummaryRequestResult> {
  return api.post<AiSummaryRequestResult>(`/tenant/conversations/${conversationId}/ai-summary`)
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

/* ------------------------------------------------------- action governance */

export interface AiActionListParams {
  page?: number
  per_page?: number
  status?: AiActionStatus
  action_type?: string
  use_case?: string
}

/** The review queue. The server scopes it to the active tenant. */
export function fetchAiActions(params: AiActionListParams = {}): Promise<Paginated<AiAction>> {
  return api.list<AiAction>('/tenant/ai/actions', { ...(params as Record<string, unknown>) })
}

export function fetchAiAction(id: number): Promise<AiAction> {
  return api.get<AiAction>(`/tenant/ai/actions/${id}`)
}

/** The closed set of capabilities this installation can execute. */
export function fetchAiActionTypes(): Promise<AiActionType[]> {
  return api.get<AiActionType[]>('/tenant/ai/action-types')
}

/** Offer a proposal to a reviewer. A draft has no business effect. */
export function submitAiAction(id: number): Promise<AiAction> {
  return api.post<AiAction>(`/tenant/ai/actions/${id}/submit`)
}

/**
 * Approve an action. `confirmed` is the explicit second acknowledgement the
 * server requires for reversible and high-risk classifications.
 */
export function approveAiAction(id: number, confirmed: boolean): Promise<AiAction> {
  return api.post<AiAction>(`/tenant/ai/actions/${id}/approve`, { confirmed })
}

export function rejectAiAction(id: number, reason?: string): Promise<AiAction> {
  return api.post<AiAction>(`/tenant/ai/actions/${id}/reject`, {
    reason: reason?.trim() ? reason.trim() : undefined,
  })
}

/** Run an approved action. The server revalidates its state and is idempotent. */
export function executeAiAction(id: number): Promise<AiAction> {
  return api.post<AiAction>(`/tenant/ai/actions/${id}/execute`)
}

/* -------------------------------------------------------- merchant copilot */

import type { MerchantCopilotAnswer, MerchantCopilotRequest } from '@/types/merchant'

/**
 * Ask the merchant copilot a business question with explicit scope/period.
 * Returns explainable facts, metric definitions, and action previews only.
 */
export function askMerchantCopilot(payload: MerchantCopilotRequest): Promise<MerchantCopilotAnswer> {
  return api.post<MerchantCopilotAnswer>('/tenant/ai/merchant-copilot', {
    question: payload.question.trim(),
    store_id: payload.store_id ?? undefined,
    from: payload.from,
    until: payload.until,
  })
}
