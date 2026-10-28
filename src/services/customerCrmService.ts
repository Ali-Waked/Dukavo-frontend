import { api } from '@/lib/axiosClient'

export interface CustomerMemory {
  id: number
  customer_id: number
  key: string
  value: string
  category: string
  source: string
  confidence: number | null
  meta: Record<string, unknown> | null
  expires_at: string | null
  review_at: string | null
  created_by?: { id: number; name: string } | null
  updated_by?: { id: number; name: string } | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CustomerSummary {
  id: number
  customer_id: number
  summary: string
  highlights: string[]
  risks: string[]
  opportunities: string[]
  source_context: Record<string, unknown>
  model: string | null
  is_edited: boolean
  generated_by?: { id: number; name: string } | null
  edited_by?: { id: number; name: string } | null
  edited_at?: string | null
  refreshed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CustomerTimelineItem {
  id: string
  type: string
  timestamp: string | null
  data: Record<string, unknown>
}

export interface CustomerOverview {
  customer: any
  stats: {
    orders_count: number
    paid_orders_count?: number
    total_spent: number
    average_order_value?: number
    currency?: string | null
    last_order_at: string | null
    last_interaction_at: string | null
  }
  summary: CustomerSummary
  last_interaction_at: string | null
}

export function fetchCustomerOverview(customerId: number): Promise<CustomerOverview> {
  return api.get<CustomerOverview>(`/tenant/customers/${customerId}/crm/overview`)
}

export function fetchCustomerTimeline(customerId: number, limit = 50): Promise<{ items: CustomerTimelineItem[] }> {
  return api.get<{ items: CustomerTimelineItem[] }>(`/tenant/customers/${customerId}/crm/timeline`, { limit })
}

export function fetchCustomerSummary(customerId: number): Promise<CustomerSummary> {
  return api.get<CustomerSummary>(`/tenant/customers/${customerId}/crm/summary`)
}

export function refreshCustomerSummary(customerId: number): Promise<CustomerSummary> {
  return api.post<CustomerSummary>(`/tenant/customers/${customerId}/crm/summary/refresh`)
}

export function updateCustomerSummary(customerId: number, payload: Partial<CustomerSummary>): Promise<CustomerSummary> {
  return api.patch<CustomerSummary>(`/tenant/customers/${customerId}/crm/summary`, payload)
}

export function fetchCustomerMemories(customerId: number): Promise<CustomerMemory[]> {
  return api.get<CustomerMemory[]>(`/tenant/customers/${customerId}/memories`)
}

export function createCustomerMemory(customerId: number, payload: Partial<CustomerMemory>): Promise<CustomerMemory> {
  return api.post<CustomerMemory>(`/tenant/customers/${customerId}/memories`, payload)
}

export function updateCustomerMemory(customerId: number, memoryId: number, payload: Partial<CustomerMemory>): Promise<CustomerMemory> {
  return api.patch<CustomerMemory>(`/tenant/customers/${customerId}/memories/${memoryId}`, payload)
}

export function deleteCustomerMemory(customerId: number, memoryId: number): Promise<void> {
  return api.delete<void>(`/tenant/customers/${customerId}/memories/${memoryId}`)
}
