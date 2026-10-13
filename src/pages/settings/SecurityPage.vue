<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { KeyRound, LogOut, Monitor } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'
import { useToast } from '@/composables/useToast'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import { ApiError } from '@/lib/axiosClient'
import {
  fetchSessions,
  revokeOtherSessions,
  revokeSession,
  updatePassword,
} from '@/services/profileService'
import type { ProfileSession } from '@/types/profile'
import { formatDate, formatRelative } from '@/utils/format'

/**
 * The Security tab: password and the devices signed in.
 *
 * Changing the password signs every other device out — a real expectation, not
 * a footnote — so the copy says so and the session list is refreshed afterwards.
 * The caller's own session never carries a revoke button, so "sign out other
 * devices" cannot lock the user out of the one they are on.
 */

const { t } = useI18n()
const toast = useToast()

const passwordForm = reactive({
  current_password: '',
  password: '',
  password_confirmation: '',
})
const errors = reactive<Record<string, string>>({})
const generalError = ref<string | null>(null)
const savingPassword = ref(false)

const sessions = ref<ProfileSession[]>([])
const sessionsLoading = ref(true)
const sessionsError = ref<string | null>(null)
const revokingId = ref<number | string | null>(null)
const revokingOthers = ref(false)
const pendingRevoke = ref<ProfileSession | null>(null)
const confirmingRevokeOthers = ref(false)

const otherSessions = computed(() => sessions.value.filter((session) => !session.is_current))

function clearErrors(): void {
  generalError.value = null
  for (const key of Object.keys(errors)) {
    delete errors[key]
  }
}

function captureApiError(error: unknown, fallbackKey: MessageKey): void {
  if (error instanceof ApiError && error.isValidation && error.fields) {
    for (const [field, messages] of Object.entries(error.fields)) {
      if (messages[0]) errors[field] = messages[0]
    }
    return
  }

  generalError.value = error instanceof ApiError ? error.message : t(fallbackKey)
}

async function loadSessions(): Promise<void> {
  sessionsLoading.value = true
  sessionsError.value = null

  try {
    sessions.value = await fetchSessions()
  } catch (error) {
    sessionsError.value = error instanceof ApiError ? error.message : t('security.sessionsFailed')
  } finally {
    sessionsLoading.value = false
  }
}

onMounted(loadSessions)

async function changePassword(): Promise<void> {
  clearErrors()
  savingPassword.value = true

  try {
    await updatePassword({
      current_password: passwordForm.current_password,
      password: passwordForm.password,
      password_confirmation: passwordForm.password_confirmation,
    })

    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
    toast.success(t('security.passwordUpdated'))
    await loadSessions()
  } catch (error) {
    captureApiError(error, 'security.passwordFailed')
  } finally {
    savingPassword.value = false
  }
}

async function confirmRevoke(): Promise<void> {
  const session = pendingRevoke.value
  if (!session) {
    return
  }

  revokingId.value = session.id

  try {
    await revokeSession(session.id)
    sessions.value = sessions.value.filter((entry) => entry.id !== session.id)
    pendingRevoke.value = null
    toast.success(t('security.sessionRevoked'))
  } catch (error) {
    generalError.value = error instanceof ApiError ? error.message : t('security.revokeFailed')
  } finally {
    revokingId.value = null
  }
}

async function confirmRevokeOthers(): Promise<void> {
  revokingOthers.value = true

  try {
    await revokeOtherSessions()
    await loadSessions()
    confirmingRevokeOthers.value = false
    toast.success(t('security.sessionsRevoked'))
  } catch (error) {
    generalError.value = error instanceof ApiError ? error.message : t('security.revokeFailed')
  } finally {
    revokingOthers.value = false
  }
}

function describeSession(session: ProfileSession): string {
  return session.last_used_at
    ? t('security.lastUsed', { time: formatRelative(session.last_used_at) })
    : t('security.neverUsed')
}
</script>

<template>
  <div class="space-y-5">
    <BaseAlert v-if="generalError" tone="danger" dismissible @dismiss="generalError = null">
      {{ generalError }}
    </BaseAlert>

    <!-- Password -->
    <section class="surface p-5" :aria-label="t('security.changePassword')">
      <div class="flex items-start gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <KeyRound class="size-5" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h2 class="text-h4 font-semibold text-ink">{{ t('security.changePassword') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('security.changePasswordDesc') }}</p>
        </div>
      </div>

      <form class="mt-4 max-w-md space-y-4" @submit.prevent="changePassword">
        <BaseInput
          v-model="passwordForm.current_password"
          type="password"
          :label="t('security.currentPassword')"
          :error="errors.current_password"
          autocomplete="current-password"
          required
        />

        <BaseInput
          v-model="passwordForm.password"
          type="password"
          :label="t('security.newPassword')"
          :error="errors.password"
          autocomplete="new-password"
          required
        />

        <BaseInput
          v-model="passwordForm.password_confirmation"
          type="password"
          :label="t('security.confirmPassword')"
          autocomplete="new-password"
          required
        />

        <div class="flex justify-end">
          <BaseButton type="submit" :loading="savingPassword">
            {{ t('security.updatePassword') }}
          </BaseButton>
        </div>
      </form>
    </section>

    <!-- Sessions -->
    <section class="surface p-5" :aria-label="t('security.sessions')">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-h4 font-semibold text-ink">{{ t('security.sessions') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('security.sessionsDesc') }}</p>
        </div>

        <BaseButton
          v-if="otherSessions.length > 0"
          variant="secondary"
          :icon="LogOut"
          :disabled="sessionsLoading"
          @click="confirmingRevokeOthers = true"
        >
          {{ t('security.revokeOthers') }}
        </BaseButton>
      </div>

      <div v-if="sessionsLoading" class="grid place-items-center py-10">
        <BaseSpinner />
      </div>

      <BaseAlert v-else-if="sessionsError" tone="danger" class="mt-4">
        {{ sessionsError }}
      </BaseAlert>

      <ul v-else class="mt-4 divide-y divide-line">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
              <Monitor class="size-5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-sm font-medium text-ink">
                <span class="truncate">{{
                  session.name || t('security.unknownDevice')
                }}</span>
                <span
                  v-if="session.is_current"
                  class="rounded-full bg-success-soft px-2 py-0.5 text-caption font-semibold text-success-ink"
                >
                  {{ t('security.currentSession') }}
                </span>
              </p>
              <p class="mt-0.5 text-small text-muted">
                {{ describeSession(session) }}
                <span v-if="session.created_at">
                  · {{ t('security.signedInOn', { time: formatDate(session.created_at) }) }}
                </span>
              </p>
            </div>
          </div>

          <BaseButton
            v-if="!session.is_current"
            variant="ghost"
            size="sm"
            :loading="revokingId === session.id"
            @click="pendingRevoke = session"
          >
            {{ t('security.revoke') }}
          </BaseButton>
        </li>
      </ul>
    </section>

    <!-- Revoke one -->
    <BaseModal
      :open="pendingRevoke !== null"
      :title="t('security.revokeSessionTitle')"
      size="sm"
      @close="pendingRevoke = null"
    >
      <p class="text-sm text-muted">
        {{ t('security.revokeSessionBody', { name: pendingRevoke?.name || t('security.unknownDevice') }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="revokingId !== null" @click="pendingRevoke = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="revokingId !== null" @click="confirmRevoke">
          {{ t('security.revoke') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Revoke others -->
    <BaseModal
      :open="confirmingRevokeOthers"
      :title="t('security.revokeOthersTitle')"
      size="sm"
      @close="confirmingRevokeOthers = false"
    >
      <p class="text-sm text-muted">{{ t('security.revokeOthersBody') }}</p>

      <template #footer>
        <BaseButton
          variant="secondary"
          :disabled="revokingOthers"
          @click="confirmingRevokeOthers = false"
        >
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="revokingOthers" @click="confirmRevokeOthers">
          {{ t('security.revokeOthers') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
