import type { CustomerStatus, OrderStatus, PaymentStatus } from './enums'

export interface CustomerAddress {
  id: number
  customer_id?: number
  label?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string | null
  is_default?: boolean
}

export interface Customer {
  id: number
  store_id: number | null
  name: string
  email?: string | null
  phone?: string | null
  status: CustomerStatus
  locale?: string | null
  notes?: string | null
  orders_count?: number
  total_spent?: number
  last_order_at?: string | null
  addresses?: CustomerAddress[]
  created_at?: string | null
  updated_at?: string | null
}

export interface OrderItem {
  id: number
  product_id: number | null
  product_variant_id: number | null
  name: string
  sku?: string | null
  unit_price: number
  quantity: number
  discount_total: number
  tax_total: number
  line_total: number
}

export interface OrderStatusHistoryEntry {
  id?: number
  from_status?: string | null
  to_status?: string
  note?: string | null
  actor?: string | null
  created_at?: string | null
}

export interface Order {
  id: number
  order_number: string
  store_id: number | null
  customer_id: number | null
  conversation_id?: number | null
  status: OrderStatus
  status_label: string
  payment_status: PaymentStatus
  payment_status_label: string
  subtotal: number
  discount_total: number
  tax_total: number
  shipping_total: number
  grand_total: number
  currency: string
  customer_name: string | null
  customer_phone: string | null
  shipping_address?: Record<string, unknown> | null
  notes?: string | null
  item_count: number | null
  allowed_transitions: OrderStatus[]
  customer?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
  } | null
  store?: { id: number; name: string } | null
  items?: OrderItem[]
  status_history?: OrderStatusHistoryEntry[]
  placed_at?: string | null
  cancelled_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}
