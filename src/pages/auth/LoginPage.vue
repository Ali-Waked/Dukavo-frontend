<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * Sign-in.
 *
 * Errors are classified before they are shown: a 401/422 is "your credentials",
 * a 429 is "slow down", a transport failure is "we never reached the server".
 * Server-side field errors are bound to the inputs they belong to instead of
 * being flattened into one banner.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { store: auth } = useAuth()

const email = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)

const expired = computed(() => route.query.reason === 'expired')
const loading = computed(() => auth.loading)

function validate(): boolean {
  const errors: Record<string, string> = {}

  if (!email.value.trim()) {
    errors.email = t('validation.required')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errors.email = t('validation.email')
  }

  if (!password.value) {
    errors.password = t('validation.required')
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return t('auth.networkError')
    if (error.status === 401 || error.status === 422) return t('auth.invalidCredentials')
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
    await auth.login(email.value.trim(), password.value, remember.value)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    formError.value = describe(error)
    password.value = ''
  }
}
</script>

<template>
  <div class="surface p-6 shadow-xs sm:p-8">
    <header class="mb-6">
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('auth.signIn') }}</h1>
      <p class="mt-1.5 text-body text-muted">{{ t('auth.signInSubtitle') }}</p>
    </header>

    <BaseAlert v-if="expired" tone="warning" class="mb-4">
      {{ t('auth.sessionExpired') }}
    </BaseAlert>

    <BaseAlert v-if="formError" tone="danger" class="mb-4" role="alert">
      {{ formError }}
    </BaseAlert>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        :label="t('auth.emailLabel')"
        :placeholder="t('auth.emailPlaceholder')"
        :error="fieldErrors.email"
        required
      />

      <BaseInput
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        name="password"
        autocomplete="current-password"
        :label="t('auth.passwordLabel')"
        :placeholder="t('auth.passwordPlaceholder')"
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

      <div class="flex items-center justify-between gap-3">
        <BaseCheckbox v-model="remember" :label="t('auth.remember')" />
        <RouterLink
          to="/auth/forgot-password"
          class="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
        >
          {{ t('auth.forgotPassword') }}
        </RouterLink>
      </div>

      <BaseButton type="submit" block :loading="loading">
        {{ loading ? t('auth.signingIn') : t('auth.signIn') }}
      </BaseButton>
    </form>
  </div>
</template>