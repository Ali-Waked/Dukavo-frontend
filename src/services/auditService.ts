import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { AuditLog } from '@/types/admin'

export interface AuditListParams {
  page?: number
  per_page?: number
  /** Filter by an `action` value; see `fetchAuditActions`. */
  action?: string
  user_id?: number
  /** Machine class of the changed record, e.g. `App\\Models\\Product`. */
  auditable_type?: string
  auditable_id?: number
  /** ISO dates, `YYYY-MM-DD`. Required together. */
  from?: string
  until?: string
  /** Platform trail: `1` includes the tenant-less events (suspensions, role changes). */
  platform?: 1
}

export type AuditBase = 'tenant' | 'platform'

export function fetchAuditLogs(
  params: AuditListParams = {},
  base: AuditBase = 'tenant',
): Promise<Paginated<AuditLog>> {
  return api.list<AuditLog>(`/${base}/audit-logs`, { ...(params as Record<string, unknown>) })
}

export function fetchAuditLog(id: number, base: AuditBase = 'tenant'): Promise<AuditLog> {
  return api.get<AuditLog>(`/${base}/audit-logs/${id}`)
}

/** The distinct actions that occurred, so filters render real values not guesses. */
export function fetchAuditActions(base: AuditBase = 'tenant'): Promise<string[]> {
  return api.get<string[]>(`/${base}/audit-logs/actions`)
}