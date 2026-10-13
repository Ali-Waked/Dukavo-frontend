import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { TenantStatus } from '@/types/enums'

/**
 * Platform tenancy — available only to platform operators.
 *
 * These routes sit under `/api/v1/platform/*` and require the platform role;
 * the tenant-scoped routes that make up the rest of the application are
 * deliberately not reachable through this service.
 */

export interface PlatformTenant {
  id: number
  name: string
  slug: string
  status: TenantStatus
  status_label?: string
  contact_email?: string | null
  phone?: string | null
  currency: string
  timezone: string
  locale?: string | null
  is_active: boolean
  stores_count?: number
  users_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface PlatformTenantPayload {
  name: string
  slug?: string | null
  contact_email?: string | null
  phone?: string | null
  currency?: string
  timezone?: string
  locale?: string | null
  store_name?: string | null
  settings?: Record<string, unknown>
  owner?: {
    name: string
    email: string
    phone?: string | null
    password?: string | null
    locale?: string | null
  }
}

export interface PlatformTenantMember {
  id: number
  name: string
  email: string
  roles: string[]
}

export function fetchTenants(params: { page?: number; per_page?: number; search?: string } = {}): Promise<
  Paginated<PlatformTenant>
> {
  return api.list<PlatformTenant>('/platform/tenants', { ...(params as Record<string, unknown>) })
}

export function fetchTenant(id: number): Promise<PlatformTenant> {
  return api.get<PlatformTenant>(`/platform/tenants/${id}`)
}

export function createTenant(payload: PlatformTenantPayload): Promise<PlatformTenant> {
  return api.post<PlatformTenant>('/platform/tenants', payload)
}

export function updateTenant(id: number, payload: Partial<PlatformTenantPayload>): Promise<PlatformTenant> {
  return api.patch<PlatformTenant>(`/platform/tenants/${id}`, payload)
}

export function deleteTenant(id: number): Promise<void> {
  return api.delete<void>(`/platform/tenants/${id}`)
}

export function suspendTenant(id: number): Promise<PlatformTenant> {
  return api.post<PlatformTenant>(`/platform/tenants/${id}/suspend`)
}

export function activateTenant(id: number): Promise<PlatformTenant> {
  return api.post<PlatformTenant>(`/platform/tenants/${id}/activate`)
}

export function fetchTenantMembers(id: number): Promise<PlatformTenantMember[]> {
  return api.get<PlatformTenantMember[]>(`/platform/tenants/${id}/members`)
}

/** A counted metric from the platform overview. */
export interface PlatformMetric {
  total: number
  active?: number
  suspended?: number
  platform?: number
  /** Distinct users holding at least one tenant-scoped role. */
  members?: number
  /** Staff only — no workspace membership. */
  platform_only?: number
  /** Workspace members only — no platform role. */
  members_only?: number
  /** People who are both Dukavo staff and a workspace member. */
  both?: number
  pending?: number
  /** Waitlist signups that converted into a real account. */
  joined?: number
  unresolved?: number
  subscribed?: number
  /** Rows created inside the selected window. */
  new?: number
  /** Rows created inside the preceding window of equal length. */
  previous_new?: number
}

/** Windows the overview understands. */
export type PlatformDashboardRangeKey = '7d' | '30d' | '90d' | '12m'

/** The resolved window, echoed back so the UI can label it honestly. */
export interface PlatformDashboardRange {
  key: PlatformDashboardRangeKey
  bucket: 'day' | 'month'
  from: string
  until: string
  previous_from: string
  previous_until: string
}

/** One time-series bucket; empty buckets arrive as zeroes, never omitted. */
export interface PlatformSeriesPoint {
  bucket: string
  tenants: number
  users: number
  waitlist: number
  contact_messages: number
  newsletter_subscribers: number
}

export interface PlatformStatusCount {
  value: string
  count: number
}

/** Plan configuration totals — never a subscriber count. */
export interface PlatformPlanConfig {
  total: number
  active: number
  highlighted: number
}

/** `GET /platform/dashboard` — real Dukavo-wide counts for one window. */
export interface PlatformDashboard {
  range: PlatformDashboardRange
  tenants: PlatformMetric
  users: PlatformMetric
  waitlist: PlatformMetric
  contact_messages: PlatformMetric
  newsletter_subscribers: PlatformMetric
  plans: PlatformPlanConfig
  series: PlatformSeriesPoint[]
  status: {
    tenants: PlatformStatusCount[]
    users: PlatformStatusCount[]
    waitlist: PlatformStatusCount[]
    contact_messages: PlatformStatusCount[]
    newsletter_subscribers: PlatformStatusCount[]
    user_accounts: PlatformStatusCount[]
  }
}

export function fetchPlatformDashboard(
  range: PlatformDashboardRangeKey = '30d',
): Promise<PlatformDashboard> {
  return api.get<PlatformDashboard>('/platform/dashboard', { range })
}