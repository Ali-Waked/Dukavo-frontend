import { apiOrigin, httpClient } from '@/lib/axiosClient'

/**
 * Backend liveness probe.
 *
 * `GET /api/health` sits *outside* the `/api/v1` namespace and returns a bare
 * object with no envelope, so it deliberately bypasses the normal helpers. It
 * is only ever used to decide whether a friendly "cannot reach the server"
 * screen beats a white one.
 */

export interface BackendHealth {
  status: 'ok'
  application: string
  laravel: string
  php: string
  environment: string
  time: string
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const { data } = await httpClient.get<BackendHealth>('/api/health', {
    baseURL: apiOrigin || '/',
    withCredentials: true,
    timeout: 8000,
  })

  return data
}