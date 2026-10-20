<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  AlertTriangle,
  Inbox,
  Layers,
  Mail,
  RefreshCw,
  UserPlus,
  Users,
  Wallet,
} from '@/components/icons'
import { currentLocale, tDynamic, useI18n, type MessageKey } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { ApiError } from '@/lib/axiosClient'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AiInsightsPanel from '@/components/ui/AiInsightsPanel.vue'
import TrendChart, { type TrendSeries } from '@/components/charts/TrendChart.vue'
import BarMeters, { type MeterItem } from '@/components/charts/BarMeters.vue'
import MiniList, { type MiniListItem } from '@/components/charts/MiniList.vue'
import {
  fetchPlatformDashboard,
  type PlatformDashboard,
  type PlatformDashboardRangeKey,
  type PlatformMetric,
  type PlatformStatusCount,
} from '@/services/platformService'
import { fetchAuditLogs } from '@/services/auditService'
import type { AuditLog } from '@/types/admin'
import { formatDate, formatNumber, formatRelative } from '@/utils/format'

/**
 * The platform operator's overview.
 *
 * Every figure is a real count or grouped count returned by the backend for the
 * selected window; nothing here is derived beyond a period-over-period
 * percentage the backend deliberately does not compute. Lifetime totals,
 * in-period counts and previous-period counts are kept visually distinct, and
 * no subscription metric is shown because Dukavo has no billing system — the
 * plan panel reports configuration, never customers.
 */

const { t } = useI18n()
const { store: auth } = useAuth()

const RANGE_KEYS: PlatformDashboardRangeKey[] = ['7d', '30d', '90d', '12m']
const RANGE_LABEL: Record<PlatformDashboardRangeKey, MessageKey> = {
  '7d': 'platform.overview.range7d',
  '30d': 'platform.overview.range30d',
  '90d': 'platform.overview.range90d',
  '12m': 'platform.overview.range12m',
}

const COLORS = {
  brand: 'var(--color-brand-700)',
  info: 'var(--color-info)',
  accent: 'var(--color-accent-700)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

const range = ref<PlatformDashboardRangeKey>('30d')
const data = ref<PlatformDashboard | null>(null)
const activity = ref<AuditLog[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const activityLoading = ref(false)
const activityError = ref<string | null>(null)

const canAudit = computed(() => auth.can('audit.view'))

const rangeOptions = computed(() =>
  RANGE_KEYS.map((key) => ({ value: key, label: t(RANGE_LABEL[key]) })),
)

/* ------------------------------------------------------------ period labels */

function windowLabel(iso: string): string {
  if (data.value?.range.bucket === 'month') {
    const [year, month] = iso.split('-')
    return new Intl.DateTimeFormat(currentLocale.value, { month: 'short', year: 'numeric' }).format(
      new Date(Number(year), Number(month) - 1, 1),
    )
  }
  return formatDate(iso)
}

const periodFrom = computed(() => (data.value ? windowLabel(data.value.range.from) : ''))
const periodUntil = computed(() => (data.value ? windowLabel(data.value.range.until) : ''))
const previousFrom = computed(() =>
  data.value ? windowLabel(data.value.range.previous_from) : '',
)
const previousUntil = computed(() =>
  data.value ? windowLabel(data.value.range.previous_until) : '',
)

const periodRangeLabel = computed(() =>
  periodFrom.value && periodUntil.value
    ? t('platform.overview.periodRange', { from: periodFrom.value, until: periodUntil.value })
    : '',
)

const previousRangeLabel = computed(() =>
  previousFrom.value && previousUntil.value
    ? t('platform.overview.periodRange', {
        from: previousFrom.value,
        until: previousUntil.value,
      })
    : '',
)

const comparisonNote = computed(() =>
  hasComparison.value
    ? t('platform.overview.comparisonNote', { range: previousRangeLabel.value })
    : t('platform.overview.comparisonUnavailable'),
)

const bucketWord = computed(() =>
  data.value?.range.bucket === 'month'
    ? t('platform.overview.bucketMonth')
    : t('platform.overview.bucketDay'),
)

/* Real destinations, each gated by the sidebar permission independently; a
platform team member without one of these modules still sees the others. */
const leadLinks = computed(() => [
  { to: '/waitlist-entries', label: t('nav.waitlistEntries') },
  { to: '/contact-messages', label: t('nav.contactMessages') },
  { to: '/newsletter-subscribers', label: t('nav.newsletterSubscribers') },
])

/* --------------------------------------------------------------- formatting */

function bucketLabel(bucket: string): string {
  if (data.value?.range.bucket === 'month') {
    const [year, month] = bucket.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat(currentLocale.value, { month: 'short', year: 'numeric' }).format(date)
  }
  return formatDate(bucket)
}

const seriesLabels = computed(() => (data.value?.series ?? []).map((point) => bucketLabel(point.bucket)))

const accountSeries = computed<TrendSeries[]>(() => [
  { key: 'tenants', label: t('platform.overview.tenantsSeries'), color: COLORS.brand, values: seriesValues('tenants') },
  { key: 'users', label: t('platform.overview.usersSeries'), color: COLORS.info, values: seriesValues('users') },
])

const leadSeries = computed<TrendSeries[]>(() => [
  { key: 'waitlist', label: t('platform.overview.waitlistSeries'), color: COLORS.accent, values: seriesValues('waitlist') },
  { key: 'contacts', label: t('platform.overview.contactSeries'), color: COLORS.warning, values: seriesValues('contact_messages') },
  { key: 'newsletter', label: t('platform.overview.newsletterSeries'), color: COLORS.info, values: seriesValues('newsletter_subscribers') },
])

function seriesValues(key: keyof PlatformDashboard['series'][number]): number[] {
  return data.value?.series.map((point) => Number(point[key])) ?? []
}

/* -------------------------------------------------------------------- kpis */

function periodDelta(metric?: PlatformMetric): number | null {
  if (!metric || !metric.previous_new) return null
  return (((metric.new ?? 0) - metric.previous_new) / metric.previous_new) * 100
}

const hasComparison = computed(() => {
  const current = data.value
  if (!current) return false

  return [
    current.tenants,
    current.users,
    current.waitlist,
    current.contact_messages,
    current.newsletter_subscribers,
  ].some((metric) => (metric.previous_new ?? 0) > 0)
})

const tenantHint = computed(() => {
  if (!data.value) return undefined
  return t('platform.overview.tenantsHint', {
    active: data.value.tenants.active ?? 0,
    suspended: data.value.tenants.suspended ?? 0,
  })
})

const userHint = computed(() =>
  data.value
    ? t('platform.overview.usersHint', {
        platform: data.value.users.platform ?? 0,
        members: data.value.users.members ?? 0,
      })
    : undefined,
)

const waitlistHint = computed(() =>
  data.value
    ? t('platform.overview.waitlistHint', {
        pending: data.value.waitlist.pending ?? 0,
        joined: data.value.waitlist.joined ?? 0,
      })
    : undefined,
)

const contactHint = computed(() =>
  data.value
    ? t('platform.overview.contactsHint', { unresolved: data.value.contact_messages.unresolved ?? 0 })
    : undefined,
)

const newsletterHint = computed(() =>
  data.value
    ? t('platform.overview.newsletterHint', {
        subscribed: data.value.newsletter_subscribers.subscribed ?? 0,
      })
    : undefined,
)

/* ------------------------------------------------------------------ status */

interface StatusCard {
  key: string
  title: string
  items: MeterItem[]
}

function statusLabel(namespace: string, value: string): string {
  return tDynamic(`status.${namespace}`, value)
}

function toMeterItems(counts: PlatformStatusCount[], namespace: string): MeterItem[] {
  const present = counts.filter((entry) => entry.count > 0)
  const leader = Math.max(1, ...present.map((entry) => entry.count))

  return present.map((entry) => ({
    id: entry.value,
    label: statusLabel(namespace, entry.value),
    value: formatNumber(entry.count),
    ratio: entry.count / leader,
  }))
}

const statusCards = computed<StatusCard[]>(() => {
  const current = data.value
  if (!current) return []

  return [
    { key: 'tenants', title: t('platform.overview.statusTenants'), items: toMeterItems(current.status.tenants, 'tenant') },
    { key: 'users', title: t('platform.overview.statusUsers'), items: toMeterItems(current.status.users, 'user') },
    { key: 'user_accounts', title: t('platform.overview.statusUserAccounts'), items: toMeterItems(current.status.user_accounts, 'user_account') },
    { key: 'waitlist', title: t('platform.overview.statusWaitlist'), items: toMeterItems(current.status.waitlist, 'waitlist') },
    { key: 'contacts', title: t('platform.overview.statusContacts'), items: toMeterItems(current.status.contact_messages, 'contact') },
    { key: 'newsletter', title: t('platform.overview.statusNewsletter'), items: toMeterItems(current.status.newsletter_subscribers, 'newsletter') },
  ]
})

/* ----------------------------------------------------------------- actions */

interface ActionItem {
  key: string
  label: string
  to: string
}

const actions = computed<ActionItem[]>(() => {
  const current = data.value
  if (!current) return []

  const items: ActionItem[] = []

  const unresolved = current.contact_messages.unresolved ?? 0
  if (unresolved > 0) {
    items.push({
      key: 'contacts',
      label: t('platform.overview.actionUnresolvedContacts', { count: formatNumber(unresolved) }),
      to: '/contact-messages',
    })
  }

  const pending = current.waitlist.pending ?? 0
  if (pending > 0) {
    items.push({
      key: 'waitlist',
      label: t('platform.overview.actionPendingWaitlist', { count: formatNumber(pending) }),
      to: '/waitlist-entries',
    })
  }

  const suspended = current.tenants.suspended ?? 0
  if (suspended > 0) {
    items.push({
      key: 'tenants',
      label: t('platform.overview.actionSuspendedTenants', { count: formatNumber(suspended) }),
      to: '/tenants',
    })
  }

  return items
})

const activityItems = computed<MiniListItem[]>(() =>
  activity.value.map((entry) => ({
    id: entry.id,
    title: entry.action_label,
    meta: `${entry.user?.name ?? t('common.none')}${
      entry.created_at ? ` · ${formatRelative(entry.created_at)}` : ''
    }`,
  })),
)

/* -------------------------------------------------------------------- load */

// The overview payload and the recent-activity feed are independent requests:
// a failure in one must not blank the other, so each keeps its own loading and
// error state and only the overview failure replaces the page with an alert.
async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const dashboard = await fetchPlatformDashboard(range.value)
    data.value = dashboard
  } catch (exception) {
    data.value = null
    error.value = exception instanceof ApiError ? exception.message : t('error.title')
  } finally {
    loading.value = false
  }

  void loadActivity()
}

async function loadActivity(): Promise<void> {
  if (!canAudit.value || !data.value) {
    activity.value = []
    activityError.value = null
    return
  }

  activityLoading.value = true
  activityError.value = null

  try {
    const logs = await fetchAuditLogs(
      { per_page: 6, from: data.value.range.from, until: data.value.range.until },
      'platform',
    )
    activity.value = logs.data
  } catch {
    activity.value = []
    activityError.value = t('platform.overview.activityFailed')
  } finally {
    activityLoading.value = false
  }
}

function onRangeChange(value: string): void {
  range.value = value as PlatformDashboardRangeKey
  void load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('platform.overview.title')" :description="t('platform.overview.subtitle')">
      <template #actions>
        <div class="flex items-center gap-2">
          <BaseButton
            variant="secondary"
            size="sm"
            :icon="RefreshCw"
            :loading="loading"
            :disabled="loading"
            @click="load"
          >
            {{ t('platform.overview.refresh') }}
          </BaseButton>
          <BaseSelect
            class="w-44"
            :model-value="range"
            :label="t('platform.overview.range')"
            :options="rangeOptions"
            :disabled="loading"
            @update:model-value="onRangeChange"
          />
        </div>
      </template>
    </PageHeader>

    <BaseAlert v-if="error" tone="danger" :title="t('error.title')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="load">
          {{ t('action.retry') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <template v-else>
      <div v-if="!loading && periodRangeLabel" class="space-y-0.5 text-small text-subtle">
        <p>{{ t('platform.overview.periodLabel', { range: periodRangeLabel }) }}</p>
        <p>{{ comparisonNote }}</p>
      </div>

      <!-- Headline figures (lifetime totals; the delta is the in-period change) -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          :label="t('platform.overview.tenants')"
          :value="formatNumber(data?.tenants.total ?? 0)"
          :delta="periodDelta(data?.tenants)"
          :delta-label="t('platform.overview.newInPeriod', { count: data?.tenants.new ?? 0 })"
          :hint="tenantHint"
          :icon="Layers"
          :loading="loading"
        />
        <StatCard
          :label="t('platform.overview.users')"
          :value="formatNumber(data?.users.total ?? 0)"
          :delta="periodDelta(data?.users)"
          :delta-label="t('platform.overview.newInPeriod', { count: data?.users.new ?? 0 })"
          :hint="userHint"
          :icon="Users"
          :loading="loading"
        />
        <StatCard
          :label="t('platform.overview.waitlist')"
          :value="formatNumber(data?.waitlist.total ?? 0)"
          :delta="periodDelta(data?.waitlist)"
          :delta-label="t('platform.overview.newInPeriod', { count: data?.waitlist.new ?? 0 })"
          :hint="waitlistHint"
          :icon="UserPlus"
          :loading="loading"
        />
        <StatCard
          :label="t('platform.overview.contacts')"
          :value="formatNumber(data?.contact_messages.total ?? 0)"
          :delta="periodDelta(data?.contact_messages)"
          :delta-label="t('platform.overview.newInPeriod', { count: data?.contact_messages.new ?? 0 })"
          :hint="contactHint"
          :icon="Inbox"
          :loading="loading"
        />
        <StatCard
          :label="t('platform.overview.newsletter')"
          :value="formatNumber(data?.newsletter_subscribers.total ?? 0)"
          :delta="periodDelta(data?.newsletter_subscribers)"
          :delta-label="t('platform.overview.newInPeriod', { count: data?.newsletter_subscribers.new ?? 0 })"
          :hint="newsletterHint"
          :icon="Mail"
          :loading="loading"
        />
      </div>

      <AiInsightsPanel v-if="auth.can('ai.use')" scope="platform" :range="range" />

      <!-- Time series -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section class="surface p-5" :aria-label="t('platform.overview.accountsChart')">
          <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.accountsChart') }}</h2>
          <p class="mt-0.5 text-small text-muted">
            {{ t('platform.overview.accountsChartDesc', { bucket: bucketWord }) }}
          </p>
          <div class="mt-4">
            <TrendChart
              :labels="seriesLabels"
              :series="accountSeries"
              :loading="loading"
              :aria-label="t('platform.overview.accountsChart')"
              :empty-title="t('platform.overview.seriesEmpty')"
              :empty-description="t('platform.overview.seriesEmptyHint')"
              :hidden-title="t('platform.overview.seriesHidden')"
              :hidden-description="t('platform.overview.seriesHiddenHint')"
              toggleable
            />
          </div>
        </section>

        <section class="surface p-5" :aria-label="t('platform.overview.leadsChart')">
          <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.leadsChart') }}</h2>
          <p class="mt-0.5 text-small text-muted">
            {{ t('platform.overview.leadsChartDesc', { bucket: bucketWord }) }}
          </p>
          <div class="mt-4">
            <TrendChart
              :labels="seriesLabels"
              :series="leadSeries"
              :loading="loading"
              :aria-label="t('platform.overview.leadsChart')"
              :empty-title="t('platform.overview.seriesEmpty')"
              :empty-description="t('platform.overview.seriesEmptyHint')"
              :hidden-title="t('platform.overview.seriesHidden')"
              :hidden-description="t('platform.overview.seriesHiddenHint')"
              toggleable
            />
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3">
            <span class="text-caption font-medium text-subtle">
              {{ t('platform.overview.leadInboxes') }}
            </span>
            <RouterLink
              v-for="link in leadLinks"
              :key="link.to"
              :to="link.to"
              class="text-caption font-medium text-brand-700 transition hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {{ link.label }}
            </RouterLink>
          </div>
        </section>
      </div>

      <!-- Status distribution -->
      <section class="space-y-4" :aria-label="t('platform.overview.status')">
        <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.status') }}</h2>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="card in statusCards" :key="card.key" class="surface p-5">
            <h3 class="text-sm font-medium text-muted">{{ card.title }}</h3>
            <div class="mt-4">
              <BarMeters
                :items="card.items"
                :loading="loading"
                :selectable="false"
                :empty-title="t('common.noResults')"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Action center, plan configuration, recent activity -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section class="surface p-5" :aria-label="t('platform.overview.actionCenter')">
          <div class="flex items-center gap-2">
            <span class="grid size-8 place-items-center rounded-lg bg-warning-soft text-warning-ink">
              <AlertTriangle class="size-4" aria-hidden="true" />
            </span>
            <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.actionCenter') }}</h2>
          </div>

          <p v-if="loading" class="mt-4 text-small text-subtle">{{ t('state.loading') }}</p>
          <p v-else-if="actions.length === 0" class="mt-4 text-small text-muted">
            {{ t('platform.overview.actionCenterEmpty') }}
          </p>
          <ul v-else class="mt-3 divide-y divide-line">
            <li v-for="action in actions" :key="action.key">
              <RouterLink
                :to="action.to"
                class="flex items-center justify-between gap-3 py-2.5 text-sm text-ink transition hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span class="min-w-0 truncate">{{ action.label }}</span>
                <span class="shrink-0 text-caption text-subtle">{{ t('platform.overview.viewAll') }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="surface p-5" :aria-label="t('platform.overview.planConfig')">
          <div class="flex items-center gap-2">
            <span class="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
              <Wallet class="size-4" aria-hidden="true" />
            </span>
            <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.planConfig') }}</h2>
          </div>
          <p class="mt-0.5 text-small text-muted">{{ t('platform.overview.planConfigDesc') }}</p>

          <dl class="mt-4 space-y-3">
            <div class="flex items-center justify-between">
              <dt class="text-small text-muted">{{ t('platform.overview.planConfigTotal') }}</dt>
              <dd class="text-h4 font-semibold tabular-nums text-ink">{{ formatNumber(data?.plans.total ?? 0) }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-small text-muted">{{ t('platform.overview.planConfigActive') }}</dt>
              <dd class="text-h4 font-semibold tabular-nums text-ink">{{ formatNumber(data?.plans.active ?? 0) }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-small text-muted">{{ t('platform.overview.planConfigHighlighted') }}</dt>
              <dd class="text-h4 font-semibold tabular-nums text-ink">{{ formatNumber(data?.plans.highlighted ?? 0) }}</dd>
            </div>
          </dl>

          <div class="mt-4">
            <BaseButton variant="link" size="sm" to="/pricing-plans">
              {{ t('platform.overview.viewAll') }}
            </BaseButton>
          </div>
        </section>

        <section
          v-if="canAudit"
          class="surface p-5"
          :aria-label="t('platform.overview.recentActivity')"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
                <Activity class="size-4" aria-hidden="true" />
              </span>
              <h2 class="text-h4 font-semibold text-ink">{{ t('platform.overview.recentActivity') }}</h2>
            </div>
            <BaseButton variant="link" size="sm" to="/platform/audit">
              {{ t('platform.overview.viewAll') }}
            </BaseButton>
          </div>
          <p class="mt-0.5 text-small text-muted">{{ t('platform.overview.recentActivityDesc') }}</p>

          <BaseAlert
            v-if="activityError"
            tone="danger"
            dismissible
            class="mt-3"
            @dismiss="activityError = null"
          >
            {{ activityError }}
          </BaseAlert>

          <div class="mt-3">
            <MiniList
              :items="activityItems"
              :loading="activityLoading"
              :selectable="false"
              :empty-title="t('platform.overview.recentActivityEmpty')"
              :empty-description="t('platform.overview.recentActivityEmptyHint')"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
