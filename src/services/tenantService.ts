import { api } from '@/lib/axiosClient'
import type { UpdateWorkspaceSettingsPayload, WorkspaceSettings } from '@/types/profile'

/**
 * The active workspace's own settings.
 *
 * The tenant is resolved from the `X-Tenant` header the HTTP client attaches,
 * never from a route id, so this service cannot address a workspace the caller
 * is not currently acting in.
 */

const PATH = '/tenant/settings'

export function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  return api.get<WorkspaceSettings>(PATH)
}

export function updateWorkspaceSettings(
  payload: UpdateWorkspaceSettingsPayload,
): Promise<WorkspaceSettings> {
  return api.patch<WorkspaceSettings>(PATH, payload)
}
