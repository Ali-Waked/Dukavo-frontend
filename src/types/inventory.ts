/**
 * Inventory intelligence shapes.
 *
 * These mirror the arrays returned by `InventoryIntelligenceController`. The
 * forecast fields are intentionally explicit: the UI can show how a number was
 * produced instead of presenting a bare prediction.
 */

export type InventoryIntelligenceStatus =
  | 'healthy'
  | 'low_stock'
  | 'out_of_stock'
  | 'reorder'
  | 'slow_moving'

export type InventoryForecastStatus = 'estimated' | 'insufficient_history'
export type InventoryForecastConfidence = 'low' | 'medium' | 'high'
export type InventoryReorderBasis = 'forecast' | 'threshold' | 'none'
export type InventoryStatusFilter = 'all' | 'low' | 'out' | 'slow' | 'reorder'

export interface InventoryForecast {
  status: InventoryForecastStatus
  daily_demand: number | null
  confidence: InventoryForecastConfidence
  method: 'weighted_recent_average'
  window_days: number
  observed_days: number
  recent_window_days: number
  recent_weight: number
  active_sales_days: number
  net_units_sold: number
  minimum_history_days: number
  notes: string[]
}

export interface InventoryReplenishment {
  needed: boolean
  basis: InventoryReorderBasis
  reorder_point: number | null
  target_stock: number | null
  suggested_quantity: number
  days_of_cover: number | null
  lead_time_days: number
  safety_days: number
  review_period_days: number
}

export interface InventoryIntelligenceItem {
  id: number
  store_id: number
  store: string | null
  product_id: number
  product_variant_id: number
  product_name: string
  variant_name: string | null
  sku: string | null
  currency: string
  quantity: number
  reserved_quantity: number
  available: number
  low_stock_threshold: number | null
  is_low_stock: boolean
  is_out_of_stock: boolean
  is_slow_moving: boolean
  status: InventoryIntelligenceStatus
  unit_cost: number | null
  inventory_value: number | null
  cost_reliable: boolean
  units_sold: number
  stockout_events: number
  last_stockout_at: string | null
  last_sale_at: string | null
  days_since_last_sale: number | null
  age_days: number | null
  forecast: InventoryForecast
  replenishment: InventoryReplenishment
}

export interface InventorySeriesPoint {
  date: string
  sold: number
  returned: number
  on_hand: number | null
}

export interface InventoryValuation {
  currency: string
  value: number
  items: number
}

export interface InventoryIntelligenceSummary {
  items_count: number
  store_count: number
  units_on_hand: number
  units_available: number
  units_reserved: number
  units_sold: number
  low_stock_count: number
  out_of_stock_count: number
  slow_moving_count: number
  reorder_count: number
  forecast_ready_count: number
  stockout_events: number
  valuation: InventoryValuation[]
}

export interface InventoryStoreBreakdown {
  store_id: number
  store: string | null
  currency: string
  items_count: number
  units_available: number
  low_stock_count: number
  out_of_stock_count: number
  reorder_count: number
  inventory_value: number
}

export interface InventoryAnalysisRange {
  from: string
  until: string
  days: number
}

export interface InventoryIntelligenceSettings {
  lead_time_days: number
  safety_days: number
  review_period_days: number
  forecast_window_days: number
  minimum_history_days: number
  slow_moving_days: number
  allow_negative_stock: boolean
}

export interface InventoryIntelligencePagination {
  current_page: number
  per_page: number
  total: number
  last_page: number
  from: number | null
  to: number | null
}

export interface InventoryIntelligenceResponse {
  range: InventoryAnalysisRange
  summary: InventoryIntelligenceSummary
  stores: InventoryStoreBreakdown[]
  items: InventoryIntelligenceItem[]
  pagination: InventoryIntelligencePagination
  settings: InventoryIntelligenceSettings
}

export interface InventoryIntelligenceDetailResponse {
  range: InventoryAnalysisRange
  item: InventoryIntelligenceItem & { series: InventorySeriesPoint[] }
  settings: InventoryIntelligenceSettings
}

export interface InventoryIntelligenceParams {
  store_id?: number
  from?: string
  until?: string
  status?: InventoryStatusFilter
  q?: string
  page?: number
  per_page?: number
}

export interface TransferStockPayload {
  from_store_id: number
  to_store_id: number
  product_variant_id: number
  quantity: number
  note?: string
  idempotency_key?: string
}

export interface StockTransfer {
  id: number
  from_store_id: number
  to_store_id: number
  product_id: number
  product_variant_id: number
  quantity: number
  note: string | null
  from_movement_id: number | null
  to_movement_id: number | null
  from_store?: { id: number; name: string } | null
  to_store?: { id: number; name: string } | null
  product?: { id: number; name: string } | null
  variant?: { id: number; name: string; sku: string | null } | null
  created_at?: string | null
}
