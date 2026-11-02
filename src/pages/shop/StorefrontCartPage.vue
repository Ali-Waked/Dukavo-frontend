<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, ShoppingBag, ShoppingCart, Trash2 } from '@/components/icons'
import QuantityStepper from '@/components/storefront/QuantityStepper.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useI18n } from '@/i18n'
import { useStorefrontStore } from '@/stores/storefrontStore'
import { useStorefrontCartStore } from '@/stores/storefrontCartStore'
import { formatCurrency } from '@/utils/format'

/**
 * The basket.
 *
 * Totals here are an estimate by design: the server re-reads every price and
 * stock level at checkout, and the delivery fee depends on the address. The
 * line items stay editable so a shopper can fix quantities before that happens.
 */

const { t } = useI18n()
const storefront = useStorefrontStore()
const cart = useStorefrontCartStore()

const clearOpen = ref(false)

const basePath = computed(() => storefront.basePath)
const currencyDecimals = computed(() => storefront.storefront?.currency_decimals ?? undefined)

function money(value: number, currency: string | null | undefined): string {
  return formatCurrency(value, currency ?? storefront.storefront?.currency ?? undefined, {
    decimals: currencyDecimals.value,
  })
}

const subtotalLabel = computed(() =>
  money(cart.subtotal, cart.currency ?? storefront.storefront?.currency),
)

function confirmClear(): void {
  cart.clear()
  clearOpen.value = false
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-10">
    <div>
      <h1 class="text-h1 font-semibold tracking-tight text-ink">{{ t('shop.cart.title') }}</h1>
      <p class="mt-1.5 text-body text-muted">{{ t('shop.cart.subtitle') }}</p>
    </div>

    <div v-if="cart.isEmpty" class="surface">
      <BaseEmptyState
        :icon="ShoppingCart"
        :title="t('shop.cart.emptyTitle')"
        :description="t('shop.cart.emptyBody')"
      >
        <template #action>
          <BaseButton :to="`${basePath}/products`" :icon="ShoppingBag">
            {{ t('shop.cart.browse') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <div v-else class="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div class="space-y-3">
        <BaseAlert tone="info">{{ t('shop.cart.estimateNote') }}</BaseAlert>

        <div class="surface divide-y divide-line">
          <article
            v-for="line in cart.lines"
            :key="line.variantId"
            class="flex gap-4 p-4"
          >
            <RouterLink
              :to="`${basePath}/products/${line.productSlug}`"
              class="size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-inset"
            >
              <img
                v-if="line.imageUrl"
                :src="line.imageUrl"
                :alt="line.productName"
                class="size-full object-cover"
              />
              <span v-else class="grid size-full place-items-center text-subtle">
                <ShoppingBag class="size-6" aria-hidden="true" />
              </span>
            </RouterLink>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <RouterLink
                    :to="`${basePath}/products/${line.productSlug}`"
                    class="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-ink"
                  >
                    {{ line.productName }}
                  </RouterLink>
                  <p class="mt-0.5 text-caption text-muted">{{ line.variantName }}</p>
                  <p v-if="line.sku" class="text-caption text-subtle" dir="ltr">{{ line.sku }}</p>
                </div>

                <button
                  type="button"
                  class="btn-icon size-8 shrink-0 text-muted hover:text-danger-ink"
                  :aria-label="t('shop.cart.removeItem', { name: line.productName })"
                  @click="cart.removeLine(line.variantId)"
                >
                  <Trash2 class="size-4" aria-hidden="true" />
                </button>
              </div>

              <div class="flex flex-wrap items-end justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-caption text-subtle">
                    {{ t('shop.cart.unitPrice', { price: money(line.unitPrice, line.currency) }) }}
                  </p>
                  <QuantityStepper
                    :model-value="line.quantity"
                    :max="Math.max(1, line.available)"
                    :label="t('shop.cart.quantityFor', { name: line.productName })"
                    @update:model-value="cart.setQuantity(line.variantId, $event)"
                  />
                </div>

                <p class="text-sm font-semibold tabular-nums text-ink">
                  {{ money(line.unitPrice * line.quantity, line.currency) }}
                </p>
              </div>

              <p v-if="line.available <= 5" class="text-caption text-warning-ink">
                {{ t('shop.cart.lowStock', { count: line.available }) }}
              </p>
            </div>
          </article>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <BaseButton :to="`${basePath}/products`" variant="ghost" :icon="ShoppingBag">
            {{ t('shop.cart.continueShopping') }}
          </BaseButton>
          <BaseButton variant="ghost" :icon="Trash2" @click="clearOpen = true">
            {{ t('shop.cart.clear') }}
          </BaseButton>
        </div>
      </div>

      <aside class="surface space-y-4 p-5 lg:sticky lg:top-24">
        <h2 class="text-h4 font-semibold text-ink">{{ t('shop.cart.summary') }}</h2>

        <dl class="space-y-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.cart.items', { count: cart.itemCount }) }}</dt>
            <dd class="font-medium tabular-nums text-ink">{{ subtotalLabel }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">{{ t('shop.cart.delivery') }}</dt>
            <dd class="text-muted">{{ t('shop.cart.deliveryAtCheckout') }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line pt-2 text-base">
            <dt class="font-semibold text-ink">{{ t('shop.cart.estimatedTotal') }}</dt>
            <dd class="font-semibold tabular-nums text-ink">{{ subtotalLabel }}</dd>
          </div>
        </dl>

        <p class="text-caption text-subtle">{{ t('shop.cart.deliveryNote') }}</p>

        <BaseButton :to="`${basePath}/checkout`" size="lg" block>
          {{ t('shop.cart.checkout') }}
          <ArrowRight class="ms-1 size-4 rtl:rotate-180" aria-hidden="true" />
        </BaseButton>
      </aside>
    </div>

    <BaseModal
      :open="clearOpen"
      :title="t('shop.cart.clearTitle')"
      :description="t('shop.cart.clearBody')"
      size="sm"
      @close="clearOpen = false"
    >
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="clearOpen = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :icon="Trash2" @click="confirmClear">
          {{ t('shop.cart.clear') }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
