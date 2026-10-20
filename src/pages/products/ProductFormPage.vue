<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from '@/components/icons'
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
import { fetchStores } from '@/services/storeService'
import {
  checkProductSlug,
  createProduct,
  deleteProduct,
  deleteProductImage,
  fetchProduct,
  updateProduct,
  updateProductImage,
  uploadProductImages,
  type ProductPayload,
} from '@/services/productService'
import type { Category, Product, ProductImage, Store } from '@/types/catalogue'
import type { ProductStatus } from '@/types/enums'
import { formatDateTime, formatNumber } from '@/utils/format'

/**
 * Create and edit a product in one screen.
 *
 * The two modes share a single form because a product is the same object either
 * way — only the request and where the user lands afterwards differ. Variants are
 * edited here because every product must have at least one; opening stock is
 * create-only, since on-hand quantities afterwards belong to the inventory
 * ledger and must not be overwritten by an edit.
 *
 * Images are special: the product must exist before it can own files, so on
 * create they are held in memory and uploaded straight after the product is
 * made, while on edit they are uploaded and deleted against the live gallery
 * immediately. Either way a half-uploaded gallery is never left behind.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

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

// Stores are loaded so a multi-store merchant can choose where opening stock
// lands. The choice is create-only: moving a product's home store afterwards
// would not move its stock, which lives in the inventory ledger.
const stores = ref<Store[]>([])
const storeId = ref('')

const name = ref('')
const slug = ref('')
const sku = ref('')
const description = ref('')
const status = ref<string>('draft')
const categoryId = ref('')
const price = ref('')
const cost = ref('')
const isTaxable = ref(true)

interface VariantRow {
  id?: number
  name: string
  sku: string
  barcode: string
  price: string
  cost: string
  isDefault: boolean
  initialQuantity: string
}

const variants = ref<VariantRow[]>([])

const existingImages = ref<ProductImage[]>([])
const pendingImages = ref<File[]>([])
const pendingPreviews = ref<string[]>([])
const imageError = ref<string | null>(null)
const uploadingImages = ref(false)
const imageInput = ref<HTMLInputElement | null>(null)

const nameError = ref<string | null>(null)
const slugError = ref<string | null>(null)
const priceError = ref<string | null>(null)
const costError = ref<string | null>(null)
const variantError = ref<string | null>(null)
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

const storeOptions = computed(() =>
  stores.value.map((store) => ({
    value: String(store.id),
    label: store.is_default ? `${store.name} · ${t('stores.default')}` : store.name,
  })),
)

const gallery = computed(() => existingImages.value)

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

/**
 * The store opening stock should default to: the tenant's default store, or the
 * first one when none is flagged. The server falls back the same way, so an
 * empty selection still stocks somewhere sensible.
 */
function defaultStoreId(): string {
  const fallback = stores.value.find((store) => store.is_default) ?? stores.value[0]

  return fallback ? String(fallback.id) : ''
}

async function loadStores(): Promise<void> {
  try {
    stores.value = await fetchStores()
  } catch {
    // `stores.view` may not be held, or the request may fail; opening stock then
    // relies on the server's default store rather than blocking product creation.
    stores.value = []
  }

  if (storeId.value === '') {
    storeId.value = defaultStoreId()
  }
}

function prefill(loaded: Product): void {
  name.value = loaded.name
  slug.value = loaded.slug
  sku.value = loaded.sku ?? ''
  description.value = loaded.description ?? ''
  status.value = loaded.status
  categoryId.value = loaded.category_id === null ? '' : String(loaded.category_id)
  price.value = String(loaded.price)
  cost.value = String(loaded.cost)
  isTaxable.value = loaded.is_taxable

  variants.value = (loaded.variants ?? []).map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku ?? '',
    barcode: variant.barcode ?? '',
    price: String(variant.price),
    cost: variant.cost === null || variant.cost === undefined ? '' : String(variant.cost),
    isDefault: variant.is_default,
    initialQuantity: '',
  }))

  existingImages.value = loaded.images ?? []
  clearErrors()
}

function resetForm(): void {
  name.value = ''
  slug.value = ''
  sku.value = ''
  description.value = ''
  status.value = 'draft'
  categoryId.value = ''
  price.value = ''
  cost.value = ''
  isTaxable.value = true
  storeId.value = defaultStoreId()
  variants.value = [emptyVariant(true)]
  clearPendingImages()
  existingImages.value = []
  clearErrors()
}

function emptyVariant(isDefault = false): VariantRow {
  return {
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    isDefault,
    initialQuantity: '',
  }
}

/* --------------------------------------------------------------- variants */

function addVariant(): void {
  // The first row is the default until another is promoted.
  variants.value.push(emptyVariant(variants.value.length === 0))
}

function removeVariant(index: number): void {
  const removed = variants.value[index]
  variants.value.splice(index, 1)

  // Never leave the set without a default: promote the first remaining row.
  if (removed?.isDefault && variants.value.length > 0 && variants.value[0]) {
    variants.value[0].isDefault = true
  }
}

function makeDefault(index: number): void {
  variants.value.forEach((variant, i) => {
    variant.isDefault = i === index
  })
}

/* ----------------------------------------------------------------- images */

function revokePending(): void {
  pendingPreviews.value.forEach((url) => URL.revokeObjectURL(url))
  pendingPreviews.value = []
}

function clearPendingImages(): void {
  revokePending()
  pendingImages.value = []
}

function acceptImages(incoming: FileList | null): File[] {
  imageError.value = null
  const accepted: File[] = []

  for (const file of Array.from(incoming ?? [])) {
    if (!IMAGE_TYPES.includes(file.type)) {
      imageError.value = t('products.imageTypeError')
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      imageError.value = t('products.imageSizeError')
      continue
    }
    accepted.push(file)
  }

  return accepted
}

function onImagePick(event: Event): void {
  const target = event.target as HTMLInputElement
  const accepted = acceptImages(target.files)
  target.value = ''

  if (accepted.length === 0) return

  if (isEditing.value) {
    void uploadToGallery(accepted)
  } else {
    accepted.forEach((file) => {
      pendingImages.value.push(file)
      pendingPreviews.value.push(URL.createObjectURL(file))
    })
  }
}

function removePending(index: number): void {
  const url = pendingPreviews.value[index]
  if (url) URL.revokeObjectURL(url)
  pendingPreviews.value.splice(index, 1)
  pendingImages.value.splice(index, 1)
}

async function uploadToGallery(files: File[]): Promise<void> {
  const target = editingSlug.value
  if (target === null) return

  uploadingImages.value = true
  try {
    const created = await uploadProductImages(target, files)
    existingImages.value = [...existingImages.value, ...created]
    toast.success(t('products.imagesUploaded'))
  } catch (caught) {
    imageError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
  } finally {
    uploadingImages.value = false
  }
}

async function removeImage(image: ProductImage): Promise<void> {
  const target = editingSlug.value
  if (target === null) return

  uploadingImages.value = true
  try {
    await deleteProductImage(target, image.id)
    existingImages.value = existingImages.value.filter((candidate) => candidate.id !== image.id)
    toast.success(t('products.imageRemoved'))
  } catch (caught) {
    imageError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
  } finally {
    uploadingImages.value = false
  }
}

async function makePrimary(image: ProductImage): Promise<void> {
  const target = editingSlug.value
  if (target === null || image.is_primary) return

  try {
    await updateProductImage(target, image.id, { is_primary: true })
    existingImages.value = existingImages.value.map((candidate) => ({
      ...candidate,
      is_primary: candidate.id === image.id,
    }))
  } catch (caught) {
    imageError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
  }
}

/* ---------------------------------------------------------------- validate */

function clearErrors(): void {
  nameError.value = null
  slugError.value = null
  priceError.value = null
  costError.value = null
  variantError.value = null
  formError.value = null
  imageError.value = null
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

  if (variants.value.length === 0) {
    variantError.value = t('products.variantNameRequired')
  } else if (variants.value.some((variant) => !variant.name.trim())) {
    variantError.value = t('products.variantNameRequired')
  } else if (variants.value.some((variant) => !variant.price.trim() || !Number.isFinite(Number(variant.price)))) {
    variantError.value = t('products.variantPriceRequired')
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
    costError.value === null &&
    variantError.value === null
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
    variants: variants.value.map((variant) => {
      const row: NonNullable<ProductPayload['variants']>[number] = {
        name: variant.name.trim(),
        price: Number(variant.price),
        sku: variant.sku.trim() || null,
        barcode: variant.barcode.trim() || null,
        is_default: variant.isDefault,
      }

      // Carrying the id keeps an existing variant — and its inventory rows —
      // intact on save; omitting it would make the server recreate the variant.
      if (variant.id !== undefined) {
        row.id = variant.id
      }

      if (variant.cost.trim()) {
        row.cost = Number(variant.cost)
      }

      // Opening stock is create-only: an edit must never reset on-hand stock.
      if (!isEditing.value && variant.initialQuantity.trim()) {
        row.initial_quantity = Number(variant.initialQuantity)
      }

      return row
    }),
  }

  if (slug.value.trim()) {
    payload.slug = slug.value.trim()
  }

  if (sku.value.trim()) {
    payload.sku = sku.value.trim()
  }

  // A blank cost is omitted rather than sent as zero: the server's rule has no
  // `nullable`, so clearing the field must leave the stored value untouched.
  if (cost.value.trim()) {
    payload.cost = Number(cost.value)
  }

  if (editingSlug.value === null && currency.value) {
    payload.currency = currency.value
  }

  // The chosen store is the product's home and the destination for its opening
  // stock. Create-only: an edit leaves the home store and on-hand stock alone.
  if (editingSlug.value === null && storeId.value !== '') {
    payload.store_id = Number(storeId.value)
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
    variantError.value = caught.fields['variants']?.[0] ?? null

    const bound =
      nameError.value ?? slugError.value ?? priceError.value ?? costError.value ?? variantError.value
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

    // Images have no home until the product exists, so on create they go up now
    // that we have a slug. A failed upload must not discard the product: the
    // user is told and can add the images again from the edit screen.
    if (target === null && pendingImages.value.length > 0) {
      try {
        await uploadProductImages(saved.slug, pendingImages.value)
      } catch (caught) {
        toast.error(
          caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
        )
      }
    }

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
  void loadStores()

  if (!isEditing.value) {
    resetForm()
  }
})

onBeforeUnmount(revokePending)
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

              <div class="grid gap-4 sm:grid-cols-2">
                <BaseInput
                  v-model="slug"
                  :label="t('products.slug')"
                  :error="slugError"
                  :hint="slugHint"
                />

                <BaseInput
                  v-model="sku"
                  :label="t('products.sku')"
                  :placeholder="t('products.skuPlaceholder')"
                />
              </div>

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

              <BaseSelect
                v-if="!isEditing && stores.length > 0"
                v-model="storeId"
                :label="t('common.store')"
                :options="storeOptions"
                :hint="t('products.storeHint')"
              />
            </div>

            <!-- Variants -->
            <div class="space-y-4 border-t border-line pt-6">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <h2 class="text-h4 font-semibold text-ink">{{ t('products.variants') }}</h2>
                <BaseButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  :icon="Plus"
                  @click="addVariant"
                >
                  {{ t('products.addVariant') }}
                </BaseButton>
              </div>

              <p class="text-small text-muted">{{ t('products.variantsHint') }}</p>

              <BaseAlert v-if="variantError" tone="danger">{{ variantError }}</BaseAlert>

              <div class="space-y-4">
                <div
                  v-for="(variant, index) in variants"
                  :key="variant.id ?? `new-${index}`"
                  class="rounded-lg border border-line p-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 text-small font-medium"
                      :class="variant.isDefault ? 'text-brand-ink' : 'text-muted hover:text-ink'"
                      :disabled="variant.isDefault"
                      @click="makeDefault(index)"
                    >
                      <CheckCircle2 v-if="variant.isDefault" class="size-4" />
                      <Circle v-else class="size-4" />
                      {{ variant.isDefault ? t('products.defaultVariant') : t('products.makeDefault') }}
                    </button>

                    <button
                      v-if="variants.length > 1"
                      type="button"
                      class="btn-icon text-danger-ink"
                      :aria-label="t('products.removeVariant')"
                      :title="t('products.removeVariant')"
                      @click="removeVariant(index)"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </div>

                  <div class="mt-3 grid gap-4 sm:grid-cols-2">
                    <BaseInput
                      v-model="variant.name"
                      :label="t('products.variantName')"
                      :placeholder="t('products.variantNamePlaceholder')"
                      required
                    />

                    <BaseInput v-model="variant.sku" :label="t('products.sku')" />

                    <BaseInput
                      v-model="variant.price"
                      type="number"
                      min="0"
                      step="0.01"
                      :label="t('products.variantPrice')"
                      required
                    />

                    <BaseInput
                      v-model="variant.cost"
                      type="number"
                      min="0"
                      step="0.01"
                      :label="t('products.variantCost')"
                      :hint="t('common.optional')"
                    />
                  </div>

                  <div v-if="!isEditing" class="mt-4">
                    <BaseInput
                      v-model="variant.initialQuantity"
                      type="number"
                      min="0"
                      step="1"
                      :label="t('products.initialStock')"
                      :hint="t('products.initialStockHint')"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Images -->
            <div class="space-y-4 border-t border-line pt-6">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <h2 class="text-h4 font-semibold text-ink">{{ t('products.images') }}</h2>
                <BaseButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  :icon="Upload"
                  :loading="uploadingImages"
                  :disabled="uploadingImages"
                  @click="imageInput?.click()"
                >
                  {{ t('products.addImages') }}
                </BaseButton>
              </div>

              <p class="text-small text-muted">{{ t('products.imagesHint') }}</p>

              <input
                ref="imageInput"
                type="file"
                class="sr-only"
                accept="image/png,image/jpeg,image/webp"
                multiple
                @change="onImagePick"
              />

              <BaseAlert v-if="imageError" tone="danger" dismissible @dismiss="imageError = null">
                {{ imageError }}
              </BaseAlert>

              <div
                v-if="gallery.length > 0 || pendingPreviews.length > 0"
                class="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                <figure
                  v-for="image in gallery"
                  :key="`existing-${image.id}`"
                  class="group relative overflow-hidden rounded-lg border border-line"
                >
                  <img
                    :src="image.url ?? image.path"
                    :alt="image.alt_text ?? ''"
                    class="aspect-square w-full object-cover"
                  />

                  <span
                    v-if="image.is_primary"
                    class="absolute start-2 top-2 rounded-full bg-brand px-2 py-0.5 text-caption font-medium text-brand-contrast"
                  >
                    {{ t('products.primary') }}
                  </span>

                  <div class="flex items-center justify-between gap-1 border-t border-line bg-surface-2 p-1.5">
                    <button
                      v-if="!image.is_primary"
                      type="button"
                      class="btn-icon"
                      :aria-label="t('products.setPrimary')"
                      :title="t('products.setPrimary')"
                      @click="makePrimary(image)"
                    >
                      <Circle class="size-4" />
                    </button>
                    <span v-else class="btn-icon text-brand-ink" aria-hidden="true">
                      <CheckCircle2 class="size-4" />
                    </span>

                    <button
                      type="button"
                      class="btn-icon text-danger-ink"
                      :aria-label="t('products.removeImage')"
                      :title="t('products.removeImage')"
                      @click="removeImage(image)"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </div>
                </figure>

                <figure
                  v-for="(preview, index) in pendingPreviews"
                  :key="`pending-${index}`"
                  class="relative overflow-hidden rounded-lg border border-dashed border-line"
                >
                  <img :src="preview" alt="" class="aspect-square w-full object-cover opacity-90" />

                  <div class="flex items-center justify-end border-t border-line bg-surface-2 p-1.5">
                    <button
                      type="button"
                      class="btn-icon text-danger-ink"
                      :aria-label="t('products.removeImage')"
                      :title="t('products.removeImage')"
                      @click="removePending(index)"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </div>
                </figure>
              </div>

              <div
                v-else
                class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 px-4 py-8 text-center text-sm text-subtle"
              >
                <ImageIcon class="size-6" aria-hidden="true" />
                {{ t('products.imagesHint') }}
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              <BaseButton type="button" variant="secondary" :disabled="saving" @click="cancel">
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
