<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Eye, EyeOff } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * Self-serve signup for the Free plan.
 *
 * The backend supports this end to end — Fortify registration returns a usable
 * bearer token, and onboarding provisions the first workspace atomically — so
 * this form is the only missing piece. It collects the account and the
 * workspace together, then hands both to the store.
 *
 * A stable `Idempotency-Key` is minted once per visit and reused across retries
 * so a double-submit or a dropped response cannot create a second workspace.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const { t } = useI18n()
const { loading, store } = useAuth()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const workspaceName = ref('')
const storeName = ref('')
const showPassword = ref(false)

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)

/** Reused for every retry of this visit, so provisioning is idempotent. */
const idempotencyKey = newIdempotencyKey()

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `signup-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function validate(): boolean {
  const errors: Record<string, string> = {}

  if (!name.value.trim()) {
    errors.name = t('validation.required')
  }

  if (!email.value.trim()) {
    errors.email = t('validation.required')
  } else if (!EMAIL_PATTERN.test(email.value.trim())) {
    errors.email = t('validation.email')
  }

  if (!password.value) {
    errors.password = t('validation.required')
  } else if (password.value.length < MIN_PASSWORD_LENGTH) {
    errors.password = t('auth.passwordMin', { min: String(MIN_PASSWORD_LENGTH) })
  }

  if (passwordConfirmation.value !== password.value) {
    errors.password_confirmation = t('validation.passwordMismatch')
  }

  if (!workspaceName.value.trim()) {
    errors.workspace_name = t('validation.required')
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return t('auth.networkError')
    if (error.status === 429) return t('auth.rateLimited')
    if (error.fields) {
      const first = Object.values(error.fields)[0]?.[0]
      if (first) return first
    }
    return error.message || t('auth.unexpectedError')
  }
  return t('auth.unexpectedError')
}

async function submit(): Promise<void> {
  formError.value = null
  if (!validate()) return

  try {
    await store.register(
      {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        password_confirmation: passwordConfirmation.value,
        workspace_name: workspaceName.value.trim(),
        store_name: storeName.value.trim() || undefined,
      },
      idempotencyKey,
    )
    await router.replace('/dashboard')
  } catch (error) {
    formError.value = describe(error)
  }
}
</script>

<template>
  <div class="surface p-6 shadow-xs sm:p-8">
    <header class="mb-6">
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('auth.registerTitle') }}</h1>
      <p class="mt-1.5 text-body text-muted">{{ t('auth.registerSubtitle') }}</p>
    </header>

    <BaseAlert v-if="formError" tone="danger" class="mb-4" role="alert">
      {{ formError }}
    </BaseAlert>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="name"
        name="name"
        autocomplete="name"
        :label="t('common.name')"
        :error="fieldErrors.name"
        required
      />

      <BaseInput
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        :label="t('common.email')"
        :error="fieldErrors.email"
        required
      />

      <BaseInput
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        name="password"
        autocomplete="new-password"
        :label="t('common.password')"
        :error="fieldErrors.password"
        required
      >
        <template #suffix>
          <button
            type="button"
            class="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </template>
      </BaseInput>

      <BaseInput
        v-model="passwordConfirmation"
        :type="showPassword ? 'text' : 'password'"
        name="password_confirmation"
        autocomplete="new-password"
        :label="t('auth.confirmPassword')"
        :error="fieldErrors.password_confirmation"
        required
      />

      <hr class="border-line" />

      <BaseInput
        v-model="workspaceName"
        name="workspace_name"
        autocomplete="organization"
        :label="t('auth.workspaceName')"
        :placeholder="t('auth.workspaceNamePlaceholder')"
        :error="fieldErrors.workspace_name"
        required
      />

      <BaseInput
        v-model="storeName"
        name="store_name"
        :label="t('auth.storeName')"
        :hint="t('auth.storeNameHint')"
      />

      <BaseButton type="submit" block :loading="loading">
        {{ loading ? t('auth.creatingAccount') : t('auth.createAccount') }}
      </BaseButton>
    </form>

    <p class="mt-6 text-center text-small text-muted">
      {{ t('auth.haveAccount') }}
      {{ ' ' }}
      <RouterLink to="/login" class="font-medium text-brand-ink underline-offset-4 hover:underline">
        {{ t('auth.signInLink') }}
      </RouterLink>
    </p>
  </div>
</template>
