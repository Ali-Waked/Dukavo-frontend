<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { MailCheck } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import { resendVerification } from '@/services/authService'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * Email verification landing page.
 *
 * Sign-in works before verification, so this page's job is to make the next
 * step obvious and one-click — not to block the workspace.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const email = computed(() => auth.user?.email ?? '')
const sending = ref(false)
const notice = ref<string | null>(null)
const error = ref<string | null>(null)

async function resend(): Promise<void> {
  notice.value = null
  error.value = null
  sending.value = true
  try {
    await resendVerification(email.value)
    notice.value = t('auth.verificationSent')
    toast.success(t('auth.verificationSent'))
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 429) {
      error.value = t('auth.rateLimited')
    } else if (caught instanceof ApiError && caught.isNetworkError) {
      error.value = t('auth.networkError')
    } else {
      error.value = t('error.title')
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <div class="surface p-6 text-center shadow-xs sm:p-8">
      <span
        class="mb-4 inline-grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-soft-border"
      >
        <MailCheck class="size-6" aria-hidden="true" />
      </span>

      <h1 class="text-h1 font-semibold tracking-tight text-ink">
        {{ t('auth.checkEmail') }}
      </h1>
      <p class="mt-2 text-body text-muted">
        {{ t('auth.checkEmailSubtitle', { email }) }}
      </p>

      <BaseAlert v-if="error" tone="danger" class="mt-5 text-start" role="alert">
        {{ error }}
      </BaseAlert>
      <BaseAlert v-else-if="notice" tone="success" class="mt-5 text-start">
        {{ notice }}
      </BaseAlert>

      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <BaseButton variant="secondary" :loading="sending" @click="resend">
          {{ t('auth.resendVerification') }}
        </BaseButton>
        <RouterLink
          to="/dashboard"
          class="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
        >
          {{ t('error.goHome') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>