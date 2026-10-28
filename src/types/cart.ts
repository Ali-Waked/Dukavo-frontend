import type { CartStatus, Channel, OrderStatus } from './enums'
import type { ReplyWindow } from './inbox'

export interface CartItem {
  id: number
  product_id: number | null
  product_variant_id: number | null
  name: string
  sku: string | null
  unit_price: number
  quantity: number
  discount_total: number
  line_total: number
  available: number
  is_available: boolean
  variant?: { id: number; name: string; is_default: boolean } | null
}

export interface CartOrder {
  id: number
  order_number: string
  status: OrderStatus
  status_label: string
  grand_total: number
  placed_at: string | null
}

export interface Cart {
  id: number
  store_id: number | null
  status: CartStatus
  status_label: string
  version: number
  currency: string
  subtotal: number
  discount_total: number
  tax_total: number
  shipping_total: number
  grand_total: number
  tax_rate: number
  shipping_address: Record<string, unknown> | null
  notes: string | null
  confirmation_requested_at: string | null
  confirmation_sent_at: string | null
  confirmation_message_id: string | null
  confirmation_error: string | null
  items: CartItem[]
  store?: { id: number; name: string; currency: string } | null
  customer?: { id: number; name: string; phone: string | null; email: string | null } | null
  conversation?: {
    id: number
    channel: Channel
    display_name: string | null
    phone: string | null
    reply_window: ReplyWindow
  } | null
  order?: CartOrder | null
  capabilities: {
    edit: boolean
    request_confirmation: boolean
    confirm: boolean
    reopen: boolean
    cancel: boolean
  }
  created_at: string | null
  updated_at: string | null
}

export interface CartDetailsPayload {
  version: number
  shipping_total?: number
  tax_rate?: number
  shipping_address?: Record<string, string | null> | null
  notes?: string | null
}
