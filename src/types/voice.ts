import type { AiUsage } from './ai'

/** The lifecycle of an inbound voice note as the server processes it. */
export type VoiceMessageStatus =
  | 'queued'
  | 'transcribing'
  | 'extracting'
  | 'ready'
  | 'applied'
  | 'failed'

export type VoiceIntent = 'order' | 'product_inquiry' | 'other'

export type VoiceLanguage = 'arabic' | 'arabic_dialect' | 'english' | 'mixed' | 'other'

export type VoiceUnresolvedReason =
  | 'quantity_required'
  | 'product_required'
  | 'product_not_found'
  | 'variant_required'
  | 'variant_not_found'

/**
 * One line proposed from the transcript.
 *
 * Resolved lines have catalogue facts attached by the server. Unresolved lines
 * deliberately keep those fields null: the model did not have enough detail to
 * pick a product, variant or quantity, so a person has to handle them.
 */
export interface VoiceDraftItem {
  requested_name: string
  product_id: number | null
  variant_id: number | null
  quantity: number | null
  notes: string
  resolved: boolean
  reason: VoiceUnresolvedReason | string | null
  name: string | null
  sku: string | null
  unit_price: number | null
  currency: string | null
  available: number | null
  sufficient_stock: boolean | null
  line_total: number | null
}

/**
 * The reviewable draft produced from one transcript.
 *
 * `items` contains only lines the server could ground in the catalogue;
 * `unresolved` is the honesty channel for everything it could not safely infer.
 */
export interface VoiceExtraction {
  intent: VoiceIntent | string
  summary: string
  detected_language: VoiceLanguage | string
  confidence: number | null
  currency: string | null
  items: VoiceDraftItem[]
  unresolved: VoiceDraftItem[]
  missing_information: string[]
  warnings: string[]
  warning_codes: string[]
  transcript: string
  usage: AiUsage
}

export interface VoiceMessageMedia {
  available: boolean
  url: string | null
  mime_type: string | null
  size: number | null
  purged_at: string | null
}

export interface VoiceMessage {
  id: number
  conversation_id: number
  message_id: number
  status: VoiceMessageStatus
  status_label: string
  transcript: string | null
  language: string | null
  confidence: number | null
  extraction: VoiceExtraction | null
  failure_code: string | null
  failure_message: string | null
  attempt_count: number
  processed_at: string | null
  applied_cart_id: number | null
  applied_at: string | null
  media: VoiceMessageMedia
  capabilities: {
    retry: boolean
    apply: boolean
  }
  created_at: string | null
  updated_at: string | null
}

/** Only the reviewed, grounded lines are ever sent back to the apply endpoint. */
export interface VoiceApplyItem {
  product_id: number
  product_variant_id: number
  quantity: number
}

export interface VoiceApplyPayload {
  confirmed: true
  items: VoiceApplyItem[]
}
