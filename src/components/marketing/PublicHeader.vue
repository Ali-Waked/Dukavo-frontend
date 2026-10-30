<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  SlidersHorizontal,
  Sun,
  X,
} from '@/components/icons'
import AppLogo from '@/components/ui/AppLogo.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useI18n, type MessageKey } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useLocale } from '@/composables/useLocale'
import { useTheme } from '@/composables/useTheme'
import { useDashboardRoute } from '@/composables/useDashboardRoute'
import { useNotificationStore } from '@/stores/notificationStore'

interface NavItem {
  to: string
  key: MessageKey
  secondary?: boolean
}

const NAV: NavItem[] = [
  { to: '/', key: 'marketing.nav.home', secondary: true },
  { to: '/features', key: 'marketing.nav.features' },
  { to: '/how-it-works', key: 'marketing.nav.howItWorks', secondary: true },
  { to: '/pricing', key: 'marketing.nav.pricing' },
  { to: '/blog', key: 'marketing.nav.blog' },
  { to: '/about', key: 'marketing.nav.about' },
  { to: '/help', key: 'marketing.nav.help' },
  { to: '/contact', key: 'marketing.nav.contact' },
]

const ANNOUNCEMENT_KEY = 'dukavo.announcement.dismissed'

const { t } = useI18n()
const { isAuthenticated, user, store: auth } = useAuth()
const { locale, languages, setLocale } = useLocale()
const { effectiveTheme, store: ui } = useTheme()
const route = useRoute()
const router = useRouter()
const notifications = useNotificationStore()
const dashboardRoute = useDashboardRoute()
const dashboardHref = computed(() => router.resolve(dashboardRoute.value).href)

const menuOpen = ref(false)
const announcementVisible = ref(true)

const themeOptions = [
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
] as const

const accountMenuLabel = computed(() =>
  user.value?.name ? `${t('nav.accountMenu')}: ${user.value.name}` : t('nav.accountMenu'),
)

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

function dismissAnnouncement(): void {
  announcementVisible.value = false
  try {
    window.localStorage.setItem(ANNOUNCEMENT_KEY, '1')
  } catch {
    // Storage can be unavailable in private modes; hiding for this visit is enough.
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
  }
}

async function handleLogout(): Promise<void> {
  try {
    await auth.logout()
  } finally {
    notifications.reset()
    menuOpen.value = false
    await router.push({ name: 'marketing.home' })
  }
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

onMounted(() => {
  try {
    announcementVisible.value = window.localStorage.getItem(ANNOUNCEMENT_KEY) !== '1'
  } catch {
    announcementVisible.value = true
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="sticky top-0 z-50">
    <Transition name="page">
      <div
        v-if="announcementVisible"
        class="relative bg-brand-800 text-white"
      >
        <div
          class="mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center text-caption font-medium md:text-small"
        >
          <span class="size-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
          <p>{{ t('marketing.announcement.text') }}</p>
          <RouterLink
            :to="isAuthenticated ? dashboardHref : '/waitlist'"
            class="hidden items-center gap-1 underline decoration-white/40 underline-offset-4 hover:decoration-white sm:inline-flex"
          >
            {{ isAuthenticated ? t('nav.dashboard') : t('marketing.announcement.action') }}
            <ArrowRight class="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </div>
        <button
          type="button"
          class="absolute inset-y-0 end-3 my-auto grid size-7 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          :aria-label="t('marketing.announcement.dismiss')"
          @click="dismissAnnouncement"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
    </Transition>

    <header
      class="border-b border-line/70 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2.5" :aria-label="t('app.name')">
          <AppLogo variant="full" :height="40" class-name="h-10 w-auto shrink-0 sm:h-9" />
        </RouterLink>

        <nav class="hidden items-center gap-1 lg:flex" :aria-label="t('marketing.nav.primary')">
          <RouterLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150"
            :class="[
              item.secondary ? 'hidden xl:inline-flex' : 'inline-flex',
              isActive(item.to)
                ? 'bg-brand-soft text-brand-ink'
                : 'text-muted hover:bg-surface-2 hover:text-ink',
            ]"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ t(item.key) }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-1.5">
          <div class="hidden items-center gap-1.5 lg:flex">
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
          </div>

          <template v-if="!isAuthenticated">
            <BaseButton to="/login" variant="ghost" size="sm" class="hidden sm:inline-flex">
              {{ t('marketing.nav.login') }}
            </BaseButton>
          </template>

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
                <span class="hidden max-w-32 truncate text-sm font-medium text-ink xl:block">
                  {{ user?.name }}
                </span>
                <ChevronDown class="hidden size-4 shrink-0 text-muted xl:block" aria-hidden="true" />
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

          <BaseButton
            v-if="!isAuthenticated"
            to="/waitlist"
            size="sm"
            class="hidden md:inline-flex"
          >
            {{ t('marketing.nav.waitlistCta') }}
          </BaseButton>

          <button
            type="button"
            class="btn-icon lg:hidden"
            :aria-expanded="menuOpen"
            aria-controls="public-mobile-menu"
            :aria-label="menuOpen ? t('action.closeMenu') : t('action.openMenu')"
            @click="menuOpen = !menuOpen"
          >
            <X v-if="menuOpen" class="size-5" aria-hidden="true" />
            <Menu v-else class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Transition name="page">
        <div
          v-if="menuOpen"
          id="public-mobile-menu"
          class="max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-5 pt-3 shadow-md lg:hidden"
        >
          <nav class="mx-auto grid max-w-7xl gap-1" :aria-label="t('marketing.nav.primary')">
            <RouterLink
              v-for="item in NAV"
              :key="`mobile-${item.to}`"
              :to="item.to"
              class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition"
              :class="
                isActive(item.to)
                  ? 'bg-brand-soft text-brand-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              "
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              {{ t(item.key) }}
              <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </RouterLink>
          </nav>

          <div class="mx-auto mt-3 flex max-w-7xl flex-col gap-2 border-t border-line pt-4">
            <BaseButton v-if="!isAuthenticated" to="/waitlist" block>
              {{ t('marketing.nav.waitlistCta') }}
            </BaseButton>
            <BaseButton v-if="!isAuthenticated" to="/login" variant="secondary" block>
              {{ t('marketing.nav.login') }}
            </BaseButton>
            <template v-else>
              <BaseButton :to="dashboardHref" variant="secondary" block>
                {{ t('nav.dashboard') }}
              </BaseButton>
              <BaseButton variant="ghost" block @click="handleLogout">
                {{ t('common.signOut') }}
              </BaseButton>
            </template>
          </div>

          <div class="mx-auto mt-4 max-w-7xl border-t border-line pt-4">
            <p class="flex items-center gap-2 px-1 text-caption font-semibold uppercase tracking-wide text-subtle">
              <SlidersHorizontal class="size-3.5" aria-hidden="true" />
              {{ t('marketing.nav.preferences') }}
            </p>

            <div class="mt-3 space-y-4">
              <div>
                <p
                  id="public-mobile-language-label"
                  class="px-1 text-small font-medium text-muted"
                >
                  {{ t('marketing.nav.language') }}
                </p>

                <div
                  class="mt-2 grid grid-cols-2 gap-2"
                  role="group"
                  aria-labelledby="public-mobile-language-label"
                >
                  <button
                    v-for="language in languages"
                    :key="`mobile-language-${language.code}`"
                    type="button"
                    class="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    :class="
                      locale === language.code
                        ? 'border-brand-soft-border bg-brand-soft text-brand-ink'
                        : 'border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink'
                    "
                    :aria-pressed="locale === language.code"
                    @click="setLocale(language.code)"
                  >
                    <span
                      class="inline-flex min-w-8 shrink-0 items-center justify-center rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {{ language.code.toUpperCase() }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">
                      {{ language.label }}
                    </span>
                    <Check
                      v-if="locale === language.code"
                      class="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div>
                <p
                  id="public-mobile-theme-label"
                  class="px-1 text-small font-medium text-muted"
                >
                  {{ t('marketing.nav.theme') }}
                </p>

                <div
                  class="mt-2 grid grid-cols-2 gap-2"
                  role="group"
                  aria-labelledby="public-mobile-theme-label"
                >
                  <button
                    v-for="option in themeOptions"
                    :key="`mobile-theme-${option.value}`"
                    type="button"
                    class="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    :class="
                      effectiveTheme === option.value
                        ? 'border-brand-soft-border bg-brand-soft text-brand-ink'
                        : 'border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink'
                    "
                    :aria-pressed="effectiveTheme === option.value"
                    @click="ui.setTheme(option.value)"
                  >
                    <component :is="option.icon" class="size-4 shrink-0" aria-hidden="true" />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">
                      {{ t(option.labelKey) }}
                    </span>
                    <Check
                      v-if="effectiveTheme === option.value"
                      class="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </header>
  </div>
</template>
