import { api } from '@/lib/axiosClient'
import type { RoleScope } from '@/types/enums'
import type { Role } from '@/types/admin'

/**
 * Roles.
 *
 * Permission syncing goes through `PATCH /roles/{role}` with a `permissions`
 * array: the controller routes it into `RoleService::updateRole`, which refuses
 * anything that would unbuild a system role. The dedicated
 * `PUT /roles/{role}/permissions` route is not used because the backend
 * registers it without a controller method to back it.
 *
 * The same controller backs both contexts — `base: 'tenant'` resolves the
 * workspace team routes, `base: 'platform'` resolves the platform catalogue. In
 * platform mode there is no tenant context, so the index returns every role and
 * the guards refuse writes to platform roles by anyone but a platform operator.
 *
 * Assigning a role to a person is a *user* operation (`role_id` on create/update);
 * there is no separate contract for it here.
 */

export interface RolePayload {
  name: string
  scope: RoleScope
  description?: string | null
  permissions?: string[]
}

export type RolesBase = 'tenant' | 'platform'

export function fetchRoles(
  options: { scope?: RoleScope | ''; search?: string } = {},
  base: RolesBase = 'tenant',
): Promise<Role[]> {
  return api.get<Role[]>(`/${base}/roles`, {
    scope: options.scope || undefined,
    search: options.search || undefined,
  })
}

export function fetchRole(id: number, base: RolesBase = 'tenant'): Promise<Role> {
  return api.get<Role>(`/${base}/roles/${id}`)
}

export function createRole(payload: RolePayload, base: RolesBase = 'tenant'): Promise<Role> {
  return api.post<Role>(`/${base}/roles`, payload)
}

export function updateRole(
  id: number,
  payload: Partial<RolePayload>,
  base: RolesBase = 'tenant',
): Promise<Role> {
  return api.patch<Role>(`/${base}/roles/${id}`, payload)
}

/** Replace a role's permission set. System roles answer with a 409. */
export function syncRolePermissions(
  id: number,
  permissionSlugs: string[],
  base: RolesBase = 'tenant',
): Promise<Role> {
  return api.patch<Role>(`/${base}/roles/${id}`, { permissions: permissionSlugs })
}

export function deleteRole(id: number, base: RolesBase = 'tenant'): Promise<void> {
  return api.delete<void>(`/${base}/roles/${id}`)
}