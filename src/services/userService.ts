import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type { UserStatus } from '@/types/enums'
import type { User } from '@/types/admin'

/**
 * Team members.
 *
 * A member holds exactly one primary role per tenant — the backend *replaces*
 * the assignment when `role_id` arrives, it never stacks. That rule lives here
 * in the service contract so the UI does not pretend roles accumulate.
 */

export interface UserListParams {
  page?: number
  per_page?: number
  search?: string
  status?: UserStatus | ''
  role_id?: number
}

export interface UserPayload {
  name: string
  email: string
  phone?: string | null
  /** Omit to invite without a password; the member sets it via the forgot-password flow. */
  password?: string | null
  status?: UserStatus
  locale?: string | null
  role_id: number
  is_owner?: boolean
}

export function fetchUsers(params: UserListParams = {}): Promise<Paginated<User>> {
  return api.list<User>('/tenant/users', { ...(params as Record<string, unknown>) })
}

export function fetchUser(id: number): Promise<User> {
  return api.get<User>(`/tenant/users/${id}`)
}

export function createUser(payload: UserPayload): Promise<User> {
  return api.post<User>('/tenant/users', payload)
}

export function updateUser(id: number, payload: Partial<UserPayload>): Promise<User> {
  return api.patch<User>(`/tenant/users/${id}`, payload)
}

export function deleteUser(id: number): Promise<void> {
  return api.delete<void>(`/tenant/users/${id}`)
}