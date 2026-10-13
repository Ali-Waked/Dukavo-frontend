<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useI18n } from '@/i18n'
import { useTheme } from '@/composables/useTheme'
import { Moon, Sun } from '@/components/icons'
import AppLogo from '@/components/ui/AppLogo.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const { t } = useI18n()
const { effectiveTheme, store: ui } = useTheme()
</script>

<template>
  <div class="relative flex min-h-dvh flex-col bg-canvas">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-gradient-to-b from-brand-100/70 to-transparent dark:from-brand-700/10"
    />

    <header class="flex items-center justify-between px-4 py-4 md:px-8">
      <div class="flex items-center gap-2.5">
        <AppLogo variant="full" :height="32" class-name="shrink-0 max-h-[36px] w-auto" />
      </div>

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
      </div>
    </header>

    <main class="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4 md:px-8">
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </main>
  </div>
</template>