import { api } from '@/lib/axiosClient'
import type { AnalyticsParams, AnalyticsOverview } from '@/types/analytics'

/** Executive analytics from the server aggregate; the browser never derives totals. */
export function fetchAnalytics(params: AnalyticsParams = {}): Promise<AnalyticsOverview> {
  return api.get<AnalyticsOverview>('/tenant/analytics', {
    ...(params as Record<string, unknown>),
  })
}
