/**
 * Marketing content: what the public site publishes and what the platform
 * inboxes collect. Every shape mirrors a Laravel resource on the server.
 *
 * Public reads are unpaginated arrays; platform admin lists arrive wrapped in
 * pagination metadata via `api.list`.
 */
import type {
  BillingInterval,
  ContactStatus,
  NewsletterArticleStatus,
  NewsletterStatus,
  WaitlistStatus,
} from '@/types/enums'

export interface MarketingFeature {
  slug: string
  name: string
  description: string
  status: 'available' | 'coming_soon'
}

/* ------------------------------------------------------------ pricing */

/** A null price means "not published yet" — render coming-soon copy. */
export interface PricingPlan {
  id: number
  name: string
  slug: string
  description: string | null
  price: number | null
  /**
   * Whether the plan can actually be bought right now. Publication (`active`)
   * and being on sale are different facts: the Free plan is purchasable, paid
   * plans are not until a payment provider exists.
   */
  purchase_available: boolean
  billing_interval: BillingInterval
  billing_interval_label: string
  currency: string
  features: string[] | null
  limits: Record<string, string | number | boolean | null> | null
  highlighted: boolean
  active: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface PricingPlanPayload {
  name: string
  slug?: string | null
  description?: string | null
  price?: number | null
  billing_interval: BillingInterval
  currency: string
  features?: string[] | null
  limits?: Record<string, string | number> | null
  highlighted?: boolean
  active?: boolean
  sort_order?: number
}

/* ----------------------------------------------------------------- faq */

export interface FaqEntry {
  id: number
  question: string
  question_ar?: string | null
  answer: string
  answer_ar?: string | null
  category: string | null
  sort_order: number
  active: boolean
  locale?: string
  created_at?: string | null
  updated_at?: string | null
}

export interface FaqEntryPayload {
  question: string
  question_ar?: string | null
  answer: string
  answer_ar?: string | null
  category?: string | null
  sort_order?: number
  active?: boolean
}

/* ------------------------------------------------------ lead capture */

export interface WaitlistEntry {
  id: number
  email: string
  name: string | null
  business_type: string | null
  source: string | null
  status: WaitlistStatus
  status_label: string
  created_at?: string | null
  updated_at?: string | null
}

export interface ContactMessage {
  id: number
  name: string
  email: string
  subject: string
  message: string
  status: ContactStatus
  status_label: string
  created_at?: string | null
  updated_at?: string | null
}

export interface NewsletterSubscriber {
  id: number
  email: string
  status: NewsletterStatus
  status_label: string
  source: string | null
  consented_at?: string | null
  unsubscribed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/* ------------------------------------------------- newsletter editions */

/**
 * An edition as it appears in a list (the admin table and the public archive).
 * Deliberately body-less: rows never render the article copy, so it is not
 * shipped until the reader opens one.
 */
export interface NewsletterSummary {
  id: number
  title: string
  title_ar?: string | null
  slug: string
  excerpt: string | null
  excerpt_ar?: string | null
  cover_image_url: string | null
  reading_minutes: number
  status: NewsletterArticleStatus
  status_label: string
  published_at: string | null
  updated_at?: string | null
  /** The language the public API resolved this copy into. */
  locale?: string
}

/**
 * A full edition, including its body. The body is HTML sanitised by the server
 * on write (an allow-list of prose tags), so it is safe to render as markup.
 */
export interface NewsletterArticle extends NewsletterSummary {
  body: string
  body_ar?: string | null
  meta_title: string | null
  meta_title_ar?: string | null
  meta_description: string | null
  meta_description_ar?: string | null
  created_at?: string | null
}

export interface NewsletterArticlePayload {
  title: string
  title_ar?: string | null
  slug?: string | null
  excerpt?: string | null
  excerpt_ar?: string | null
  body: string
  body_ar?: string | null
  status?: NewsletterArticleStatus
  meta_title?: string | null
  meta_title_ar?: string | null
  meta_description?: string | null
  meta_description_ar?: string | null
  /** A replacement cover; absent leaves the current one in place. */
  cover_image?: File | null
  /** Explicitly clears the cover when no replacement is supplied. */
  remove_cover?: boolean
}

/* ------------------------------------------------------- long-form pages */

/**
 * How a section's body should be presented. `prose` is plain headings and
 * copy (legal documents); `steps`, `cards` and `cta` are used by the About
 * page. The renderer decides, so content authors only choose a layout.
 */
export type ContentSectionLayout = 'prose' | 'cards' | 'steps' | 'cta'

export interface ContentSection {
  /** Anchor-safe slug used as the heading's `id` and the table-of-contents target. */
  id: string
  title: string
  layout: ContentSectionLayout
  /** Plain text only — never HTML. Blank lines separate paragraphs. */
  body: string
}

/**
 * A long-form public page (terms, privacy, about). `published_at` is the date
 * the page first went live, which is what "last updated" should read; editing
 * a live page does not move it.
 */
export interface ContentPage {
  id: number
  key: string
  /** BCP-47 language of this row, e.g. `en` or `ar`. */
  locale: string
  title: string
  intro: string | null
  sections: ContentSection[]
  active: boolean
  meta_title: string | null
  meta_description: string | null
  published_at: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ContentPagePayload {
  title?: string
  intro?: string | null
  sections?: ContentSection[]
  active?: boolean
  meta_title?: string | null
  meta_description?: string | null
}