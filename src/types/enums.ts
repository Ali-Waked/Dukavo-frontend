/**
 * Domain value unions.
 *
 * Every one of these mirrors a PHP enum case value on the server. They are
 * types, not constants, so they cost nothing at runtime; the human labels and
 * colour tones that go with them live in `constants/statuses.ts`.
 *
 * Keeping the two apart matters: this file is imported by service signatures
 * and store state, while the label maps are imported only by components that
 * render them.
 */

export type UserStatus = 'active' | 'invited' | 'suspended'
export type TenantStatus = 'active' | 'suspended'
export type StoreStatus = 'active' | 'inactive'
export type ProductStatus = 'draft' | 'active' | 'archived'
export type CustomerStatus = 'active' | 'inactive' | 'blocked'
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
export type ConversationStatus = 'open' | 'pending' | 'closed'
export type WhatsappStatus = 'pending' | 'connected' | 'disconnected' | 'error'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'system'
export type InventoryMovementType =
  | 'initial'
  | 'purchase'
  | 'sale'
  | 'return_in'
  | 'return_out'
  | 'adjustment'
export type RoleScope = 'platform' | 'tenant'
export type Locale = 'en' | 'ar'
export type ThemePreference = 'light' | 'dark' | 'system'
export type Channel = 'whatsapp' | 'web' | 'manual' | 'other'

/* ------------------------------------------------------- lead capture */
export type WaitlistStatus = 'pending' | 'invited' | 'joined' | 'disqualified'
export type ContactStatus = 'new' | 'read' | 'replied' | 'closed'
export type NewsletterStatus = 'subscribed' | 'unsubscribed'
export type BillingInterval = 'monthly' | 'yearly' | 'one_time'

/* ------------------------------------------------- newsletter editions */
/**
 * The lifecycle of a written newsletter edition. Distinct from
 * {@link NewsletterStatus}, which is whether an email address is subscribed:
 * one is content, the other is the audience.
 */
export type NewsletterArticleStatus = 'draft' | 'published'
