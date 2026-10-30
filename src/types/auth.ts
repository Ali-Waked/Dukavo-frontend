import type { UserStatus } from './enums'

/** The tenant a request is scoped to, as reported by the boot endpoint. */
export interface ActiveTenant {
  id: number
  name: string
  slug: string
  status?: 'active' | 'suspended'
  is_active?: boolean
  currency: string
  timezone: string
  locale: string | null
}

/** A tenant the signed-in user may switch into. */
export interface TenantMembership {
  id: number
  name: string
  slug: string
  status: string
  status_label?: string
  contact_email?: string | null
  phone?: string | null
  currency: string
  timezone: string
  locale: string | null
  is_active?: boolean
  created_at?: string | null
}

/**
 * Roles and permissions held in one tenant. `me` returns this per tenant so a
 * tenant switch never needs a second round trip.
 */
export interface TenantRoles {
  tenant_id: number
  slug: string
  roles: string[]
  permissions: string[]
}

/** The signed-in user as the boot endpoint describes them. */
export interface SessionUser {
  id: number
  name: string
  email: string
  phone?: string | null
  locale?: string | null
  status: UserStatus
  is_platform_user: boolean
  is_super_admin: boolean
  avatar_url?: string | null
  email_verified_at?: string | null
  last_login_at?: string | null
}

/** `GET /api/v1/me` — everything the SPA needs to boot. */
export interface Session {
  user: SessionUser
  active_tenant: ActiveTenant | null
  tenants: TenantMembership[]
  roles: TenantRoles[]
  permissions: string[]
  permission_catalogue: Record<string, string[]>
}

/** `POST /api/v1/auth/login` — the credential exchange. */
export interface LoginResponse {
  user: { id: number; name: string; email: string; locale?: string | null } | null
  token: string | null
  token_type: string
}

export interface LoginPayload {
  email: string
  password: string
}

/** `POST /api/v1/onboarding/tenant` — the account's first workspace. */
export interface ProvisionTenantPayload {
  name: string
  store_name?: string
}

/** The tenant resource onboarding returns once the workspace exists. */
export interface ProvisionedTenant {
  id: number
  name: string
  slug: string
  currency?: string
  timezone?: string
  locale?: string | null
}
