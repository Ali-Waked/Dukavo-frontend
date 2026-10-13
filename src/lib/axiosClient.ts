import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { currentLocale } from '@/i18n'
import type { ApiFailure, ApiSuccess, Paginated } from '@/types/api'

/**
 * The single HTTP client for the whole application.
 *
 * Nothing else in the codebase constructs an axios instance or imports
 * `axios` directly. Components call a service, services call through here, and
 * everything about *how* a request is made — base URL, credentials, the tenant
 * header, error shapes, session loss — is decided in one place.
 *
 *   Component → Pinia store → service → this client → Laravel
 *
 * Two pieces of server contract are encoded here and nowhere else:
 *
 *   1. The envelope. Every response is `{ success, message?, data, meta? }`,
 *      so the public helpers unwrap it once and services only ever see their
 *      own payload type.
 *   2. Session/CSRF handling. `statefulApi()` means Sanctum treats first-party
 *      requests as stateful, so CSRF is validated on every call, not just on
 *      login. The cookie is primed before the first request and re-primed once
 *      automatically if the token rotates underneath us (419).
 */

/* -------------------------------------------------------------------------
 * Credentials
 * ---------------------------------------------------------------------- */

let accessToken: string | null = null
let tenantSlug: string | null = null

/**
 * Attach or clear the bearer token on every subsequent request.
 *
 * The client deliberately does not own persistence: the auth store decides
 * where a session lives, so a credential never has two competing sources of
 * truth.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

/**
 * The tenant every scoped request resolves into. Sent as `X-Tenant`, which the
 * server accepts only when the caller actually holds a role there — a forged
 * value widens nothing, but keeping it correct here keeps it out of services.
 */
export function setTenantSlug(slug: string | null): void {
  tenantSlug = slug
}

/* -------------------------------------------------------------------------
 * Session loss
 * ---------------------------------------------------------------------- */

type UnauthorizedHandler = () => void

const unauthorizedHandlers = new Set<UnauthorizedHandler>()

/**
 * Register a callback for "the server no longer recognises this session".
 *
 * The client cannot import the router or the auth store — that would make the
 * dependency cycle permanent — so the store subscribes to this instead and owns
 * what happens, which is to clear state and return to the sign-in screen.
 *
 * @returns an unsubscribe function.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler)
  return () => unauthorizedHandlers.delete(handler)
}

/* -------------------------------------------------------------------------
 * CSRF
 * ---------------------------------------------------------------------- */

/** URL of Sanctum's cookie endpoint, resolved against the API base. */
function csrfCookieUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'

  // A relative base means the API is served from this origin (dev proxy or
  // same-host production), so the Sanctum route sits next to it.
  if (!/^https?:\/\//i.test(base)) {
    return '/sanctum/csrf-cookie'
  }

  return new URL('/sanctum/csrf-cookie', base).toString()
}

let csrfPrime: Promise<void> | null = null

/**
 * Fetch a fresh XSRF cookie, collapsing concurrent callers onto one request.
 * Safe to call repeatedly — the endpoint is cheap and idempotent.
 */
export function ensureCsrfToken(): Promise<void> {
  csrfPrime ??= axios
    .get(csrfCookieUrl(), {
      withCredentials: true,
      withXSRFToken: true,
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      // Cleared so a later 419 can ask for a new token rather than reusing a
      // resolved promise.
      setTimeout(() => {
        csrfPrime = null
      }, 0)
    })

  return csrfPrime
}

/* -------------------------------------------------------------------------
 * Errors
 * ---------------------------------------------------------------------- */

/**
 * A normalised failure. Components branch on `status` and `fields` rather than
 * on axios internals, so a transport change never reaches the UI layer.
 */
export class ApiError extends Error {
  /** HTTP status; `0` when the request never reached the server. */
  readonly status: number
  /** Field-keyed validation messages from a 422, ready to bind to inputs. */
  readonly fields: Record<string, string[]> | null
  /** Machine-readable code from a business-rule refusal (409). */
  readonly code: string | null
  readonly isNetworkError: boolean

  constructor(
    message: string,
    status: number,
    options: {
      fields?: Record<string, string[]> | null
      code?: string | null
      isNetworkError?: boolean
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = options.fields ?? null
    this.code = options.code ?? null
    this.isNetworkError = options.isNetworkError ?? false
  }

  /** True when the server refused for a validation reason, not a transport one. */
  get isValidation(): boolean {
    return this.status === 422 && this.fields !== null
  }
}

/** Human fallbacks, used only when the server supplies no message of its own. */
const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'The request could not be completed.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.",
  404: "We couldn't find what you were looking for.",
  409: 'This change conflicts with the current state.',
  422: 'Some of the details need attention.',
  429: 'Too many requests. Please slow down and try again shortly.',
  500: 'Something went wrong on our end. Please try again.',
  502: 'The service is temporarily unavailable.',
  503: 'The service is temporarily unavailable.',
  504: 'The request took too long. Please try again.',
}

export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection and try again."

function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError(NETWORK_ERROR_MESSAGE, 0, { isNetworkError: true })
    }

    const { status, data } = error.response as { status: number; data?: unknown }
    const envelope =
      data && typeof data === 'object'
        ? (data as Partial<ApiSuccess<unknown>> & { errors?: Record<string, string[]>; code?: string | null })
        : null

    const message = envelope?.message || FALLBACK_MESSAGES[status] || 'The request could not be completed.'

    return new ApiError(message, status, {
      fields: (envelope?.errors as Record<string, string[]> | undefined) ?? null,
      code: envelope?.code ?? null,
    })
  }

  return new ApiError('Something went wrong. Please try again.', 500)
}

/* -------------------------------------------------------------------------
 * Instance
 * ---------------------------------------------------------------------- */

export const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
})

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  if (tenantSlug) {
    config.headers['X-Tenant'] = tenantSlug
  }

  // The interface language, advertised on every request so the API can answer
  // with localised text (validation messages, dates) when it wants to. The
  // standard HTTP header keeps the backend contract plain and cache-friendly.
  config.headers['Accept-Language'] = currentLocale.value

  return config
})

/** Distinguishes "we have already re-primed CSRF for this request" from "we haven't". */
type RetriableConfig = InternalAxiosRequestConfig & { __csrfRetried?: boolean }

httpClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.response) {
      throw normalise(error)
    }

    const status = error.response.status

    // The session token rotated between requests — refresh it and replay once.
    // A second failure is a real answer, not something to retry into.
    if (status === 419) {
      const config = error.config as RetriableConfig | undefined

      if (config && !config.__csrfRetried) {
        config.__csrfRetried = true
        await ensureCsrfToken()
        return httpClient.request(config)
      }
    }

    if (status === 401) {
      accessToken = null
      for (const handler of unauthorizedHandlers) {
        handler()
      }
    }

    throw normalise(error)
  },
)

/* -------------------------------------------------------------------------
 * Request helpers
 * ---------------------------------------------------------------------- */

type Envelope<T> = ApiSuccess<T>

/**
 * Execute a request and return the envelope's `data`, typed.
 *
 * Services get their payload and nothing else, which is why no service in this
 * codebase ever writes `.data.data`.
 */
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const { data, status } = await httpClient.request<Envelope<T> | string>(config)

  // 204 responses carry no body at all; callers treat that as "nothing to read".
  if (status === 204 || data === '' || data == null) {
    return null as T
  }

  const body: Envelope<T> = typeof data === 'string' ? (JSON.parse(data) as Envelope<T>) : data

  // Normally unreachable — the HTTP status already failed — but a 2xx with an
  // explicit failure envelope should still surface as an error rather than
  // being silently treated as a payload.
  const failure = body as unknown as Partial<ApiFailure>
  if (failure.success === false) {
    throw new ApiError(failure.message || 'The request could not be completed.', 400, {
      fields: failure.errors ?? null,
      code: failure.code ?? null,
    })
  }

  return body.data
}

/**
 * Execute a request against a paginated endpoint and return rows plus pager
 * metadata in one object.
 */
async function list<T>(config: AxiosRequestConfig): Promise<Paginated<T>> {
  const { data, status } = await httpClient.request<Envelope<T[]> & Partial<Paginated<T>> | string>(config)

  if (status === 204 || data === '' || data == null) {
    return { data: [], meta: emptyMeta(), links: emptyLinks() }
  }

  const body = typeof data === 'string'
    ? (JSON.parse(data) as Envelope<T[]> & Partial<Paginated<T>>)
    : data

  const rows = body.data ?? []

  if (!('meta' in body) || !body.meta) {
    return { data: rows, meta: emptyMeta(), links: body.links ?? emptyLinks() }
  }

  return {
    data: body.data ?? [],
    meta: body.meta,
    links: body.links ?? emptyLinks(),
  }
}

function emptyMeta(): Paginated<never>['meta'] {
  return {
    current_page: 1,
    from: null,
    last_page: 1,
    links: [],
    path: '',
    per_page: 15,
    to: null,
    total: 0,
  }
}

function emptyLinks(): Paginated<never>['links'] {
  return { first: null, last: null, prev: null, next: null }
}

function omitEmpty(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) {
    return undefined
  }

  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    cleaned[key] = value
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ method: 'GET', url, params: omitEmpty(params), ...config }),

  list: <T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<Paginated<T>> =>
    list<T>({ method: 'GET', url, params: omitEmpty(params), ...config }),

  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ method: 'POST', url, data: body, ...config }),

  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ method: 'PUT', url, data: body, ...config }),

  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ method: 'PATCH', url, data: body, ...config }),

  delete: <T = void>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ method: 'DELETE', url, ...config }),

  /** Escape hatch for responses that do not use the standard envelope. */
  raw: httpClient,
}

export default httpClient
