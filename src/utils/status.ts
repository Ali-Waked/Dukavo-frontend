import type { BadgeTone } from '@/components/ui/badgeTones'

/**
 * One status → one tone, applied everywhere a status is rendered.
 *
 * The mapping is semantic rather than per-domain: `pending` is amber whether it
 * is an order, an invitation or a WhatsApp pairing, because amber has to mean
 * the same thing on every screen. Deliberately includes `error` (WhatsApp) and
 * `refunded` so a colour never contradicts the word beside it.
 */
export function statusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'active':
    case 'paid':
    case 'converted':
    case 'delivered':
    case 'connected':
    case 'open':
    case 'joined':
    case 'replied':
    case 'subscribed':
      return 'success'

    case 'pending':
    case 'pending_confirmation':
    case 'processing':
    case 'confirmed':
    case 'partially_paid':
    case 'new':
      return 'warning'

    case 'cancelled':
    case 'blocked':
    case 'suspended':
    case 'refunded':
    case 'error':
      return 'danger'

    case 'shipped':
    case 'read':
    case 'invited':
      return 'info'

    case 'draft':
    case 'archived':
    case 'inactive':
    case 'disconnected':
    case 'closed':
    case 'disqualified':
    case 'unsubscribed':
      return 'neutral'

    default:
      return 'neutral'
  }
}