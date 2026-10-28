import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

/**
 * The dashboard that matches the signed-in account's type.
 *
 * A platform operator always lands on the platform overview — that surface is
 * reachable by every platform role, whereas a workspace dashboard depends on
 * tenant-scoped permissions they may not hold. A merchant only ever sees their
 * own workspace dashboard; the platform route is never offered to them.
 *
 * Shared by every surface that offers a "go to dashboard" shortcut so the rule
 * lives in one place.
 */
export function useDashboardRoute(): ComputedRef<RouteLocationRaw> {
  const auth = useAuthStore()

  return computed<RouteLocationRaw>(() =>
    auth.isPlatformUser ? { name: 'platform.dashboard' } : { name: 'dashboard.index' },
  )
}
