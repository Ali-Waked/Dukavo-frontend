<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Mail, MessageCircle, Phone, Store } from '@/components/icons'
import { useI18n } from '@/i18n'
import type { PublicStorefront } from '@/types/storefront'

const props = defineProps<{ store: PublicStorefront }>()

const { t } = useI18n()

const basePath = `/shop/${props.store.tenant_slug}/${props.store.slug}`
</script>

<template>
  <footer class="border-t border-line bg-surface">
    <div class="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
      <div class="space-y-2">
        <p class="flex items-center gap-2 text-sm font-semibold text-ink">
          <Store class="size-4 text-brand-ink" aria-hidden="true" />
          {{ store.name }}
        </p>
        <p v-if="store.description" class="max-w-sm text-sm text-muted">
          {{ store.description }}
        </p>
        <p v-if="store.settings.address" class="max-w-sm text-sm text-muted">
          {{ store.settings.address }}
        </p>
      </div>

      <div class="space-y-2 text-sm">
        <p class="font-semibold text-ink">{{ t('shop.footer.contact') }}</p>
        <a
          v-if="store.settings.contact_email || store.email"
          :href="`mailto:${store.settings.contact_email || store.email}`"
          class="flex items-center gap-2 text-muted transition hover:text-ink"
        >
          <Mail class="size-4 shrink-0" aria-hidden="true" />
          <span dir="ltr">{{ store.settings.contact_email || store.email }}</span>
        </a>
        <a
          v-if="store.settings.contact_phone || store.phone"
          :href="`tel:${store.settings.contact_phone || store.phone}`"
          class="flex items-center gap-2 text-muted transition hover:text-ink"
        >
          <Phone class="size-4 shrink-0" aria-hidden="true" />
          <span dir="ltr">{{ store.settings.contact_phone || store.phone }}</span>
        </a>
        <a
          v-if="store.settings.whatsapp_number"
          :href="`https://wa.me/${store.settings.whatsapp_number.replace(/[^0-9]/g, '')}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-muted transition hover:text-ink"
        >
          <MessageCircle class="size-4 shrink-0" aria-hidden="true" />
          <span dir="ltr">{{ store.settings.whatsapp_number }}</span>
        </a>
        <p v-if="store.settings.opening_hours" class="text-muted">
          {{ store.settings.opening_hours }}
        </p>
      </div>

      <div class="space-y-2 text-sm">
        <p class="font-semibold text-ink">{{ t('shop.footer.shop') }}</p>
        <RouterLink :to="basePath" class="block text-muted transition hover:text-ink">
          {{ t('shop.nav.home') }}
        </RouterLink>
        <RouterLink :to="`${basePath}/products`" class="block text-muted transition hover:text-ink">
          {{ t('shop.nav.catalogue') }}
        </RouterLink>
        <RouterLink :to="`${basePath}/cart`" class="block text-muted transition hover:text-ink">
          {{ t('shop.nav.cart') }}
        </RouterLink>
        <RouterLink :to="`${basePath}/track`" class="block text-muted transition hover:text-ink">
          {{ t('shop.nav.track') }}
        </RouterLink>
      </div>
    </div>

    <div class="border-t border-line px-4 py-4 text-center text-caption text-subtle md:px-6">
      {{ t('shop.footer.poweredBy') }}
    </div>
  </footer>
</template>
