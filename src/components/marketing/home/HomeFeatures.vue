<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowRight,
  CheckCircle2,
  CircleMinus,
  MessageCircle,
  Package,
  ShoppingCart,
  UserCog,
  Users,
} from '@/components/icons'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeTone } from '@/components/ui/badgeTones'
import { useI18n, type MessageKey } from '@/i18n'

/**
 * The five-pillar feature bento.
 *
 * Each pillar carries a small piece of the real interface rather than a
 * decorative illustration, and the team card is genuinely interactive: pick a
 * role, see exactly what that role is allowed to do — the same model the
 * permissions system ships with.
 */

interface Role {
  id: string
  labelKey: MessageKey
  allows: Record<string, boolean>
}

const { t } = useI18n()

const selectedRole = ref('owner')

const PERMISSIONS: { id: string; labelKey: MessageKey }[] = [
  { id: 'view', labelKey: 'marketing.home.demoPermViewOrders' },
  { id: 'edit', labelKey: 'marketing.home.demoPermEditStock' },
  { id: 'delete', labelKey: 'marketing.home.demoPermDeleteOrders' },
]

const ROLES: Role[] = [
  {
    id: 'owner',
    labelKey: 'marketing.home.roleOwner',
    allows: { view: true, edit: true, delete: true },
  },
  {
    id: 'sales',
    labelKey: 'marketing.home.roleSales',
    allows: { view: true, edit: false, delete: false },
  },
  {
    id: 'warehouse',
    labelKey: 'marketing.home.roleWarehouse',
    allows: { view: true, edit: true, delete: false },
  },
]

const role = computed<Role>(
  () => ROLES.find((r) => r.id === selectedRole.value) ?? (ROLES[0] as Role),
)

const ORDER_PIPELINE: { key: MessageKey; tone: BadgeTone }[] = [
  { key: 'status.order.pending', tone: 'neutral' },
  { key: 'status.order.confirmed', tone: 'info' },
  { key: 'status.order.processing', tone: 'warning' },
  { key: 'status.order.shipped', tone: 'brand' },
  { key: 'status.order.delivered', tone: 'success' },
]

const stockRows = computed(() => [
  { name: t('marketing.home.demoProductJacket'), qty: 14, low: false },
  { name: t('marketing.home.demoProductCap'), qty: 4, low: true },
])

function stockWidth(qty: number): string {
  return `${Math.min(qty * 3, 100)}%`
}
</script>

<template>
  <section id="features" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
        >
          {{ t('marketing.home.featuresEyebrow') }}
        </span>
        <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
          {{ t('marketing.home.featuresTitle') }}
        </h2>
      </div>

      <div class="mt-10 grid gap-5 md:grid-cols-3">
        <!-- Inventory -->
        <article
          class="surface flex flex-col p-6 md:col-span-2"
          data-aos="fade-up"
          data-aos-delay="0"
        >
          <span class="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
            <Package class="size-5" aria-hidden="true" />
          </span>
          <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t('marketing.home.featureInventoryTitle') }}</h3>
          <p class="mt-2 max-w-lg text-body text-muted">{{ t('marketing.home.featureInventoryBody') }}</p>

          <div class="mt-5 space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div v-for="product in stockRows" :key="product.name" class="flex items-center gap-3">
              <span class="w-28 shrink-0 truncate text-small text-ink sm:w-36">{{ product.name }}</span>
              <span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span
                  class="block h-full rounded-full transition-[width] duration-700 ease-out"
                  :class="product.low ? 'bg-warning' : 'bg-brand-700'"
                  :style="{ width: stockWidth(product.qty) }"
                />
              </span>
              <b class="metric w-6 shrink-0 text-end text-small">{{ product.qty }}</b>
              <BaseBadge
                v-if="product.low"
                tone="warning"
                size="sm"
                dot
              >
                {{ t('marketing.home.demoLowStock') }}
              </BaseBadge>
            </div>
          </div>

          <RouterLink
            to="/features"
            class="mt-5 inline-flex items-center gap-1.5 self-start text-small font-medium text-brand-ink hover:underline"
          >
            {{ t('marketing.home.learnMore') }}
            <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </article>

        <!-- Orders -->
        <article class="surface flex flex-col p-6" data-aos="fade-up" data-aos-delay="50">
          <span class="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
            <ShoppingCart class="size-5" aria-hidden="true" />
          </span>
          <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t('marketing.home.featureOrdersTitle') }}</h3>
          <p class="mt-2 text-body text-muted">{{ t('marketing.home.featureOrdersBody') }}</p>

          <div class="mt-5 flex flex-wrap gap-2 rounded-xl border border-line bg-canvas p-4">
            <template v-for="(status, index) in ORDER_PIPELINE" :key="status.key">
              <BaseBadge :tone="status.tone" size="sm">{{ t(status.key) }}</BaseBadge>
              <ArrowRight
                v-if="index < ORDER_PIPELINE.length - 1"
                class="mt-1 size-3.5 shrink-0 self-center text-subtle rtl:-scale-x-100"
                aria-hidden="true"
              />
            </template>
          </div>

          <RouterLink
            to="/features"
            class="mt-5 inline-flex items-center gap-1.5 self-start text-small font-medium text-brand-ink hover:underline"
          >
            {{ t('marketing.home.learnMore') }}
            <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </article>

        <!-- Customers -->
        <article class="surface flex flex-col p-6" data-aos="fade-up" data-aos-delay="0">
          <span class="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
            <Users class="size-5" aria-hidden="true" />
          </span>
          <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t('marketing.home.featureCustomersTitle') }}</h3>
          <p class="mt-2 text-body text-muted">{{ t('marketing.home.featureCustomersBody') }}</p>

          <div class="mt-5 flex items-center gap-3 rounded-xl border border-line bg-canvas p-4">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-ink">
              {{ t('marketing.home.demoCustomerSara').charAt(0) }}
            </span>
            <span class="min-w-0">
              <b class="block text-small font-semibold text-ink">{{ t('marketing.home.demoCustomerSara') }}</b>
              <span class="text-caption text-muted">
                {{ t('marketing.home.demoPreviousOrders') }} · 8
              </span>
            </span>
            <BaseBadge class="ms-auto shrink-0" tone="info" size="sm" dot>
              {{ t('status.conversation.open') }}
            </BaseBadge>
          </div>

          <RouterLink
            to="/features"
            class="mt-5 inline-flex items-center gap-1.5 self-start text-small font-medium text-brand-ink hover:underline"
          >
            {{ t('marketing.home.learnMore') }}
            <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </article>

        <!-- Conversations -->
        <article class="surface flex flex-col p-6 md:col-span-2" data-aos="fade-up" data-aos-delay="50">
          <span class="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
            <MessageCircle class="size-5" aria-hidden="true" />
          </span>
          <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t('marketing.home.featureConversationsTitle') }}</h3>
          <p class="mt-2 max-w-lg text-body text-muted">{{ t('marketing.home.featureConversationsBody') }}</p>

          <div class="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-canvas p-4">
            <span class="max-w-[60%] rounded-2xl rounded-ss-sm border border-line bg-surface px-3 py-2 text-small text-ink shadow-xs">
              {{ t('marketing.home.demoMsgJackets') }}
            </span>
            <ArrowRight class="size-4 shrink-0 text-brand-700 rtl:-scale-x-100" aria-hidden="true" />
            <span class="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-small font-medium text-white shadow-xs">
              <CheckCircle2 class="size-4" aria-hidden="true" />
              {{ t('marketing.home.demoWaCreated') }}
            </span>
          </div>

          <RouterLink
            to="/features"
            class="mt-5 inline-flex items-center gap-1.5 self-start text-small font-medium text-brand-ink hover:underline"
          >
            {{ t('marketing.home.learnMore') }}
            <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </article>

        <!-- Team & permissions -->
        <article class="surface flex flex-col p-6 md:col-span-3" data-aos="fade-up" data-aos-delay="100">
          <div class="grid gap-6 md:grid-cols-2 md:items-start">
            <div>
              <span class="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink ring-1 ring-brand-ring">
                <UserCog class="size-5" aria-hidden="true" />
              </span>
              <h3 class="mt-4 text-h3 font-semibold text-ink">{{ t('marketing.home.featureTeamTitle') }}</h3>
              <p class="mt-2 max-w-lg text-body text-muted">{{ t('marketing.home.featureTeamBody') }}</p>

              <RouterLink
                to="/features"
                class="mt-5 inline-flex items-center gap-1.5 self-start text-small font-medium text-brand-ink hover:underline"
              >
                {{ t('marketing.home.learnMore') }}
                <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </RouterLink>
            </div>

            <div class="rounded-xl border border-line bg-canvas p-4">
              <!-- Role picker -->
              <div class="flex gap-2" role="group" :aria-label="t('marketing.home.featureTeamTitle')">
                <button
                  v-for="item in ROLES"
                  :key="item.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-small font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  :class="
                    selectedRole === item.id
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  "
                  :aria-pressed="selectedRole === item.id"
                  @click="selectedRole = item.id"
                >
                  {{ t(item.labelKey) }}
                </button>
              </div>

              <!-- Permission rows -->
              <div class="mt-3 space-y-2">
                <div
                  v-for="permission in PERMISSIONS"
                  :key="permission.id"
                  class="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
                >
                  <span class="text-small" :class="role.allows[permission.id] ? 'text-ink' : 'text-muted line-through'">
                    {{ t(permission.labelKey) }}
                  </span>
                  <CheckCircle2
                    v-if="role.allows[permission.id]"
                    class="size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <CircleMinus v-else class="size-4 shrink-0 text-subtle" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
