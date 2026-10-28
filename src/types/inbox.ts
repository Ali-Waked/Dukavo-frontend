import type { VoiceMessage } from './voice'
import type {
  Channel,
  ConversationStatus,
  MessageDirection,
  MessageType,
  WhatsappStatus,
} from './enums'

/** The provider's delivery lifecycle for an outbound message. */
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ReplyWindow {
  is_open: boolean
  expires_at: string | null
  requires_template: boolean
}

export interface MessageMedia {
  /** Authenticated conversation-scoped route; never a disk path or provider URL. */
  url: string
  filename: string | null
  mime_type: string | null
  size: number | null
}

export interface MessageTemplate {
  name?: string | null
  language?: string | null
  language_code?: string | null
  parameters?: string[] | null
}

export interface MessageLocation {
  latitude?: number | null
  longitude?: number | null
  name?: string | null
  address?: string | null
}

export interface ConversationMessage {
  id: number
  conversation_id: number
  user_id?: number | null
  direction: MessageDirection
  direction_label?: string
  type: MessageType
  body: string | null
  /** Meta's provider id — not the caller's dedupe key. */
  external_id?: string | null
  is_internal: boolean
  media?: MessageMedia | null
  template?: MessageTemplate | null
  location?: MessageLocation | null
  meta?: Record<string, unknown> | null
  delivery_status?: DeliveryStatus | null
  delivery_status_label?: string | null
  delivered_at?: string | null
  read_at?: string | null
  failure_code?: string | null
  failure_reason?: string | null
  delivery_error?: string | null
  failed_at?: string | null
  retry_of_id?: number | null
  attempt_count?: number
  can_retry?: boolean
  sent_at?: string | null
  author?: { id: number; name: string } | null
  /** Present on inbound audio messages once the webhook has registered them. */
  voice?: VoiceMessage | null
  created_at?: string | null
}

export interface Conversation {
  id: number
  store_id?: number | null
  customer_id: number | null
  assigned_to?: number | null
  channel: Channel
  channel_account?: string | null
  external_id?: string | null
  subject?: string | null
  display_name?: string | null
  phone?: string | null
  status: ConversationStatus
  status_label: string
  unread_count: number
  last_read_at?: string | null
  last_inbound_at?: string | null
  reply_window: ReplyWindow
  customer?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
  } | null
  assignee?: { id: number; name: string } | null
  last_message?: {
    id?: number
    body: string | null
    type?: MessageType
    direction: MessageDirection
    is_internal?: boolean
    delivery_status?: DeliveryStatus | null
    sent_at: string | null
  } | null
  messages_count?: number
  last_message_at?: string | null
  closed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * One team-facing event on a conversation.
 *
 * This is the audit trail, not the customer-visible thread: it answers who
 * assigned, changed status, sent or noted something. `old_values` and
 * `new_values` are already allow-listed by the server, so they never contain
 * message bodies or credentials.
 */
export interface ConversationEvent {
  id: number
  action: string
  action_label: string
  user?: { id: number; name: string; email?: string | null } | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  created_at: string | null
}

/** `GET /conversations/summary` — queue and unread counters. */
export interface ConversationSummary {
  open: number
  pending: number
  unassigned: number
  unread: number
}

export interface WhatsappAccount {
  id: number
  store_id?: number | null
  name: string
  phone_number_id?: string | null
  business_account_id?: string | null
  phone?: string | null
  status: WhatsappStatus
  status_label: string
  is_connected: boolean
  is_usable: boolean
  error_message?: string | null
  webhook_verify_token?: string | null
  meta?: Record<string, unknown> | null
  connected_at?: string | null
  last_synced_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * `GET /whatsapp-accounts/configuration` — the installation's platform-level
 * WhatsApp setup, as booleans and public URLs.
 *
 * It carries no secret by construction: it exists so the page can say what is
 * missing and why nothing arrives, which it cannot infer from the accounts
 * alone. `signature_validation` is the one that decides whether Meta's inbound
 * deliveries are checked or refused outright.
 */
export interface WhatsappConfiguration {
  api_version: string | null
  api_host: string | null
  configured: {
    phone_number_id: boolean
    business_account_id: boolean
    access_token: boolean
    webhook_verify_token: boolean
    app_secret: boolean
  }
  webhook: {
    verify_url: string
    events_url: string
    signature_validation: 'enforced' | 'not_configured'
  }
}
