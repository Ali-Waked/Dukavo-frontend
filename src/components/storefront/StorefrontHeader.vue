<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowRight,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Truck,
  X,
} from '@/components/icons'
import BaseButton from '@/components/ui/BaseButton.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useI18n } from '@/i18n'
import type { PublicStorefront } from '@/types/storefront'

/**
 * The shop's own header.
 *
 * This is deliberately not the Dukavo marketing header: a customer is shopping
 * with the merchant, so the merchant's name, logo and navigation lead and the
 * platform is only credited in the footer.
 */

const props = defineProps<{
  store: PublicStorefront
  cartCount: number
}>()

const { t } = useI18n()
const route = useRoute()

const menuOpen = ref(false)
const basePath = computed(() => `/shop/${props.store.tenant_slug}/${props.store.slug}`)

const links = computed(() => [
  { to: basePath.value, label: t('shop.nav.home'), exact: true },
  { to: `${basePath.value}/products`, label: t('shop.nav.catalogue'), exact: false },
  { to: `${basePath.value}/track`, label: t('shop.nav.track'), exact: false },
])

function isActive(to: string, exact: boolean): boolean {
  if (exact) return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') menuOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
      <RouterLink :to="basePath" class="flex min-w-0 items-center gap-2.5">
        <img
          v-if="store.logo_url"
          :src="store.logo_url"
          :alt="store.name"
          class="size-9 shrink-0 rounded-lg object-cover"
        />
        <span
          v-else
          class="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <ShoppingBag class="size-5" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-base font-semibold text-ink">{{ store.name }}</span>
          <span
            v-if="store.settings.tagline"
            class="block truncate text-caption text-muted"
          >
            {{ store.settings.tagline }}
          </span>
        </span>
      </RouterLink>

      <nav class="ms-6 hidden items-center gap-1 md:flex" :aria-label="t('shop.nav.primary')">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition"
          :class="
            isActive(link.to, link.exact)
              ? 'bg-brand-soft text-brand-ink'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          "
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="ms-auto flex items-center gap-1.5">
        <div class="hidden md:block">
          <LanguageSwitcher />
        </div>

        <RouterLink
          :to="`${basePath}/cart`"
          class="relative inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition hover:bg-surface-2"
          :aria-label="t('shop.nav.cartWithCount', { count: cartCount })"
        >
          <ShoppingCart class="size-5" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t('shop.nav.cart') }}</span>
          <span
            v-if="cartCount > 0"
            class="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-caption font-semibold text-white"
          >
            {{ cartCount > 99 ? '99+' : cartCount }}
          </span>
        </RouterLink>

        <button
          type="button"
          class="btn-icon md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="storefront-mobile-menu"
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
        id="storefront-mobile-menu"
        class="border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden"
      >
        <nav class="flex flex-col gap-1" :aria-label="t('shop.nav.primary')">
          <RouterLink
            v-for="link in links"
            :key="`mobile-${link.to}`"
            :to="link.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
            :class="
              isActive(link.to, link.exact)
                ? 'bg-brand-soft text-brand-ink'
                : 'text-muted hover:bg-surface-2 hover:text-ink'
            "
          >
            <component
              :is="link.exact ? ShoppingBag : link.to.endsWith('/track') ? Truck : ShoppingCart"
              class="size-4"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ link.label }}</span>
            <ArrowRight class="size-4 rtl:rotate-180" aria-hidden="true" />
          </RouterLink>
        </nav>

        <div class="mt-3 border-t border-line pt-3">
          <BaseButton :to="`${basePath}/cart`" variant="secondary" block :icon="ShoppingCart">
            {{ t('shop.nav.cartWithCount', { count: cartCount }) }}
          </BaseButton>
        </div>
      </div>
    </Transition>
  </header>
</template>
