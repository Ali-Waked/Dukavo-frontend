<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2 } from '@/components/icons'
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
import {
  createCustomerMemory,
  deleteCustomerMemory,
  fetchCustomerMemories,
  fetchCustomerSummary,
  fetchCustomerTimeline,
  refreshCustomerSummary,
  updateCustomerMemory,
  updateCustomerSummary,
  type CustomerMemory,
  type CustomerSummary,
  type CustomerTimelineItem,
} from '@/services/customerCrmService'
import type { Customer, CustomerAddress, Order } from '@/types/commerce'
import type { CustomerStatus } from '@/types/enums'
import { statusTone } from '@/utils/status'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatRelative,
} from '@/utils/format'
import { activeCurrency } from '@/utils/currency'

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

const timeline = ref<CustomerTimelineItem[]>([])
const timelineLoading = ref(false)
const timelineError = ref<string | null>(null)

const memories = ref<CustomerMemory[]>([])
const memoriesLoading = ref(false)
const memoriesError = ref<string | null>(null)

const summary = ref<CustomerSummary | null>(null)
const summaryLoading = ref(false)
const summaryRefreshing = ref(false)
const summaryEditing = ref(false)
const summaryForm = ref('')
const summarySaving = ref(false)

const memoryFormOpen = ref(false)
const memoryEditing = ref<CustomerMemory | null>(null)
const memoryKey = ref('')
const memoryValue = ref('')
const memoryCategory = ref('general')
const memorySource = ref('manual')
const memoryConfidence = ref<string>('')
const memorySaving = ref(false)
const memoryError = ref<string | null>(null)
const memoryPendingDelete = ref<CustomerMemory | null>(null)
const memoryDeleting = ref(false)

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
const canUseAi = computed(() => auth.can('ai.use'))
const canViewOrders = computed(() => auth.can('orders.view'))
const currency = computed(() => auth.activeTenant?.currency ?? activeCurrency())

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

async function loadTimeline(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  timelineLoading.value = true
  timelineError.value = null
  try {
    const res = await fetchCustomerTimeline(id)
    timeline.value = res.items || []
  } catch (caught) {
    timeline.value = []
    timelineError.value =
      caught instanceof ApiError && caught.isNetworkError ? t('auth.networkError') : t('state.loadFailed')
  } finally {
    timelineLoading.value = false
  }
}

async function loadMemories(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  memoriesLoading.value = true
  memoriesError.value = null
  try {
    const res = await fetchCustomerMemories(id)
    memories.value = Array.isArray(res) ? res : (res as any).data || []
  } catch (caught) {
    memories.value = []
    memoriesError.value =
      caught instanceof ApiError && caught.isNetworkError ? t('auth.networkError') : t('state.loadFailed')
  } finally {
    memoriesLoading.value = false
  }
}

async function loadSummary(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  summaryLoading.value = true
  try {
    summary.value = await fetchCustomerSummary(id)
  } catch (caught) {
    summary.value = null
  } finally {
    summaryLoading.value = false
  }
}

async function doRefreshSummary(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  summaryRefreshing.value = true
  try {
    summary.value = await refreshCustomerSummary(id)
    toast.success(t('customers.summaryRefreshed'))
  } catch (caught) {
    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    summaryRefreshing.value = false
  }
}

function startEditSummary(): void {
  summaryForm.value = summary.value?.summary || ''
  summaryEditing.value = true
}

function cancelEditSummary(): void {
  summaryEditing.value = false
}

async function saveSummary(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  summarySaving.value = true
  try {
    summary.value = await updateCustomerSummary(id, { summary: summaryForm.value })
    summaryEditing.value = false
    toast.success(t('customers.summaryUpdated'))
  } catch (caught) {
    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    summarySaving.value = false
  }
}

function openMemoryCreate(): void {
  memoryEditing.value = null
  memoryKey.value = ''
  memoryValue.value = ''
  memoryCategory.value = 'general'
  memorySource.value = 'manual'
  memoryConfidence.value = ''
  memoryError.value = null
  memoryFormOpen.value = true
}

function openMemoryEdit(mem: CustomerMemory): void {
  memoryEditing.value = mem
  memoryKey.value = mem.key
  memoryValue.value = mem.value
  memoryCategory.value = mem.category || 'general'
  memorySource.value = mem.source || 'manual'
  memoryConfidence.value = mem.confidence !== null && mem.confidence !== undefined ? String(mem.confidence) : ''
  memoryError.value = null
  memoryFormOpen.value = true
}

function closeMemoryForm(): void {
  memoryFormOpen.value = false
}

async function saveMemory(): Promise<void> {
  const id = customerId.value
  if (!Number.isFinite(id)) return
  if (!memoryKey.value.trim() || !memoryValue.value.trim()) {
    memoryError.value = t('validation.required')
    return
  }
  memorySaving.value = true
  memoryError.value = null
  try {
    const payload: any = {
      key: memoryKey.value.trim(),
      value: memoryValue.value.trim(),
      category: memoryCategory.value,
      source: memorySource.value,
    }
    if (memoryConfidence.value !== '') {
      payload.confidence = Number(memoryConfidence.value)
    }
    if (memoryEditing.value) {
      await updateCustomerMemory(id, memoryEditing.value.id, payload)
      toast.success(t('customers.memoryUpdated'))
    } else {
      await createCustomerMemory(id, payload)
      toast.success(t('customers.memoryCreated'))
    }
    closeMemoryForm()
    await loadMemories()
  } catch (caught) {
    memoryError.value = caught instanceof ApiError && caught.message ? caught.message : t('error.title')
  } finally {
    memorySaving.value = false
  }
}

async function removeMemory(): Promise<void> {
  const id = customerId.value
  const mem = memoryPendingDelete.value
  if (!Number.isFinite(id) || !mem) return
  memoryDeleting.value = true
  try {
    await deleteCustomerMemory(id, mem.id)
    toast.success(t('customers.memoryDeleted'))
    await loadMemories()
    memoryPendingDelete.value = null
  } catch (caught) {
    toast.error(caught instanceof ApiError && caught.message ? caught.message : t('error.title'))
  } finally {
    memoryDeleting.value = false
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
  timeline.value = []
  memories.value = []
  summary.value = null
  void load()
  void loadOrders()
  void loadTimeline()
  void loadMemories()
  void loadSummary()
})

onMounted(() => {
  void load()
  void loadOrders()
  void loadTimeline()
  void loadMemories()
  void loadSummary()
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

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <!-- AI Summary -->
        <section class="surface p-5" :aria-label="t('customers.aiSummary')">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-h4 font-semibold text-ink">{{ t('customers.aiSummary') }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <BaseButton v-if="canUseAi" size="sm" variant="secondary" :icon="RefreshCw" :loading="summaryRefreshing" @click="doRefreshSummary">
                {{ t('action.refresh') }}
              </BaseButton>
              <BaseButton v-if="canUpdate && !summaryEditing" size="sm" variant="secondary" :icon="Pencil" @click="startEditSummary">
                {{ t('action.edit') }}
              </BaseButton>
            </div>
          </div>
          <div class="mt-4">
            <BaseSkeleton v-if="summaryLoading" :rows="4" height="h-4" />
            <template v-else>
              <div v-if="summaryEditing">
                <BaseTextarea v-model="summaryForm" :rows="6" />
                <div class="mt-3 flex items-center gap-2">
                  <BaseButton size="sm" :loading="summarySaving" @click="saveSummary">{{ t('action.save') }}</BaseButton>
                  <BaseButton size="sm" variant="secondary" @click="cancelEditSummary">{{ t('action.cancel') }}</BaseButton>
                </div>
              </div>
              <div v-else>
                <p class="whitespace-pre-wrap text-sm text-ink">{{ summary?.summary || t('customers.noSummary') }}</p>
                <div v-if="summary?.highlights?.length" class="mt-3">
                  <p class="text-caption font-semibold uppercase tracking-wide text-subtle">{{ t('customers.highlights') }}</p>
                  <ul class="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
                    <li v-for="(h, idx) in summary.highlights" :key="idx">{{ h }}</li>
                  </ul>
                </div>
                <div v-if="summary?.risks?.length" class="mt-3">
                  <p class="text-caption font-semibold uppercase tracking-wide text-subtle">{{ t('customers.risks') }}</p>
                  <ul class="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
                    <li v-for="(r, idx) in summary.risks" :key="idx">{{ r }}</li>
                  </ul>
                </div>
                <div v-if="summary?.opportunities?.length" class="mt-3">
                  <p class="text-caption font-semibold uppercase tracking-wide text-subtle">{{ t('customers.opportunities') }}</p>
                  <ul class="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
                    <li v-for="(o, idx) in summary.opportunities" :key="idx">{{ o }}</li>
                  </ul>
                </div>
                <p v-if="summary?.model" class="mt-3 text-xs text-subtle">{{ t('customers.summaryDraftNote') }}</p>
                <p v-if="summary?.is_edited" class="mt-1 text-xs text-subtle">{{ t('customers.editedByStaff') }}</p>
              </div>
            </template>
          </div>
        </section>

        <!-- Verified memories / preferences -->
        <section class="surface p-5" :aria-label="t('customers.preferences')">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-h4 font-semibold text-ink">{{ t('customers.preferences') }}</h2>
            <BaseButton v-if="canUpdate" size="sm" variant="secondary" :icon="Plus" @click="openMemoryCreate">
              {{ t('customers.addMemory') }}
            </BaseButton>
          </div>
          <div class="mt-4">
            <BaseSkeleton v-if="memoriesLoading" :rows="4" height="h-4" />
            <template v-else>
              <ul v-if="memories.length" class="space-y-2">
                <li v-for="mem in memories" :key="mem.id" class="flex flex-col gap-2 rounded-lg border border-subtle p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-ink">{{ mem.key }}</p>
                      <BaseBadge>{{ mem.category }}</BaseBadge>
                      <BaseBadge v-if="mem.source">{{ mem.source }}</BaseBadge>
                    </div>
                    <p class="mt-1 whitespace-pre-wrap text-sm text-muted">{{ mem.value }}</p>
                    <p v-if="mem.confidence !== null && mem.confidence !== undefined" class="mt-1 text-xs text-subtle">{{ t('customers.confidence') }}: {{ mem.confidence }}%</p>
                  </div>
                  <div v-if="canUpdate || canDelete" class="flex items-center gap-2">
                    <BaseButton v-if="canUpdate" size="sm" variant="secondary" :icon="Pencil" @click="openMemoryEdit(mem)">{{ t('action.edit') }}</BaseButton>
                    <BaseButton v-if="canDelete" size="sm" variant="danger" :icon="Trash2" @click="memoryPendingDelete = mem">{{ t('action.delete') }}</BaseButton>
                  </div>
                </li>
              </ul>
              <p v-else class="text-sm text-subtle">{{ t('customers.noMemories') }}</p>
            </template>
          </div>
        </section>
      </div>

      <!-- Timeline -->
      <section class="surface p-5" :aria-label="t('customers.timeline')">
        <h2 class="text-h4 font-semibold text-ink">{{ t('customers.timeline') }}</h2>
        <div class="mt-4">
          <BaseSkeleton v-if="timelineLoading" :rows="5" height="h-4" />
          <template v-else>
            <ul v-if="timeline.length" class="space-y-3">
              <li v-for="item in timeline" :key="item.id" class="flex flex-col gap-1 rounded-lg border border-subtle p-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-sm font-semibold capitalize text-ink">{{ item.type }}</p>
                  <p class="mt-1 text-sm text-muted">{{ item.data?.order_number || item.data?.subject || item.data?.channel || '—' }}</p>
                </div>
                <p class="text-xs text-subtle">{{ item.timestamp ? formatRelative(item.timestamp) : '—' }}</p>
              </li>
            </ul>
            <p v-else class="text-sm text-subtle">{{ t('customers.noTimeline') }}</p>
          </template>
        </div>
      </section>
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

    <!-- Memory -->
    <BaseModal
      :open="memoryFormOpen"
      :title="memoryEditing ? t('customers.editMemory') : t('customers.addMemory')"
      @close="closeMemoryForm"
    >
      <div class="space-y-4">
        <BaseAlert v-if="memoryError" tone="danger" dismissible @dismiss="memoryError = null">
          {{ memoryError }}
        </BaseAlert>
        <BaseInput v-model="memoryKey" :label="t('customers.memoryKey')" required />
        <BaseTextarea v-model="memoryValue" :label="t('customers.memoryValue')" :rows="4" required />
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="memoryCategory" :label="t('customers.memoryCategory')" />
          <BaseInput v-model="memorySource" :label="t('customers.memorySource')" />
        </div>
        <BaseInput v-model="memoryConfidence" type="number" :label="t('customers.memoryConfidence')" />
      </div>
      <template #footer>
        <BaseButton variant="secondary" :disabled="memorySaving" @click="closeMemoryForm">{{ t('action.cancel') }}</BaseButton>
        <BaseButton :loading="memorySaving" @click="saveMemory">{{ t('action.save') }}</BaseButton>
      </template>
    </BaseModal>

    <!-- Memory delete confirmation -->
    <BaseModal
      :open="Boolean(memoryPendingDelete)"
      :title="t('customers.deleteMemoryTitle')"
      size="sm"
      @close="memoryPendingDelete = null"
    >
      <p class="text-sm text-muted">
        {{ t('customers.deleteMemoryBody', { key: memoryPendingDelete?.key ?? '' }) }}
      </p>

      <template #footer>
        <BaseButton variant="secondary" :disabled="memoryDeleting" @click="memoryPendingDelete = null">
          {{ t('action.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="memoryDeleting" @click="removeMemory">
          {{ t('action.delete') }}
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
