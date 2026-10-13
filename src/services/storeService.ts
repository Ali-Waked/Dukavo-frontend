import { api } from '@/lib/axiosClient'
import type { StoreStatus } from '@/types/enums'
import type { Store } from '@/types/catalogue'

/**
 * Sales channels. A merchant's default store anchors reporting and the
 * tenant-level currency; the rest are independent channels with their own
 * inventory and pricing.
 */

export interface StorePayload {
  name: string
  slug?: string | null
  status?: StoreStatus
  email?: string | null
  phone?: string | null
  currency?: string
  timezone?: string
  is_default?: boolean
}

export function fetchStores(options: { activeOnly?: boolean } = {}): Promise<Store[]> {
  return api.get<Store[]>('/tenant/stores', { status: options.activeOnly ? 'active' : undefined })
}

export function fetchStore(id: number): Promise<Store> {
  return api.get<Store>(`/tenant/stores/${id}`)
}

export function createStore(payload: StorePayload): Promise<Store> {
  return api.post<Store>('/tenant/stores', payload)
}

export function updateStore(id: number, payload: Partial<StorePayload>): Promise<Store> {
  return api.patch<Store>(`/tenant/stores/${id}`, payload)
}

export function deleteStore(id: number): Promise<void> {
  return api.delete<void>(`/tenant/stores/${id}`)
}

/** Promote a store to the tenant's default — the anchor for aggregated reports. */
export function makeDefaultStore(id: number): Promise<Store> {
  return api.post<Store>(`/tenant/stores/${id}/default`)
}