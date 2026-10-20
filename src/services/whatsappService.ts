import { api } from '@/lib/axiosClient'
import type { WhatsappAccount, WhatsappConfiguration } from '@/types/inbox'

/**
 * WhatsApp channel configuration.
 *
 * These endpoints manage the *connection* to a number. Message traffic itself
 * lives in the conversation inbox like any other channel — WhatsApp is a
 * transport inside Dukavo, not a second product.
 */

export interface WhatsappAccountPayload {
  name: string
  store_id?: number | null
  phone_number_id?: string
  business_account_id?: string
  phone?: string | null
  webhook_verify_token?: string
}

export function fetchAccounts(): Promise<WhatsappAccount[]> {
  return api.get<WhatsappAccount[]>('/tenant/whatsapp-accounts')
}

export function fetchAccount(id: number): Promise<WhatsappAccount> {
  return api.get<WhatsappAccount>(`/tenant/whatsapp-accounts/${id}`)
}

/**
 * The installation's platform-level WhatsApp setup.
 *
 * Booleans and public URLs only — the server has already decided what may leave
 * it, so this can be fetched safely by any viewer of the channel. It is loaded
 * beside the accounts because a channel that sends nothing is otherwise
 * indistinguishable from a healthy one waiting for its first message.
 */
export function fetchConfiguration(): Promise<WhatsappConfiguration> {
  return api.get<WhatsappConfiguration>('/tenant/whatsapp-accounts/configuration')
}

export function createAccount(payload: WhatsappAccountPayload): Promise<WhatsappAccount> {
  return api.post<WhatsappAccount>('/tenant/whatsapp-accounts', payload)
}

export function updateAccount(
  id: number,
  payload: Partial<WhatsappAccountPayload>,
): Promise<WhatsappAccount> {
  return api.patch<WhatsappAccount>(`/tenant/whatsapp-accounts/${id}`, payload)
}

export function deleteAccount(id: number): Promise<void> {
  return api.delete<void>(`/tenant/whatsapp-accounts/${id}`)
}

/** Ask Meta to confirm the webhook handshake for this account. */
export function verifyAccount(id: number): Promise<WhatsappAccount> {
  return api.post<WhatsappAccount>(`/tenant/whatsapp-accounts/${id}/verify`)
}

export function disconnectAccount(id: number): Promise<WhatsappAccount> {
  return api.post<WhatsappAccount>(`/tenant/whatsapp-accounts/${id}/disconnect`)
}
