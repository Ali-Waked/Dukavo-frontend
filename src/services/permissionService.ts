import { api } from '@/lib/axiosClient'
import type { PermissionIndex } from '@/types/admin'

/**
 * The permission catalogue.
 *
 * Unlike every other endpoint this one is *not* tenant-scoped: it answers with
 * the whole product's permission registry so role editors can render every
 * checkbox the backend will actually enforce.
 */

export function fetchPermissionIndex(): Promise<PermissionIndex> {
  return api.get<PermissionIndex>('/permissions')
}