import { onBeforeUnmount, ref } from 'vue'

/**
 * Reactive breakpoints, matching the Tailwind theme's breakpoints.
 *
 * `isMobile` follows `lg` (1024px): below that the sidebar collapses into an
 * overlay. Exposed as a single composable so breakpoint logic is not scattered
 * across layout components with hand-rolled matches.
 */
export function useResponsive() {
  const isMobile = ref(false)
  const isDesktop = ref(false)

  const mobileQuery = window.matchMedia('(max-width: 1023.98px)')
  const desktopQuery = window.matchMedia('(min-width: 1024px)')

  function update(): void {
    isMobile.value = mobileQuery.matches
    isDesktop.value = desktopQuery.matches
  }

  update()

  mobileQuery.addEventListener('change', update)
  desktopQuery.addEventListener('change', update)

  onBeforeUnmount(() => {
    mobileQuery.removeEventListener('change', update)
    desktopQuery.removeEventListener('change', update)
  })

  return { isMobile, isDesktop }
}