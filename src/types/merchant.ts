import type { AiUsage } from './ai'

export type MerchantCopilotActionType =
  | 'review_low_stock'
  | 'draft_follow_up'
  | 'review_bundle'
  | 'open_report'
  | 'other'

export interface MerchantCopilotActionPreview {
  label: string
  type: MerchantCopilotActionType
  reason: string
  link_hint: string
}

export interface MerchantCopilotMetricExplanation {
  metric: string
  definition: string
  source: string
}

export interface MerchantCopilotScope {
  store_id: number | null
  store_name: string | null
  currency: string | null
}

export interface MerchantCopilotPeriod {
  from: string | null
  until: string | null
  timezone: string | null
}

export interface MerchantCopilotAnswer {
  answer: string
  period: MerchantCopilotPeriod
  scope: MerchantCopilotScope
  facts_used: string[]
  missing_or_insufficient: string[]
  estimates_and_recommendations: string[]
  metric_explanations: MerchantCopilotMetricExplanation[]
  action_previews: MerchantCopilotActionPreview[]
  data_gaps: string[]
  usage: AiUsage
}

export interface MerchantCopilotRequest {
  question: string
  store_id?: number | null
  from: string
  until: string
}
