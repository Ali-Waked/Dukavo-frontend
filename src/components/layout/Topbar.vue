<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { Bell, ChevronDown, LogOut, Menu, Moon, Settings, Sun, UserCog } from '@/components/icons'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const userMenuOpen = ref(false)
const userMenuButton = ref<HTMLButtonElement | null>(null)

const pageTitle = computed(() => String(route.meta.title ?? t('app.name')))

function onDocumentClick(event: MouseEvent): void {
  if (userMenuOpen.value && userMenuButton.value && !userMenuButton.value.contains(event.target as Node)) {
    userMenuOpen.value = false
  }
}

document.addEventListener('click', onDocumentClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

async function handleLogout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'auth.login' })
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

      <button
        type="button"
        class="btn-icon relative"
        :title="t('nav.notifications') ?? 'Notifications'"
        aria-label="Notifications"
      >
        <Bell class="size-5" />
        <span class="pointer-events-none absolute end-1.5 top-1.5 size-2 rounded-full bg-accent-400 ring-2 ring-surface" />
      </button>

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

    <div class="relative">
      <button
        ref="userMenuButton"
        type="button"
        class="flex items-center gap-2 rounded-lg px-1.5 py-1 text-start transition hover:bg-surface-2"
        @click="userMenuOpen = !userMenuOpen"
      >
        <UserAvatar :name="auth.user?.name" :src="auth.user?.avatar_url" size="sm" />
        <span class="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
          {{ auth.user?.name }}
        </span>
        <ChevronDown class="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
      </button>

      <Transition name="pop">
        <div
          v-if="userMenuOpen"
          class="absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div class="border-b border-line px-4 py-3">
            <p class="truncate text-sm font-semibold text-ink">{{ auth.user?.name }}</p>
            <p class="truncate text-xs text-muted">{{ auth.user?.email }}</p>
          </div>
          <div class="p-1.5">
            <RouterLink
              to="/profile"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="userMenuOpen = false"
            >
              <UserCog class="size-4 text-muted" aria-hidden="true" />
              {{ t('nav.profile') }}
            </RouterLink>
            <RouterLink
              to="/settings"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="userMenuOpen = false"
            >
              <Settings class="size-4 text-muted" aria-hidden="true" />
              {{ t('nav.settings') }}
            </RouterLink>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-surface-2"
              @click="handleLogout()"
            >
              <LogOut class="size-4 text-muted" aria-hidden="true" />
              {{ t('common.signOut') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </header>
</template>