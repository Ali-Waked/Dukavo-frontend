<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ExternalLink,
  Globe,
  ImagePlus,
  Mail,
  RefreshCw,
  Save,
  Store,
} from '@/components/icons'
import MerchantStoreSelector from '@/components/storefront/MerchantStoreSelector.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useMerchantStore } from '@/composables/useMerchantStore'
import { ApiError } from '@/lib/axiosClient'
import {
  fetchMerchantStorefront,
  updateMerchantStorefront,
} from '@/services/storefrontService'
import type {
  MerchantStorefrontPayload,
  MerchantStorefrontSettings,
} from '@/types/storefront'

/**
 * The merchant's editor for the public shop.
 *
 * Everything here is presentation: wording, contact details, policies and
 * whether the shop is listed. Prices, stock and delivery fees are owned by the
 * catalogue and shipping screens, so this page cannot silently change money.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const {
  stores,
  selectedId,
  selectedStore,
  loading: storesLoading,
  error: storesError,
  load: loadStores,
} = useMerchantStore()

const canManage = computed(() => auth.can('storefront.manage'))
const tenantSlug = computed(() => auth.activeTenant?.slug ?? '')

const resource = ref<MerchantStorefrontSettings | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

const form = reactive({
  storefront_enabled: true,
  description: '',
  logo_url: '',
  settings: {
    tagline: '',
    about: '',
    hero_image_url: '',
    contact_email: '',
    contact_phone: '',
    whatsapp_number: '',
    address: '',
    social: {
      facebook: '',
      instagram: '',
      tiktok: '',
    },
    opening_hours: '',
    delivery_note: '',
    return_policy: '',
    show_out_of_stock: true,
    meta_title: '',
    meta_description: '',
  },
})

let requestId = 0

const publicUrl = computed(() => {
  if (!resource.value || tenantSlug.value === '') return null
  return `/shop/${tenantSlug.value}/${resource.value.slug}`
})

const isLive = computed(
  () => form.storefront_enabled && resource.value?.status === 'active',
)

const disabled = computed(() => !canManage.value || saving.value)

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function errorFor(key: string): string | null {
  return fieldErrors.value[key]?.[0] ?? null
}

function apply(next: MerchantStorefrontSettings): void {
  resource.value = next
  form.storefront_enabled = next.storefront_enabled
  form.description = next.description ?? ''
  form.logo_url = next.logo_url ?? ''

  const settings = next.settings
  form.settings.tagline = settings.tagline ?? ''
  form.settings.about = settings.about ?? ''
  form.settings.hero_image_url = settings.hero_image_url ?? ''
  form.settings.contact_email = settings.contact_email ?? ''
  form.settings.contact_phone = settings.contact_phone ?? ''
  form.settings.whatsapp_number = settings.whatsapp_number ?? ''
  form.settings.address = settings.address ?? ''
  form.settings.social.facebook = settings.social?.facebook ?? ''
  form.settings.social.instagram = settings.social?.instagram ?? ''
  form.settings.social.tiktok = settings.social?.tiktok ?? ''
  form.settings.opening_hours = settings.opening_hours ?? ''
  form.settings.delivery_note = settings.delivery_note ?? ''
  form.settings.return_policy = settings.return_policy ?? ''
  form.settings.show_out_of_stock = settings.show_out_of_stock !== false
  form.settings.meta_title = settings.meta_title ?? ''
  form.settings.meta_description = settings.meta_description ?? ''
}

async function load(): Promise<void> {
  if (selectedId.value === '') {
    resource.value = null
    return
  }

  const id = ++requestId
  loading.value = true
  loadError.value = null
  fieldErrors.value = {}

  try {
    const result = await fetchMerchantStorefront(selectedId.value)
    if (id !== requestId) return
    apply(result)
  } catch (caught) {
    if (id !== requestId) return
    loadError.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('shop.common.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('shop.common.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

function buildPayload(): MerchantStorefrontPayload {
  return {
    storefront_enabled: form.storefront_enabled,
    description: nullable(form.description),
    logo_url: nullable(form.logo_url),
    settings: {
      tagline: nullable(form.settings.tagline),
      about: nullable(form.settings.about),
      hero_image_url: nullable(form.settings.hero_image_url),
      contact_email: nullable(form.settings.contact_email),
      contact_phone: nullable(form.settings.contact_phone),
      whatsapp_number: nullable(form.settings.whatsapp_number),
      address: nullable(form.settings.address),
      social: {
        facebook: nullable(form.settings.social.facebook),
        instagram: nullable(form.settings.social.instagram),
        tiktok: nullable(form.settings.social.tiktok),
      },
      opening_hours: nullable(form.settings.opening_hours),
      delivery_note: nullable(form.settings.delivery_note),
      return_policy: nullable(form.settings.return_policy),
      show_out_of_stock: form.settings.show_out_of_stock,
      meta_title: nullable(form.settings.meta_title),
      meta_description: nullable(form.settings.meta_description),
    },
  }
}

async function save(): Promise<void> {
  if (!canManage.value || selectedId.value === '' || saving.value) return

  saving.value = true
  fieldErrors.value = {}

  try {
    const result = await updateMerchantStorefront(selectedId.value, buildPayload())
    apply(result)
    toast.success(t('shop.admin.saved'))
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 422) {
      fieldErrors.value = caught.fields ?? {}
      toast.error(caught.message)
    } else {
      toast.error(
        caught instanceof ApiError && caught.isNetworkError
          ? t('shop.common.networkError')
          : caught instanceof ApiError
            ? caught.message
            : t('shop.common.error'),
      )
    }
  } finally {
    saving.value = false
  }
}

watch(selectedId, () => {
  if (!storesLoading.value) void load()
})

onMounted(loadStores)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('shop.admin.storefront.title')" :description="t('shop.admin.storefront.subtitle')">
      <template #actions>
        <BaseButton
          v-if="publicUrl && isLive"
          :to="publicUrl"
          variant="secondary"
          :icon="ExternalLink"
        >
          {{ t('shop.admin.openStorefront') }}
        </BaseButton>
        <BaseButton
          v-if="canManage && resource"
          :icon="Save"
          :loading="saving"
          @click="save"
        >
          {{ t('shop.admin.save') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseAlert v-if="!canManage" tone="info">
      {{ t('shop.admin.readOnly') }}
    </BaseAlert>

    <MerchantStoreSelector
      v-model="selectedId"
      :stores="stores"
      :loading="storesLoading"
      :hint="t('shop.admin.storeHint')"
    />

    <BaseAlert v-if="storesError" tone="danger" dismissible @dismiss="storesError = null">
      {{ storesError }}
    </BaseAlert>

    <div v-if="storesLoading" class="space-y-4">
      <BaseSkeleton block height="h-20" />
      <BaseSkeleton block height="h-80" />
    </div>

    <BaseAlert v-else-if="stores.length === 0" tone="warning">
      {{ t('shop.admin.noStoresBody') }}
      <BaseButton to="/stores" variant="link" size="sm" class="px-0">
        {{ t('shop.admin.goToStores') }}
      </BaseButton>
    </BaseAlert>

    <div v-else-if="loading" class="space-y-4">
      <BaseSkeleton block height="h-20" />
      <BaseSkeleton block height="h-80" />
    </div>

    <div v-else-if="loadError" class="surface">
      <BaseEmptyState :icon="Globe" :title="t('shop.common.error')" :description="loadError">
        <template #action>
          <BaseButton variant="secondary" :icon="RefreshCw" @click="load">
            {{ t('shop.common.retry') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <template v-else-if="resource">
      <BaseAlert v-if="resource.status !== 'active'" tone="warning">
        {{ t('shop.admin.storefront.inactiveStore') }}
      </BaseAlert>
      <BaseAlert v-else-if="!form.storefront_enabled" tone="info">
        {{ t('shop.admin.storefront.hidden') }}
      </BaseAlert>

      <form class="space-y-5" @submit.prevent="save">
        <!-- Visibility -->
        <section class="surface space-y-4 p-5">
          <div class="flex items-center gap-2">
            <Store class="size-5 text-brand-ink" aria-hidden="true" />
            <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.storefront.visibility') }}</h2>
          </div>

          <BaseSwitch
            v-model="form.storefront_enabled"
            :label="t('shop.admin.storefront.enabled')"
            :hint="t('shop.admin.storefront.enabledHint')"
            :disabled="disabled"
          />

          <div v-if="publicUrl" class="rounded-lg border border-line bg-surface-2 p-3">
            <p class="text-caption text-subtle">{{ t('shop.admin.storefront.publicLink') }}</p>
            <p class="mt-1 break-all text-sm text-ink" dir="ltr">{{ publicUrl }}</p>
          </div>
        </section>

        <!-- Identity -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <ImagePlus class="size-5 text-brand-ink" aria-hidden="true" />
            <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.storefront.identity') }}</h2>
          </div>

          <div class="surface grid gap-4 p-5 sm:grid-cols-2">
            <BaseInput
              v-model="form.settings.tagline"
              :label="t('shop.admin.storefront.tagline')"
              :hint="t('shop.admin.storefront.taglineHint')"
              :error="errorFor('settings.tagline')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.logo_url"
              type="url"
              :label="t('shop.admin.storefront.logoUrl')"
              :hint="t('shop.admin.storefront.logoHint')"
              :error="errorFor('logo_url')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.settings.hero_image_url"
              type="url"
              class="sm:col-span-2"
              :label="t('shop.admin.storefront.heroUrl')"
              :hint="t('shop.admin.storefront.heroHint')"
              :error="errorFor('settings.hero_image_url')"
              :disabled="disabled"
            />
            <BaseTextarea
              v-model="form.description"
              class="sm:col-span-2"
              :label="t('shop.admin.storefront.description')"
              :hint="t('shop.admin.storefront.descriptionHint')"
              :error="errorFor('description')"
              :rows="3"
              :disabled="disabled"
            />
            <BaseTextarea
              v-model="form.settings.about"
              class="sm:col-span-2"
              :label="t('shop.admin.storefront.about')"
              :hint="t('shop.admin.storefront.aboutHint')"
              :error="errorFor('settings.about')"
              :rows="6"
              :disabled="disabled"
            />
          </div>
        </section>

        <!-- Contact -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <Mail class="size-5 text-brand-ink" aria-hidden="true" />
            <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.storefront.contact') }}</h2>
          </div>

          <div class="surface grid gap-4 p-5 sm:grid-cols-2">
            <BaseInput
              v-model="form.settings.contact_email"
              type="email"
              :label="t('shop.admin.storefront.contactEmail')"
              :error="errorFor('settings.contact_email')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.settings.contact_phone"
              type="tel"
              :label="t('shop.admin.storefront.contactPhone')"
              :error="errorFor('settings.contact_phone')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.settings.whatsapp_number"
              :label="t('shop.admin.storefront.whatsapp')"
              :hint="t('shop.admin.storefront.whatsappHint')"
              :error="errorFor('settings.whatsapp_number')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.settings.opening_hours"
              :label="t('shop.admin.storefront.openingHours')"
              :hint="t('shop.admin.storefront.openingHoursHint')"
              :error="errorFor('settings.opening_hours')"
              :disabled="disabled"
            />
            <BaseTextarea
              v-model="form.settings.address"
              class="sm:col-span-2"
              :label="t('shop.admin.storefront.address')"
              :error="errorFor('settings.address')"
              :rows="2"
              :disabled="disabled"
            />
          </div>
        </section>

        <!-- Social -->
        <section class="surface grid gap-4 p-5 sm:grid-cols-3">
          <h2 class="text-h4 font-semibold text-ink sm:col-span-3">
            {{ t('shop.admin.storefront.social') }}
          </h2>
          <BaseInput
            v-model="form.settings.social.facebook"
            type="url"
            label="Facebook"
            :error="errorFor('settings.social.facebook')"
            :disabled="disabled"
          />
          <BaseInput
            v-model="form.settings.social.instagram"
            type="url"
            label="Instagram"
            :error="errorFor('settings.social.instagram')"
            :disabled="disabled"
          />
          <BaseInput
            v-model="form.settings.social.tiktok"
            type="url"
            label="TikTok"
            :error="errorFor('settings.social.tiktok')"
            :disabled="disabled"
          />
        </section>

        <!-- Policies -->
        <section class="space-y-4">
          <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.storefront.policies') }}</h2>
          <div class="surface grid gap-4 p-5">
            <BaseTextarea
              v-model="form.settings.delivery_note"
              :label="t('shop.admin.storefront.deliveryNote')"
              :hint="t('shop.admin.storefront.deliveryNoteHint')"
              :error="errorFor('settings.delivery_note')"
              :rows="3"
              :disabled="disabled"
            />
            <BaseTextarea
              v-model="form.settings.return_policy"
              :label="t('shop.admin.storefront.returnPolicy')"
              :error="errorFor('settings.return_policy')"
              :rows="5"
              :disabled="disabled"
            />
          </div>
        </section>

        <!-- Display & SEO -->
        <section class="surface space-y-4 p-5">
          <h2 class="text-h4 font-semibold text-ink">{{ t('shop.admin.storefront.display') }}</h2>

          <BaseSwitch
            v-model="form.settings.show_out_of_stock"
            :label="t('shop.admin.storefront.showOutOfStock')"
            :hint="t('shop.admin.storefront.showOutOfStockHint')"
            :disabled="disabled"
          />

          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="form.settings.meta_title"
              :label="t('shop.admin.storefront.metaTitle')"
              :hint="t('shop.admin.storefront.metaTitleHint')"
              :error="errorFor('settings.meta_title')"
              :disabled="disabled"
            />
            <BaseInput
              v-model="form.settings.meta_description"
              :label="t('shop.admin.storefront.metaDescription')"
              :hint="t('shop.admin.storefront.metaDescriptionHint')"
              :error="errorFor('settings.meta_description')"
              :disabled="disabled"
            />
          </div>
        </section>

        <div v-if="canManage" class="flex justify-end gap-2">
          <BaseButton type="submit" :icon="Save" :loading="saving" :disabled="saving">
            {{ t('shop.admin.save') }}
          </BaseButton>
        </div>
      </form>
    </template>
  </div>
</template>
