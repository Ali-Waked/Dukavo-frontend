import type { RoleScope, UserStatus } from './enums'

export interface Permission {
  id?: number
  slug: string
  name: string
  module: string
  description?: string
}

export interface Role {
  id: number
  name: string
  slug: string
  scope: RoleScope
  scope_label?: string
  description?: string | null
  is_system: boolean
  requires_tenant: boolean
  permissions?: Permission[]
  permission_slugs?: string[]
}

export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  locale?: string | null
  status: UserStatus
  status_label?: string
  email_verified_at?: string | null
  last_login_at?: string | null
  roles?: Role[]
  tenants?: Array<{ id: number; name: string; slug: string }>
  created_at?: string | null
  updated_at?: string | null
}

export interface AuditLog {
  id: number
  tenant_id?: number | null
  action: string
  action_label: string
  auditable_type?: string | null
  auditable_id?: number | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  ip_address?: string | null
  user?: { id: number; name: string; email: string } | null
  created_at?: string | null
}

/**
 * `permission_catalogue` from `me`: the authoritative list of every permission
 * the product defines, grouped by module. Role editing builds its checkboxes
 * from this rather than from a hardcoded list, so the UI can never offer a
 * permission the backend does not enforce.
 */
export type PermissionCatalogue = Record<string, string[]>

/** `GET /permissions` — the same catalogue plus descriptions, for the role editor. */
export interface PermissionGroup {
  module: string
  permissions: Permission[]
}

export interface PermissionIndex {
  modules: PermissionGroup[]
  slugs: string[]
}
