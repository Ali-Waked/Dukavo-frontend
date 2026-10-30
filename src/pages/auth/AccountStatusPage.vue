<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Clock, LogOut, MailCheck, ShieldAlert, Store } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * The honest landing page for an account that cannot use a dashboard.
 *
 * `status` is a presentation hint only: it explains why the session resolver
 * sent the visitor here. It never grants access, and an unknown value falls
 * back to a generic explanation instead of echoing arbitrary query text.
 */

type Status = 'invited' | 'suspended' | 'tenant-suspended' | 'unavailable'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { store: auth, user } = useAuth()

const allowed = new Set<Status>(['invited', 'suspended', 'tenant-suspended', 'unavailable'])

const status = computed<Status>(() => {
  const value = typeof route.query.status === 'string' ? route.query.status : ''
  return allowed.has(value as Status) ? (value as Status) : 'unavailable'
})

const signedIn = computed(() => auth.isAuthenticated)
const email = computed(() => user.value?.email ?? '')

const copy = computed(() => {
  switch (status.value) {
    case 'invited':
      return {
        eyebrow: t('accountStatus.invitedEyebrow'),
        title: t('accountStatus.invitedTitle'),
        body: t('accountStatus.invitedBody'),
      }
    case 'suspended':
      return {
        eyebrow: t('accountStatus.suspendedEyebrow'),
        title: t('accountStatus.suspendedTitle'),
        body: t('accountStatus.suspendedBody'),
      }
    case 'tenant-suspended':
      return {
        eyebrow: t('accountStatus.tenantEyebrow'),
        title: t('accountStatus.tenantTitle'),
        body: t('accountStatus.tenantBody'),
      }
    default:
      return {
        eyebrow: t('accountStatus.unavailableEyebrow'),
        title: t('accountStatus.unavailableTitle'),
        body: t('accountStatus.unavailableBody'),
      }
  }
})

async function goToReset(): Promise<void> {
  await auth.logout()
  await router.replace({ name: 'auth.forgot-password' })
}

async function signOut(): Promise<void> {
  await auth.logout()
  await router.replace({ name: 'auth.login' })
}
</script>

<template>
  <div class="surface p-7 text-center shadow-xs sm:p-9">
    <span
      class="mx-auto mb-5 grid size-14 place-items-center rounded-2xl"
      :class="
        status === 'invited'
          ? 'bg-brand-soft text-brand-ink ring-1 ring-brand-ring'
          : 'bg-warning-soft text-warning-ink ring-1 ring-warning-border'
      "
    >
      <MailCheck v-if="status === 'invited'" class="size-7" aria-hidden="true" />
      <Store v-else-if="status === 'tenant-suspended'" class="size-7" aria-hidden="true" />
      <Clock v-else-if="status === 'unavailable'" class="size-7" aria-hidden="true" />
      <ShieldAlert v-else class="size-7" aria-hidden="true" />
    </span>

    <p class="text-caption font-semibold uppercase tracking-widest text-subtle">
      {{ copy.eyebrow }}
    </p>
    <h1 class="mt-2 text-h1 font-semibold tracking-tight text-ink">{{ copy.title }}</h1>
    <p class="mx-auto mt-3 max-w-md text-body text-muted">{{ copy.body }}</p>

    <p v-if="signedIn && email" class="mt-4 text-small text-subtle">
      {{ t('accountStatus.signedInAs', { email }) }}
    </p>

    <div class="mt-7 flex flex-wrap justify-center gap-3">
      <BaseButton v-if="status === 'invited'" @click="goToReset">
        {{ t('accountStatus.acceptInvitation') }}
      </BaseButton>

      <BaseButton v-else-if="signedIn" variant="secondary" @click="signOut">
        <LogOut class="size-4" aria-hidden="true" />
        {{ t('common.signOut') }}
      </BaseButton>

      <BaseButton v-else to="/login" variant="secondary">
        {{ t('auth.backToSignIn') }}
      </BaseButton>

      <BaseButton to="/contact" variant="ghost">
        {{ t('accountStatus.contactSupport') }}
      </BaseButton>
    </div>
  </div>
</template>
