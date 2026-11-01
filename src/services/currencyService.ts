import { api } from '@/lib/axiosClient'
import type { Store } from '@/types/catalogue'

/**
 * Store base-currency API.
 *
 * Reads are safe; `convert` is the only write and it is explicit, confirmed and
 * idempotent. Rates are fetched by the server, so the SPA never needs a
 * third-party key or a hardcoded quote.
 */

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
  decimals: number
  locale: string
}

export interface CurrencyOptionsResponse {
  default: string
  currencies: CurrencyOption[]
}

export interface CurrencyConversionReceipt {
  id: number
  store_id: number
  from_currency: string
  to_currency: string
  exchange_rate: number
  rate_source: string
  rate_fetched_at: string | null
  status: 'processing' | 'completed' | 'failed'
  products_converted: number
  variants_converted: number
  bundles_converted: number
  failure_reason: string | null
  completed_at: string | null
  created_at: string | null
}

export interface CurrencyPreviewSample {
  id: number
  name: string
  price_before: number
  price_after: number
  cost_before: number
  cost_after: number
}

export interface CurrencyPreview {
  store_id: number
  from_currency: string
  to_currency: string
  rate: number
  rate_source: string
  rate_fetched_at: string
  products: number
  variants: number
  bundles: number
  sample: CurrencyPreviewSample[]
  noop: boolean
}

export interface StoreCurrencyState {
  store: Store
  history: CurrencyConversionReceipt[]
}

export function fetchCurrencyOptions(): Promise<CurrencyOptionsResponse> {
  return api.get<CurrencyOptionsResponse>('/tenant/currencies')
}

export function fetchStoreCurrency(storeId: number): Promise<StoreCurrencyState> {
  return api.get<StoreCurrencyState>(`/tenant/stores/${storeId}/currency`)
}

export function previewStoreCurrency(storeId: number, currency: string): Promise<CurrencyPreview> {
  return api.get<CurrencyPreview>(`/tenant/stores/${storeId}/currency/preview`, { currency })
}

export interface ConvertCurrencyPayload {
  currency: string
  idempotency_key: string
  confirm: true
}

export interface ConvertCurrencyResponse {
  store: Store
  conversion: CurrencyConversionReceipt
}

export function convertStoreCurrency(
  storeId: number,
  payload: ConvertCurrencyPayload,
): Promise<ConvertCurrencyResponse> {
  return api.post<ConvertCurrencyResponse>(`/tenant/stores/${storeId}/currency`, payload)
}

/**
 * A key that survives a retry of the same attempt but differs between attempts.
 *
 * Generated once when the merchant confirms and reused if the request is
 * retried, so a lost response returns the original receipt rather than
 * converting the catalogue twice.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `currency-${crypto.randomUUID()}`
  }

  return `currency-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}
