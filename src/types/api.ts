/**
 * Shared API transport types.
 *
 * Dukavo answers every request through one envelope, defined once by
 * {@link \App\Support\ApiResponse} on the server:
 *
 *   success  { success: true,  message?, data, meta? }
 *   failure  { success: false, message,  errors?, code? }
 *
 * Resource collections differ only in that `data` is a list and pagination
 * metadata rides alongside it. Typing the envelope here means no service ever
 * re-describes it, and a change on the server surfaces as a compile error
 * rather than an `undefined` at runtime.
 */

export interface ApiSuccess<T> {
  success: true
  message?: string
  data: T
  meta?: ApiMeta
}

export interface ApiFailure {
  success: false
  message: string
  /** Field-keyed messages, present on 422 responses. */
  errors?: Record<string, string[]>
  /** Machine-readable code, present on business-rule refusals (409). */
  code?: string | null
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

/**
 * Laravel's paginator metadata, as it arrives on `meta` of a paginated
 * response. `links` inside it are the clickable page entries; the top-level
 * `links` on {@link Paginated} are the URL pointers.
 */
export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  links: Array<{ url: string | null; label: string; active: boolean }>
  path: string
  per_page: number
  to: number | null
  total: number
}

export interface PaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}

/** Free-form envelope metadata; paginated responses type theirs specifically. */
export type ApiMeta = Record<string, unknown>

/**
 * What a paginated endpoint returns once the envelope is unwrapped: the rows
 * plus everything needed to drive a pager.
 */
export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
  links: PaginationLinks
}

export interface Health {
  status: string
  application: string
  laravel: string
  php: string
  environment: string
  time: string
}

/** Shape returned by Laravel API resources. */
export interface ApiResource<T> {
  data: T
}

/** Query parameters every list endpoint understands. */
export interface ListParams {
  page?: number
  per_page?: number
  search?: string
  sort?: string
  desc?: boolean | 0 | 1
}
