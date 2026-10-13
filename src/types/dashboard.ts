/**
 * Dashboard aggregates.
 *
 * Every figure here is computed in SQL on the server. The frontend formats and
 * renders them — it never derives, rounds into existence, or compares them on
 * its own behalf, because it has no way to know what the backend counts.
 */

export interface DashboardSummary {
  revenue_today: number
  orders_today: number
  average_order_value: number
  revenue_month: number
  orders_month: number
  open_conversations: number
  low_stock_items: number
  active_customers: number
  awaiting_fulfilment: number
}

export interface RevenuePoint {
  date: string
  total: number
  orders: number
}

export interface TopProduct {
  product_id: number
  product_slug: string | null
  name: string
  sku: string | null
  units: number
  revenue: number
}

export interface DeadStockItem {
  id: number
  name: string
  sku: string | null
  stock: number
}

export interface DashboardContext {
  tenant: string
  currency: string
  timezone: string
}

/** `GET /dashboard` — context plus headline figures in one round trip. */
export interface DashboardOverview {
  context: DashboardContext
  summary: DashboardSummary
}
