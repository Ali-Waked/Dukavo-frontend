<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { Moon, Sun } from '@/components/icons'
import AppLogo from '@/components/ui/AppLogo.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import MarketingFooter from '@/components/marketing/MarketingFooter.vue'

const { t } = useI18n()
const { isAuthenticated } = useAuth()
const { effectiveTheme, store: ui } = useTheme()
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
          <BaseButton to="/register" size="sm">
            {{ t('marketing.cta.startFree') }}
          </BaseButton>
        </template>
      </div>
    </header>

    <main class="relative z-10 flex-1">
      <RouterView />
    </main>

    <MarketingFooter />
  </div>
</template>
