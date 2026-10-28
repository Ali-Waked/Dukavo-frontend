import type { ProfitLimitation, ProfitMethodology, ProfitPayments, ProfitRefunds } from '@/types/profit'

/**
 * Executive analytics shapes.
 *
 * The server owns every calculation. Nullable figures mean the stored data
 * cannot support the metric; the interface must say so rather than showing a
 * zero that looks like a measurement.
 */

export type AnalyticsDirection = 'up' | 'down' | 'flat'

export interface AnalyticsKpi {
  key: string
  label: string
  value: number
  previous_value: number | null
  change_percent: number | null
  direction: AnalyticsDirection
  unit: 'currency' | 'count' | string
  definition: string
}

export interface AnalyticsContext {
  tenant: string
  currency: string
  timezone: string
  store: { id: number; name: string } | null
}

export interface AnalyticsRange {
  from: string
  until: string
  days: number
  timezone: string
}

export interface AnalyticsComparison {
  from: string
  until: string
  days: number
  timezone: string
}

export interface AnalyticsCustomerRepeat {
  total_customers_with_orders: number
  repeat_customers: number
  repeat_purchase_rate_percent: number
  measurable: boolean
}

export interface AnalyticsProduct {
  product_id: number | null
  name: string
  sku: string | null
  orders: number
  units_sold: number
  revenue: number
  net_sales: number
  gross_profit: number | null
  gross_margin_percent: number | null
  cost_complete: boolean
}

export interface AnalyticsStore {
  store_id: number
  store: string | null
  orders: number
  revenue: number
  average_order_value: number
  gross_profit: number | null
  gross_margin_percent: number | null
  cost_complete: boolean
}

export interface AnalyticsStockItem {
  id: number
  store: string | null
  product_name: string
  sku: string | null
  quantity: number
  reserved_quantity: number
  available: number
  low_stock_threshold: number | null
  status: 'out_of_stock' | 'low_stock' | 'healthy'
}

export interface AnalyticsStockHealth {
  summary: {
    total_items: number
    out_of_stock: number
    low_stock: number
    healthy: number
  }
  items: AnalyticsStockItem[]
  insufficient_data: boolean
}

export interface AnalyticsConversationMetrics {
  measurable: boolean
  reason?: string
  conversations_analyzed?: number
  conversations_with_first_response?: number
  response_rate_percent?: number
  avg_first_response_minutes?: number
  median_first_response_minutes?: number
  min_first_response_minutes?: number
  max_first_response_minutes?: number
}

export interface AnalyticsRecoveryFunnel {
  measurable: boolean
  reason: string | null
  funnel: Array<{ stage: string; count: number }>
  totals: {
    total_opportunities: number
    open_opportunities: number
    recovered: number
    dismissed: number
    expired: number
  }
  open_pipeline_value: number
  recovered_revenue: number
  conversion_rate_percent: number
}

export interface AnalyticsDeliveryMetrics {
  measurable: boolean
  total_messages: number
  by_status: Record<string, number>
  delivered_or_read: number
  failed: number
  delivery_rate_percent: number | null
  failure_rate_percent: number | null
}

export interface AnalyticsFinancialMargin {
  measurable: boolean
  reason: string | null
  summary: {
    net_sales: number
    cogs: number
    gross_profit: number | null
    gross_margin_percent: number | null
    cost_coverage_percent: number | null
    uncosted_units: number
  }
  note: string
}

export interface AnalyticsOverview {
  context: AnalyticsContext
  range: AnalyticsRange
  comparison: AnalyticsComparison
  currency: string
  definitions: Record<string, unknown>
  kpis: AnalyticsKpi[]
  orders_over_time: Array<{ date: string; orders: number }>
  order_status_distribution: Array<{ status: string; count: number; share_percent: number | null }>
  sales_trends: Array<{ date: string; revenue: number; orders: number }>
  customer_repeat_purchase_rate: AnalyticsCustomerRepeat
  product_performance: AnalyticsProduct[]
  store_performance: AnalyticsStore[]
  stock_health: AnalyticsStockHealth
  conversation_response_metrics: AnalyticsConversationMetrics
  sales_recovery_funnel: AnalyticsRecoveryFunnel
  message_delivery_metrics: AnalyticsDeliveryMetrics
  financial_margin: AnalyticsFinancialMargin
  payment_summary: ProfitPayments
  refunds: ProfitRefunds
  limitations: ProfitLimitation[]
  methodology: ProfitMethodology
}

export interface AnalyticsParams {
  from?: string
  until?: string
  store_id?: number
  currency?: string
  product_limit?: number
}
