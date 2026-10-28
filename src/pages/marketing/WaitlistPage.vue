<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, UserPlus } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { useSeo } from '@/composables/useSeo'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import HoneypotField from '@/components/marketing/HoneypotField.vue'
import { joinWaitlist } from '@/services/marketingService'

/**
 * Public waitlist signup — the only public path into Dukavo.
 *
 * Onboarding is invite-only: a platform operator reviews signups and sends
 * invitations, so this page never implies self-serve registration. The answer
 * is deliberately sparse — 202 means "we have it" whether the address was new
 * or already listed, so nothing here distinguishes the two. The form carries
 * the `website` honeypot the server reads, and rate-limit replies are shown
 * as-is rather than mapped to scary copy.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()
const route = useRoute()
const { set: setSeo } = useSeo()

/**
 * When a visitor arrives from a specific plan the plan slug travels in the
 * query string, so interest can be recorded against that plan through the
 * existing waitlist table instead of a new one.
 */
const source =
  typeof route.query.plan === 'string' && route.query.plan
    ? `pricing:${route.query.plan}`
    : 'waitlist'

const email = ref('')
const name = ref('')
const businessType = ref('')
const website = ref('')

const emailError = ref<string | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)
const joined = ref(false)

onMounted(() => {
  setSeo({ title: t('waitlist.title'), description: t('waitlist.subtitle') })
  AOS.init({
    duration: 600,
    easing: 'ease-out-quart',
    once: true,
    offset: 120,
  })
})

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

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
    await joinWaitlist({
      email: email.value.trim(),
      name: name.value.trim() || undefined,
      business_type: businessType.value.trim() || undefined,
      source,
      website: website.value,
    })
    joined.value = true
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      emailError.value = caught.fields['email']?.[0] ?? null
      if (!emailError.value) {
        formError.value = caught.message || t('error.title')
      }
    } else if (caught instanceof ApiError && caught.status === 429) {
      formError.value = t('error.rateLimitedBody')
    } else {
      formError.value = errorMessage(caught)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-3xl px-4 md:px-6">
      <Transition name="page" mode="out-in">
        <!-- Success -->
        <div
          v-if="joined"
          key="success"
          class="surface mx-auto max-w-xl p-8 text-center"
          data-aos="fade-up"
        >
          <span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success-soft text-success-ink">
            <CheckCircle2 class="size-7" aria-hidden="true" />
          </span>
          <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('waitlist.successTitle') }}</h1>
          <p class="mx-auto mt-2 max-w-sm text-body text-muted">{{ t('waitlist.successBody') }}</p>
          <div class="mt-6">
            <BaseButton variant="secondary" @click="joined = false">
              {{ t('waitlist.again') }}
            </BaseButton>
          </div>
        </div>

        <!-- Form -->
        <div v-else key="form">
          <div class="text-center" data-aos="fade-up">
            <span class="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
              <UserPlus class="size-6" aria-hidden="true" />
            </span>
            <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('waitlist.title') }}</h1>
            <p class="mt-3 text-muted">{{ t('waitlist.subtitle') }}</p>
          </div>

          <div class="surface mt-10 p-6 md:p-8" data-aos="fade-up" data-aos-delay="100">
            <form class="space-y-4" @submit.prevent="submit">
              <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
                {{ formError }}
              </BaseAlert>

              <HoneypotField v-model="website" />

              <BaseInput
                v-model="email"
                type="email"
                :label="t('common.email')"
                :error="emailError"
                autocomplete="email"
                required
              />

              <div class="grid gap-4 sm:grid-cols-2">
                <BaseInput
                  v-model="name"
                  :label="t('common.name')"
                  :hint="t('common.optional')"
                  autocomplete="name"
                />

                <BaseInput
                  v-model="businessType"
                  :label="t('waitlist.businessType')"
                  :hint="t('waitlist.businessTypeHint')"
                  :placeholder="t('waitlist.businessTypePlaceholder')"
                />
              </div>

              <div class="pt-2">
                <BaseButton type="submit" :loading="submitting" block size="lg">
                  {{ t('waitlist.submit') }}
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>
