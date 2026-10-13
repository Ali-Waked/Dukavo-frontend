<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { PLATFORM_WORKSPACE, useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import SidebarBody from './SidebarBody.vue'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

async function handleTenantChange(slug: string): Promise<void> {
  if (slug === PLATFORM_WORKSPACE) {
    if (auth.isPlatformMode) {
      return
    }
    await auth.enterPlatformMode()
    await router.replace({ name: 'platform.dashboard' })
    return
  }

  if (!slug || slug === auth.activeTenant?.slug) {
    return
  }

  try {
    await auth.switchTenant(slug)
    await router.replace({ path: route.path, query: route.query })
  } catch {
    // The toast system reports the failure; the selector keeps its value truthfully.
  }
}

async function handleLogout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'auth.login' })
}
</script>

<template>
  <!-- Desktop rail -->
  <aside
    class="fixed inset-y-0 start-0 z-40 hidden w-72 flex-col border-e border-line bg-surface lg:flex"
    :class="ui.sidebarCollapsed ? '!w-20' : ''"
  >
    <SidebarBody
      :collapsed="ui.sidebarCollapsed"
      @navigate="ui.setSidebarCollapsed(false)"
      @logout="handleLogout"
      @tenant="handleTenantChange"
    />
  </aside>

  <!-- Mobile drawer -->
  <Transition name="sheet">
    <div v-if="ui.mobileNavOpen" class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" @click="ui.setMobileNavOpen(false)" />
      <aside
        class="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col border-e border-line bg-surface shadow-2xl"
      >
        <SidebarBody :collapsed="false" @navigate="ui.setMobileNavOpen(false)" @logout="handleLogout" @tenant="handleTenantChange" />
      </aside>
    </div>
  </Transition>
</template>