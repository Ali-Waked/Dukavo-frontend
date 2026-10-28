<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { useDashboardRoute } from '@/composables/useDashboardRoute'
import { ChevronDown, LayoutDashboard, LogOut, Moon, Sun } from '@/components/icons'
import AppLogo from '@/components/ui/AppLogo.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import MarketingFooter from '@/components/marketing/MarketingFooter.vue'
import { useNotificationStore } from '@/stores/notificationStore'

const { t } = useI18n()
const { isAuthenticated, user, store: auth } = useAuth()
const { effectiveTheme, store: ui } = useTheme()
const route = useRoute()
const router = useRouter()
const notifications = useNotificationStore()
const dashboardRoute = useDashboardRoute()

// A page that renders its own newsletter capture opts the footer's copy out,
// so the same form never appears twice in one view.
const showFooterNewsletter = computed(() => route.meta.hideFooterNewsletter !== true)

const accountMenuLabel = computed(() =>
  user.value?.name ? `${t('nav.accountMenu')}: ${user.value.name}` : t('nav.accountMenu'),
)

/**
 * Signing out on the public site returns to the public site — the visitor was
 * reading pages, not working in the shell, so dumping them on the sign-in form
 * would be a detour. The same user state is cleared as in the app topbar so
 * nothing from the session survives into the next one.
 */
async function handleLogout(): Promise<void> {
  try {
    await auth.logout()
  } finally {
    notifications.reset()
    await router.push({ name: 'marketing.home' })
  }
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col bg-canvas">
    <header class="sticky top-0 z-50 flex items-center justify-between border-b border-line/60 bg-surface/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:px-8">
      <div class="flex items-center gap-2.5">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <AppLogo variant="full" :height="40" class-name="h-10 w-auto shrink-0 sm:h-9" />
        </RouterLink>
      </div>

      <nav class="hidden items-center gap-6 lg:flex">
        <RouterLink to="/features" class="text-sm font-medium text-muted transition hover:text-ink">{{ t('marketing.nav.features') }}</RouterLink>
        <RouterLink to="/how-it-works" class="text-sm font-medium text-muted transition hover:text-ink">{{ t('marketing.nav.howItWorks') }}</RouterLink>
        <RouterLink to="/pricing" class="text-sm font-medium text-muted transition hover:text-ink">{{ t('marketing.nav.pricing') }}</RouterLink>
        <RouterLink to="/contact" class="text-sm font-medium text-muted transition hover:text-ink">{{ t('marketing.nav.contact') }}</RouterLink>
      </nav>

      <div class="flex items-center gap-1.5">
        <LanguageSwitcher />
        <button
          type="button"
          class="btn-icon"
          :title="effectiveTheme === 'dark' ? t('theme.dark') : t('theme.light')"
          @click="ui.toggleTheme()"
        >
          <Sun v-if="effectiveTheme === 'dark'" class="size-5" />
          <Moon v-else class="size-5" />
          <span class="sr-only">{{ t('theme.toggle') }}</span>
        </button>
        <template v-if="!isAuthenticated">
          <BaseButton to="/login" variant="ghost" size="sm" class="hidden sm:inline-flex">
            {{ t('marketing.nav.login') }}
          </BaseButton>
        </template>

        <!-- Signed in: identity opens a small account menu -->
        <BaseDropdown v-else align="end">
          <template #trigger="{ open }">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-haspopup="menu"
              :aria-expanded="open"
              :aria-label="accountMenuLabel"
            >
              <UserAvatar :name="user?.name" :src="user?.avatar_url" size="sm" />
              <span class="hidden max-w-36 truncate text-sm font-medium text-ink sm:block">
                {{ user?.name }}
              </span>
              <ChevronDown class="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
            </button>
          </template>

          <template #default="{ close }">
            <div class="w-60 max-w-[calc(100vw-2rem)]">
              <div class="flex items-center gap-3 border-b border-line px-4 py-3" role="presentation">
                <UserAvatar :name="user?.name" :src="user?.avatar_url" size="md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-ink" dir="auto">{{ user?.name }}</p>
                  <p class="truncate text-xs text-muted" dir="auto">{{ user?.email }}</p>
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
      </div>
    </header>

    <main class="relative z-10 flex-1">
      <RouterView />
    </main>

    <MarketingFooter :show-newsletter="showFooterNewsletter" />
  </div>
</template>
