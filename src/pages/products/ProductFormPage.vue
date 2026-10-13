<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Package, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useSlugAvailability } from '@/composables/useSlugAvailability'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { fetchCategories } from '@/services/categoryService'
import {
  checkProductSlug,
  createProduct,
  deleteProduct,
  fetchProduct,
  updateProduct,
  type ProductPayload,
} from '@/services/productService'
import type { Category, Product } from '@/types/catalogue'
import type { ProductStatus } from '@/types/enums'
import { formatDateTime, formatNumber } from '@/utils/format'

/**
 * Create and edit a product in one screen.
 *
 * The two modes share a single form because a product is the same object
 * either way — only the request and where the user lands afterwards differ.
 * Variants are deliberately absent: the server creates the first one, and a
 * variant editor belongs on its own surface rather than half-built here.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const editingSlug = computed(() =>
  typeof route.params.slug === 'string' && route.params.slug !== '' ? route.params.slug : null,
)
const isEditing = computed(() => editingSlug.value !== null)

// Starts true on the edit route so the form never flashes empty before the
// product it is about has arrived.
const loading = ref(editingSlug.value !== null)
const notFound = ref(false)
const loadError = ref<string | null>(null)

const allowed = computed(() => auth.can(isEditing.value ? 'products.update' : 'products.create'))
const canDelete = computed(() => auth.can('products.delete'))
const currency = computed(() => auth.activeTenant?.currency ?? '')

const product = ref<Product | null>(null)
const categories = ref<Category[]>([])

const name = ref('')
const slug = ref('')
const description = ref('')
const status = ref<string>('draft')
const categoryId = ref('')
const price = ref('')
const cost = ref('')
const isTaxable = ref(true)

const nameError = ref<string | null>(null)
const slugError = ref<string | null>(null)
const priceError = ref<string | null>(null)
const costError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const confirmingDelete = ref(false)
const deleting = ref(false)

// Live slug check. The product's own id is ignored so re-saving an unchanged
// slug is not reported as taken.
const editingProductId = computed(() => product.value?.id ?? null)
const slugAvailability = useSlugAvailability(slug, checkProductSlug, {
  ignore: editingProductId,
})

const slugHint = computed(() => {
  switch (slugAvailability.state.value) {
    case 'checking':
      return t('slug.checking')
    case 'available':
      return t('slug.available')
    case 'taken':
      return t('slug.taken')
    default:
      return t('slug.autoHint')
  }
})

const statusOptions = computed(() => [
  { value: 'draft', label: t('status.product.draft') },
  { value: 'active', label: t('status.product.active') },
  { value: 'archived', label: t('status.product.archived') },
])

const categoryOptions = computed(() => [
  { value: '', label: t('common.none') },
  ...categories.value.map((category) => ({ value: String(category.id), label: category.name })),
])

/* -------------------------------------------------------------------- load */

async function load(): Promise<void> {
  const target = editingSlug.value

  if (target === null) {
    loading.value = false
    return
  }

  loading.value = true
  notFound.value = false
  loadError.value = null

  try {
    const loaded = await fetchProduct(target)
    product.value = loaded
    prefill(loaded)
  } catch (caught) {
    product.value = null
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      loadError.value =
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

async function loadCategories(): Promise<void> {
  try {
    categories.value = await fetchCategories()
  } catch {
    // A category is optional and the server accepts a product without one, so
    // a failed lookup degrades to the "None" option instead of blocking the form.
    categories.value = []
  }
}

function prefill(loaded: Product): void {
  name.value = loaded.name
  slug.value = loaded.slug
  description.value = loaded.description ?? ''
  status.value = loaded.status
  categoryId.value = loaded.category_id === null ? '' : String(loaded.category_id)
  price.value = String(loaded.price)
  cost.value = String(loaded.cost)
  isTaxable.value = loaded.is_taxable
  clearErrors()
}

function resetForm(): void {
  name.value = ''
  slug.value = ''
  description.value = ''
  status.value = 'draft'
  categoryId.value = ''
  price.value = ''
  cost.value = ''
  isTaxable.value = true
  clearErrors()
}

/* ---------------------------------------------------------------- validate */

function clearErrors(): void {
  nameError.value = null
  slugError.value = null
  priceError.value = null
  costError.value = null
  formError.value = null
}

function validate(): boolean {
  clearErrors()

  if (!name.value.trim()) {
    nameError.value = t('validation.required')
  }

  if (!price.value.trim()) {
    priceError.value = t('validation.required')
  } else if (!Number.isFinite(Number(price.value))) {
    priceError.value = t('validation.number')
  } else if (Number(price.value) < 0) {
    priceError.value = t('validation.positive')
  }

  if (cost.value.trim()) {
    if (!Number.isFinite(Number(cost.value))) {
      costError.value = t('validation.number')
    } else if (Number(cost.value) < 0) {
      costError.value = t('validation.positive')
    }
  }

  // A known-taken slug would only come back as a 422; catching it here saves a
  // round trip and points at the field directly.
  if (slugAvailability.state.value === 'taken') {
    slugError.value = t('slug.taken')
  }

  return (
    nameError.value === null &&
    slugError.value === null &&
    priceError.value === null &&
    costError.value === null
  )
}

/* ------------------------------------------------------------------ submit */

function buildPayload(): ProductPayload {
  const payload: ProductPayload = {
    name: name.value.trim(),
    description: description.value.trim() || null,
    status: status.value as ProductStatus,
    price: Number(price.value),
    is_taxable: isTaxable.value,
    category_id: categoryId.value === '' ? null : Number(categoryId.value),
  }

  if (slug.value.trim()) {
    payload.slug = slug.value.trim()
  }

  // A blank cost is omitted rather than sent as zero: the server's rule has no
  // `nullable`, so clearing the field must leave the stored value untouched.
  if (cost.value.trim()) {
    payload.cost = Number(cost.value)
  }

  if (editingSlug.value === null && currency.value) {
    payload.currency = currency.value
  }

  return payload
}

function showServerError(caught: unknown): void {
  // 409 = the product has been ordered; the server's sentence explains why far
  // better than a generic failure would.
  if (caught instanceof ApiError && caught.status === 409) {
    toast.error(caught.message || t('error.title'))
    return
  }

  if (caught instanceof ApiError && caught.fields) {
    nameError.value = caught.fields['name']?.[0] ?? null
    slugError.value = caught.fields['slug']?.[0] ?? null
    priceError.value = caught.fields['price']?.[0] ?? null
    costError.value = caught.fields['cost']?.[0] ?? null

    const bound = nameError.value ?? slugError.value ?? priceError.value ?? costError.value
    if (!bound) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function submit(): Promise<void> {
  if (!validate()) return

  const target = editingSlug.value
  saving.value = true

  try {
    const saved = target === null
      ? await createProduct(buildPayload())
      : await updateProduct(target, buildPayload())

    toast.success(t(target === null ? 'products.created' : 'products.updated'))
    await router.push({ name: 'catalogue.products.show', params: { slug: saved.slug } })
  } catch (caught) {
    showServerError(caught)
  } finally {
    saving.value = false
  }
}

function cancel(): void {
  void router.push({ name: 'catalogue.products' })
}

/* ------------------------------------------------------------------ delete */

async function confirmDelete(): Promise<void> {
  const current = product.value
  if (current === null) return

  deleting.value = true
  try {
    await deleteProduct(current.slug)
    toast.success(t('products.deleted'))
    confirmingDelete.value = false
    await router.push({ name: 'catalogue.products' })
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    deleting.value = false
  }
}

watch(editingSlug, () => {
  product.value = null
  notFound.value = false
  loadError.value = null
  resetForm()
  void load()
})

onMounted(() => {
  void load()
  void loadCategories()
})
</script>

<template>
  <div class="space-y-5">
    <RouterLink
      :to="{ name: 'catalogue.products' }"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ArrowLeft class="size-4 rtl:-scale-x-100" />
      {{ t('products.backToList') }}
    </RouterLink>

    <BaseEmptyState
      v-if="!allowed"
      :title="t('error.forbiddenTitle')"
      :description="t('error.forbiddenBody')"
    >
      <template #action>
        <BaseButton variant="secondary" to="/products">{{ t('products.backToList') }}</BaseButton>
      </template>
    </BaseEmptyState>

    <div v-else-if="loading" class="space-y-5">
      <BaseSkeleton height="h-8" block />
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <BaseSkeleton class="lg:col-span-2" :rows="8" height="h-5" />
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

    <BaseAlert v-else-if="loadError" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ loadError }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <template v-else>
      <PageHeader :title="isEditing ? t('products.edit') : t('products.create')" />

      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <section
          class="surface max-w-2xl p-6 lg:col-span-2"
          :aria-label="isEditing ? t('products.edit') : t('products.create')"
        >
          <form class="space-y-6" novalidate @submit.prevent="submit">
            <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
              {{ formError }}
            </BaseAlert>

            <!-- Basics -->
            <div class="space-y-4">
              <h2 class="text-h4 font-semibold text-ink">{{ t('products.basics') }}</h2>

              <BaseInput
                v-model="name"
                :label="t('products.nameLabel')"
                :placeholder="t('products.namePlaceholder')"
                :error="nameError"
                required
              />

              <BaseInput
                v-model="slug"
                :label="t('products.slug')"
                :error="slugError"
                :hint="slugHint"
              />

              <BaseTextarea
                v-model="description"
                :label="t('common.description')"
                :placeholder="t('products.descriptionPlaceholder')"
                :rows="4"
              />

              <BaseSelect
                v-model="status"
                :label="t('common.status')"
                :options="statusOptions"
              />
            </div>

            <!-- Pricing -->
            <div class="space-y-4 border-t border-line pt-6">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <h2 class="text-h4 font-semibold text-ink">{{ t('products.pricing') }}</h2>
                <p v-if="!isEditing && currency" class="text-caption text-subtle">
                  {{ t('unit.currencyNote', { currency }) }}
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <BaseInput
                  v-model="price"
                  type="number"
                  min="0"
                  step="0.01"
                  :label="t('products.price')"
                  :error="priceError"
                  required
                />

                <BaseInput
                  v-model="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  :label="t('products.cost')"
                  :error="costError"
                  :hint="t('common.optional')"
                />
              </div>

              <BaseSwitch v-model="isTaxable" :label="t('products.taxable')" />
            </div>

            <!-- Organisation -->
            <div class="space-y-4 border-t border-line pt-6">
              <h2 class="text-h4 font-semibold text-ink">{{ t('products.organisation') }}</h2>

              <BaseSelect
                v-model="categoryId"
                :label="t('common.category')"
                :options="categoryOptions"
              />
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              <BaseButton variant="secondary" :disabled="saving" @click="cancel">
                {{ t('action.cancel') }}
              </BaseButton>
              <BaseButton type="submit" :loading="saving">
                {{ isEditing ? t('action.saveChanges') : t('action.create') }}
              </BaseButton>
            </div>
          </form>
        </section>

        <!-- Edit-only context: what the form cannot change, and the way out -->
        <aside
          v-if="isEditing && product"
          class="surface p-5"
          :aria-label="t('products.details')"
        >
          <h2 class="text-h4 font-semibold text-ink">{{ t('products.details') }}</h2>

          <!-- Single column: this panel is only ever a third of the grid. -->
          <dl class="mt-4 space-y-4">
            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('products.sku') }}
              </dt>
              <dd class="mt-1 break-words text-sm text-ink">{{ product.sku || '—' }}</dd>
            </div>

            <div v-if="product.stock">
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('common.quantity') }}
              </dt>
              <dd class="mt-1 text-sm tabular-nums text-ink">
                {{ formatNumber(product.stock.quantity) }}
              </dd>
            </div>

            <div v-if="product.stock">
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('inventory.reserved') }}
              </dt>
              <dd class="mt-1 text-sm tabular-nums text-ink">
                {{ formatNumber(product.stock.reserved) }}
              </dd>
            </div>

            <div v-if="product.stock">
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('inventory.available') }}
              </dt>
              <dd class="mt-1 text-sm tabular-nums text-ink">
                {{ formatNumber(product.stock.available) }}
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

          <div v-if="canDelete" class="mt-5 border-t border-line pt-4">
            <BaseButton variant="danger" :icon="Trash2" block @click="confirmingDelete = true">
              {{ t('action.delete') }}
            </BaseButton>
          </div>
        </aside>
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
