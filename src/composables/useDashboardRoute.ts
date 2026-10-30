import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

/**
 * The account's own landing route.
 *
 * This is not always `/dashboard`: a platform operator belongs on the platform
 * overview, an employee without `dashboard.view` belongs in the first section
 * they can open, and an invited or workspace-less account belongs on its status
 * or onboarding page. Reusing the auth resolver means a "go to dashboard"
 * shortcut can never point at a page the guard will immediately refuse.
 */
export function useDashboardRoute(): ComputedRef<RouteLocationRaw> {
  const auth = useAuthStore()

  return computed<RouteLocationRaw>(() => auth.homeDestination)
}
