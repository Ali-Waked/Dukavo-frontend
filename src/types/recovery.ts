import type { CartStatus, ConversationStatus, OrderStatus, RecoveryEventType, RecoveryOpportunityStatus, RecoveryReason } from './enums'
import type { AiUsage } from './ai'

/** A money total grouped by ISO currency, as the summary endpoint returns it. */
export interface RecoveryCurrencyTotal {
  currency: string
  total: number
  count: number
}

export interface RecoverySummaryCounts {
  total: number
  open: number
  eligible: number
  contacted: number
  responded: number
  recovered: number
  snoozed: number
  dismissed: number
  expired: number
}

export interface RecoverySummary {
  counts: RecoverySummaryCounts
  open_value: RecoveryCurrencyTotal[]
  recovered_revenue: RecoveryCurrencyTotal[]
}

export interface RecoveryReplyWindow {
  is_open: boolean
  requires_template: boolean
  expires_at?: string | null
  remaining_seconds?: number | null
}

export interface RecoveryCustomer {
  id: number
  name: string
  phone: string | null
  locale: string | null
  whatsapp_opt_out_at: string | null
}

export interface RecoveryConversation {
  id: number
  channel: string
  display_name: string
  phone: string | null
  status: ConversationStatus
  last_inbound_at: string | null
  reply_window: RecoveryReplyWindow
}

export interface RecoveryCartItem {
  id: number
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export interface RecoveryCart {
  id: number
  status: CartStatus
  version: number
  item_count: number | null
  grand_total: number
  currency: string
  items: RecoveryCartItem[]
}

export interface RecoveryOrder {
  id: number
  order_number: string
  status: OrderStatus
  status_label: string
  grand_total: number
  currency: string
  placed_at: string | null
}

export interface RecoveryEvent {
  id: number
  type: RecoveryEventType
  type_label: string
  note: string | null
  meta: Record<string, unknown> | null
  conversation_message_id: number | null
  user: { id: number; name: string } | null
  created_at: string | null
}

/**
 * One detected lost sale.
 *
 * `estimated_value` is the cart snapshot that made the opportunity worth
 * working; `recovered_value` is the real order total and stays null until an
 * order exists and is not cancelled.
 */
export interface RecoveryOpportunity {
  id: number
  status: RecoveryOpportunityStatus
  status_label: string
  reason: RecoveryReason
  reason_label: string
  conversation_id: number | null
  customer_id: number | null
  cart_id: number | null
  order_id: number | null
  assigned_to: number | null
  estimated_value: number | null
  currency: string | null
  recovered_value: number | null
  recovered_currency: string | null
  contact_attempts: number
  detected_at: string | null
  last_activity_at: string | null
  last_contacted_at: string | null
  responded_at: string | null
  next_follow_up_at: string | null
  recovered_at: string | null
  dismissed_at: string | null
  dismissal_reason: string | null
  expires_at: string | null
  can_contact: boolean
  can_text: boolean
  requires_template: boolean
  conversation: RecoveryConversation | null
  customer: RecoveryCustomer | null
  cart: RecoveryCart | null
  order: RecoveryOrder | null
  assignee: { id: number; name: string } | null
  events: RecoveryEvent[]
  created_at: string | null
  updated_at: string | null
}

export interface RecoveryListParams {
  page?: number
  per_page?: number
  search?: string
  status?: RecoveryOpportunityStatus | 'open' | ''
  reason?: RecoveryReason | ''
  assigned_to?: number
  mine?: boolean
  unassigned?: boolean
  store_id?: number
}

export type RecoveryContactPayload =
  | { mode: 'text'; body: string }
  | {
      mode: 'template'
      template_name: string
      language_code: string
      parameters?: string[]
    }

/** The AI suggestion, which is always a draft for a person to review. */
export interface RecoveryDraft {
  suggested_reply: string
  language: string
  tone: string
  rationale: string
  needs_human: boolean
  handoff_reason: string | null
  risk_flags: string[]
  usage: AiUsage
}
