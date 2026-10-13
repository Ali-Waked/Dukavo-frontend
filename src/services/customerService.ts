import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { CustomerStatus } from '@/types/enums'
import type { Customer } from '@/types/commerce'

export interface CustomerListParams {
  page?: number
  per_page?: number
  search?: string
  status?: CustomerStatus | ''
  store_id?: number
}

export interface CustomerPayload {
  name: string
  email?: string | null
  phone?: string | null
  status?: CustomerStatus
  locale?: string | null
  notes?: string | null
  store_id?: number | null
}

export function fetchCustomers(params: CustomerListParams = {}): Promise<Paginated<Customer>> {
  return api.list<Customer>('/tenant/customers', { ...(params as Record<string, unknown>) })
}

export function fetchCustomer(id: number): Promise<Customer> {
  return api.get<Customer>(`/tenant/customers/${id}`)
}

export function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return api.post<Customer>('/tenant/customers', payload)
}

export function updateCustomer(id: number, payload: Partial<CustomerPayload>): Promise<Customer> {
  return api.patch<Customer>(`/tenant/customers/${id}`, payload)
}

export function deleteCustomer(id: number): Promise<void> {
  return api.delete<void>(`/tenant/customers/${id}`)
}
