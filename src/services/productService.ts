import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { ProductStatus } from '@/types/enums'
import type { Product } from '@/types/catalogue'

/**
 * The product catalogue.
 *
 * List parameters mirror `ProductController@index` exactly, including its
 * sort allow-list — passing a `sort` outside `name|price|sku|created_at` is
 * silently ignored by the server, so the type says what is meaningful.
 */

export interface ProductListParams {
  page?: number
  per_page?: number
  search?: string
  /** When omitted the server returns active products only. */
  status?: ProductStatus | ''
  category_id?: number
  store_id?: number
  low_stock?: boolean
  sort?: 'name' | 'price' | 'sku' | 'created_at'
  desc?: boolean
}

/** Payload for creating a product. Variants are optional — the server creates
 *  a default one when the array is absent or empty. */
export interface ProductPayload {
  name: string
  slug?: string
  sku?: string | null
  description?: string | null
  status?: ProductStatus
  price?: number
  cost?: number
  currency?: string
  is_taxable?: boolean
  category_id?: number | null
  store_id?: number | null
  variants?: Array<{
    name: string
    sku?: string | null
    barcode?: string | null
    price: number
    cost?: number | null
    is_default?: boolean
  }>
}

/** The answer to "can I use this slug?" from the product form. */
export interface SlugAvailability {
  slug: string
  available: boolean
}

export function fetchProducts(params: ProductListParams = {}): Promise<Paginated<Product>> {
  return api.list<Product>('/tenant/products', { ...(params as Record<string, unknown>) })
}

/**
 * Products are addressed by slug, matching the merchant-facing URL. Resolving
 * by slug also keeps a foreign tenant's product a plain 404, never a leak.
 */
export function fetchProduct(slug: string): Promise<Product> {
  return api.get<Product>(`/tenant/products/${slug}`)
}

export function createProduct(payload: ProductPayload): Promise<Product> {
  return api.post<Product>('/tenant/products', payload)
}

export function updateProduct(slug: string, payload: Partial<ProductPayload>): Promise<Product> {
  return api.patch<Product>(`/tenant/products/${slug}`, payload)
}

/**
 * Archive (default) or permanently delete.
 *
 * The server refuses a hard delete for any product that has been ordered, so a
 * `BusinessRuleViolation` (409) can surface from here — callers should show its
 * message rather than assume success.
 */
export function deleteProduct(slug: string, options: { force?: boolean } = {}): Promise<void> {
  return api.delete<void>(`/tenant/products/${slug}`, {
    params: options.force ? { force: 1 } : undefined,
  })
}

/**
 * Live slug check for the product form. `ignore` is the id of the product being
 * edited, so its own slug does not read as taken.
 */
export function checkProductSlug(slug: string, ignore?: number): Promise<SlugAvailability> {
  return api.get<SlugAvailability>('/tenant/products/slug-availability', { slug, ignore })
}
