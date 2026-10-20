import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  login as loginRequest,
  logout as logoutRequest,
  fetchSession,
} from '@/services/authService'
import { setAccessToken, setTenantSlug } from '@/lib/axiosClient'
import type { Session } from '@/types/auth'

/**
 * The signed-in identity, and the boot flow that produces it.
 *
 * Ownership rules, kept deliberately strict:
 *  - This store owns the *session*, the client owns the *credential* it attaches.
 *    On refresh the store reads the saved token, hands it to the client, and
 *    re-fetches `me`; the two never disagree because only one persists a secret.
 *  - Permissions are the active tenant's set, refreshed on every tenant switch.
 *    `can()` answers UX questions only — the backend is the actual boundary.
 */

const TOKEN_KEY = 'dukavo.token'

/**
 * Sentinel used by the workspace switcher for "no workspace" — the platform
 * context. It is never sent to the server: entering platform mode clears the
 * tenant header entirely.
 */
export const PLATFORM_WORKSPACE = '__platform__'

/**
 * The tenant slug last switched into.
 *
 * The backend never infers a tenant for a user with several memberships (or a
 * platform operator) — those callers *must* send `X-Tenant` on every
 * tenant-scoped request. Persisting the choice is what keeps it alive across a
 * page refresh, where an in-memory value would be gone and every dashboard
 * request would be refused with "No tenant could be resolved".
 */
const TENANT_KEY = 'dukavo.tenant'

/**
 * Where the bearer token lives.
 *
 * "Keep me signed in" is a real distinction here, not a label: unchecked means
 * the token is written to `sessionStorage` and dies with the tab, checked means
 * it survives a browser restart. Both paths are read on bootstrap, so restoring
 * a session never depends on which one was chosen.
 */
function persistToken(token: string, remember: boolean): void {
  if (remember) {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.setItem(TOKEN_KEY, token)
  }
}

function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

function forgetToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function persistTenant(slug: string | null): void {
  if (slug) {
    localStorage.setItem(TENANT_KEY, slug)
  } else {
    localStorage.removeItem(TENANT_KEY)
  }
}

function readTenantSlug(): string | null {
  return localStorage.getItem(TENANT_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const loading = ref(false)
  /** True once bootstrap or login has been attempted — the router waits for this. */
  const initialised = ref(false)

  const isAuthenticated = computed(() => session.value !== null)
  const isPlatformUser = computed(() => session.value?.user.is_platform_user ?? false)
  const user = computed(() => session.value?.user ?? null)
  const tenants = computed(() => session.value?.tenants ?? [])
  const activeTenant = computed(() => session.value?.active_tenant ?? null)
  const permissions = computed(() => new Set(session.value?.permissions ?? []))

  /**
   * True when a platform operator is *not* inside any workspace. This is the
   * context that renders Dukavo's own administration; a platform operator who
   * has explicitly opened a workspace sees that merchant's tools instead.
   */
  const isPlatformMode = computed(() => isPlatformUser.value && activeTenant.value === null)

  const roles = computed(() => {
    const activeId = activeTenant.value?.id ?? null
    return session.value?.roles.find((entry) => entry.tenant_id === activeId)?.roles ?? []
  })

  function applySession(next: Session): void {
    session.value = next
  }

  async function fetchMe(): Promise<Session> {
    const next = await fetchSession()
    applySession(next)
    return next
  }

  /**
   * Re-read the session from the server and fold it back into the store.
   *
   * Used after an action that changes how the user is described (editing their
   * own name or avatar). `me` is the single source of truth for identity, so
   * refreshing through it keeps the topbar and every other consumer in step
   * rather than letting each patched copy drift.
   */
  async function refreshSession(): Promise<Session> {
    return fetchMe()
  }

  async function login(email: string, password: string, remember = true): Promise<void> {
    loading.value = true
    try {
      const { token } = await loginRequest({ email, password })
      if (!token) {
        throw new Error('Sign-in succeeded without a token.')
      }
      setAccessToken(token)
      persistToken(token, remember)

      // Re-attach a remembered workspace before booting: `me` reports the
      // active tenant from X-Tenant. A platform operator with no remembered
      // workspace stays in platform mode, which is the whole point of keeping
      // the two dashboards apart.
      setTenantSlug(readTenantSlug())

      const next = await fetchMe()

      if (next.user.is_platform_user) {
        // Platform operators land on the platform overview unless they had
        // deliberately opened a workspace on their last visit.
        if (next.active_tenant === null) {
          persistTenant(null)
        }
      } else {
        // Always land inside a tenant: the remembered choice when the account
        // still holds it, otherwise the first membership. Without one, every
        // tenant-scoped request (dashboard, orders, customers) goes out without
        // an X-Tenant header and the backend refuses it.
        const pick =
          next.tenants.find((entry) => entry.slug === readTenantSlug()) ?? next.tenants[0]
        if (pick) {
          await switchTenant(pick.slug)
        }
      }
    } finally {
      loading.value = false
      initialised.value = true
    }
  }

  async function switchTenant(slug: string): Promise<Session> {
    setTenantSlug(slug)
    const next = await fetchMe()
    persistTenant(slug)
    return next
  }

  /**
   * Leave the active workspace and return to the platform context. Only a
   * platform operator has one to return to; any other caller would lose its
   * tenant and be refused by every scoped request.
   */
  async function enterPlatformMode(): Promise<Session> {
    setTenantSlug(null)
    persistTenant(null)
    return fetchMe()
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest()
    } catch {
      // The session is gone client-side regardless; a failed remote logout is
      // not worth blocking the user on.
    } finally {
      clear()
    }
  }

  function clear(): void {
    setAccessToken(null)
    setTenantSlug(null)
    persistTenant(null)
    session.value = null
    forgetToken()
  }

  /** Restore a session after a page refresh. Safe to call repeatedly. */
  async function bootstrap(): Promise<void> {
    if (initialised.value) {
      return
    }

    const saved = readToken()
    if (!saved) {
      initialised.value = true
      return
    }

    setAccessToken(saved)

    // Re-attach the remembered tenant *before* booting: `me` reports the
    // active tenant from X-Tenant, and every tenant-scoped call after it
    // needs the same header.
    const savedSlug = readTenantSlug()
    if (savedSlug) {
      setTenantSlug(savedSlug)
    }

    loading.value = true
    try {
      const next = await fetchMe()

      // The remembered slug no longer resolves (access revoked, tenant
      // removed) or there never was one: fall back to the first membership so
      // the app still boots with a tenant in context. A platform operator has
      // a deliberate platform context to boot into instead, so it is left
      // alone and starts on the platform overview.
      if (!next.active_tenant && !next.user.is_platform_user && next.tenants.length > 0 && next.tenants[0]) {
        await switchTenant(next.tenants[0].slug)
      }
    } catch {
      clear()
    } finally {
      loading.value = false
      initialised.value = true
    }
  }

  /**
   * True when the active context grants `permission`.
   *
   * This is exactly the set the backend enforces: platform operators answer
   * with their platform role's permissions (a super admin holds every slug, a
   * dukavo-admin only its deliberate subset), so the UI never offers an action
   * the API would refuse.
   */
  function can(permission: string): boolean {
    return permissions.value.has(permission)
  }

  /** True when any of the requested permissions is granted. */
  function anyOf(list: string[]): boolean {
    return list.some((permission) => can(permission))
  }

  return {
    session,
    loading,
    initialised,
    isAuthenticated,
    isPlatformUser,
    isPlatformMode,
    user,
    tenants,
    activeTenant,
    permissions,
    roles,
    login,
    logout,
    bootstrap,
    refreshSession,
    switchTenant,
    enterPlatformMode,
    clear,
    can,
    anyOf,
  }
})