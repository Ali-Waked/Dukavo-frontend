<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { MailCheck } from '@/components/icons'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import { forgotPassword } from '@/services/authService'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * Password reset request.
 *
 * The success message is deliberately identical whether or not the address has
 * an account — telling an anonymous visitor "no such user" turns the reset form
 * into a user-enumeration oracle.
 */

const { t } = useI18n()

const email = ref('')
const fieldError = ref<string | null>(null)
const formError = ref<string | null>(null)
const loading = ref(false)
const sent = ref(false)

const canResend = computed(() => !loading.value)

async function submit(): Promise<void> {
  formError.value = null
  fieldError.value = null

  if (!email.value.trim()) {
    fieldError.value = t('validation.required')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    fieldError.value = t('validation.email')
    return
  }

  loading.value = true
  try {
    await forgotPassword(email.value.trim())
    sent.value = true
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) {
      formError.value = t('auth.networkError')
    } else if (error instanceof ApiError && error.status === 429) {
      formError.value = t('auth.rateLimited')
    } else if (error instanceof ApiError && error.fields?.email?.[0]) {
      fieldError.value = error.fields.email[0]
    } else {
      formError.value = t('error.title')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="surface p-6 shadow-xs sm:p-8">
    <template v-if="sent">
      <div class="flex flex-col items-center text-center">
        <span
          class="mb-4 grid size-12 place-items-center rounded-xl bg-success-soft text-success-ink ring-1 ring-success-border"
        >
          <MailCheck class="size-6" aria-hidden="true" />
        </span>
        <h1 class="text-h1 font-semibold tracking-tight text-ink">
          {{ t('auth.checkEmail') }}
        </h1>
        <p class="mt-2 text-body text-muted">{{ t('auth.resetLinkSent') }}</p>

        <div class="mt-6 flex flex-col items-center gap-3">
          <BaseButton
            variant="secondary"
            :disabled="!canResend"
            :loading="loading"
            @click="submit"
          >
            {{ t('auth.sendResetLink') }}
          </BaseButton>
          <RouterLink
            to="/auth/login"
            class="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
          >
            {{ t('auth.backToSignIn') }}
          </RouterLink>
        </div>
      </div>
    </template>

    <template v-else>
      <header class="mb-6">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">
          {{ t('auth.resetPassword') }}
        </h1>
        <p class="mt-1.5 text-body text-muted">{{ t('auth.resetPasswordSubtitle') }}</p>
      </header>

      <BaseAlert v-if="formError" tone="danger" class="mb-4" role="alert">
        {{ formError }}
      </BaseAlert>

      <form class="space-y-4" novalidate @submit.prevent="submit">
        <BaseInput
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          :label="t('auth.emailLabel')"
          :placeholder="t('auth.emailPlaceholder')"
          :error="fieldError"
          required
        />

        <BaseButton type="submit" block :loading="loading">
          {{ t('auth.sendResetLink') }}
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