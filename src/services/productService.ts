import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { ProductStatus } from '@/types/enums'
import type { Product, ProductImage } from '@/types/catalogue'

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
    /** Present when editing an existing variant, so it is updated in place
     *  rather than deleted and recreated (which would drop its inventory). */
    id?: number
    name: string
    sku?: string | null
    barcode?: string | null
    price: number
    cost?: number | null
    is_default?: boolean
    /** Opening stock, create only. Records an `initial` ledger movement. */
    initial_quantity?: number
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

/* --------------------------------------------------------------- gallery */

/**
 * Upload images to a product. A product is created first (JSON), then its files
 * are posted here in a multipart request — the product must already exist to own
 * its gallery. `altTexts` is index-matched to `files`.
 */
export function uploadProductImages(
  slug: string,
  files: File[],
  altTexts: Array<string | null> = [],
): Promise<ProductImage[]> {
  const form = new FormData()
  files.forEach((file) => form.append('images[]', file))
  altTexts.forEach((text, index) => {
    if (text != null && text !== '') {
      form.append(`alt_text[${index}]`, text)
    }
  })

  return api.post<ProductImage[]>(`/tenant/products/${slug}/images`, form)
}

export function updateProductImage(
  slug: string,
  imageId: number,
  payload: { alt_text?: string | null; is_primary?: boolean; position?: number },
): Promise<ProductImage> {
  return api.patch<ProductImage>(`/tenant/products/${slug}/images/${imageId}`, payload)
}

export function deleteProductImage(slug: string, imageId: number): Promise<void> {
  return api.delete<void>(`/tenant/products/${slug}/images/${imageId}`)
}

export function reorderProductImages(slug: string, ids: number[]): Promise<ProductImage[]> {
  return api.post<ProductImage[]>(`/tenant/products/${slug}/images/reorder`, { images: ids })
}
