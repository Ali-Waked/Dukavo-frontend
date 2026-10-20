<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Bot,
  Copy,
  KeyRound,
  Link2Off,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import {
  createAccount,
  deleteAccount,
  disconnectAccount,
  fetchAccounts,
  fetchConfiguration,
  updateAccount,
  verifyAccount,
  type WhatsappAccountPayload,
} from '@/services/whatsappService'
import { fetchStores } from '@/services/storeService'
import type { WhatsappAccount, WhatsappConfiguration } from '@/types/inbox'
import type { Store } from '@/types/catalogue'
import type { WhatsappStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import { formatDateTime } from '@/utils/format'

/**
 * WhatsApp channel configuration — one card per number, no pagination.
 *
 * Two lists load beside the accounts rather than through them: a store endpoint
 * that fails drops a field from the form, and a configuration endpoint that
 * fails drops the setup card, never the page. Every mutation is hidden without
 * `whatsapp.manage`, so a viewer reads the same screen with an empty action
 * column.
 *
 * The setup card is the only place the page can answer "why does nothing
 * arrive?" — a healthy-looking number tells you nothing about whether the server
 * holds the App Secret Meta signs deliveries with, so the server reports that
 * as booleans and the card repeats them.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const accounts = ref<WhatsappAccount[]>([])
const stores = ref<Store[]>([])
const configuration = ref<WhatsappConfiguration | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const canManage = computed(() => auth.can('whatsapp.manage'))

const STATUS_LABEL_KEYS = {
  pending: 'status.whatsapp.pending',
  connected: 'status.whatsapp.connected',
  disconnected: 'status.whatsapp.disconnected',
  error: 'status.whatsapp.error',
} as const

function statusLabel(value: WhatsappStatus): string {
  return t(STATUS_LABEL_KEYS[value])
}

/** The account carries only `store_id`; the name comes from the store list. */
function storeName(account: WhatsappAccount): string | null {
  if (account.store_id == null) return null
  return stores.value.find((store) => store.id === account.store_id)?.name ?? null
}

const storeOptions = computed(() => [
  { value: '', label: t('common.none') },
  ...stores.value.map((store) => ({ value: String(store.id), label: store.name })),
])

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    accounts.value = await fetchAccounts()
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.isNetworkError
        ? t('auth.networkError')
        : caught instanceof ApiError
          ? caught.message
          : t('error.title')
  } finally {
    loading.value = false
  }
}

async function loadStores(): Promise<void> {
  try {
    stores.value = await fetchStores()
  } catch {
    // The picker is optional: without it the form still saves a name, a number
    // and its Meta identifiers.
    stores.value = []
  }
}

/**
 * Platform setup, loaded beside the accounts.
 *
 * Failure is deliberately silent — the endpoint needs `whatsapp.view` and may
 * not exist on an older server, and neither state should hold the page hostage
 * when the numbers themselves loaded fine.
 */
async function loadConfiguration(): Promise<void> {
  try {
    configuration.value = await fetchConfiguration()
  } catch {
    configuration.value = null
  }
}

/** One row per platform value: whether the server has it, never what it is. */
const configurationRows = computed(() => {
  const configured = configuration.value?.configured

  if (!configured) return []

  return [
    { label: t('whatsapp.configPhoneNumberId'), ok: configured.phone_number_id },
    { label: t('whatsapp.configBusinessAccount'), ok: configured.business_account_id },
    { label: t('whatsapp.configAccessToken'), ok: configured.access_token },
    { label: t('whatsapp.configAppSecret'), ok: configured.app_secret },
    { label: t('whatsapp.configVerifyToken'), ok: configured.webhook_verify_token },
  ]
})

/**
 * Copy one of the webhook URLs, ready to paste into Meta's dashboard.
 *
 * Clipboard access needs a secure context and a browser that allows it; when it
 * does not, the URL is still on screen to be selected by hand, so a refusal is a
 * note rather than a failure.
 */
async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(t('toast.copiedToClipboard'))
  } catch {
    toast.warning(t('whatsapp.copyFailed'))
  }
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : t('error.title')
}

/* ------------------------------------------------------------------- form */

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formName = ref('')
const formPhone = ref('')
const formStoreId = ref('')
const formPhoneNumberId = ref('')
const formBusinessAccountId = ref('')
const formVerifyToken = ref('')
const nameError = ref<string | null>(null)
const phoneError = ref<string | null>(null)
const storeError = ref<string | null>(null)
const phoneNumberIdError = ref<string | null>(null)
const businessAccountIdError = ref<string | null>(null)
const verifyTokenError = ref<string | null>(null)
const saving = ref(false)

/**
 * Kept apart from `formStoreId` so an edit whose store list never loaded sends
 * the assignment it came in with instead of clearing it.
 */
const formOriginalStoreId = ref<number | null>(null)

function clearFormErrors(): void {
  nameError.value = null
  phoneError.value = null
  storeError.value = null
  phoneNumberIdError.value = null
  businessAccountIdError.value = null
  verifyTokenError.value = null
}

function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formPhone.value = ''
  formStoreId.value = ''
  formOriginalStoreId.value = null
  formPhoneNumberId.value = ''
  formBusinessAccountId.value = ''
  formVerifyToken.value = ''
  clearFormErrors()
  formOpen.value = true
}

function openEdit(account: WhatsappAccount): void {
  editingId.value = account.id
  formName.value = account.name
  formPhone.value = account.phone ?? ''
  formStoreId.value = account.store_id == null ? '' : String(account.store_id)
  formOriginalStoreId.value = account.store_id ?? null
  formPhoneNumberId.value = account.phone_number_id ?? ''
  formBusinessAccountId.value = account.business_account_id ?? ''
  formVerifyToken.value = account.webhook_verify_token ?? ''
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

function showFormError(caught: unknown): void {
  if (!(caught instanceof ApiError) || !caught.fields) {
    toast.error(errorMessage(caught))
    return
  }

  nameError.value = caught.fields['name']?.[0] ?? null
  phoneError.value = caught.fields['phone']?.[0] ?? null
  storeError.value = caught.fields['store_id']?.[0] ?? null
  phoneNumberIdError.value = caught.fields['phone_number_id']?.[0] ?? null
  businessAccountIdError.value = caught.fields['business_account_id']?.[0] ?? null
  verifyTokenError.value = caught.fields['webhook_verify_token']?.[0] ?? null

  const bound = [
    nameError,
    phoneError,
    storeError,
    phoneNumberIdError,
    businessAccountIdError,
    verifyTokenError,
  ]
  if (!bound.some((field) => field.value !== null)) {
    toast.error(caught.message)
  }
}

async function submitForm(): Promise<void> {
  clearFormErrors()

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
    return
  }

  saving.value = true
  const payload: WhatsappAccountPayload = {
    name: formName.value.trim(),
    store_id:
      stores.value.length > 0
        ? formStoreId.value === ''
          ? null
          : Number(formStoreId.value)
        : formOriginalStoreId.value,
    phone: formPhone.value.trim() || null,
    phone_number_id: formPhoneNumberId.value.trim() || undefined,
    business_account_id: formBusinessAccountId.value.trim() || undefined,
    webhook_verify_token: formVerifyToken.value.trim() || undefined,
  }

  try {
    if (editingId.value !== null) {
      await updateAccount(editingId.value, payload)
    } else {
      await createAccount(payload)
    }
    toast.success(t('whatsapp.saved'))
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

/* ------------------------------------------------------------- mutations */

const verifyingId = ref<number | null>(null)

async function verify(account: WhatsappAccount): Promise<void> {
  if (verifyingId.value !== null) return

  verifyingId.value = account.id
  try {
    const updated = await verifyAccount(account.id)
    const message = `${updated.name}: ${statusLabel(updated.status)}`
    if (updated.status === 'connected') {
      toast.success(message)
    } else {
      toast.warning(message)
    }
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    verifyingId.value = null
  }
}

const pendingDisconnect = ref<WhatsappAccount | null>(null)
const disconnecting = ref(false)

async function confirmDisconnect(): Promise<void> {
  const account = pendingDisconnect.value
  if (!account) return

  disconnecting.value = true
  try {
    await disconnectAccount(account.id)
    toast.success(t('whatsapp.disconnected_msg'))
    pendingDisconnect.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    disconnecting.value = false
  }
}

const pendingDelete = ref<WhatsappAccount | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  const account = pendingDelete.value
  if (!account) return

  deleting.value = true
  try {
    await deleteAccount(account.id)
    toast.success(t('whatsapp.deleted'))
    pendingDelete.value = null
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void load()
  void loadStores()
  void loadConfiguration()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('whatsapp.title')" :description="t('whatsapp.subtitle')">
      <template #actions>
        <BaseButton v-if="canManage" :icon="Plus" @click="openCreate">
          {{ t('whatsapp.add') }}
        </BaseButton>
      </template>
    </PageHeader>

    <p class="max-w-3xl text-body text-muted">{{ t('whatsapp.channelNote') }}</p>

    <!-- Platform setup: what the server holds, so a dead channel is explained
         rather than merely displayed. -->
    <BaseCard v-if="configuration">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-body font-semibold text-ink">{{ t('whatsapp.platformSetup') }}</h2>
            <p class="mt-1 text-caption text-muted">{{ t('whatsapp.platformSetupNote') }}</p>
          </div>

          <BaseBadge v-if="configuration.api_version" tone="info" size="sm">
            {{ configuration.api_version }}
          </BaseBadge>
        </div>
      </template>

      <div class="space-y-4">
        <BaseAlert
          v-if="configuration.webhook.signature_validation === 'not_configured'"
          tone="warning"
          :title="t('whatsapp.signatureOff')"
        >
          {{ t('whatsapp.signatureOffNote') }}
        </BaseAlert>

        <BaseAlert
          v-else
          tone="success"
          :title="t('whatsapp.signatureEnforced')"
        />

        <ul class="space-y-2">
          <li
            v-for="row in configurationRows"
            :key="row.label"
            class="flex items-center justify-between gap-3"
          >
            <span class="text-sm text-muted">{{ row.label }}</span>
            <BaseBadge :tone="row.ok ? 'success' : 'warning'" size="sm" dot>
              {{ row.ok ? t('whatsapp.configured') : t('whatsapp.notConfigured') }}
            </BaseBadge>
          </li>
        </ul>

        <dl class="space-y-2 border-t border-line pt-3">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-caption text-subtle">{{ t('whatsapp.webhookVerifyUrl') }}</dt>
            <dd class="flex min-w-0 items-center gap-1.5">
              <span dir="ltr" class="truncate text-sm text-ink">
                {{ configuration.webhook.verify_url }}
              </span>
              <button
                type="button"
                class="btn-icon shrink-0"
                :aria-label="t('action.copy')"
                :title="t('action.copy')"
                @click="copyToClipboard(configuration.webhook.verify_url)"
              >
                <Copy class="size-4" />
              </button>
            </dd>
          </div>

          <div class="flex items-center justify-between gap-3">
            <dt class="text-caption text-subtle">{{ t('whatsapp.webhookEventsUrl') }}</dt>
            <dd class="flex min-w-0 items-center gap-1.5">
              <span dir="ltr" class="truncate text-sm text-ink">
                {{ configuration.webhook.events_url }}
              </span>
              <button
                type="button"
                class="btn-icon shrink-0"
                :aria-label="t('action.copy')"
                :title="t('action.copy')"
                @click="copyToClipboard(configuration.webhook.events_url)"
              >
                <Copy class="size-4" />
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </BaseCard>

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <div v-else-if="loading" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="index in 3" :key="index">
        <BaseSkeleton :rows="4" height="h-5" />
      </BaseCard>
    </div>

    <div v-else-if="accounts.length === 0" class="surface">
      <BaseEmptyState
        :icon="Bot"
        :title="t('whatsapp.emptyTitle')"
        :description="t('whatsapp.emptyBody')"
      >
        <template v-if="canManage" #action>
          <BaseButton :icon="Plus" @click="openCreate">
            {{ t('whatsapp.add') }}
          </BaseButton>
        </template>
      </BaseEmptyState>
    </div>

    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <BaseCard v-for="account in accounts" :key="account.id">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-body font-semibold text-ink">{{ account.name }}</h2>
              <p v-if="account.phone" dir="ltr" class="mt-1 truncate text-caption text-muted">
                {{ account.phone }}
              </p>
            </div>

            <BaseDropdown v-if="canManage" align="end">
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
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  @click="close(); openEdit(account)"
                >
                  <Pencil class="size-4 text-muted" />
                  {{ t('action.edit') }}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  @click="close(); verify(account)"
                >
                  <LoaderCircle
                    v-if="verifyingId === account.id"
                    class="size-4 animate-spin text-muted"
                  />
                  <KeyRound v-else class="size-4 text-muted" />
                  {{ t('whatsapp.verify') }}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
                  @click="close(); pendingDisconnect = account"
                >
                  <Link2Off class="size-4 text-muted" />
                  {{ t('whatsapp.disconnect') }}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger-ink transition hover:bg-danger-soft"
                  @click="close(); pendingDelete = account"
                >
                  <Trash2 class="size-4" />
                  {{ t('action.delete') }}
                </button>
              </template>
            </BaseDropdown>
          </div>
        </template>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <span class="text-caption font-semibold uppercase tracking-wide text-subtle">
              {{ t('whatsapp.connectionStatus') }}
            </span>
            <BaseBadge :tone="statusTone(account.status)" dot>
              {{ account.status_label || statusLabel(account.status) }}
            </BaseBadge>
          </div>

          <!-- The reason a number is in error is stored with the account, so
               it outlives the toast that announced it. -->
          <BaseAlert
            v-if="account.status === 'error' && account.error_message"
            tone="danger"
            :title="t('whatsapp.connectionError')"
          >
            {{ account.error_message }}
          </BaseAlert>

          <dl class="space-y-2 border-t border-line pt-3">
            <div v-if="storeName(account)" class="flex items-center justify-between gap-3">
              <dt class="text-caption text-subtle">{{ t('common.store') }}</dt>
              <dd class="truncate text-sm text-ink">{{ storeName(account) }}</dd>
            </div>

            <div class="flex items-center justify-between gap-3">
              <dt class="text-caption text-subtle">{{ t('common.createdAt') }}</dt>
              <dd class="text-sm text-muted">{{ formatDateTime(account.created_at) }}</dd>
            </div>
          </dl>
        </div>
      </BaseCard>
    </div>

    <!-- Create / edit -->
    <BaseModal
      :open="formOpen"
      :title="editingId === null ? t('whatsapp.add') : t('action.edit')"
      size="lg"
      @close="closeForm"
    >
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formName"
            :label="t('common.name')"
            :error="nameError"
            required
          />

          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            :error="phoneError"
            :hint="t('common.optional')"
            autocomplete="tel"
          />
        </div>

        <BaseSelect
          v-if="stores.length > 0"
          v-model="formStoreId"
          :label="t('common.store')"
          :options="storeOptions"
          :error="storeError"
          :hint="t('common.optional')"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formPhoneNumberId"
            :label="t('whatsapp.phoneNumber')"
            :error="phoneNumberIdError"
            :hint="t('common.optional')"
          />

          <BaseInput
            v-model="formBusinessAccountId"
            :label="t('whatsapp.businessAccount')"
            :error="businessAccountIdError"
            :hint="t('common.optional')"
          />
        </div>

        <BaseInput
          v-model="formVerifyToken"
          :label="t('whatsapp.verifyToken')"
          :error="verifyTokenError"
          :hint="t('common.optional')"
          autocomplete="off"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="saving" @click="submitForm">
          {{ editingId === null ? t('action.create') : t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Disconnect confirmation -->
    <BaseModal
      :open="pendingDisconnect !== null"
      :title="t('whatsapp.disconnectTitle')"
      size="sm"
      @close="pendingDisconnect = null"
    >
      <p class="text-sm text-muted">
        {{ t('whatsapp.disconnectBody', { name: pendingDisconnect?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="disconnecting" @click="pendingDisconnect = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="disconnecting" @click="confirmDisconnect">
          {{ t('whatsapp.disconnect') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="pendingDelete !== null"
      :title="t('whatsapp.deleteTitle')"
      size="sm"
      @close="pendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('whatsapp.deleteBody', { name: pendingDelete?.name ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="deleting" @click="pendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmDelete">
          {{ t('action.delete') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
