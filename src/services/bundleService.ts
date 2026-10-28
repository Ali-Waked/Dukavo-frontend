import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type {
  Bundle,
  BundlePayload,
  BundlePreview,
  BundleRecommendationsPayload,
  BundleStatus,
  RecommendationExplanation,
} from '@/types/bundles'

/**
 * Smart Bundles.
 *
 * Preview and recommendation responses are always trusted as computed by the
 * server: the browser never adds up a bundle total or decides availability on
 * its own. Expected fingerprints are forwarded when the caller has one so a
 * changed catalogue produces a 409 instead of a silently different total.
 */

export interface BundleListParams {
  page?: number
  per_page?: number
  search?: string
  status?: BundleStatus | ''
  store_id?: number
}

export interface PreviewOptions {
  store_id?: number
  expected_catalog_fingerprint?: string
}

export interface RecommendationOptions {
  store_id?: number
  limit?: number
  expected_catalog_fingerprint?: string
}

export function fetchBundles(params: BundleListParams = {}): Promise<Paginated<Bundle>> {
  return api.list<Bundle>('/tenant/bundles', { ...(params as Record<string, unknown>) })
}

export function fetchBundle(id: number): Promise<Bundle> {
  return api.get<Bundle>(`/tenant/bundles/${id}`)
}

export function createBundle(payload: BundlePayload): Promise<Bundle> {
  return api.post<Bundle>('/tenant/bundles', payload)
}

export function updateBundle(id: number, payload: BundlePayload): Promise<Bundle> {
  return api.patch<Bundle>(`/tenant/bundles/${id}`, payload)
}

export function deleteBundle(id: number): Promise<void> {
  return api.delete<void>(`/tenant/bundles/${id}`)
}

export function previewBundle(id: number, options: PreviewOptions = {}): Promise<BundlePreview> {
  return api.get<BundlePreview>(`/tenant/bundles/${id}/preview`, { ...options })
}

export function fetchBundleRecommendations(
  productId: number,
  options: RecommendationOptions = {},
): Promise<BundleRecommendationsPayload> {
  return api.get<BundleRecommendationsPayload>('/tenant/bundles/recommendations', {
    product_id: productId,
    ...options,
  })
}

export function explainBundleRecommendation(payload: {
  product_id: number
  partner_product_id: number
  store_id?: number
}): Promise<RecommendationExplanation> {
  return api.post<RecommendationExplanation>('/tenant/bundles/recommendations/explain', payload)
}
