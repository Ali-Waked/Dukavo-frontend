/**
 * AI assistance types.
 *
 * These mirror the shapes the backend returns from the `ai` endpoints. Every
 * field is model-generated prose or a model-chosen label — nothing here is a
 * figure the server computed — so the UI treats all of it as a suggestion to be
 * reviewed, never as authoritative data.
 */

import type { AiActionClassification, AiActionStatus } from './enums'

/** Token accounting returned alongside every completion. */
export interface AiUsage {
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

/** A draft reply for a support agent to edit and send themselves. */
export interface AiReplyDraft {
  draft: string
  tone: string
  suggestions: string[]
  usage: AiUsage
}

/* ------------------------------------------------------------ sales copilot */

export type AiCopilotIntent =
  | 'product_inquiry'
  | 'availability'
  | 'pricing'
  | 'order_request'
  | 'order_status'
  | 'complaint'
  | 'support'
  | 'other'

export type AiCopilotLanguage = 'arabic' | 'arabic_dialect' | 'english' | 'mixed' | 'other'

export type AiCopilotTone = 'friendly' | 'formal' | 'concise' | 'apologetic'

/**
 * A catalogue item the copilot believes is relevant.
 *
 * Every field has been resolved and priced by the server against the tenant's
 * real catalogue. The model supplied only the reference and the quantity, so
 * the displayed name, SKU, price and stock can be trusted far more than the
 * surrounding prose.
 */
export interface AiCopilotProduct {
  product_id: number
  variant_id: number
  name: string
  sku: string | null
  unit_price: number
  currency: string
  available: number | null
  requested_quantity: number | null
  sufficient_stock: boolean | null
  reason: string
}

export interface AiCopilotDraftItem {
  product_id: number
  variant_id: number
  name: string
  sku: string | null
  unit_price: number
  quantity: number
  line_total: number
  available: number | null
  sufficient_stock: boolean | null
}

export interface AiCopilotDraftIssue {
  code: string
  product?: string
  available?: number
  requested?: number
}

/**
 * A proposed basket, not an order.
 *
 * The totals were computed server-side from catalogue prices; nothing has been
 * reserved, charged or confirmed. An agent still has to build and confirm the
 * real order.
 */
export interface AiCopilotDraftOrder {
  currency: string
  items: AiCopilotDraftItem[]
  subtotal: number
  tax_total: number
  shipping_total: number
  grand_total: number
  issues: AiCopilotDraftIssue[]
}

/**
 * One sales-copilot suggestion for a conversation.
 *
 * `warnings` and `ignored_references` are the server's honesty channel: they
 * say what the model proposed that could not be verified. `draft_order` is
 * always a preview the agent must confirm elsewhere.
 */
export interface AiSalesCopilotSuggestion {
  intent: AiCopilotIntent
  summary: string
  detected_language: AiCopilotLanguage
  suggested_reply: string
  tone: AiCopilotTone
  products: AiCopilotProduct[]
  missing_information: string[]
  needs_human: boolean
  handoff_reason: string | null
  handoff_code: string | null
  draft_order: AiCopilotDraftOrder | null
  warnings: string[]
  warning_codes: string[]
  ignored_references: number[]
  usage: AiUsage
}

export type AiHighlightSeverity = 'positive' | 'neutral' | 'warning'

export interface AiHighlight {
  title: string
  detail: string
  severity: AiHighlightSeverity
}

export interface AiRecommendation {
  title: string
  detail: string
}

/**
 * A grounded briefing over already-computed dashboard aggregates.
 *
 * `data_gaps` lists the metrics the model was asked to call out as missing, so
 * a quiet period reads as "no data" rather than being glossed over.
 */
export interface AiInsights {
  summary: string
  highlights: AiHighlight[]
  recommendations: AiRecommendation[]
  data_gaps: string[]
  usage: AiUsage
}

export type AiNewsletterAction = 'outline' | 'draft' | 'improve'

/** Proposed newsletter content. The body is already sanitised server-side. */
export interface AiNewsletterContent {
  title: string
  excerpt: string
  body: string
  usage: AiUsage
}

/**
 * One use case, as advertised by the server.
 *
 * `enabled` is the server's own answer to "may this actor run this right now":
 * it already accounts for the master switch, the feature switch, a provider
 * that can serve it and the caller's permission. The UI shows a control only
 * when this is true, so it never offers something the backend will refuse.
 */
export interface AiAvailability {
  key: string
  label: string
  queueable: boolean
  enabled: boolean
}

/** The accepted shape of a queued summary request. */
export interface AiSummaryRequestResult {
  status: 'queued'
  conversation_id: number
}

export type AiConversationIntent =
  | 'order_status'
  | 'product_question'
  | 'pricing'
  | 'delivery'
  | 'complaint'
  | 'compliment'
  | 'other'

export type AiConversationSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated'

/**
 * What the server understood from a customer thread.
 *
 * `referenced_orders` has already been resolved against the tenant's real
 * orders server-side, so an order number the model invented is not present.
 */
export interface AiConversationSummary {
  summary: string
  intent: AiConversationIntent
  sentiment: AiConversationSentiment
  needs_human_reply: boolean
  suggested_next_step: string
  referenced_orders: string[]
  usage: AiUsage
}

/* ------------------------------------------------------- action governance */

/** A person attached to an action's audit trail. */
export interface AiActionActor {
  id: number
  name: string
}

/**
 * A proposed business action awaiting human judgement.
 *
 * `resolved_payload` is what the server vouched for after resolving the model's
 * suggestion against real records. The UI renders it for review; it never sends
 * it back as authority for a change.
 */
export interface AiAction {
  id: number
  use_case: string
  action_type: string
  classification: AiActionClassification | null
  classification_label: string | null
  required_permission: string | null
  requires_confirmation: boolean
  status: AiActionStatus
  status_label: string
  summary: string | null
  resolved_payload: Record<string, unknown>
  result: Record<string, unknown> | null
  rejection_reason: string | null
  error: string | null
  can_execute: boolean
  is_expired: boolean
  proposer?: AiActionActor | null
  approver?: AiActionActor | null
  executor?: AiActionActor | null
  submitted_at: string | null
  approved_at: string | null
  confirmed_at: string | null
  rejected_at: string | null
  executed_at: string | null
  expires_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AiActionRequirements {
  approval_required: boolean
  confirmation_required: boolean
  expires_after_minutes: number
}

/** One executable capability, as described by the server's closed registry. */
export interface AiActionType {
  action_type: string
  permission: string
  classification: AiActionClassification
  classification_label: string
  requirements: AiActionRequirements
}
