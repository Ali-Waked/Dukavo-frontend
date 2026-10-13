import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { Inventory, InventoryMovement } from '@/types/catalogue'

/**
 * Stock.
 *
 * Two different questions are answered by two different endpoints and are kept
 * separate here on purpose: `adjust` sets an absolute quantity, `receive` adds
 * a purchase movement. Getting them the wrong way round would silently corrupt
 * the ledger, so the payload types say which is which.
 */

export interface InventoryListParams {
  page?: number
  per_page?: number
  store_id?: number
  product_variant_id?: number
  low_stock?: boolean
}

export function fetchInventory(params: InventoryListParams = {}): Promise<Paginated<Inventory>> {
  return api.list<Inventory>('/tenant/inventory', { ...(params as Record<string, unknown>) })
}

export function fetchLowStock(params: Omit<InventoryListParams, 'low_stock'> = {}): Promise<Paginated<Inventory>> {
  return api.list<Inventory>('/tenant/inventory/low-stock', { ...(params as Record<string, unknown>) })
}

export function fetchMovements(
  inventoryId: number,
  params: { page?: number; per_page?: number } = {},
): Promise<Paginated<InventoryMovement>> {
  return api.list<InventoryMovement>(`/tenant/inventory/${inventoryId}/movements`, {
    ...(params as Record<string, unknown>),
  })
}

/** Set the on-hand quantity for a variant in a store. */
export interface AdjustStockPayload {
  store_id: number
  product_variant_id: number
  quantity: number
  note?: string
}

export function adjustStock(payload: AdjustStockPayload): Promise<InventoryMovement> {
  return api.post<InventoryMovement>('/tenant/inventory/adjust', payload)
}

/** Record a purchase arriving into stock. */
export interface ReceiveStockPayload extends AdjustStockPayload {
  low_stock_threshold?: number
}

export function receiveStock(payload: ReceiveStockPayload): Promise<InventoryMovement> {
  return api.post<InventoryMovement>('/tenant/inventory/receive', payload)
}
