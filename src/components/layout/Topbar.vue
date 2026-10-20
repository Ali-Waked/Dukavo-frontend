<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { ChevronDown, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, UserCog } from '@/components/icons'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import NotificationBell from '@/components/notifications/NotificationBell.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useNotificationStore } from '@/stores/notificationStore'

const auth = useAuthStore()
const ui = useUiStore()
const notifications = useNotificationStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => String(route.meta.title ?? t('app.name')))

/**
 * The dashboard that matches the signed-in account's type.
 *
 * A platform operator always lands on the platform overview — that surface is
 * reachable by every platform role, whereas a workspace dashboard depends on
 * tenant-scoped permissions they may not hold. A merchant only ever sees their
 * own workspace dashboard; the platform route is never offered to them.
 */
const dashboardRoute = computed(() =>
  auth.isPlatformUser ? { name: 'platform.dashboard' } : { name: 'dashboard.index' },
)

const accountMenuLabel = computed(() =>
  auth.user?.name ? `${t('nav.accountMenu')}: ${auth.user.name}` : t('nav.accountMenu'),
)

async function handleLogout(): Promise<void> {
  try {
    await auth.logout()
  } finally {
    // Drop user-specific state so a following session on the same device can
    // never read the previous account's notifications, then leave the shell.
    notifications.reset()
    await router.push({ name: 'auth.login' })
  }
}
</script>

<template>
  <header class="sticky inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
    <button
      type="button"
      class="btn-icon lg:hidden"
      :aria-label="t('nav.openMenu') ?? 'Open menu'"
      @click="ui.setMobileNavOpen(true)"
    >
      <Menu class="size-5" />
    </button>

    <h1 class="truncate text-lead font-semibold text-ink">{{ pageTitle }}</h1>

    <div class="mx-auto" />

    <div class="flex items-center gap-1.5">
      <LanguageSwitcher />

      <NotificationBell />

      <button
        type="button"
        class="btn-icon"
        :title="ui.effectiveTheme === 'dark' ? t('theme.light') : t('theme.dark')"
        @click="ui.toggleTheme()"
      >
        <Sun v-if="ui.effectiveTheme === 'dark'" class="size-5" />
        <Moon v-else class="size-5" />
        <span class="sr-only">{{ t('theme.toggle') }}</span>
      </button>
    </div>

    <BaseDropdown align="end">
      <template #trigger="{ open }">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg px-1.5 py-1 text-start transition hover:bg-surface-2"
          aria-haspopup="menu"
          :aria-expanded="open"
          :aria-label="accountMenuLabel"
        >
          <UserAvatar :name="auth.user?.name" :src="auth.user?.avatar_url" size="sm" />
          <span class="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
            {{ auth.user?.name }}
          </span>
          <ChevronDown class="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
        </button>
      </template>

      <template #default="{ close }">
        <div class="w-64 max-w-[calc(100vw-2rem)]">
          <div class="flex items-center gap-3 border-b border-line px-4 py-3" role="presentation">
            <UserAvatar :name="auth.user?.name" :src="auth.user?.avatar_url" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink" dir="auto">{{ auth.user?.name }}</p>
              <p class="truncate text-xs text-muted" dir="auto">{{ auth.user?.email }}</p>
            </div>
          </div>

          <div class="p-1.5" role="presentation">
            <RouterLink
              :to="dashboardRoute"
              role="menuitem"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="close()"
            >
              <LayoutDashboard class="size-4 text-muted" aria-hidden="true" />
              {{ t('nav.dashboard') }}
            </RouterLink>

            <RouterLink
              to="/profile"
              role="menuitem"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="close()"
            >
              <UserCog class="size-4 text-muted" aria-hidden="true" />
              {{ t('nav.profile') }}
            </RouterLink>

            <RouterLink
              to="/settings"
              role="menuitem"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="close()"
            >
              <Settings class="size-4 text-muted" aria-hidden="true" />
              {{ t('nav.settings') }}
            </RouterLink>

            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="close(); handleLogout()"
            >
              <LogOut class="size-4 text-muted" aria-hidden="true" />
              {{ t('common.signOut') }}
            </button>
          </div>
        </div>
      </template>
    </BaseDropdown>
  </header>
</template>
