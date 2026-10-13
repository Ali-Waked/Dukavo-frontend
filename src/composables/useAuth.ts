import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

/**
 * Convenience access to the auth store. In a setup component this is the
 * canonical way to read identity without threading props through the tree.
 */
export function useAuth() {
  const store = useAuthStore()
  return { ...storeToRefs(store), store }
}