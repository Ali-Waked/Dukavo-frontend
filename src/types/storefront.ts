import type { OrderStatus, PaymentStatus } from './enums'

/**
 * Public shopfront contracts.
 *
 * These mirror `App\Http\Resources\Storefront\*` exactly. They are deliberately
 * separate from the merchant catalogue types: a shopper never receives cost,
 * internal ids or other stores' stock, so reusing the admin types would imply
 * fields the public API does not send.
 */

export interface StorefrontSocialLinks {
  facebook?: string | null
  instagram?: string | null
  tiktok?: string | null
}

export interface StorefrontSettings {
  tagline?: string | null
  about?: string | null
  hero_image_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  whatsapp_number?: string | null
  address?: string | null
  social?: StorefrontSocialLinks
  opening_hours?: string | null
  delivery_note?: string | null
  return_policy?: string | null
  show_out_of_stock?: boolean
  meta_title?: string | null
  meta_description?: string | null
}

export interface PublicStorefront {
  name: string
  slug: string
  tenant_slug: string
  description?: string | null
  logo_url?: string | null
  email?: string | null
  phone?: string | null
  currency: string
  currency_symbol?: string | null
  currency_decimals?: number | null
  timezone?: string | null
  settings: StorefrontSettings
}

export interface PublicCategory {
  slug: string
  name: string
  description?: string | null
  products_count: number
}

export interface PublicProductVariant {
  id: number
  name: string
  sku?: string | null
  price: number
  is_default: boolean
  available: number
  in_stock: boolean
}

export interface PublicProductImage {
  url: string
  alt_text?: string | null
  is_primary?: boolean
}

export interface PublicProduct {
  slug: string
  name: string
  description?: string | null
  price: number
  currency: string
  is_taxable: boolean
  in_stock: boolean
  available: number
  category?: { slug: string; name: string } | null
  images?: PublicProductImage[]
  variants: PublicProductVariant[]
  created_at?: string | null
}

export type PublicProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name'

export interface PublicProductFilters {
  page?: number
  per_page?: number
  search?: string
  category?: string
  sort?: PublicProductSort
}

export interface ShippingZone {
  id: number
  name: string
  city?: string | null
  areas: string[]
  fee: number
  free_shipping_threshold?: number | null
  is_active: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface ShippingZonePayload {
  name: string
  city?: string | null
  areas?: string[] | null
  fee: number
  free_shipping_threshold?: number | null
  is_active?: boolean
  sort_order?: number
}

export type PaymentMethodCode = 'cod' | 'online'

export interface PaymentMethodOption {
  code: PaymentMethodCode
  label: string
  description: string
  available: boolean
  unavailable_reason?: string | null
}

export interface StorePaymentSettings {
  cod_enabled: boolean
  cod_instructions?: string | null
}

export interface StorePaymentResponse {
  settings: StorePaymentSettings
  methods: PaymentMethodOption[]
}

export interface MerchantStorefrontSettings {
  store_id: number
  name: string
  slug: string
  status: string
  description?: string | null
  logo_url?: string | null
  storefront_enabled: boolean
  currency: string
  settings: StorefrontSettings
  updated_at?: string | null
}

export interface MerchantStorefrontPayload {
  storefront_enabled?: boolean
  description?: string | null
  logo_url?: string | null
  settings?: StorefrontSettings
}

export interface StorefrontCheckoutItem {
  product_variant_id: number
  quantity: number
}

export interface StorefrontShippingAddress {
  contact_name?: string | null
  line_one: string
  line_two?: string | null
  city: string
  state?: string | null
  postal_code?: string | null
  country: string
}

export interface StorefrontCheckoutPayload {
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  area?: string | null
  notes?: string | null
  payment_method: PaymentMethodCode
  idempotency_key: string
  shipping_address: StorefrontShippingAddress
  items: StorefrontCheckoutItem[]
}

export interface PublicOrderItem {
  name: string
  sku?: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export interface PublicOrder {
  order_number: string
  status: OrderStatus
  status_label: string
  payment_status: PaymentStatus
  payment_status_label: string
  payment_method?: PaymentMethodCode | null
  payment_method_label?: string | null
  subtotal: number
  discount_total: number
  tax_total: number
  shipping_total: number
  grand_total: number
  currency: string
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  shipping_address?: StorefrontShippingAddress | Record<string, unknown> | null
  items?: PublicOrderItem[]
  store?: {
    name: string
    slug: string
    email?: string | null
    phone?: string | null
  } | null
  placed_at?: string | null
  /** Only present on the response to the checkout that created the order. */
  tracking_token?: string
}

/** A cart line is a local estimate; the server reprices every line on checkout. */
export interface StorefrontCartLine {
  variantId: number
  productSlug: string
  productName: string
  variantName: string
  unitPrice: number
  quantity: number
  currency: string
  imageUrl?: string | null
  available: number
  sku?: string | null
}
