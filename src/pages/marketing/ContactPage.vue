<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CheckCircle2, Send } from '@/components/icons'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import HoneypotField from '@/components/marketing/HoneypotField.vue'
import { submitContact } from '@/services/marketingService'

/**
 * Public contact form.
 *
 * Like the rest of the lead-capture forms, the response only ever says
 * "we have it": the visitor learns nothing about the message, just that it was
 * accepted. Single-line fields are stripped of newlines by the server before
 * validation, and the `website` honeypot rides along with every request.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()

const name = ref('')
const email = ref('')
const subject = ref('')
const message = ref('')
const website = ref('')

const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const subjectError = ref<string | null>(null)
const messageError = ref<string | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)
const sent = ref(false)

onMounted(() => {
  AOS.init({
    duration: 600,
    easing: 'ease-out-quart',
    once: false,
    mirror: false,
    offset: 120,
  })
})

function clearFieldErrors(): void {
  nameError.value = null
  emailError.value = null
  subjectError.value = null
  messageError.value = null
}

function validate(): boolean {
  clearFieldErrors()

  if (!name.value.trim()) nameError.value = t('validation.required')
  if (!email.value.trim()) {
    emailError.value = t('validation.required')
  } else if (!EMAIL_PATTERN.test(email.value.trim())) {
    emailError.value = t('validation.email')
  }
  if (!subject.value.trim()) subjectError.value = t('validation.required')
  if (!message.value.trim()) messageError.value = t('validation.required')

  return (
    nameError.value === null &&
    emailError.value === null &&
    subjectError.value === null &&
    messageError.value === null
  )
}

async function submit(): Promise<void> {
  if (!validate()) return

  formError.value = null
  submitting.value = true
  try {
    await submitContact({
      name: name.value.trim(),
      email: email.value.trim(),
      subject: subject.value.trim(),
      message: message.value.trim(),
      website: website.value,
    })
    sent.value = true
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      const fields = caught.fields
      nameError.value = fields['name']?.[0] ?? null
      emailError.value = fields['email']?.[0] ?? null
      subjectError.value = fields['subject']?.[0] ?? null
      messageError.value = fields['message']?.[0] ?? null

      if (
        nameError.value === null &&
        emailError.value === null &&
        subjectError.value === null &&
        messageError.value === null
      ) {
        formError.value = caught.message || t('error.title')
      }
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
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-3xl px-4 md:px-6">
      <Transition name="page" mode="out-in">
        <!-- Success -->
        <div
          v-if="sent"
          key="success"
          class="surface mx-auto max-w-xl p-8 text-center"
          data-aos="fade-up"
        >
          <span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success-soft text-success-ink">
            <CheckCircle2 class="size-7" aria-hidden="true" />
          </span>
          <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('contact.successTitle') }}</h1>
          <p class="mx-auto mt-2 max-w-sm text-body text-muted">{{ t('contact.successBody') }}</p>
          <div class="mt-6">
            <BaseButton variant="secondary" @click="sent = false">
              {{ t('contact.again') }}
            </BaseButton>
          </div>
        </div>

        <!-- Form -->
        <div v-else key="form">
          <div class="text-center" data-aos="fade-up">
            <span class="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
              <Send class="size-6" aria-hidden="true" />
            </span>
            <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('contact.title') }}</h1>
            <p class="mt-3 text-muted">{{ t('contact.subtitle') }}</p>
          </div>

          <div class="surface mt-10 p-6 md:p-8" data-aos="fade-up" data-aos-delay="100">
            <form class="space-y-4" @submit.prevent="submit">
              <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
                {{ formError }}
              </BaseAlert>

              <HoneypotField v-model="website" />

              <div class="grid gap-4 sm:grid-cols-2">
                <BaseInput
                  v-model="name"
                  :label="t('common.name')"
                  :error="nameError"
                  autocomplete="name"
                  required
                />

                <BaseInput
                  v-model="email"
                  type="email"
                  :label="t('common.email')"
                  :error="emailError"
                  autocomplete="email"
                  required
                />
              </div>

              <BaseInput
                v-model="subject"
                :label="t('common.subject')"
                :error="subjectError"
                :placeholder="t('contact.subjectPlaceholder')"
                maxlength="150"
                required
              />

              <BaseTextarea
                v-model="message"
                :label="t('contact.messagePlaceholder')"
                :error="messageError"
                :placeholder="t('contact.messagePlaceholder')"
                :rows="6"
                :maxlength="5000"
                required
              />

              <div class="pt-2">
                <BaseButton type="submit" :loading="submitting" block size="lg">
                  {{ t('contact.submit') }}
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>