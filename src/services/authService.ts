import { api, ensureCsrfToken, setAccessToken, setTenantSlug } from '@/lib/axiosClient'
import type {
  LoginPayload,
  LoginResponse,
  ProvisionedTenant,
  ProvisionTenantPayload,
  RegisterPayload,
  RegisterResponse,
  Session,
} from '@/types/auth'

/**
 * Authentication and the boot sequence.
 *
 * This is the only module that knows how a Dukavo session starts and ends. The
 * auth store calls into it; nothing else touches `/auth/*` or `/me`.
 *
 * Flow on sign-in:
 *   credentials → token → /me (user, roles, permissions, tenants) → tenant chosen
 *
 * `/me` deliberately returns everything in one round trip, so switching tenant
 * later is a client-side decision and never costs another request.
 */

const PATHS = {
  login: '/auth/login',
  register: '/auth/register',
  onboarding: '/onboarding/tenant',
  logout: '/auth/logout',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  requestVerification: '/auth/email-verification-notification',
  me: '/me',
} as const

/**
 * Exchange credentials for a bearer token and hand the token straight to the
 * HTTP client.
 *
 * The CSRF cookie is primed first: Fortify's routes sit behind the `web`
 * middleware group, and Sanctum treats first-party requests as stateful, so a
 * POST without a matching token never reaches the credential check.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  await ensureCsrfToken()

  const data = await api.post<LoginResponse>(PATHS.login, payload)

  if (data.token) {
    setAccessToken(data.token)
  }

  return data
}

/**
 * End the session.
 *
 * Best-effort by design: a sign-out that fails because the session already
 * expired is still a successful sign-out from the user's point of view, so the
 * caller clears local state regardless and this function does not throw.
 */
export async function logout(): Promise<void> {
  try {
    await ensureCsrfToken()
    await api.post(PATHS.logout)
  } finally {
    setAccessToken(null)
    setTenantSlug(null)
  }
}

/** Everything the SPA needs to render navigation, guards and buttons. */
export function fetchSession(): Promise<Session> {
  return api.get<Session>(PATHS.me)
}

/**
 * Create a new merchant account.
 *
 * Like login, this is a stateful first-party POST, so the CSRF cookie is primed
 * first. The account is left token-less here — the store attaches the returned
 * bearer token, then provisions the first workspace.
 */
export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  await ensureCsrfToken()
  return api.post<RegisterResponse>(PATHS.register, payload)
}

/**
 * Provision the account's first workspace.
 *
 * The caller passes a stable `Idempotency-Key` per signup attempt so a
 * double-submitted form or a retry after a dropped response resolves to the
 * workspace already created instead of building a second one.
 */
export async function provisionTenant(
  payload: ProvisionTenantPayload,
  idempotencyKey: string,
): Promise<ProvisionedTenant> {
  await ensureCsrfToken()
  return api.post<ProvisionedTenant>(PATHS.onboarding, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function forgotPassword(email: string): Promise<void> {
  await ensureCsrfToken()
  await api.post(PATHS.forgotPassword, { email })
}

export async function resetPassword(payload: {
  email: string
  token: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await ensureCsrfToken()
  await api.post(PATHS.resetPassword, payload)
}

export async function resendVerification(email: string): Promise<void> {
  await ensureCsrfToken()
  await api.post(PATHS.requestVerification, { email })
}
