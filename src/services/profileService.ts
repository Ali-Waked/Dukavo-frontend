import { api } from '@/lib/axiosClient'
import type {
  NotificationPreferences,
  Profile,
  ProfileSession,
  UpdateProfilePayload,
} from '@/types/profile'

/**
 * The signed-in user's own account.
 *
 * Every call here acts on the caller (`/profile`, never `/users/{id}`), so the
 * service has no id parameters to pass and nothing to get wrong. Components
 * call these; nothing else touches `/profile/*`.
 */

const PATHS = {
  profile: '/profile',
  avatar: '/profile/avatar',
  password: '/profile/password',
  sessions: '/profile/sessions',
  notifications: '/profile/notifications',
} as const

export function fetchProfile(): Promise<Profile> {
  return api.get<Profile>(PATHS.profile)
}

/** Update the fields a user owns: name, phone and interface language. */
export function updateProfile(payload: UpdateProfilePayload): Promise<Profile> {
  return api.patch<Profile>(PATHS.profile, payload)
}

/**
 * Replace the avatar.
 *
 * The file is sent as multipart under the `avatar` field; axios sets the
 * boundary itself, so no content-type is forced here.
 */
export function uploadAvatar(file: File): Promise<Profile> {
  const body = new FormData()
  body.append('avatar', file)

  return api.post<Profile>(PATHS.avatar, body)
}

/** Remove the current avatar. A no-op when none is set. */
export function removeAvatar(): Promise<Profile> {
  return api.delete<Profile>(PATHS.avatar)
}

/**
 * Change the password. The backend proves the current password and signs every
 * other device out as a side effect, so callers should tell the user that.
 */
export function updatePassword(payload: {
  current_password: string
  password: string
  password_confirmation: string
}): Promise<void> {
  return api.put<void>(PATHS.password, payload)
}

export function fetchSessions(): Promise<ProfileSession[]> {
  return api.get<ProfileSession[]>(PATHS.sessions)
}

/** Sign one other device out. The current session has no revoke affordance. */
export function revokeSession(id: number | string): Promise<void> {
  return api.delete<void>(`${PATHS.sessions}/${id}`)
}

/**
 * Sign every other device out. The backend keeps the caller's own token, so the
 * device in hand stays signed in.
 */
export function revokeOtherSessions(): Promise<void> {
  return api.delete<void>(PATHS.sessions)
}

/** The resolved switch set — stored values merged over the model's defaults. */
export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return api.get<NotificationPreferences>(PATHS.notifications)
}

export function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  return api.put<NotificationPreferences>(PATHS.notifications, preferences)
}
