import type { OrderStatus, PaymentStatus } from '@/types/enums'

/**
 * Profit intelligence shapes.
 *
 * Nullable money is deliberate: the backend returns null when the stored data
 * cannot support a figure. The UI must render that as "not available", never as
 * zero, because zero is a claim about the business.
 */

export type ProfitLimitationCode =
  | 'payment_amounts_not_recorded'
  | 'refund_amounts_not_recorded'
  | 'shipping_cost_not_recorded'
  | 'operating_costs_not_recorded'
  | 'historical_cost_incomplete'

export interface ProfitLimitation {
  code: ProfitLimitationCode
  severity: 'warning' | 'info'
  affects: string[]
}

export interface ProfitMethodology {
  revenue_recognition: string
  gross_sales: string
  net_sales: string
  cogs: string
  gross_profit: string
  gross_margin: string
  tax_treatment: string
  shipping_treatment: string
  cost_source: string
  currency: string
  timezone: string
  excluded_order_statuses: OrderStatus[]
  excluded_payment_statuses: PaymentStatus[]
}

export interface ProfitRange {
  from: string
  until: string
  days: number
  timezone: string
}

export interface ProfitSummary {
  total_orders: number
  recognized_orders: number
  gross_sales: number
  discounts: number
  net_sales: number
  tax_collected: number
  shipping_revenue: number
  recognized_order_value: number
  average_order_value: number | null
  units_sold: number
  cogs: number
  cost_complete: boolean
  uncosted_units: number
  uncosted_net_sales: number
  cost_coverage_percent: number | null
  gross_profit: number | null
  gross_margin_percent: number | null
  shipping_cost: null
  operating_costs: null
  net_profit: null
  cancelled_orders: number
  cancelled_order_value: number
  cancellation_rate_percent: number | null
  refunded_orders: number
  refunded_order_value: number
}

export interface ProfitSeriesPoint {
  date: string
  orders: number
  gross_sales: number
  discounts: number
  net_sales: number
  cogs: number
  gross_profit: number | null
  cost_complete: boolean
}

export interface ProfitProduct {
  product_id: number | null
  name: string
  sku: string | null
  orders: number
  units: number
  gross_sales: number
  discounts: number
  net_sales: number
  cogs: number
  uncosted_units: number
  uncosted_net_sales: number
  cost_complete: boolean
  gross_profit: number | null
  gross_margin_percent: number | null
}

export interface ProfitStore {
  store_id: number
  store: string | null
  orders: number
  net_sales: number
  cogs: number
  cost_complete: boolean
  gross_profit: number | null
  gross_margin_percent: number | null
  average_order_value: number
}

export interface ProfitStatusBreakdown {
  status: OrderStatus
  orders: number
  recognized_orders: number
  order_value: number
  net_sales: number
  share_percent: number | null
}

export interface ProfitPaymentStatusBreakdown {
  payment_status: PaymentStatus
  orders: number
  recognized_orders: number
  order_value: number
}

export interface ProfitPayments {
  marked_paid_value: number
  unpaid_value: number
  unpaid_orders: number
  partially_paid_value: number
  partially_paid_orders: number
  refunded_order_value: number
  collected_payments: null
  outstanding_amount: number | null
  statuses: ProfitPaymentStatusBreakdown[]
}

export interface ProfitRefunds {
  refunded_orders: number
  refunded_order_value: number
  refund_rate_percent: number | null
  refund_amount_recorded: false
}

export interface ProfitIntelligenceResponse {
  currency: string
  currencies: string[]
  range: ProfitRange
  summary: ProfitSummary
  series: ProfitSeriesPoint[]
  products: ProfitProduct[]
  stores: ProfitStore[]
  statuses: ProfitStatusBreakdown[]
  payments: ProfitPayments
  refunds: ProfitRefunds
  methodology: ProfitMethodology
  limitations: ProfitLimitation[]
}

export interface ProfitIntelligenceParams {
  store_id?: number
  currency?: string
  from?: string
  until?: string
  product_limit?: number
}
