<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Pencil, RefreshCw, Trash2 } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import MiniList, { type MiniListItem } from '@/components/charts/MiniList.vue'
import { deleteCustomer, fetchCustomer, updateCustomer } from '@/services/customerService'
import { fetchOrders } from '@/services/orderService'
import type { Customer, CustomerAddress, Order } from '@/types/commerce'
import type { CustomerStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatRelative,
} from '@/utils/format'

/**
 * One customer: who they are, what they have spent, and their latest orders.
 *
 * The 404 is a state of its own rather than an error — a deleted customer gets
 * a plain explanation and a way back, while a transport failure keeps the page
 * and offers a retry. Orders are loaded separately so a user without
 * `orders.view`, or an orders endpoint that fails, still gets a complete
 * customer record.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { store: auth } = useAuth()
const toast = useToast()

const customer = ref<Customer | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const orders = ref<Order[]>([])
const ordersLoading = ref(false)
const ordersError = ref<string | null>(null)

const formOpen = ref(false)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formStatus = ref<string>('active')
const formNotes = ref('')
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)

const confirmingDelete = ref(false)
const deleting = ref(false)

const customerId = computed(() => Number(route.params.id))
const canUpdate = computed(() => auth.can('customers.update'))
const canDelete = computed(() => auth.can('customers.delete'))
const canViewOrders = computed(() => auth.can('orders.view'))
const currency = computed(() => auth.activeTenant?.currency ?? 'USD')

const addresses = computed(() => customer.value?.addresses ?? [])

const statusFormOptions = computed(() => [
  { value: 'active', label: t('status.customer.active') },
  { value: 'inactive', label: t('status.customer.inactive') },
  { value: 'blocked', label: t('status.customer.blocked') },
])

const STATUS_LABEL_KEYS = {
  active: 'status.customer.active',
  inactive: 'status.customer.inactive',
  blocked: 'status.customer.blocked',
} as const

function statusLabel(value: CustomerStatus): string {
  return t(STATUS_LABEL_KEYS[value])
}

const orderItems = computed<MiniListItem[]>(() =>
  orders.value.map((order) => ({
    id: order.order_number,
    title: order.order_number,
    meta: formatRelative(order.placed_at ?? order.created_at),
    trailing: formatCurrency(order.grand_total, order.currency),
    trailingTone: statusTone(order.status),
  })),
)

function formatAddress(address: CustomerAddress): string {
  const body = [address.line1, address.line2, address.city, address.region, address.postal_code, address.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ')

  if (!address.label) return body || '—'
  return body ? `${address.label} — ${body}` : address.label
}

async function load(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) {
    customer.value = null
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  notFound.value = false

  try {
    customer.value = await fetchCustomer(id)
  } catch (caught) {
    customer.value = null
    if (caught instanceof ApiError && caught.status === 404) {
      notFound.value = true
    } else {
      error.value =
        caught instanceof ApiError && caught.isNetworkError
          ? t('auth.networkError')
          : caught instanceof ApiError
            ? caught.message
            : t('error.title')
    }
  } finally {
    loading.value = false
  }
}

async function loadOrders(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id) || !canViewOrders.value) return

  ordersLoading.value = true
  ordersError.value = null

  try {
    const result = await fetchOrders({ customer_id: id, per_page: 5 })
    orders.value = result.data
  } catch (caught) {
    orders.value = []
    ordersError.value =
      caught instanceof ApiError && caught.isNetworkError ? t('auth.networkError') : t('state.loadFailed')
  } finally {
    ordersLoading.value = false
  }
}

function openOrder(orderNumber: number | string): void {
  void router.push({ name: 'orders.show', params: { orderNumber: String(orderNumber) } })
}

/* ------------------------------------------------------------------- form */

function clearFormErrors(): void {
  nameError.value = null
  emailError.value = null
  formError.value = null
}

function openEdit(): void {
  if (!customer.value) return

  formName.value = customer.value.name
  formEmail.value = customer.value.email ?? ''
  formPhone.value = customer.value.phone ?? ''
  formStatus.value = customer.value.status
  formNotes.value = customer.value.notes ?? ''
  clearFormErrors()
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm(): boolean {
  clearFormErrors()

  if (!formName.value.trim()) {
    nameError.value = t('validation.required')
  }

  const email = formEmail.value.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    emailError.value = t('validation.email')
  }

  return nameError.value === null && emailError.value === null
}

function showFormError(caught: unknown): void {
  if (caught instanceof ApiError && caught.fields) {
    const nameMessage = caught.fields['name']?.[0]
    const emailMessage = caught.fields['email']?.[0]
    nameError.value = nameMessage ?? null
    emailError.value = emailMessage ?? null

    if (!nameMessage && !emailMessage) {
      formError.value = caught.message || t('error.title')
    }
    return
  }

  formError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
}

async function submitForm(): Promise<void> {
  if (!customer.value || !validateForm()) return

  saving.value = true
  const payload = {
    name: formName.value.trim(),
    email: formEmail.value.trim() || null,
    phone: formPhone.value.trim() || null,
    status: formStatus.value as CustomerStatus,
    notes: formNotes.value.trim() || null,
  }

  try {
    await updateCustomer(customer.value.id, payload)
    toast.success(t('customers.updated'))
    closeForm()
    await load()
  } catch (caught) {
    showFormError(caught)
  } finally {
    saving.value = false
  }
}

/* ----------------------------------------------------------------- delete */

async function confirmDelete(): Promise<void> {
  if (!customer.value) return

  deleting.value = true
  try {
    await deleteCustomer(customer.value.id)
    toast.success(t('customers.deleted'))
    confirmingDelete.value = false
    await router.push({ name: 'customers.index' })
  } catch (caught) {
    toast.error(
      caught instanceof ApiError && caught.message ? caught.message : t('error.title'),
    )
  } finally {
    deleting.value = false
  }
}

watch(customerId, () => {
  customer.value = null
  orders.value = []
  void load()
  void loadOrders()
})

onMounted(() => {
  void load()
  void loadOrders()
})
</script>

<template>
  <div class="space-y-5">
    <RouterLink
      :to="{ name: 'customers.index' }"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ArrowLeft class="size-4 rtl:-scale-x-100" />
      {{ t('customers.backToList') }}
    </RouterLink>

    <div v-if="loading" class="space-y-5">
      <BaseSkeleton height="h-8" block />
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <BaseSkeleton class="xl:col-span-2" :rows="6" height="h-5" />
        <BaseSkeleton :rows="5" height="h-5" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="notFound"
      :title="t('customers.notFound')"
      :description="t('customers.notFoundBody')"
    >
      <template #action>
        <BaseButton to="/customers">{{ t('customers.backToList') }}</BaseButton>
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

    <template v-else-if="customer">
      <PageHeader :title="customer.name">
        <template #actions>
          <BaseBadge :tone="statusTone(customer.status)" dot>
            {{ statusLabel(customer.status) }}
          </BaseBadge>

          <BaseButton v-if="canUpdate" variant="secondary" :icon="Pencil" @click="openEdit">
            {{ t('customers.edit') }}
          </BaseButton>

          <BaseButton v-if="canDelete" variant="danger" :icon="Trash2" @click="confirmingDelete = true">
            {{ t('action.delete') }}
          </BaseButton>
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <!-- Summary -->
        <section class="surface p-5 xl:col-span-2" :aria-label="t('customers.details')">
          <h2 class="text-h4 font-semibold text-ink">{{ t('customers.details') }}</h2>

          <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('common.email') }}
              </dt>
              <dd class="mt-1 break-words text-sm text-ink">{{ customer.email || '—' }}</dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('common.phone') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">{{ customer.phone || '—' }}</dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('customers.ordersCount') }}
              </dt>
              <dd class="mt-1 text-sm tabular-nums text-ink">
                {{ customer.orders_count !== undefined ? formatNumber(customer.orders_count) : '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('customers.totalSpent') }}
              </dt>
              <dd class="mt-1 text-sm tabular-nums text-ink">
                {{ customer.total_spent !== undefined ? formatCurrency(customer.total_spent, currency) : '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('customers.lastOrder') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">
                {{ customer.last_order_at ? formatRelative(customer.last_order_at) : '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('common.createdAt') }}
              </dt>
              <dd class="mt-1 text-sm text-ink">{{ formatDateTime(customer.created_at) }}</dd>
            </div>

            <div v-if="customer.notes" class="sm:col-span-2">
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('common.notes') }}
              </dt>
              <dd class="mt-1 whitespace-pre-wrap text-sm text-muted">{{ customer.notes }}</dd>
            </div>

            <div class="sm:col-span-2">
              <dt class="text-caption font-semibold uppercase tracking-wide text-subtle">
                {{ t('customers.addresses') }}
              </dt>
              <dd class="mt-1">
                <ul v-if="addresses.length > 0" class="space-y-1.5">
                  <li v-for="address in addresses" :key="address.id" class="text-sm text-muted">
                    {{ formatAddress(address) }}
                  </li>
                </ul>
                <span v-else class="text-sm text-subtle">—</span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Recent orders -->
        <section
          v-if="canViewOrders"
          class="surface p-5"
          :aria-label="t('customers.recentOrders')"
        >
          <h2 class="text-h4 font-semibold text-ink">{{ t('customers.recentOrders') }}</h2>

          <div class="mt-4">
            <MiniList
              :items="orderItems"
              :loading="ordersLoading"
              :empty-title="t('customers.noOrders')"
              :empty-description="t('orders.emptyBody')"
              @select="openOrder"
            />

            <div v-if="ordersError" class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-muted">{{ ordersError }}</p>
              <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="loadOrders">
                {{ t('action.retry') }}
              </BaseButton>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- Edit -->
    <BaseModal
      :open="formOpen"
      :title="t('customers.edit')"
      @close="closeForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="formError" tone="danger" dismissible @dismiss="formError = null">
          {{ formError }}
        </BaseAlert>

        <BaseInput
          v-model="formName"
          :label="t('customers.nameLabel')"
          :placeholder="t('customers.namePlaceholder')"
          :error="nameError"
          required
          autocomplete="name"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="formEmail"
            type="email"
            :label="t('common.email')"
            :error="emailError"
            autocomplete="email"
          />
          <BaseInput
            v-model="formPhone"
            type="tel"
            :label="t('common.phone')"
            autocomplete="tel"
          />
        </div>

        <BaseSelect
          v-model="formStatus"
          :label="t('common.status')"
          :options="statusFormOptions"
        />

        <BaseTextarea
          v-model="formNotes"
          :label="t('common.notes')"
          :rows="3"
        />
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton :loading="saving" @click="submitForm">
          {{ t('action.saveChanges') }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirmation -->
    <BaseModal
      :open="confirmingDelete"
      :title="t('customers.deleteTitle')"
      size="sm"
      @close="confirmingDelete = false"
    >
      <p class="text-sm text-muted">
        {{ t('customers.deleteBody', { name: customer?.name ?? '' }) }}
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
