import { useAuthStore } from '@/stores/authStore'
import type { PermissionSlug } from '@/constants/permissions'

/**
 * Permission checks for the *active tenant*.
 *
 * This is a UX convenience, not a security model: the backend enforces every
 * permission on its own and the UI only shapes what the user sees. `can` usage
 * should therefore decide column visibility, buttons and routes — never
 * sensitive data the server already guards.
 */
export function usePermissions() {
  const store = useAuthStore()

  function can(permission: PermissionSlug | string): boolean {
    return store.can(permission)
  }

  function canAny(permissions: Array<PermissionSlug | string>): boolean {
    return store.anyOf(permissions)
  }

  return { can, canAny }
}