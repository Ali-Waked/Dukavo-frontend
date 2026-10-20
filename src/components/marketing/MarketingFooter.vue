<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import HoneypotField from '@/components/marketing/HoneypotField.vue'
import { subscribeNewsletter } from '@/services/marketingService'

/**
 * Footer shared by every surface page.
 *
 * The newsletter signup lives here rather than on the homepage so subscribing
 * is possible from anywhere. Like the other public forms it carries the
 * `website` honeypot; the happy path is a quiet inline confirmation instead of
 * a toast so it never steals focus from the page footer.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()

const email = ref('')
const website = ref('')
const emailError = ref<string | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)
const subscribed = ref(false)

async function submit(): Promise<void> {
  emailError.value = null
  formError.value = null

  if (!email.value.trim()) {
    emailError.value = t('validation.required')
    return
  }
  if (!EMAIL_PATTERN.test(email.value.trim())) {
    emailError.value = t('validation.email')
    return
  }

  submitting.value = true
  try {
    await subscribeNewsletter({
      email: email.value.trim(),
      source: 'footer',
      website: website.value,
    })
    subscribed.value = true
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      emailError.value = caught.fields['email']?.[0] ?? null
      if (!emailError.value) formError.value = caught.message || t('error.title')
    } else if (caught instanceof ApiError && caught.status === 429) {
      formError.value = t('error.rateLimitedBody')
    } else {
      formError.value =
        caught instanceof ApiError && caught.message ? caught.message : t('error.title')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <footer class="border-t border-line bg-surface-2 py-12">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <!-- Newsletter -->
      <div class="mb-12 rounded-2xl border border-line bg-surface p-6 md:p-8">
        <div class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 class="text-h3 font-semibold text-ink">{{ t('newsletter.title') }}</h2>
            <p class="mt-1 text-muted">{{ t('newsletter.subtitle') }}</p>
          </div>

          <form v-if="!subscribed" class="w-full max-w-sm" @submit.prevent="submit">
            <HoneypotField v-model="website" />
            <div class="flex gap-2">
              <BaseInput
                v-model="email"
                type="email"
                :label="t('common.email')"
                :error="emailError"
                :placeholder="t('newsletter.emailPlaceholder')"
                autocomplete="email"
                class="flex-1"
                required
              />
              <BaseButton type="submit" :loading="submitting" class="mt-6">
                {{ t('newsletter.submit') }}
              </BaseButton>
            </div>
            <p v-if="formError" class="text-small text-danger-ink" role="alert">
              {{ formError }}
            </p>
          </form>

          <p v-else class="flex items-center gap-2 text-body text-ink">
            <CheckCircle2 class="size-5 text-success" aria-hidden="true" />
            {{ t('newsletter.successTitle') }}
          </p>
        </div>
      </div>

      <!-- Link columns -->
      <div class="grid gap-8 md:grid-cols-4">
        <div>
          <AppLogo variant="full" :height="36" />
          <p class="mt-3 text-sm text-muted">{{ t('marketing.footer.tagline') }}</p>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-ink">{{ t('marketing.footer.product') }}</h3>
          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li><RouterLink to="/features" class="transition hover:text-ink">{{ t('marketing.nav.features') }}</RouterLink></li>
            <li><RouterLink to="/pricing" class="transition hover:text-ink">{{ t('marketing.nav.pricing') }}</RouterLink></li>
            <li><RouterLink to="/how-it-works" class="transition hover:text-ink">{{ t('marketing.nav.howItWorks') }}</RouterLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-ink">{{ t('marketing.footer.resources') }}</h3>
          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li><RouterLink to="/help" class="transition hover:text-ink">{{ t('marketing.nav.help') }}</RouterLink></li>
            <li><RouterLink to="/contact" class="transition hover:text-ink">{{ t('marketing.nav.contact') }}</RouterLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-ink">{{ t('marketing.footer.legal') }}</h3>
          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li><RouterLink to="/terms" class="transition hover:text-ink">{{ t('marketing.footer.terms') }}</RouterLink></li>
            <li><RouterLink to="/privacy" class="transition hover:text-ink">{{ t('marketing.footer.privacy') }}</RouterLink></li>
            <li><RouterLink to="/about" class="transition hover:text-ink">{{ t('marketing.footer.about') }}</RouterLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
        {{ t('marketing.footer.rights', { year: String(new Date().getFullYear()) }) }}
      </div>
    </div>
  </footer>
</template>