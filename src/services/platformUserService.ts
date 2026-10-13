import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { UserStatus } from '@/types/enums'
import type { User } from '@/types/admin'

/**
 * Platform staff — Dukavo's own accounts.
 *
 * These routes sit under `/api/v1/platform/users` and require the platform
 * role plus `users.manage` for writes. A platform user is any account holding
 * a *platform scoped* role; tenant members are managed through the workspace
 * team endpoints instead. The backend refuses to attach a tenant role to a
 * platform account, and it never lets the last active super administrator be
 * suspended or stripped — both refusals surface here as business-rule errors.
 *
 * There is deliberately no "delete": suspending is done through `status` on
 * update, mirroring the team endpoints' keep-the-audit-trail policy.
 */

export interface PlatformUserListParams {
  page?: number
  per_page?: number
  search?: string
  status?: UserStatus | ''
  role_id?: number
}

export interface PlatformUserPayload {
  name: string
  email: string
  phone?: string | null
  /** Blank invites without a password; the member sets it via forgot-password. */
  password?: string | null
  locale?: string | null
  /** Platform scoped role only — the backend refuses tenant roles with a 422. */
  role_id: number
  status?: UserStatus
}

export function fetchPlatformUsers(params: PlatformUserListParams = {}): Promise<Paginated<User>> {
  return api.list<User>('/platform/users', { ...(params as Record<string, unknown>) })
}

export function fetchPlatformUser(id: number): Promise<User> {
  return api.get<User>(`/platform/users/${id}`)
}

export function createPlatformUser(payload: PlatformUserPayload): Promise<User> {
  return api.post<User>('/platform/users', payload)
}

export function updatePlatformUser(id: number, payload: Partial<PlatformUserPayload>): Promise<User> {
  return api.patch<User>(`/platform/users/${id}`, payload)
}

/** Individual role operations, so the last-super-admin guards can refuse loudly. */
export function assignPlatformRole(userId: number, roleId: number): Promise<{ role: string }> {
  return api.post<{ role: string }>(`/platform/users/${userId}/roles/${roleId}`)
}

export function revokePlatformRole(userId: number, roleId: number): Promise<void> {
  return api.delete<void>(`/platform/users/${userId}/roles/${roleId}`)
}