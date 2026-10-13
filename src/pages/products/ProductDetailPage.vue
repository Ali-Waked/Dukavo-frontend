<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MoreHorizontal, Package, Pencil, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { deleteProduct, fetchProduct } from '@/services/productService'
import type { Product } from '@/types/catalogue'
import { statusTone } from '@/utils/status'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'

/**
 * One product, read-only.
 *
 * A deleted product gets a plain explanation and a way back (404 is a state,
 * not an error), while a transport failure keeps the page and offers a retry.
 * Images are shown as they are stored — uploading is its own concern and does
 * not belong on a page whose job is to answer "what is this product?".
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const product = ref<Product | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const confirmingDelete = ref(false)
const deleting = ref(false)

const productSlug = computed(() => String(route.params.slug ?? ''))
const canUpdate = computed(() => auth.can('products.update'))
const canDelete = computed(() => auth.can('products.delete'))

const variants = computed(() => product.value?.variants ?? [])
const hasVariantStock = computed(() => variants.value.some((variant) => variant.stock !== undefined))
const images = computed(() =>
  (product.value?.images ?? []).filter((image) => Boolean(image.url ?? image.path)),
)

const variantColumns = computed<TableColumn[]>(() => {
  const columns: TableColumn[] = [
    { key: 'name', label: t('common.name') },
    { key: 'sku', label: t('products.sku') },
    { key: 'price', label: t('products.price'), align: 'end' },
    { key: 'cost', label: t('products.cost'), align: 'end' },
  ]

  if (hasVariantStock.value) {
    columns.push({ key: 'stock', label: t('products.stock'), align: 'end' })
  }

  columns.push({ key: 'default', label: t('products.default'), align: 'end' })
  return columns
})

async function load(): Promise<void> {
  const slug = productSlug.value
  if (slug === '') {
    product.value = null
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  notFound.value = false

  try {
    product.value = await fetchProduct(slug)
  } catch (caught) {
    product.value = null
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      error.value =
        caught instanceof ApiError && caught.isNetworkError
          ? t('auth.networkError')
          : caught instanceof ApiError && caught.message
            ? caught.message
            : t('error.title')
    }
  } finally {
    loading.value = false
  }
}

async function confirmDelete(): Promise<void> {
  const current = product.value
  if (!current) return

  deleting.value = true
  try {
    await deleteProduct(current.slug)
    toast.success(t('products.deleted'))
    confirmingDelete.value = false
    await router.push({ name: 'catalogue.products' })
  } catch (caught) {
    // 409 = the product has been ordered; the server's sentence explains why
    // far better than a generic failure would.
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    deleting.value = false
  }
}

watch(productSlug, () => {
  product.value = null
  confirmingDelete.value = false
  void load()
})

onMounted(() => void load())
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="space-y-5">
      <BaseSkeleton height="h-8" block />
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <BaseSkeleton class="xl:col-span-2" :rows="6" height="h-5" />
        <BaseSkeleton :rows="5" height="h-5" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="notFound"
      :icon="Package"
      :title="t('products.notFound')"
      :description="t('products.notFoundBody')"
    >
      <template #action>
        <BaseButton to="/products">{{ t('products.backToList') }}</BaseButton>
      </template>
    </BaseEmptyState>

    <BaseAlert v-else-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <template v-else-if="product">
      <PageHeader :title="product.name">
        <template #actions>
          <RouterLink
            :to="{ name: 'catalogue.products' }"
            class="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ArrowLeft class="size-4 rtl:-scale-x-100" />
            {{ t('products.backToList') }}
          </RouterLink>

          <BaseBadge :tone="statusTone(product.status)" dot>
            {{ product.status_label }}
          </BaseBadge>

          <BaseButton
            v-if="canUpdate"
            variant="secondary"
            :icon="Pencil"
            @click="router.push({ name: 'catalogue.products.edit', params: { slug: product.slug } })"
          >
            {{ t('action.edit') }}
          </BaseButton>

          <BaseDropdown v-if="canDelete" align="end">
            <template #trigger>
              <span
                class="btn-icon"
                role="button"
                :aria-label="t('action.moreActions')"
                :title="t('action.moreActions')"
              >
                <MoreHorizontal class="size-5" />
              </span>
            </template>

            <template #default="{ close }">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                @click="close(); confirmingDelete = true"
              >
                <Trash2 class="size-4" />
                {{ t('action.delete') }}
              </button>
            </template>
          </BaseDropdown>
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div class="space-y-5 xl:col-span-2">
          <!-- Description -->
          <section class="surface p-5" :aria-label="t('common.description')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('common.description') }}</h2>

            <p v-if="product.description" class="mt-3 whitespace-pre-wrap text-body text-muted">
              {{ product.description }}
            </p>
            <p v-else class="mt-3 text-sm text-subtle">{{ t('products.noDescription') }}</p>
          </section>

          <!-- Variants -->
          <section class="surface p-5" :aria-label="t('products.variants')">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-h4 font-semibold text-ink">{{ t('products.variants') }}</h2>
              <span class="text-caption text-subtle">
                {{ t('products.variantCount', { count: variants.length }) }}
              </span>
            </div>

            <div class="mt-4">
              <BaseTable :columns="variantColumns">
                <tr v-for="variant in variants" :key="variant.id">
                  <td class="px-4 py-3 font-medium text-ink">{{ variant.name }}</td>

                  <td class="px-4 py-3 text-muted">{{ variant.sku || '—' }}</td>

                  <td class="px-4 py-3 text-end tabular-nums text-ink">
                    {{ formatCurrency(variant.price, product.currency) }}
                  </td>

                  <td class="px-4 py-3 text-end tabular-nums text-muted">
                    {{ formatCurrency(variant.cost, product.currency) }}
                  </td>

                  <td v-if="hasVariantStock" class="px-4 py-3 text-end tabular-nums text-muted">
                    {{ variant.stock ? formatNumber(variant.stock.quantity) : '—' }}
                  </td>

                  <td class="px-4 py-3 text-end">
                    <BaseBadge v-if="variant.is_default" tone="brand" size="sm">
                      {{ t('products.default') }}
                    </BaseBadge>
                    <span v-else class="text-subtle">—</span>
                  </td>
                </tr>

                <template #empty>
                  <BaseEmptyState
                    v-if="variants.length === 0"
                    compact
                    :title="t('products.variants')"
                    :description="t('state.empty')"
                  />
                </template>
              </BaseTable>
            </div>
          </section>
        </div>

        <div class="space-y-5">
          <!-- Summary -->
          <section class="surface p-5" :aria-label="t('products.details')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('products.details') }}</h2>

            <!-- Single column: the side rail is only ever a third of the grid. -->
            <dl class="mt-4 space-y-4">
              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('products.price') }}
                </dt>
                <dd class="mt-1 text-sm font-medium tabular-nums text-ink">
                  {{ formatCurrency(product.price, product.currency) }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('products.cost') }}
                </dt>
                <dd class="mt-1 text-sm tabular-nums text-ink">
                  {{ formatCurrency(product.cost, product.currency) }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('products.sku') }}
                </dt>
                <dd class="mt-1 break-words text-sm text-ink">{{ product.sku || '—' }}</dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.category') }}
                </dt>
                <dd class="mt-1 break-words text-sm text-ink">
                  {{ product.category?.name ?? '—' }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('products.taxable') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">
                  {{ product.is_taxable ? t('common.yes') : t('common.no') }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.createdAt') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ formatDateTime(product.created_at) }}</dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.updatedAt') }}
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ formatDateTime(product.updated_at) }}</dd>
              </div>
            </dl>
          </section>

          <!-- Stock -->
          <section
            v-if="product.stock"
            class="surface p-5"
            :aria-label="t('products.stock')"
          >
            <h2 class="text-h4 font-semibold text-ink">{{ t('products.stock') }}</h2>

            <dl class="mt-4 space-y-4">
              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('common.quantity') }}
                </dt>
                <dd class="mt-1 text-sm font-medium tabular-nums text-ink">
                  {{ formatNumber(product.stock.quantity) }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('inventory.reserved') }}
                </dt>
                <dd class="mt-1 text-sm tabular-nums text-ink">
                  {{ formatNumber(product.stock.reserved) }}
                </dd>
              </div>

              <div>
                <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                  {{ t('inventory.available') }}
                </dt>
                <dd class="mt-1 text-sm tabular-nums text-ink">
                  {{ formatNumber(product.stock.available) }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Images -->
          <section class="surface p-5" :aria-label="t('products.images')">
            <h2 class="text-h4 font-semibold text-ink">{{ t('products.images') }}</h2>

            <div v-if="images.length > 0" class="mt-4 grid grid-cols-3 gap-3">
              <img
                v-for="image in images"
                :key="image.id"
                :src="image.url ?? image.path"
                :alt="image.alt ?? ''"
                loading="lazy"
                class="aspect-square w-full rounded-lg border border-line object-cover"
              />
            </div>

            <div
              v-else
              class="mt-4 rounded-lg border border-dashed border-line bg-surface-2 px-4 py-8 text-center text-sm text-subtle"
            >
              {{ t('products.images') }}
            </div>
          </section>
        </div>
      </div>
    </template>

    <!-- Delete confirmation -->
    <BaseModal
      :open="confirmingDelete"
      :title="t('products.deleteTitle')"
      size="sm"
      @close="confirmingDelete = false"
    >
      <p class="text-sm text-muted">
        {{ t('products.deleteBody', { name: product?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="confirmingDelete = false">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
