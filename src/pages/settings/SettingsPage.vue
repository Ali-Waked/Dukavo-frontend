<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, Monitor, Moon, Sun } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { UserStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatRelative } from '@/utils/format'

/**
 * The General tab: appearance and the account at a glance.
 *
 * Appearance changes immediately — there is no Save button to pretend
 * otherwise. Workspace and security settings live on their own tabs; this page
 * only summarises the account and offers the way out.
 */

const { t, locale, setLocale } = useI18n()
const { store: auth } = useAuth()
const { store: ui, effectiveTheme } = useTheme()
const router = useRouter()

const themeOptions = computed(() => [
  { value: 'light' as const, label: t('settings.themeLight'), icon: Sun },
  { value: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
  { value: 'system' as const, label: t('settings.themeSystem'), icon: Monitor },
])

const languageOptions = computed(() => [
  { value: 'en' as const, label: t('language.en') },
  { value: 'ar' as const, label: t('language.ar') },
])

const USER_STATUS_KEYS = {
  active: 'status.user.active',
  invited: 'status.user.invited',
  suspended: 'status.user.suspended',
} as const

function userStatusLabel(status: UserStatus): string {
  return t(USER_STATUS_KEYS[status])
}

function lastLoginLabel(): string {
  return auth.user?.last_login_at
    ? formatRelative(auth.user.last_login_at)
    : t('users.neverSignedIn')
}

async function signOut(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'auth.login' })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Appearance -->
    <section class="surface p-5" :aria-label="t('settings.appearance')">
      <h2 class="text-h4 font-semibold text-ink">{{ t('settings.appearance') }}</h2>
      <p class="mt-1 text-small text-muted">{{ t('settings.appearanceDesc') }}</p>

      <div class="mt-4 space-y-5">
        <!-- Theme -->
        <div>
          <h3 class="text-sm font-medium text-ink">{{ t('settings.theme') }}</h3>

          <div
            role="radiogroup"
            :aria-label="t('settings.theme')"
            class="mt-2 flex flex-wrap gap-2"
          >
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="ui.theme === option.value"
              class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              :class="
                ui.theme === option.value
                  ? 'border-brand-700 bg-brand-soft text-brand-ink'
                  : 'border-line text-ink hover:bg-surface-2'
              "
              @click="ui.setTheme(option.value)"
            >
              <component :is="option.icon" class="size-4" aria-hidden="true" />
              {{ option.label }}
            </button>
          </div>

          <p class="mt-2 text-caption text-subtle">
            {{
              t('settings.effectiveTheme', {
                theme:
                  effectiveTheme === 'dark' ? t('settings.themeDark') : t('settings.themeLight'),
              })
            }}
          </p>
        </div>

        <!-- Language -->
        <div>
          <h3 class="text-sm font-medium text-ink">{{ t('settings.language') }}</h3>
          <p class="mt-0.5 text-small text-muted">{{ t('settings.languageDesc') }}</p>

          <div
            role="radiogroup"
            :aria-label="t('settings.language')"
            class="mt-2 flex flex-wrap gap-2"
          >
            <button
              v-for="option in languageOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="locale === option.value"
              class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              :class="
                locale === option.value
                  ? 'border-brand-700 bg-brand-soft text-brand-ink'
                  : 'border-line text-ink hover:bg-surface-2'
              "
              @click="setLocale(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Account -->
    <section class="surface p-5" :aria-label="t('settings.account')">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-h4 font-semibold text-ink">{{ t('settings.account') }}</h2>
          <p class="mt-1 text-small text-muted">{{ t('settings.accountDesc') }}</p>
        </div>

        <BaseButton variant="danger" :icon="LogOut" @click="signOut">
          {{ t('action.signOut') }}
        </BaseButton>
      </div>

      <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('common.name') }}
          </dt>
          <dd class="mt-1 break-words text-sm text-ink">{{ auth.user?.name ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('common.email') }}
          </dt>
          <dd class="mt-1 break-words text-sm text-ink">{{ auth.user?.email ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('common.status') }}
          </dt>
          <dd class="mt-1">
            <BaseBadge v-if="auth.user" :tone="statusTone(auth.user.status)" dot>
              {{ userStatusLabel(auth.user.status) }}
            </BaseBadge>
            <span v-else class="text-sm text-subtle">—</span>
          </dd>
        </div>

        <div>
          <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('users.lastSignIn') }}
          </dt>
          <dd class="mt-1 text-sm text-ink">{{ lastLoginLabel() }}</dd>
        </div>
      </dl>

      <div class="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        <BaseButton variant="secondary" to="/profile">
          {{ t('settings.editProfile') }}
        </BaseButton>
        <BaseButton variant="ghost" to="/settings/security">
          {{ t('settings.manageSecurity') }}
        </BaseButton>
      </div>
    </section>
  </div>
</template>
