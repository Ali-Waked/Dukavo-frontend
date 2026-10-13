<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Bell, Lock, SlidersHorizontal, Store, type LucideIcon } from '@/components/icons'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/composables/usePermissions'
import PageHeader from '@/components/ui/PageHeader.vue'

/**
 * Shell for the settings area.
 *
 * Settings is one destination with several facets, so the facets are tabs of a
 * single screen rather than separate sidebar entries. The Workspace tab is
 * filtered on `settings.view` — the same slug its route guard checks — so a
 * staff member never sees a door they cannot open.
 */

const { t } = useI18n()
const { can } = usePermissions()
const route = useRoute()

const tabs = computed<Array<{ name: string; label: string; icon: LucideIcon; permission?: string }>>(
  () =>
    [
      { name: 'settings.index', label: t('settings.tabs.general'), icon: SlidersHorizontal },
      { name: 'settings.security', label: t('settings.tabs.security'), icon: Lock },
      { name: 'settings.notifications', label: t('settings.tabs.notifications'), icon: Bell },
      {
        name: 'settings.workspace',
        label: t('settings.tabs.workspace'),
        icon: Store,
        permission: 'settings.view',
      },
    ].filter((tab) => !tab.permission || can(tab.permission)),
)

function isActive(name: string): boolean {
  return route.name === name
}
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <PageHeader :title="t('settings.title')" :description="t('settings.subtitle')" />

    <nav
      class="flex items-center gap-1 overflow-x-auto border-b border-line"
      :aria-label="t('settings.title')"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :class="
          isActive(tab.name)
            ? 'border-brand-700 text-brand-ink'
            : 'border-transparent text-muted hover:border-line hover:text-ink'
        "
        :aria-current="isActive(tab.name) ? 'page' : undefined"
      >
        <component :is="tab.icon" class="size-4" aria-hidden="true" />
        {{ tab.label }}
      </RouterLink>
    </nav>

    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
