<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Pencil, Trash2 } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { ApiError } from '@/lib/axiosClient'
import {
  fetchProfile,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from '@/services/profileService'
import type { Profile } from '@/types/profile'

/**
 * The signed-in user's own profile.
 *
 * Photo, name and phone — the things a person owns about themselves. Email is
 * shown read-only: changing it needs a verification workflow the backend does
 * not implement, so offering an input would be a promise the API cannot keep.
 * A successful save refreshes `/me` so the topbar avatar and name stay in step.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const profile = ref<Profile | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const avatarBusy = ref(false)
const generalError = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})
const fileInput = ref<HTMLInputElement | null>(null)

const form = reactive({ name: '', phone: '' })

const languageOptions = computed(() => [
  { value: 'en', label: t('language.en') },
  { value: 'ar', label: t('language.ar') },
])

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_BYTES = 2 * 1024 * 1024

function applyProfile(next: Profile): void {
  profile.value = next
  form.name = next.name
  form.phone = next.phone ?? ''
}

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

onMounted(async () => {
  try {
    applyProfile(await fetchProfile())
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : t('error.title')
  } finally {
    loading.value = false
  }
})

async function save(): Promise<void> {
  clearErrors()
  saving.value = true

  try {
    const updated = await updateProfile({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
    })

    applyProfile(updated)
    await auth.refreshSession()
    toast.success(t('profile.saved'))
  } catch (error) {
    captureApiError(error, 'profile.saveFailed')
  } finally {
    saving.value = false
  }
}

function triggerFilePicker(): void {
  fileInput.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  clearErrors()

  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    generalError.value = t('profile.avatarType')
    input.value = ''
    return
  }

  if (file.size > MAX_BYTES) {
    generalError.value = t('profile.avatarTooLarge')
    input.value = ''
    return
  }

  avatarBusy.value = true

  try {
    applyProfile(await uploadAvatar(file))
    await auth.refreshSession()
    toast.success(t('profile.photoUpdated'))
  } catch (error) {
    captureApiError(error, 'profile.photoFailed')
  } finally {
    avatarBusy.value = false
    input.value = ''
  }
}

async function removePhoto(): Promise<void> {
  clearErrors()
  avatarBusy.value = true

  try {
    applyProfile(await removeAvatar())
    await auth.refreshSession()
    toast.success(t('profile.photoRemoved'))
  } catch (error) {
    captureApiError(error, 'profile.photoFailed')
  } finally {
    avatarBusy.value = false
  }
}

async function changeLanguage(value: string): Promise<void> {
  if (!profile.value) {
    return
  }

  clearErrors()
  saving.value = true

  try {
    const updated = await updateProfile({ locale: value })
    applyProfile(updated)
    await auth.refreshSession()
    toast.success(t('profile.saved'))
  } catch (error) {
    captureApiError(error, 'profile.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <div v-if="loading" class="grid place-items-center py-24">
      <BaseSpinner />
    </div>

    <BaseAlert v-else-if="loadError" tone="danger" :title="t('profile.loadFailed')">
      {{ loadError }}
    </BaseAlert>

    <template v-else-if="profile">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('profile.title') }}</h1>
          <p class="mt-1.5 text-body text-muted">{{ t('profile.subtitle') }}</p>
        </div>
      </header>

      <BaseAlert v-if="generalError" tone="danger" dismissible @dismiss="generalError = null">
        {{ generalError }}
      </BaseAlert>

      <!-- Photo -->
      <section class="surface p-5" :aria-label="t('profile.photo')">
        <h2 class="text-h4 font-semibold text-ink">{{ t('profile.photo') }}</h2>
        <p class="mt-1 text-small text-muted">{{ t('profile.photoHint') }}</p>

        <div class="mt-4 flex flex-wrap items-center gap-5">
          <div class="relative">
            <UserAvatar :name="profile.name" :src="profile.avatar_url" size="xl" />
            <span
              v-if="avatarBusy"
              class="absolute inset-0 grid place-items-center rounded-full bg-scrim/60"
            >
              <BaseSpinner size="lg" />
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <BaseButton
              variant="secondary"
              :icon="Pencil"
              :loading="avatarBusy"
              @click="triggerFilePicker"
            >
              {{ profile.avatar_url ? t('profile.changePhoto') : t('profile.uploadPhoto') }}
            </BaseButton>

            <BaseButton
              v-if="profile.avatar_url"
              variant="ghost"
              :icon="Trash2"
              :disabled="avatarBusy"
              @click="removePhoto"
            >
              {{ t('profile.removePhoto') }}
            </BaseButton>
          </div>

          <input
            ref="fileInput"
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/webp"
            @change="onFileSelected"
          />
        </div>
      </section>

      <!-- Details -->
      <section class="surface p-5" :aria-label="t('profile.details')">
        <h2 class="text-h4 font-semibold text-ink">{{ t('profile.details') }}</h2>
        <p class="mt-1 text-small text-muted">{{ t('profile.detailsDesc') }}</p>

        <form class="mt-4 space-y-4" @submit.prevent="save">
          <BaseInput
            v-model="form.name"
            :label="t('common.name')"
            :error="errors.name"
            autocomplete="name"
            required
          />

          <BaseInput
            v-model="form.phone"
            type="tel"
            :label="t('common.phone')"
            :placeholder="t('common.optional')"
            :error="errors.phone"
            autocomplete="tel"
          />

          <BaseInput
            :model-value="profile.email"
            type="email"
            :label="t('common.email')"
            :hint="t('profile.emailReadonly')"
            disabled
          />

          <BaseSelect
            :model-value="profile.locale ?? ''"
            :label="t('settings.language')"
            :options="languageOptions"
            :hint="t('profile.languageHint')"
            :disabled="saving"
            @update:model-value="changeLanguage"
          />

          <div class="flex justify-end pt-1">
            <BaseButton type="submit" :loading="saving">
              {{ t('action.saveChanges') }}
            </BaseButton>
          </div>
        </form>
      </section>

      <!-- Account meta -->
      <section class="surface p-5" :aria-label="t('profile.accountMeta')">
        <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('common.status') }}
            </dt>
            <dd class="mt-1 text-sm text-ink">{{ profile.status_label }}</dd>
          </div>
          <div>
            <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('profile.emailStatus') }}
            </dt>
            <dd class="mt-1 text-sm text-ink">
              {{ profile.email_verified_at ? t('profile.emailVerified') : t('profile.emailUnverified') }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
