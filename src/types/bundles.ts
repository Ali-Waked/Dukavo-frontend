/**
 * Smart Bundles.
 *
 * A bundle is a merchant-curated set of concrete product variants sold with a
 * discount. Recommendations are a different shape on purpose: they may be a
 * curated bundle *or* a generated two-product suggestion, and they always carry
 * the evidence behind them so the UI never presents a catalogue match as
 * measured demand.
 */

export type BundleStatus = 'draft' | 'active' | 'archived'
export type BundleDiscountType = 'percentage' | 'fixed'

export interface BundleStoreRef {
  id: number
  name: string
  currency: string
}

export interface BundleItemProductRef {
  id: number
  name: string
  slug: string
  status: string
  currency: string
}

export interface BundleItemVariantRef {
  id: number
  name: string
  sku: string | null
  price: number
  is_default: boolean
}

export interface BundleItem {
  id: number
  product_id: number
  product_variant_id: number
  quantity: number
  position: number
  product?: BundleItemProductRef | null
  variant?: BundleItemVariantRef | null
}

export interface Bundle {
  id: number
  store_id: number | null
  name: string
  description: string | null
  status: BundleStatus
  status_label: string
  discount_type: BundleDiscountType
  discount_type_label: string
  discount_value: number
  currency: string
  store?: BundleStoreRef | null
  items?: BundleItem[]
  item_count?: number
  created_at: string | null
  updated_at: string | null
}

export interface BundleItemPayload {
  product_id: number
  product_variant_id: number
  quantity: number
}

export interface BundlePayload {
  name: string
  description?: string | null
  status?: BundleStatus
  discount_type?: BundleDiscountType
  discount_value?: number
  currency?: string
  store_id?: number | null
  items: BundleItemPayload[]
}

export interface BundlePreviewIssue {
  code: string
  message: string
  product_id?: number
  product_variant_id?: number
}

export interface BundlePreviewLine {
  id: number | null
  product_id: number
  product_variant_id: number
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  line_subtotal: number
  available: number
  is_available: boolean
  product: BundleItemProductRef
  variant: BundleItemVariantRef
}

export interface BundlePreview {
  bundle_id: number
  status: BundleStatus
  store: BundleStoreRef | null
  currency: string
  subtotal: number
  discount: number
  total: number
  item_count: number
  is_available: boolean
  issues: BundlePreviewIssue[]
  items: BundlePreviewLine[]
  catalog_fingerprint: string
  generated_at: string
}

export type RecommendationBasis = 'merchant_curated' | 'purchased_together' | 'same_category'
export type RecommendationConfidence = 'curated' | 'measured' | 'rule_based'

export interface RecommendationEvidence {
  basis: RecommendationBasis
  confidence: RecommendationConfidence
  order_count: number | null
  unit_count: number | null
  last_observed_at: string | null
  window_days: number | null
  category?: string | null
}

export interface RecommendationBundleRef {
  id: number
  name: string
  description: string | null
  status: string
  discount_type: BundleDiscountType
  discount_value: number
  currency: string
}

export interface RecommendationLine {
  id: number | null
  product_id: number
  product_variant_id: number
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  line_subtotal: number
  available: number
  is_available: boolean
  product: BundleItemProductRef
  variant: BundleItemVariantRef
}

export interface BundleRecommendation {
  key: string
  kind: 'bundle' | 'suggested'
  source: 'merchant_curated' | 'generated'
  title: string
  description: string | null
  bundle: RecommendationBundleRef | null
  items: RecommendationLine[]
  subtotal: number
  discount: number
  total: number
  currency: string
  is_available: boolean
  issues: BundlePreviewIssue[]
  evidence: RecommendationEvidence
  explanation: string
  catalog_fingerprint: string
}

export interface BundleRecommendationsPayload {
  anchor: {
    product_id: number
    name: string
    slug: string
    currency: string
    category: string | null
  }
  store: BundleStoreRef | null
  recommendations: BundleRecommendation[]
  catalog_fingerprint: string
  generated_at: string
}

export interface RecommendationExplanation {
  evidence: RecommendationEvidence
  explanation: string
  usage: {
    model?: string | null
    input_tokens?: number | null
    output_tokens?: number | null
    total_tokens?: number | null
  } | null
}
