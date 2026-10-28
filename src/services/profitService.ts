import { api } from '@/lib/axiosClient'
import type { ProfitIntelligenceParams, ProfitIntelligenceResponse } from '@/types/profit'

/** Financial reporting. One service feeds both the screen and the CSV. */
export function fetchProfitIntelligence(
  params: ProfitIntelligenceParams = {},
): Promise<ProfitIntelligenceResponse> {
  return api.get<ProfitIntelligenceResponse>('/tenant/profit', {
    ...(params as Record<string, unknown>),
  })
}

export interface ProfitExport {
  blob: Blob
  filename: string | null
}

/** Download the filtered, order-level report as a spreadsheet-safe CSV. */
export async function exportProfitIntelligence(
  params: ProfitIntelligenceParams = {},
): Promise<ProfitExport> {
  const response = await api.raw.get<Blob>('/tenant/profit/export', {
    params,
    responseType: 'blob',
  })

  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = /filename="?([^";]+)"?/i.exec(disposition)

  return { blob: response.data, filename: match?.[1] ?? null }
}
