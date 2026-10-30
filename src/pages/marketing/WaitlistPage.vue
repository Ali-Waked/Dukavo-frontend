<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, Clock, MailCheck, ShieldCheck } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n, type MessageKey } from '@/i18n'
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
 * or already listed, so nothing here distinguishes the two.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()
const route = useRoute()
const { set: setSeo } = useSeo()

const STEPS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'waitlist.nextStep1Title', bodyKey: 'waitlist.nextStep1Body' },
  { titleKey: 'waitlist.nextStep2Title', bodyKey: 'waitlist.nextStep2Body' },
  { titleKey: 'waitlist.nextStep3Title', bodyKey: 'waitlist.nextStep3Body' },
]

const TRUST = [
  'waitlist.trustInvite',
  'waitlist.trustData',
  'waitlist.trustNoSpam',
] as const

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
  setSeo({
    title: t('waitlist.title'),
    description: t('waitlist.subtitle'),
    type: 'website',
  })
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
  <section class="relative overflow-hidden py-16 md:py-24">
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-700/20" />
      <div class="absolute -end-24 top-24 size-72 rounded-full bg-accent-400/5 blur-3xl" />
    </div>

    <div class="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-16">
      <div data-aos="fade-up">
        <span class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted shadow-xs">
          <span class="size-1.5 rounded-full bg-brand-700" aria-hidden="true" />
          {{ t('waitlist.eyebrow') }}
        </span>

        <h1 class="mt-5 text-display font-semibold tracking-tight text-ink">{{ t('waitlist.title') }}</h1>
        <p class="mt-4 max-w-xl text-lead text-muted">{{ t('waitlist.subtitle') }}</p>

        <ul class="mt-7 space-y-3">
          <li v-for="key in TRUST" :key="key" class="flex items-start gap-2.5 text-body text-ink">
            <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {{ t(key) }}
          </li>
        </ul>

        <div class="surface mt-8 p-5">
          <p class="text-caption font-semibold uppercase tracking-[0.14em] text-subtle">
            {{ t('waitlist.nextTitle') }}
          </p>
          <ol class="mt-4 space-y-4">
            <li v-for="(step, index) in STEPS" :key="step.titleKey" class="flex gap-3">
              <span class="metric grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-small font-semibold text-brand-ink">
                {{ index + 1 }}
              </span>
              <div>
                <p class="text-small font-semibold text-ink">{{ t(step.titleKey) }}</p>
                <p class="mt-0.5 text-small text-muted">{{ t(step.bodyKey) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <div class="lg:sticky lg:top-28" data-aos="fade-up" data-aos-delay="80">
        <Transition name="page" mode="out-in">
          <div v-if="joined" key="success" class="surface p-7 text-center md:p-8">
            <span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success-soft text-success-ink">
              <MailCheck class="size-7" aria-hidden="true" />
            </span>
            <h2 class="text-h1 font-semibold tracking-tight text-ink">{{ t('waitlist.successTitle') }}</h2>
            <p class="mx-auto mt-2 max-w-sm text-body text-muted">{{ t('waitlist.successBody') }}</p>
            <div class="mt-6">
              <BaseButton variant="secondary" @click="joined = false">
                {{ t('waitlist.again') }}
              </BaseButton>
            </div>
          </div>

          <div v-else key="form" class="surface p-6 md:p-8">
            <div class="flex items-center gap-3 border-b border-line pb-5">
              <span class="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
                <Clock class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 class="text-h3 font-semibold text-ink">{{ t('waitlist.formTitle') }}</h2>
                <p class="text-small text-muted">{{ t('waitlist.formBody') }}</p>
              </div>
            </div>

            <form class="mt-5 space-y-4" @submit.prevent="submit">
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

              <div class="pt-1">
                <BaseButton type="submit" :loading="submitting" block size="lg">
                  {{ t('waitlist.submit') }}
                </BaseButton>
              </div>

              <p class="flex items-start gap-2 text-caption text-subtle">
                <ShieldCheck class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {{ t('waitlist.privacyNote') }}
              </p>
            </form>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>
