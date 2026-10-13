import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Interface chrome that has nothing to do with any one page: colour scheme,
 * navigation chrome, and their persistence. Pages read these; only this store
 * writes them.
 */

export type ThemePreference = 'light' | 'dark' | 'system'

const THEME_KEY = 'dukavo.theme'

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function preferredSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemePreference>((() => {
    const stored = localStorage.getItem(THEME_KEY)
    return isThemePreference(stored) ? stored : 'system'
  })())

  const mobileNavOpen = ref(false)
  const sidebarCollapsed = ref(false)

  /** The theme actually rendered, after resolving `system` against the OS. */
  const effectiveTheme = computed<'light' | 'dark'>(
    () => (theme.value !== 'system' ? theme.value : preferredSystemTheme()),
  )

  function applyTheme(): void {
    const dark = effectiveTheme.value === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }

  function setTheme(next: ThemePreference): void {
    theme.value = next
    localStorage.setItem(THEME_KEY, next)
    applyTheme()
  }

  function toggleTheme(): void {
    setTheme(effectiveTheme.value === 'dark' ? 'light' : 'dark')
  }

  function setMobileNavOpen(open: boolean): void {
    mobileNavOpen.value = open
  }

  function setSidebarCollapsed(collapsed: boolean): void {
    sidebarCollapsed.value = collapsed
  }

  return {
    theme,
    effectiveTheme,
    mobileNavOpen,
    sidebarCollapsed,
    setTheme,
    toggleTheme,
    setMobileNavOpen,
    setSidebarCollapsed,
  }
})