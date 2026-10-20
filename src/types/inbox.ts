import type {
  Channel,
  ConversationStatus,
  MessageDirection,
  MessageType,
  WhatsappStatus,
} from './enums'

export interface ConversationMessage {
  id: number
  conversation_id: number
  user_id?: number | null
  direction: MessageDirection
  direction_label?: string
  type: MessageType
  body: string | null
  meta?: Record<string, unknown> | null
  delivery_status?: string | null
  delivery_status_label?: string | null
  delivered_at?: string | null
  read_at?: string | null
  delivery_error?: string | null
  sent_at?: string | null
  author?: { id: number; name: string } | null
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
  status: ConversationStatus
  status_label: string
  customer?: { id: number; name: string; phone?: string | null } | null
  assignee?: { id: number; name: string } | null
  last_message?: {
    body: string | null
    direction: MessageDirection
    sent_at: string | null
  } | null
  messages_count?: number
  last_message_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** `GET /conversations/summary` — open, pending and unassigned counts. */
export interface ConversationSummary {
  open: number
  pending: number
  unassigned: number
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
