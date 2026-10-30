import type { Session } from '@/types/auth'

/**
 * One place that decides where a signed-in account belongs.
 *
 * A destination is derived from the session the server just described — never
 * from the page the visitor happened to be on. That is what stops a merchant
 * from being sent back to the public waitlist after signing in, and what keeps
 * a platform operator out of a tenant dashboard they did not choose.
 *
 * The route guard and the login form both call this, so the answer after a
 * fresh sign-in is identical to the answer after a refresh or a guest was
 * bounced away from `/login`.
 */
export interface AuthDestination {
  name: string
  query?: Record<string, string>
}

/**
 * The tenant sections in preference order.
 *
 * The first permission the account actually holds wins. Choosing the dashboard
 * unconditionally would strand an employee whose role deliberately omits
 * `dashboard.view` on the 403 page, even though they can open orders.
 */
const TENANT_LANDING_ROUTES: ReadonlyArray<{ name: string; permission: string }> = [
  { name: 'dashboard.index', permission: 'dashboard.view' },
  { name: 'orders.index', permission: 'orders.view' },
  { name: 'conversations.index', permission: 'conversations.view' },
  { name: 'customers.index', permission: 'customers.view' },
  { name: 'catalogue.products', permission: 'products.view' },
  { name: 'inventory.index', permission: 'inventory.view' },
  { name: 'recovery.index', permission: 'recovery.view' },
  { name: 'catalogue.categories', permission: 'categories.view' },
  { name: 'stores.index', permission: 'stores.view' },
  { name: 'profit.index', permission: 'profit.view' },
  { name: 'automation.index', permission: 'automation.view' },
  { name: 'whatsapp.index', permission: 'whatsapp.view' },
  { name: 'ai-approvals', permission: 'ai.approve' },
  { name: 'ai-merchant-copilot', permission: 'ai.use' },
  { name: 'users.index', permission: 'users.view' },
  { name: 'roles.index', permission: 'roles.view' },
  { name: 'audit.index', permission: 'audit.view' },
  { name: 'settings.workspace', permission: 'settings.view' },
]

/** Suspended or invited accounts go here instead of a dashboard. */
export const ACCOUNT_STATUS_ROUTE = 'account.status'
export const ONBOARDING_ROUTE = 'onboarding'

function accountStatus(status: 'invited' | 'suspended' | 'tenant-suspended'): AuthDestination {
  return { name: ACCOUNT_STATUS_ROUTE, query: { status } }
}

function isActiveMembership(tenant: Session['tenants'][number]): boolean {
  return tenant.status === 'active' && tenant.is_active !== false
}

function tenantLanding(permissions: string[]): AuthDestination {
  const held = new Set(permissions)

  for (const route of TENANT_LANDING_ROUTES) {
    if (held.has(route.permission)) {
      return { name: route.name }
    }
  }

  // Profile belongs to the person, not the workspace, so it remains a safe
  // landing page for a member whose role has not granted any operational page.
  return { name: 'profile.index' }
}

/**
 * Resolve the account's real destination from the boot payload.
 *
 * Order matters: identity restrictions come before role and workspace routing,
 * because a suspended or not-yet-accepted invitation must not be described as
 * a dashboard problem.
 */
export function resolveAuthDestination(session: Session | null): AuthDestination {
  if (!session) {
    return { name: 'auth.login' }
  }

  if (session.user.status === 'suspended') {
    return accountStatus('suspended')
  }

  if (session.user.status === 'invited') {
    return accountStatus('invited')
  }

  if (session.user.is_platform_user) {
    return { name: 'platform.dashboard' }
  }

  const active = session.active_tenant

  if (active) {
    if (active.status === 'suspended' || active.is_active === false) {
      return accountStatus('tenant-suspended')
    }

    return tenantLanding(session.permissions)
  }

  if (session.tenants.length > 0) {
    // A live membership exists but the boot request did not activate it. The
    // store repairs that on the next fetch; until then, a suspended membership
    // is the only reason a merchant should be held outside a workspace.
    return session.tenants.some(isActiveMembership)
      ? tenantLanding(session.permissions)
      : accountStatus('tenant-suspended')
  }

  return { name: ONBOARDING_ROUTE }
}

/**
 * Reject protocol-relative, absolute, or protocol-bearing redirects.
 *
 * `redirect` arrives in the URL, so it is user-controlled. Only same-origin
 * paths are allowed through; whether the path is an authenticated app route is
 * decided by the router after this check.
 */
export function isSafeInternalRedirect(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const path = value.trim()

  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return false
  }

  return !/[\r\n]/.test(path)
}
