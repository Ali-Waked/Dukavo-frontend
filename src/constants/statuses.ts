import type { MessageKey } from '@/i18n'
import type {
  BillingInterval,
  ContactStatus,
  ConversationStatus,
  CustomerStatus,
  InventoryMovementType,
  NewsletterStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  StoreStatus,
  TenantStatus,
  UserStatus,
  WaitlistStatus,
  WhatsappStatus,
} from '@/types/enums'

/**
 * Status presentation, in one place.
 *
 * Colour and copy for a status are decided here rather than at the call site,
 * so "delivered" looks and reads the same on the orders table, the order
 * detail, the dashboard widget and the export. Adding a server status without a
 * row here is a type error, which is exactly the failure we want to catch
 * before it reaches a screen.
 *
 * `tone` maps to a token family (`text-danger-ink`, `bg-danger-soft`, …), never
 * to a hex value — the palette itself lives in `tokens.css`.
 */

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export interface StatusMeta {
  tone: Tone
  key: MessageKey
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  pending: { tone: 'warning', key: 'status.order.pending' },
  confirmed: { tone: 'info', key: 'status.order.confirmed' },
  processing: { tone: 'info', key: 'status.order.processing' },
  shipped: { tone: 'brand', key: 'status.order.shipped' },
  delivered: { tone: 'success', key: 'status.order.delivered' },
  cancelled: { tone: 'danger', key: 'status.order.cancelled' },
}

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  unpaid: { tone: 'danger', key: 'status.payment.unpaid' },
  partially_paid: { tone: 'warning', key: 'status.payment.partially_paid' },
  paid: { tone: 'success', key: 'status.payment.paid' },
  refunded: { tone: 'neutral', key: 'status.payment.refunded' },
}

export const PRODUCT_STATUS: Record<ProductStatus, StatusMeta> = {
  draft: { tone: 'neutral', key: 'status.product.draft' },
  active: { tone: 'success', key: 'status.product.active' },
  archived: { tone: 'neutral', key: 'status.product.archived' },
}

export const CUSTOMER_STATUS: Record<CustomerStatus, StatusMeta> = {
  active: { tone: 'success', key: 'status.customer.active' },
  inactive: { tone: 'neutral', key: 'status.customer.inactive' },
  blocked: { tone: 'danger', key: 'status.customer.blocked' },
}

export const CONVERSATION_STATUS: Record<ConversationStatus, StatusMeta> = {
  open: { tone: 'info', key: 'status.conversation.open' },
  pending: { tone: 'warning', key: 'status.conversation.pending' },
  closed: { tone: 'neutral', key: 'status.conversation.closed' },
}

export const USER_STATUS: Record<UserStatus, StatusMeta> = {
  active: { tone: 'success', key: 'status.user.active' },
  invited: { tone: 'info', key: 'status.user.invited' },
  suspended: { tone: 'danger', key: 'status.user.suspended' },
}

export const STORE_STATUS: Record<StoreStatus, StatusMeta> = {
  active: { tone: 'success', key: 'status.store.active' },
  inactive: { tone: 'neutral', key: 'status.store.inactive' },
}

export const TENANT_STATUS: Record<TenantStatus, StatusMeta> = {
  active: { tone: 'success', key: 'status.tenant.active' },
  suspended: { tone: 'danger', key: 'status.tenant.suspended' },
}

export const WHATSAPP_STATUS: Record<WhatsappStatus, StatusMeta> = {
  pending: { tone: 'warning', key: 'status.whatsapp.pending' },
  connected: { tone: 'success', key: 'status.whatsapp.connected' },
  disconnected: { tone: 'neutral', key: 'status.whatsapp.disconnected' },
  error: { tone: 'danger', key: 'status.whatsapp.error' },
}

export const MOVEMENT_TYPE: Record<InventoryMovementType, StatusMeta> = {
  purchase: { tone: 'success', key: 'status.movement.purchase' },
  sale: { tone: 'info', key: 'status.movement.sale' },
  return_in: { tone: 'brand', key: 'status.movement.return_in' },
  return_out: { tone: 'warning', key: 'status.movement.return_out' },
  adjustment: { tone: 'neutral', key: 'status.movement.adjustment' },
}

export const WAITLIST_STATUS: Record<WaitlistStatus, StatusMeta> = {
  pending: { tone: 'warning', key: 'status.waitlist.pending' },
  invited: { tone: 'info', key: 'status.waitlist.invited' },
  joined: { tone: 'success', key: 'status.waitlist.joined' },
  disqualified: { tone: 'neutral', key: 'status.waitlist.disqualified' },
}

export const CONTACT_STATUS: Record<ContactStatus, StatusMeta> = {
  new: { tone: 'warning', key: 'status.contact.new' },
  read: { tone: 'info', key: 'status.contact.read' },
  replied: { tone: 'success', key: 'status.contact.replied' },
  closed: { tone: 'neutral', key: 'status.contact.closed' },
}

export const NEWSLETTER_STATUS: Record<NewsletterStatus, StatusMeta> = {
  subscribed: { tone: 'success', key: 'status.newsletter.subscribed' },
  unsubscribed: { tone: 'neutral', key: 'status.newsletter.unsubscribed' },
}

/** Billing cadence, guided by its own label rather than a status tone. */
export const BILLING_INTERVAL: Record<BillingInterval, StatusMeta> = {
  monthly: { tone: 'brand', key: 'billing.monthly' },
  yearly: { tone: 'success', key: 'billing.yearly' },
  one_time: { tone: 'neutral', key: 'billing.one_time' },
}

/**
 * Look up status metadata without a specific type in hand — used by generic
 * cell renderers that receive a column definition rather than a concrete field.
 */
export function statusMeta(
  value: string,
  group: Record<string, StatusMeta> = {},
): StatusMeta | null {
  return group[value] ?? null
}

/** Filter options for a status set, in declaration order. */
export function statusOptions<T extends string>(group: Record<T, StatusMeta>): Array<{
  value: T
  meta: StatusMeta
}> {
  return Object.entries(group).map(([value, meta]) => ({
    value: value as T,
    meta: meta as StatusMeta,
  }))
}
