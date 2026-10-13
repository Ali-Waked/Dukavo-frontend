<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CheckCircle2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { resetPassword } from '@/services/authService'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * Set a new password from a mailed token.
 *
 * The token arrives in the query string; a missing or stale one is surfaced as
 * a clear "link expired" state with a route back to requesting a new one,
 * because a blank form after a click is indistinguishable from a broken app.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const password = ref('')
const confirmation = ref('')
const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const loading = ref(false)
const done = ref(false)

const missingToken = computed(() => !token.value || !email.value)

function validate(): boolean {
  const errors: Record<string, string> = {}

  if (!password.value) {
    errors.password = t('validation.required')
  } else if (password.value.length < 8) {
    errors.password = t('validation.passwordMin')
  }

  if (!confirmation.value) {
    errors.password_confirmation = t('validation.required')
  } else if (confirmation.value !== password.value) {
    errors.password_confirmation = t('validation.passwordMatch')
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit(): Promise<void> {
  formError.value = null
  if (!validate()) return

  loading.value = true
  try {
    await resetPassword({
      email: email.value,
      token: token.value,
      password: password.value,
      password_confirmation: confirmation.value,
    })
    done.value = true
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) {
      formError.value = t('auth.networkError')
    } else if (error instanceof ApiError && (error.status === 401 || error.status === 404 || error.status === 419)) {
      formError.value = t('error.unauthorizedBody')
    } else if (error instanceof ApiError && error.fields) {
      const mapped: Record<string, string> = {}
      for (const [field, messages] of Object.entries(error.fields)) {
        if (messages[0]) mapped[field] = messages[0]
      }
      fieldErrors.value = mapped
      formError.value = t('validation.fixFields')
    } else {
      formError.value = t('error.title')
    }
  } finally {
    loading.value = false
  }
}

async function goToLogin(): Promise<void> {
  await router.push('/auth/login')
}
</script>

<template>
  <div class="surface p-6 shadow-xs sm:p-8">
    <template v-if="done">
      <div class="flex flex-col items-center text-center">
        <span
          class="mb-4 grid size-12 place-items-center rounded-xl bg-success-soft text-success-ink ring-1 ring-success-border"
        >
          <CheckCircle2 class="size-6" aria-hidden="true" />
        </span>
        <h1 class="text-h1 font-semibold tracking-tight text-ink">
          {{ t('auth.updatePassword') }}
        </h1>
        <p class="mt-2 text-body text-muted">{{ t('auth.passwordUpdated') }}</p>
        <BaseButton class="mt-6" @click="goToLogin">
          {{ t('auth.backToSignIn') }}
        </BaseButton>
      </div>
    </template>

    <template v-else-if="missingToken">
      <header class="mb-4">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">
          {{ t('auth.resetPassword') }}
        </h1>
      </header>
      <BaseAlert tone="danger">
        {{ t('error.unauthorizedBody') }}
      </BaseAlert>
      <p class="mt-5 text-center">
        <RouterLink
          to="/auth/forgot-password"
          class="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
        >
          {{ t('auth.sendResetLink') }}
        </RouterLink>
      </p>
    </template>

    <template v-else>
      <header class="mb-6">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">
          {{ t('auth.newPassword') }}
        </h1>
        <p class="mt-1.5 text-body text-muted">{{ t('auth.newPasswordSubtitle') }}</p>
      </header>

      <BaseAlert v-if="formError" tone="danger" class="mb-4" role="alert">
        {{ formError }}
      </BaseAlert>

      <form class="space-y-4" novalidate @submit.prevent="submit">
        <BaseInput
          v-model="password"
          type="password"
          name="password"
          autocomplete="new-password"
          :label="t('auth.passwordLabel')"
          :placeholder="t('auth.passwordPlaceholder')"
          :hint="t('validation.passwordMin')"
          :error="fieldErrors.password"
          required
        />

        <BaseInput
          v-model="confirmation"
          type="password"
          name="password_confirmation"
          autocomplete="new-password"
          :label="t('auth.confirmPassword')"
          :error="fieldErrors.password_confirmation"
          required
        />

        <BaseButton type="submit" block :loading="loading">
          {{ t('auth.updatePassword') }}
        </BaseButton>
      </form>

      <p class="mt-6 text-center">
        <RouterLink
          to="/auth/login"
          class="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
        >
          {{ t('auth.backToSignIn') }}
        </RouterLink>
      </p>
    </template>
  </div>
</template>