<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, Store } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import { provisionTenant } from '@/services/authService'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * First-run setup for an approved account with no workspace.
 *
 * The workspace endpoint already creates the tenant, its first store and the
 * owner role atomically. This screen only collects the two names and then
 * switches the session into the new workspace, so the route the guard sends the
 * owner to next has a real tenant behind it.
 */

const { t } = useI18n()
const router = useRouter()
const { store: auth, user } = useAuth()

const name = ref('')
const storeName = ref('')
const nameError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const idempotencyKey = ref(crypto.randomUUID())
const email = computed(() => user.value?.email ?? '')

async function submit(): Promise<void> {
  nameError.value = null
  formError.value = null

  if (!name.value.trim()) {
    nameError.value = t('validation.required')
    return
  }

  saving.value = true
  try {
    const tenant = await provisionTenant(
      {
        name: name.value.trim(),
        store_name: storeName.value.trim() || undefined,
      },
      idempotencyKey.value,
    )

    await auth.switchTenant(tenant.slug)
    await router.replace(auth.homeDestination)
  } catch (caught) {
    if (caught instanceof ApiError && caught.fields) {
      nameError.value = caught.fields['name']?.[0] ?? null
      if (!nameError.value) {
        formError.value = caught.message || t('error.title')
      }
    } else if (caught instanceof ApiError && caught.status === 429) {
      formError.value = t('error.rateLimitedBody')
    } else {
      formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
    }
  } finally {
    saving.value = false
  }
}

async function signOut(): Promise<void> {
  await auth.logout()
  await router.replace({ name: 'auth.login' })
}
</script>

<template>
  <div class="surface p-6 shadow-xs sm:p-8">
    <div class="flex items-start gap-3 border-b border-line pb-5">
      <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
        <Store class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('onboarding.title') }}</h1>
        <p class="mt-1 text-body text-muted">{{ t('onboarding.subtitle') }}</p>
      </div>
    </div>

    <BaseAlert v-if="formError" tone="danger" class="mt-5" dismissible @dismiss="formError = null">
      {{ formError }}
    </BaseAlert>

    <form class="mt-5 space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="name"
        name="name"
        :label="t('auth.workspaceName')"
        :placeholder="t('auth.workspaceNamePlaceholder')"
        :error="nameError"
        autocomplete="organization"
        required
      />

      <BaseInput
        v-model="storeName"
        name="store_name"
        :label="t('auth.storeName')"
        :hint="t('auth.storeNameHint')"
        autocomplete="organization"
      />

      <BaseButton type="submit" block :loading="saving">
        {{ saving ? t('onboarding.submitting') : t('onboarding.submit') }}
      </BaseButton>
    </form>

    <div class="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-center">
      <p v-if="email" class="text-small text-muted">{{ t('onboarding.signedInAs', { email }) }}</p>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted transition hover:text-ink"
        @click="signOut"
      >
        <LogOut class="size-4" aria-hidden="true" />
        {{ t('common.signOut') }}
      </button>
    </div>
  </div>
</template>
