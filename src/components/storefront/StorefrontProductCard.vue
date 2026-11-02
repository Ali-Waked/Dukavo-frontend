<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ShoppingBag } from '@/components/icons'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useI18n } from '@/i18n'
import { formatCurrency } from '@/utils/format'
import type { PublicProduct } from '@/types/storefront'

const props = defineProps<{
  product: PublicProduct
  basePath: string
  currencyDecimals?: number | null
}>()

const { t } = useI18n()

const primaryImage = computed(() => {
  const images = props.product.images ?? []
  return images.find((image) => image.is_primary) ?? images[0] ?? null
})

const hasMultiplePrices = computed(
  () => new Set(props.product.variants.map((variant) => variant.price)).size > 1,
)

const price = computed(() =>
  formatCurrency(props.product.price, props.product.currency, {
    decimals: props.currencyDecimals ?? undefined,
  }),
)
</script>

<template>
  <RouterLink
    :to="`${basePath}/products/${product.slug}`"
    class="surface surface-hover group flex h-full flex-col overflow-hidden"
  >
    <div class="relative aspect-4/3 overflow-hidden bg-inset">
      <img
        v-if="primaryImage"
        :src="primaryImage.url"
        :alt="primaryImage.alt_text || product.name"
        class="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div v-else class="grid size-full place-items-center text-subtle">
        <ShoppingBag class="size-10" aria-hidden="true" />
      </div>

      <span class="absolute start-3 top-3">
        <BaseBadge v-if="!product.in_stock" tone="danger" size="sm">
          {{ t('shop.product.outOfStock') }}
        </BaseBadge>
        <BaseBadge v-else-if="product.available <= 5" tone="warning" size="sm">
          {{ t('shop.product.lowStock') }}
        </BaseBadge>
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-4">
      <p v-if="product.category" class="text-caption font-medium uppercase tracking-wide text-subtle">
        {{ product.category.name }}
      </p>
      <h3 class="line-clamp-2 text-sm font-semibold text-ink">{{ product.name }}</h3>
      <p v-if="product.description" class="line-clamp-2 text-sm text-muted">
        {{ product.description }}
      </p>

      <div class="mt-auto flex items-end justify-between gap-2 pt-2">
        <div>
          <p v-if="hasMultiplePrices" class="text-caption text-subtle">
            {{ t('shop.product.from') }}
          </p>
          <p class="text-base font-semibold text-ink">{{ price }}</p>
        </div>
        <span class="text-caption text-muted">
          {{ t('shop.product.variantCount', { count: product.variants.length }) }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
