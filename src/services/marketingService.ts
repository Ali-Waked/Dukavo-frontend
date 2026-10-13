import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { ContentPage, FaqEntry, MarketingFeature, NewsletterArticle, NewsletterSummary, PricingPlan } from '@/types/marketing'

/**
 * Public marketing site — reads for the landing pages and the lead-capture
 * forms. Everything here is unauthenticated and rate-limited by the server;
 * the client's job is only to shape the request and unwrap the envelope.
 *
 * The three forms answer with generic success copy regardless of outcome (no
 * email enumeration), so the pages never branch on the response body — a 2xx
 * means "we have it", whatever state it landed in.
 */

export interface JoinWaitlistPayload {
  email: string
  name?: string
  business_type?: string
  source?: string
  /** Honeypot — styled invisible; the server ignores it, bots cannot. */
  website?: string
}

export interface ContactMessagePayload {
  name: string
  email: string
  subject: string
  message: string
  /** Honeypot — styled invisible; the server ignores it, bots cannot. */
  website?: string
}

export interface NewsletterSubscribePayload {
  email: string
  source?: string
  /** Honeypot — styled invisible; the server ignores it, bots cannot. */
  website?: string
}

export function fetchPublicFeatures(): Promise<{ features: MarketingFeature[] }> {
  return api.get<{ features: MarketingFeature[] }>('/public/features')
}

export function fetchPublicPricing(): Promise<PricingPlan[]> {
  return api.get<PricingPlan[]>('/public/pricing')
}

export function fetchPublicFaq(): Promise<FaqEntry[]> {
  return api.get<FaqEntry[]>('/public/faq')
}

/**
 * A long-form public page by its stable key (`terms`, `privacy`, `about`).
 * An unpublished or unknown key is a 404, which the page renders as a
 * "not available yet" state rather than an error.
 */
export function fetchPublicContentPage(key: string): Promise<ContentPage> {
  return api.get<ContentPage>(`/public/pages/${key}`)
}

export function joinWaitlist(payload: JoinWaitlistPayload): Promise<void> {
  return api.post<void>('/public/waitlist', payload)
}

export function submitContact(payload: ContactMessagePayload): Promise<void> {
  return api.post<void>('/public/contact', payload)
}

export function subscribeNewsletter(payload: NewsletterSubscribePayload): Promise<void> {
  return api.post<void>('/public/newsletter/subscribe', payload)
}

export function unsubscribeNewsletter(email: string): Promise<void> {
  return api.post<void>('/public/newsletter/unsubscribe', { email })
}

/* ----------------------------------------------------- newsletter archive */

export interface PublicNewsletterParams {
  page?: number
  per_page?: number
}

/** The public archive: published editions only, newest first. */
export function fetchPublicNewsletters(
  params: PublicNewsletterParams = {},
): Promise<Paginated<NewsletterSummary>> {
  return api.list<NewsletterSummary>('/public/newsletters', { ...(params as Record<string, unknown>) })
}

/**
 * A published edition by its slug. A draft or unknown slug is a 404, which the
 * page renders as a "not found" state rather than an error.
 */
export function fetchPublicNewsletter(slug: string): Promise<NewsletterArticle> {
  return api.get<NewsletterArticle>(`/public/newsletters/${slug}`)
}