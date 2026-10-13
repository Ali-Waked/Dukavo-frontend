<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { PLATFORM_WORKSPACE, useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { SETTINGS_NAV_ITEM, visibleNavGroups, type NavItem } from '@/constants/navigation'
import { LogOut, Settings } from '@/components/icons'
import AppLogo from '@/components/ui/AppLogo.vue'

/**
 * The reusable sidebar frame: brand, tenant switch, groups, then utilities.
 * Both the desktop rail and the mobile drawer render this; `collapsed` picks
 * the desktop rail's icon-only form, and the tenant selector hides when
 * collapsed because a rail that can't show options is just ambiguity.
 */

const props = defineProps<{
  /** Icons-only mode for the collapsed desktop rail. */
  collapsed?: boolean
}>()

const emit = defineEmits<{
  navigate: []
  logout: []
  tenant: [slug: string]
}>()

const auth = useAuthStore()
const { t } = useI18n()
const route = useRoute()

const groups = computed(() =>
  // The context chooses the whole menu: the platform overview in platform
  // mode, the merchant workspace otherwise. Permission-gated merchant items
  // are filtered out so a link never lands on a page the caller cannot open.
  visibleNavGroups(auth.isPlatformMode, auth.can),
)

const showSettings = computed(() => !SETTINGS_NAV_ITEM.permission || auth.can(SETTINGS_NAV_ITEM.permission))
const showTenantSwitch = computed(
  // A platform operator needs the switcher even with a single membership so
  // they can step back out to the platform context.
  () => !props.collapsed && (auth.tenants.length > 1 || auth.isPlatformUser),
)

function isActive(item: NavItem): boolean {
  if (item.end) {
    return route.path === item.to
  }
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Brand -->
    <div class="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-line px-4" :class="collapsed ? 'justify-center !px-0' : ''">
      <AppLogo v-if="collapsed" variant="icon" :height="36" class-name="shrink-0" />
      <AppLogo v-else variant="full" :height="32" class-name="shrink-0 max-h-[36px] w-auto" />
    </div>

    <!-- Tenant switch -->
    <div v-if="showTenantSwitch" class="shrink-0 px-3 pt-3">
      <select
        class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink focus-ring"
        :value="auth.activeTenant?.slug ?? PLATFORM_WORKSPACE"
        aria-label="Workspace"
        @change="(event) => emit('tenant', (event.target as HTMLSelectElement).value)"
      >
        <option v-if="auth.isPlatformUser" :value="PLATFORM_WORKSPACE">
          {{ t('nav.platformMode') }}
        </option>
        <option v-for="membership in auth.tenants" :key="membership.slug" :value="membership.slug">
          {{ membership.name }}
        </option>
      </select>
    </div>

    <!-- Navigation -->
    <nav class="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
      <div v-for="group in groups" :key="group.key">
        <p v-if="!collapsed" class="side-group-label">{{ t(group.labelKey) }}</p>
        <ul class="mt-1 space-y-0.5">
          <li v-for="item in group.items" :key="item.key">
            <RouterLink
              :to="item.to"
              class="side-link"
              :class="{ active: isActive(item) }"
              :title="collapsed ? t(item.labelKey) : undefined"
              @click="$emit('navigate')"
            >
              <component :is="item.icon" class="size-[18px] shrink-0" aria-hidden="true" />
              <span v-if="!collapsed" class="truncate">{{ t(item.labelKey) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Utilities -->
    <div class="shrink-0 border-t border-line p-3">
      <ul class="space-y-0.5">
        <li v-if="showSettings">
          <RouterLink
            :to="SETTINGS_NAV_ITEM.to"
            class="side-link"
            :class="{ active: isActive(SETTINGS_NAV_ITEM) }"
            :title="collapsed ? t(SETTINGS_NAV_ITEM.labelKey) : undefined"
            @click="$emit('navigate')"
          >
            <Settings class="size-[18px] shrink-0" aria-hidden="true" />
            <span v-if="!collapsed" class="truncate">{{ t(SETTINGS_NAV_ITEM.labelKey) }}</span>
          </RouterLink>
        </li>
        <li>
          <button type="button" class="side-link w-full" @click="$emit('logout')">
            <LogOut class="size-[18px] shrink-0" aria-hidden="true" />
            <span v-if="!collapsed" class="truncate">{{ t('common.signOut') }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>