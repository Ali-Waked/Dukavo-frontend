import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { ContactStatus, NewsletterArticleStatus, NewsletterStatus, WaitlistStatus } from '@/types/enums'
import type {
  ContactMessage,
  ContentPage,
  ContentPagePayload,
  FaqEntry,
  FaqEntryPayload,
  NewsletterArticle,
  NewsletterArticlePayload,
  NewsletterSubscriber,
  NewsletterSummary,
  PricingPlan,
  PricingPlanPayload,
  WaitlistEntry,
} from '@/types/marketing'
import type { SlugCheckResult } from '@/composables/useSlugAvailability'

/**
 * Platform content administration — pricing, FAQ and the lead-capture inboxes.
 *
 * These routes sit under `/api/v1/platform/*` and require the platform role
 * (the router guard enforces it; the sidebar only renders them for platform
 * operators). The inbox resources are status-only: a signup or message the
 * visitor wrote is immutable, so the only mutation offered is the workflow
 * status, plus deletion for spam or GDPR cleanup.
 */

/* ---------------------------------------------------------- pricing plans */

export interface IndexPlansParams {
  page?: number
  per_page?: number
  search?: string
  active?: boolean
}

export function fetchPricingPlans(params: IndexPlansParams = {}): Promise<Paginated<PricingPlan>> {
  return api.list<PricingPlan>('/platform/pricing-plans', { ...(params as Record<string, unknown>) })
}

export function fetchPricingPlan(id: number): Promise<PricingPlan> {
  return api.get<PricingPlan>(`/platform/pricing-plans/${id}`)
}

export function createPricingPlan(payload: PricingPlanPayload): Promise<PricingPlan> {
  return api.post<PricingPlan>('/platform/pricing-plans', payload)
}

export function updatePricingPlan(id: number, payload: Partial<PricingPlanPayload>): Promise<PricingPlan> {
  return api.patch<PricingPlan>(`/platform/pricing-plans/${id}`, payload)
}

export function deletePricingPlan(id: number): Promise<void> {
  return api.delete<void>(`/platform/pricing-plans/${id}`)
}

/* -------------------------------------------------------------- faq entries */

export interface IndexFaqParams {
  page?: number
  per_page?: number
  search?: string
  category?: string
  active?: boolean
}

export function fetchFaqEntries(params: IndexFaqParams = {}): Promise<Paginated<FaqEntry>> {
  return api.list<FaqEntry>('/platform/faq-entries', { ...(params as Record<string, unknown>) })
}

export function fetchFaqEntry(id: number): Promise<FaqEntry> {
  return api.get<FaqEntry>(`/platform/faq-entries/${id}`)
}

export function createFaqEntry(payload: FaqEntryPayload): Promise<FaqEntry> {
  return api.post<FaqEntry>('/platform/faq-entries', payload)
}

export function updateFaqEntry(id: number, payload: Partial<FaqEntryPayload>): Promise<FaqEntry> {
  return api.patch<FaqEntry>(`/platform/faq-entries/${id}`, payload)
}

export function deleteFaqEntry(id: number): Promise<void> {
  return api.delete<void>(`/platform/faq-entries/${id}`)
}

/* -------------------------------------------------------------- waitlist */

export interface IndexWaitlistParams {
  page?: number
  per_page?: number
  search?: string
  status?: WaitlistStatus
}

export function fetchWaitlistEntries(params: IndexWaitlistParams = {}): Promise<Paginated<WaitlistEntry>> {
  return api.list<WaitlistEntry>('/platform/waitlist-entries', {
    ...(params as Record<string, unknown>),
  })
}

export function updateWaitlistEntry(id: number, status: WaitlistStatus): Promise<WaitlistEntry> {
  return api.patch<WaitlistEntry>(`/platform/waitlist-entries/${id}`, { status })
}

export function deleteWaitlistEntry(id: number): Promise<void> {
  return api.delete<void>(`/platform/waitlist-entries/${id}`)
}

/* -------------------------------------------------------- contact inbox */

export interface IndexContactParams {
  page?: number
  per_page?: number
  search?: string
  status?: ContactStatus
}

export function fetchContactMessages(params: IndexContactParams = {}): Promise<Paginated<ContactMessage>> {
  return api.list<ContactMessage>('/platform/contact-messages', {
    ...(params as Record<string, unknown>),
  })
}

export function updateContactMessage(id: number, status: ContactStatus): Promise<ContactMessage> {
  return api.patch<ContactMessage>(`/platform/contact-messages/${id}`, { status })
}

export function deleteContactMessage(id: number): Promise<void> {
  return api.delete<void>(`/platform/contact-messages/${id}`)
}

/* ----------------------------------------------------------- newsletter */

export interface IndexNewsletterParams {
  page?: number
  per_page?: number
  search?: string
  status?: NewsletterStatus
}

export function fetchNewsletterSubscribers(
  params: IndexNewsletterParams = {},
): Promise<Paginated<NewsletterSubscriber>> {
  return api.list<NewsletterSubscriber>('/platform/newsletter-subscribers', {
    ...(params as Record<string, unknown>),
  })
}

export function updateNewsletterSubscriber(id: number, status: NewsletterStatus): Promise<NewsletterSubscriber> {
  return api.patch<NewsletterSubscriber>(`/platform/newsletter-subscribers/${id}`, { status })
}

export function deleteNewsletterSubscriber(id: number): Promise<void> {
  return api.delete<void>(`/platform/newsletter-subscribers/${id}`)
}

/* ------------------------------------------------------- content pages */

/**
 * The long-form public pages (terms, privacy, about). There is no create and
 * no delete: the pages are seeded and fixed, so the platform team only reads
 * them and replaces their content.
 */
export function fetchContentPages(): Promise<ContentPage[]> {
  return api.get<ContentPage[]>('/platform/content-pages')
}

export function fetchContentPage(id: number): Promise<ContentPage> {
  return api.get<ContentPage>(`/platform/content-pages/${id}`)
}

export function updateContentPage(id: number, payload: ContentPagePayload): Promise<ContentPage> {
  return api.patch<ContentPage>(`/platform/content-pages/${id}`, payload)
}

/* ------------------------------------------------------ newsletter editions */

export interface IndexNewsletterArticlesParams {
  page?: number
  per_page?: number
  search?: string
  status?: NewsletterArticleStatus
}

/**
 * Build the multipart body for a create or replace.
 *
 * A cover is a file, so the whole form goes as `multipart/form-data`. Empty
 * optional values are omitted rather than sent as empty strings, which would
 * otherwise defeat a rule such as `nullable|url`.
 */
function newsletterFormData(payload: Partial<NewsletterArticlePayload>): FormData {
  const form = new FormData()

  if (payload.title != null) {
    form.append('title', payload.title)
  }

  if (payload.slug) {
    form.append('slug', payload.slug)
  }

  if (payload.body != null) {
    form.append('body', payload.body)
  }

  if (payload.excerpt != null) {
    form.append('excerpt', payload.excerpt)
  }

  if (payload.status) {
    form.append('status', payload.status)
  }

  if (payload.meta_title != null) {
    form.append('meta_title', payload.meta_title)
  }

  if (payload.meta_description != null) {
    form.append('meta_description', payload.meta_description)
  }

  if (payload.cover_image) {
    form.append('cover_image', payload.cover_image)
  }

  if (payload.remove_cover) {
    form.append('remove_cover', '1')
  }

  return form
}

export function fetchNewsletterArticles(
  params: IndexNewsletterArticlesParams = {},
): Promise<Paginated<NewsletterSummary>> {
  return api.list<NewsletterSummary>('/platform/newsletters', { ...(params as Record<string, unknown>) })
}

export function fetchNewsletterArticle(id: number): Promise<NewsletterArticle> {
  return api.get<NewsletterArticle>(`/platform/newsletters/${id}`)
}

export function createNewsletterArticle(payload: NewsletterArticlePayload): Promise<NewsletterArticle> {
  return payload.cover_image
    ? api.post<NewsletterArticle>('/platform/newsletters', newsletterFormData(payload))
    : api.post<NewsletterArticle>('/platform/newsletters', payload)
}

/**
 * Save an edition.
 *
 * A multipart body cannot be sent as a real PATCH — PHP only parses uploaded
 * files for POST — so when a cover is involved the request is spoofed with
 * `_method=PATCH`. Without a file the plain JSON PATCH is used.
 */
export function updateNewsletterArticle(
  id: number,
  payload: Partial<NewsletterArticlePayload>,
): Promise<NewsletterArticle> {
  if (payload.cover_image || payload.remove_cover) {
    const form = newsletterFormData(payload)
    form.append('_method', 'PATCH')

    return api.post<NewsletterArticle>(`/platform/newsletters/${id}`, form)
  }

  return api.patch<NewsletterArticle>(`/platform/newsletters/${id}`, payload)
}

export function deleteNewsletterArticle(id: number): Promise<void> {
  return api.delete<void>(`/platform/newsletters/${id}`)
}

export function checkNewsletterSlug(slug: string, ignore?: number): Promise<SlugCheckResult> {
  return api.get<SlugCheckResult>('/platform/newsletters/slug-availability', { slug, ignore })
}