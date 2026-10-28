import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type {
  RecoveryContactPayload,
  RecoveryDraft,
  RecoveryListParams,
  RecoveryOpportunity,
  RecoverySummary,
} from '@/types/recovery'

/**
 * Lost-sale recovery.
 *
 * Reads show why an opportunity exists; writes are explicit human decisions.
 * Nothing here sends a message on its own — `contact` only runs when an agent
 * has reviewed the body or template and pressed send.
 */

export interface RecoveryAssignPayload {
  user_id: number | null
}

export function fetchRecoverySummary(): Promise<RecoverySummary> {
  return api.get<RecoverySummary>('/tenant/recovery-opportunities/summary')
}

export function fetchRecoveryOpportunities(
  params: RecoveryListParams = {},
): Promise<Paginated<RecoveryOpportunity>> {
  return api.list<RecoveryOpportunity>('/tenant/recovery-opportunities', {
    ...(params as Record<string, unknown>),
  })
}

export function fetchRecoveryOpportunity(id: number): Promise<RecoveryOpportunity> {
  return api.get<RecoveryOpportunity>(`/tenant/recovery-opportunities/${id}`)
}

export function draftRecoveryReply(
  id: number,
  instruction?: string,
): Promise<RecoveryDraft> {
  return api.post<RecoveryDraft>(`/tenant/recovery-opportunities/${id}/ai-draft`, {
    instruction: instruction?.trim() ? instruction.trim() : undefined,
  })
}

export function contactRecoveryOpportunity(
  id: number,
  payload: RecoveryContactPayload,
): Promise<RecoveryOpportunity> {
  return api.post<RecoveryOpportunity>(`/tenant/recovery-opportunities/${id}/contact`, payload)
}

export function assignRecoveryOpportunity(
  id: number,
  userId: number | null,
): Promise<RecoveryOpportunity> {
  return api.post<RecoveryOpportunity>(`/tenant/recovery-opportunities/${id}/assign`, {
    user_id: userId,
  })
}

export function snoozeRecoveryOpportunity(
  id: number,
  until: string,
): Promise<RecoveryOpportunity> {
  return api.post<RecoveryOpportunity>(`/tenant/recovery-opportunities/${id}/snooze`, { until })
}

export function dismissRecoveryOpportunity(
  id: number,
  reason?: string,
): Promise<RecoveryOpportunity> {
  return api.post<RecoveryOpportunity>(`/tenant/recovery-opportunities/${id}/dismiss`, {
    reason: reason?.trim() ? reason.trim() : undefined,
  })
}

export function optOutRecoveryCustomer(
  id: number,
  reason?: string,
): Promise<RecoveryOpportunity> {
  return api.post<RecoveryOpportunity>(
    `/tenant/recovery-opportunities/${id}/do-not-contact`,
    { reason: reason?.trim() ? reason.trim() : undefined },
  )
}
