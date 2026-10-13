import { api } from '@/lib/axiosClient'
import type { Category } from '@/types/catalogue'

/**
 * Categories.
 *
 * The list endpoint returns a flat, ordered set of top-level categories; the
 * tree endpoint returns the nested shape the category manager renders. They
 * answer different questions, so both exist rather than one being shaped to
 * fit both.
 */

export interface CategoryPayload {
  name: string
  slug?: string
  parent_id?: number | null
  description?: string | null
  is_active?: boolean
  sort_order?: number
}

/** The answer to "can I use this slug?" from the category form. */
export interface CategorySlugAvailability {
  slug: string
  available: boolean
}

export function fetchCategories(options: { includeInactive?: boolean } = {}): Promise<Category[]> {
  return api.get<Category[]>('/tenant/categories', {
    include_inactive: options.includeInactive ? 1 : undefined,
  })
}

/** Nested categories, for the tree editor and for cascading selects. */
export function fetchCategoryTree(options: { includeInactive?: boolean } = {}): Promise<Category[]> {
  return api.get<Category[]>('/tenant/categories/tree', {
    include_inactive: options.includeInactive ? 1 : undefined,
  })
}

export function fetchCategory(id: number): Promise<Category> {
  return api.get<Category>(`/tenant/categories/${id}`)
}

export function createCategory(payload: CategoryPayload): Promise<Category> {
  return api.post<Category>('/tenant/categories', payload)
}

export function updateCategory(id: number, payload: Partial<CategoryPayload>): Promise<Category> {
  return api.patch<Category>(`/tenant/categories/${id}`, payload)
}

export function deleteCategory(id: number): Promise<void> {
  return api.delete<void>(`/tenant/categories/${id}`)
}

/**
 * Live slug check for the category form. `ignore` is the id of the category
 * being edited, so its own slug does not read as taken.
 */
export function checkCategorySlug(slug: string, ignore?: number): Promise<CategorySlugAvailability> {
  return api.get<CategorySlugAvailability>('/tenant/categories/slug-availability', { slug, ignore })
}
