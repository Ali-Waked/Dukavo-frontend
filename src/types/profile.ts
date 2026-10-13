import type { UserStatus } from './enums'

/**
 * The signed-in user's own account, as `ProfileResource` describes it.
 *
 * Deliberately narrower than a `SessionUser`: this is the person, not their
 * place in a workspace. `email` is read-only in the interface (the backend has
 * no endpoint to change it), and `avatar_url` is an absolute link the model
 * builds, so the SPA never guesses which disk or host backs it.
 */
export interface Profile {
  id: number
  name: string
  email: string
  phone: string | null
  locale: string | null
  status: UserStatus
  status_label: string
  avatar_url: string | null
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** Fields a user may change about their own identity. */
export interface UpdateProfilePayload {
  name?: string
  phone?: string | null
  locale?: string | null
}

/** One signed-in client, backed by a Sanctum personal access token. */
export interface ProfileSession {
  id: number | string
  name: string
  last_used_at: string | null
  expires_at: string | null
  created_at: string | null
  is_current: boolean
}

/**
 * The notification catalogue, mirroring `User::NOTIFICATION_CHANNELS`.
 *
 * Only channels and events the backend knows about appear; security notices are
 * deliberately absent because they are always sent.
 */
export const NOTIFICATION_CHANNELS = {
  email: ['order_updates', 'low_stock', 'new_messages', 'weekly_summary', 'product_news'],
  whatsapp: ['order_updates', 'low_stock', 'new_messages'],
} as const

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNELS
export type NotificationEvent = (typeof NOTIFICATION_CHANNELS)[NotificationChannel][number]
export type NotificationPreferences = Record<NotificationChannel, Record<string, boolean>>

/** The workspace fields a merchant may edit about their own tenant. */
export interface WorkspaceSettings {
  id: number
  name: string
  slug: string
  status: string
  status_label: string
  contact_email: string | null
  phone: string | null
  currency: string
  timezone: string
  locale: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

/** Editable subset of {@link WorkspaceSettings}. Slug and status are not offered. */
export interface UpdateWorkspaceSettingsPayload {
  name?: string
  contact_email?: string | null
  phone?: string | null
  currency?: string
  timezone?: string
  locale?: string | null
}
