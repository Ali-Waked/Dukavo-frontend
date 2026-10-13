import { api } from '@/lib/axiosClient'
import type {
  DashboardOverview,
  DashboardSummary,
  DeadStockItem,
  RevenuePoint,
  TopProduct,
} from '@/types/dashboard'

/**
 * Dashboard aggregates.
 *
 * Every figure is produced by the backend in SQL; these functions only fetch
 * and hand it over. Nothing here computes, compares or extrapolates — the UI
 * formats what it is given.
 */

export function fetchOverview(): Promise<DashboardOverview> {
  return api.get<DashboardOverview>('/tenant/dashboard')
}

export function fetchSummary(storeId?: number): Promise<DashboardSummary> {
  return api.get<DashboardSummary>('/tenant/dashboard/summary', { store_id: storeId })
}

/** Daily revenue, oldest first. The server pads empty days with zeroes so the
 *  chart axis stays honest about quiet periods. */
export function fetchRevenue(days = 30, storeId?: number): Promise<RevenuePoint[]> {
  return api.get<RevenuePoint[]>('/tenant/dashboard/revenue', { days, store_id: storeId })
}

export function fetchTopProducts(limit = 5, storeId?: number): Promise<TopProduct[]> {
  return api.get<TopProduct[]>('/tenant/dashboard/top-products', { limit, store_id: storeId })
}

/** Stock that has never sold — the merchant's tie-up of working capital. */
export function fetchDeadStock(limit = 5): Promise<DeadStockItem[]> {
  return api.get<DeadStockItem[]>('/tenant/dashboard/dead-stock', { limit })
}
