import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { OrderStatus, PaymentStatus } from '@/types/enums'
import type { Order } from '@/types/commerce'

/**
 * Orders.
 *
 * `transition` is separate from `update` because they are different verbs on
 * the server: an update edits fields, a transition runs the workflow and may
 * refuse. A refusal comes back as a 409 with a human message, which the UI
 * shows verbatim rather than replacing with a generic failure.
 */

export interface OrderListParams {
  page?: number
  per_page?: number
  search?: string
  status?: OrderStatus | ''
  store_id?: number
  customer_id?: number
  /** ISO date, `YYYY-MM-DD`. Requires `until` as well. */
  from?: string
  until?: string
}

export interface OrderPayload {
  customer_id?: number | null
  store_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  notes?: string | null
  shipping_address?: Record<string, unknown> | null
  items?: Array<{
    product_id?: number | null
    product_variant_id: number
    quantity: number
    unit_price?: number
  }>
}

/** The transition table for one order: where it is, and where it may go. */
export interface OrderTransitions {
  current: OrderStatus
  allowed: Array<{ status: OrderStatus; label: string }>
  is_cancellable: boolean
}

export interface TransitionPayload {
  status: OrderStatus
  note?: string | null
  /** Setting this to `paid` also marks the order paid in the same call. */
  payment_status?: PaymentStatus
}

export function fetchOrders(params: OrderListParams = {}): Promise<Paginated<Order>> {
  return api.list<Order>('/tenant/orders', { ...(params as Record<string, unknown>) })
}

/**
 * Read an order by its human number (ORD-000123), the identifier a merchant
 * shares with a customer. Mutations below key on the primary key instead, so
 * stock and history side effects never depend on a guessable value.
 */
export function fetchOrder(orderNumber: string): Promise<Order> {
  return api.get<Order>(`/tenant/orders/${orderNumber}`)
}

export function fetchTransitions(id: number): Promise<OrderTransitions> {
  return api.get<OrderTransitions>(`/tenant/orders/${id}/transitions`)
}

export function createOrder(payload: OrderPayload): Promise<Order> {
  return api.post<Order>('/tenant/orders', payload)
}

export function updateOrder(id: number, payload: Partial<OrderPayload>): Promise<Order> {
  return api.patch<Order>(`/tenant/orders/${id}`, payload)
}

export function transitionOrder(id: number, payload: TransitionPayload): Promise<Order> {
  return api.post<Order>(`/tenant/orders/${id}/transition`, payload)
}

export function deleteOrder(id: number): Promise<void> {
  return api.delete<void>(`/tenant/orders/${id}`)
}
