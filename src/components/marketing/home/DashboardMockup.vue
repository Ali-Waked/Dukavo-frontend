<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useI18n, type MessageKey } from '@/i18n'
import type { BadgeTone } from '@/components/ui/badgeTones'

/**
 * The hero's interactive product demo.
 *
 * Everything inside the window is sample data on purpose — it is a labelled
 * illustration of the product, not a live view of anything. The WhatsApp card
 * can be clicked, dragged onto the board, or activated with the keyboard: all
 * three paths run the same conversion moment (a new order appears, stock drops,
 * a toast confirms), and everything resets a few seconds later so the next
 * visitor sees the same story.
 *
 * Motion is progressive: tilt needs a real pointer, drag needs Pointer Events,
 * and `prefers-reduced-motion` collapses the rest through the global reduced
 * motion rules.
 */

type DemoView = 'dashboard' | 'orders' | 'products' | 'conversations'

const RESET_MS = 6500

const { t } = useI18n()

const view = ref<DemoView>('dashboard')
const converted = ref(false)
const dragging = ref(false)
const overBoard = ref(false)
const tilt = ref('')
const stageEl = ref<HTMLElement | null>(null)
const boardEl = ref<HTMLElement | null>(null)
const waEl = ref<HTMLElement | null>(null)

let resetTimer: ReturnType<typeof setTimeout> | null = null
let drag: { id: number; x: number; y: number; moved: number; dx: number; dy: number } | null = null
let hoverCapable = false
let reduceMotion = false

const TABS: { id: DemoView; labelKey: MessageKey }[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard' },
  { id: 'orders', labelKey: 'nav.orders' },
  { id: 'products', labelKey: 'nav.products' },
  { id: 'conversations', labelKey: 'nav.conversations' },
]

const kpis = computed(() => [
  { label: t('marketing.home.demoKpiOrders'), value: converted.value ? 13 : 12 },
  { label: t('marketing.home.demoKpiStock'), value: converted.value ? 12 : 14 },
  { label: t('marketing.home.demoKpiConversations'), value: converted.value ? 4 : 5 },
])

interface DemoOrder {
  number: string
  customer: string
  tone: BadgeTone
  status: string
}

const latestOrders = computed<DemoOrder[]>(() => {
  const rows: DemoOrder[] = [
    {
      number: '#1041',
      customer: t('marketing.home.demoCustomerSara'),
      tone: 'warning',
      status: t('status.order.processing'),
    },
    {
      number: '#1040',
      customer: t('marketing.home.demoCustomerMohamed'),
      tone: 'success',
      status: t('status.order.delivered'),
    },
    {
      number: '#1039',
      customer: t('marketing.home.demoCustomerLayla'),
      tone: 'success',
      status: t('status.order.delivered'),
    },
  ]

  if (converted.value) {
    rows.unshift({
      number: '#1043',
      customer: t('marketing.home.demoCustomerAhmed'),
      tone: 'info',
      status: t('marketing.home.demoNew'),
    })
  }

  return rows
})

const products = computed(() => {
  const jacket = converted.value ? 12 : 14
  return [
    { name: t('marketing.home.demoProductJacket'), qty: jacket, low: jacket < 6 },
    { name: t('marketing.home.demoProductShirt'), qty: 31, low: false },
    { name: t('marketing.home.demoProductCap'), qty: 4, low: true },
  ]
})

const conversations = computed(() => [
  {
    name: t('marketing.home.demoCustomerAhmed'),
    preview: t('marketing.home.demoMsgJackets'),
    tone: converted.value ? ('success' as BadgeTone) : ('info' as BadgeTone),
    status: converted.value
      ? t('marketing.home.demoWaCreated')
      : t('marketing.home.demoNew'),
  },
  {
    name: t('marketing.home.demoCustomerSara'),
    preview: t('marketing.home.demoMsgWhereIsMyOrder'),
    tone: 'warning' as BadgeTone,
    status: t('status.conversation.open'),
  },
  {
    name: t('marketing.home.demoCustomerMohamed'),
    preview: t('marketing.home.demoMsgThanks'),
    tone: 'neutral' as BadgeTone,
    status: t('status.conversation.closed'),
  },
])

function stockWidth(qty: number): string {
  return `${Math.min(qty * 3, 100)}%`
}

/* --------------------------------------------------------------- convert */

function convert(): void {
  if (converted.value) {
    return
  }
  converted.value = true
  if (resetTimer) {
    clearTimeout(resetTimer)
  }
  resetTimer = setTimeout(() => {
    converted.value = false
    resetTimer = null
  }, RESET_MS)
}

/* ------------------------------------------------------------------ drag */

function onWaPointerDown(event: PointerEvent): void {
  if (!waEl.value) {
    return
  }
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, dx: 0, dy: 0 }
  waEl.value.setPointerCapture(event.pointerId)
  dragging.value = true
}

function onWaPointerMove(event: PointerEvent): void {
  if (!drag || drag.id !== event.pointerId) {
    return
  }
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy))
  drag.dx = dx
  drag.dy = dy
  if (waEl.value) {
    waEl.value.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 40}deg)`
  }
  overBoard.value = isOverBoard(event)
}

function isOverBoard(event: PointerEvent): boolean {
  const board = boardEl.value
  if (!board) {
    return false
  }
  const rect = board.getBoundingClientRect()
  return (
    event.clientX > rect.left &&
    event.clientX < rect.right &&
    event.clientY > rect.top &&
    event.clientY < rect.bottom
  )
}

function onWaPointerUp(event: PointerEvent): void {
  if (!drag || drag.id !== event.pointerId) {
    return
  }
  const { moved } = drag
  const hit = isOverBoard(event)
  drag = null
  dragging.value = false
  overBoard.value = false
  if (waEl.value) {
    waEl.value.style.transform = ''
  }
  // A tap, or a drop onto the board — both tell the same story.
  if (moved < 6 || hit) {
    convert()
  }
}

function onWaPointerCancel(): void {
  drag = null
  dragging.value = false
  overBoard.value = false
  if (waEl.value) {
    waEl.value.style.transform = ''
  }
}

/* ------------------------------------------------------------------ tilt */

function onStagePointerMove(event: PointerEvent): void {
  if (!stageEl.value || dragging.value || !hoverCapable || reduceMotion) {
    return
  }
  const rect = stageEl.value.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width - 0.5
  const y = (event.clientY - rect.top) / rect.height - 0.5
  tilt.value = `perspective(1100px) rotateY(${x * -5}deg) rotateX(${y * 4}deg)`
}

function onStagePointerLeave(): void {
  tilt.value = ''
}

onMounted(() => {
  hoverCapable = window.matchMedia('(hover: hover)').matches
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

onBeforeUnmount(() => {
  if (resetTimer) {
    clearTimeout(resetTimer)
    resetTimer = null
  }
})
</script>

<template>
  <div>
    <div
      ref="stageEl"
      class="relative mx-auto mt-14 max-w-5xl px-4 md:mt-16 md:px-6"
      @pointermove="onStagePointerMove"
      @pointerleave="onStagePointerLeave"
    >
      <div class="transition-transform duration-300 ease-out" :style="{ transform: tilt }">
        <!-- App window -->
        <div class="surface overflow-hidden shadow-xl">
          <!-- Title bar -->
          <div class="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3">
            <span class="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
            <span class="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
            <span class="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
            <span class="mx-auto rounded-full bg-surface-2 px-10 py-0.5 text-label text-subtle">
              app.dukavo.com
            </span>
          </div>

          <!-- Sidebar + board -->
          <div class="grid lg:grid-cols-[170px_1fr]">
            <div
              class="flex gap-1 overflow-x-auto border-b border-line bg-canvas p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-e lg:p-2.5"
              role="group"
              :aria-label="t('marketing.home.demoWindowLabel')"
            >
              <button
                v-for="tab in TABS"
                :key="tab.id"
                type="button"
                class="whitespace-nowrap rounded-lg px-3 py-2 text-start text-small font-medium text-muted transition-colors duration-150 hover:text-ink"
                :class="view === tab.id ? 'bg-surface font-semibold text-brand-ink shadow-xs ring-1 ring-line' : ''"
                :aria-pressed="view === tab.id"
                @click="view = tab.id"
              >
                {{ t(tab.labelKey) }}
              </button>
            </div>

            <div
              ref="boardEl"
              class="grid content-start gap-3.5 bg-surface p-5 transition-shadow duration-200"
              :class="{ 'ring-2 ring-inset ring-brand-700 bg-brand-soft': overBoard }"
            >
              <!-- Dashboard -->
              <template v-if="view === 'dashboard'">
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="(kpi, index) in kpis"
                    :key="kpi.label"
                    class="rounded-xl border border-line p-3 text-caption text-muted"
                    :style="{ animationDelay: `${index * 90}ms` }"
                    data-demo-rise
                  >
                    <strong class="metric block text-h2 text-ink">{{ kpi.value }}</strong>
                    {{ kpi.label }}
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-[1.3fr_1fr]">
                  <div class="rounded-xl border border-line p-3.5 text-caption text-muted">
                    {{ t('marketing.home.demoSales') }}
                    <div dir="ltr" class="mt-1.5">
                      <svg viewBox="0 0 300 90" preserveAspectRatio="none" class="block h-24 w-full" aria-hidden="true">
                        <path
                          class="demo-area"
                          d="M0 70 C40 66 60 34 100 40 S170 62 200 32 S260 16 300 10 V90 H0Z"
                        />
                        <path
                          class="demo-line"
                          pathLength="1"
                          d="M0 70 C40 66 60 34 100 40 S170 62 200 32 S260 16 300 10"
                        />
                      </svg>
                    </div>
                  </div>

                  <div class="rounded-xl border border-line p-3.5 text-caption text-muted">
                    {{ t('marketing.home.demoLatestOrders') }}
                    <div class="mt-1">
                      <div
                        v-for="order in latestOrders.slice(0, 3)"
                        :key="order.number"
                        class="flex items-center justify-between gap-2 border-b border-dashed border-line py-2 text-small text-ink last:border-0"
                      >
                        <span>
                          <b class="font-semibold">{{ order.number }}</b>
                          · {{ order.customer }}
                        </span>
                        <BaseBadge :tone="order.tone" size="sm">{{ order.status }}</BaseBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Orders -->
              <template v-else-if="view === 'orders'">
                <div class="rounded-xl border border-line p-3.5 text-caption text-muted">
                  {{ t('marketing.home.demoAllOrders') }}
                  <div class="mt-1">
                    <div
                      v-for="order in latestOrders"
                      :key="order.number"
                      class="flex items-center justify-between gap-2 border-b border-dashed border-line py-2 text-small text-ink last:border-0"
                      :class="{ 'demo-new-row': order.number === '#1043' }"
                    >
                      <span>
                        <b class="font-semibold">{{ order.number }}</b>
                        · {{ order.customer }}
                      </span>
                      <BaseBadge :tone="order.tone" size="sm">{{ order.status }}</BaseBadge>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Products -->
              <template v-else-if="view === 'products'">
                <div class="rounded-xl border border-line p-3.5 text-caption text-muted">
                  {{ t('marketing.home.demoProducts') }}
                  <div class="mt-1">
                    <div
                      v-for="product in products"
                      :key="product.name"
                      class="flex items-center justify-between gap-3 py-2 text-small text-ink"
                    >
                      <span class="w-24 shrink-0 truncate sm:w-28">{{ product.name }}</span>
                      <span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          class="block h-full rounded-full transition-[width] duration-500 ease-out"
                          :class="product.low ? 'bg-warning' : 'bg-brand-700'"
                          :style="{ width: stockWidth(product.qty) }"
                        />
                      </span>
                      <b class="metric w-8 shrink-0 text-end">{{ product.qty }}</b>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Conversations -->
              <template v-else>
                <div class="rounded-xl border border-line p-3.5 text-caption text-muted">
                  {{ t('marketing.home.demoConversations') }}
                  <div class="mt-1">
                    <div
                      v-for="conversation in conversations"
                      :key="conversation.name"
                      class="flex items-center justify-between gap-2 border-b border-dashed border-line py-2 text-small text-ink last:border-0"
                    >
                      <span class="min-w-0">
                        <b class="font-semibold">{{ conversation.name }}</b>
                        · <span class="text-muted">{{ conversation.preview }}</span>
                      </span>
                      <BaseBadge :tone="conversation.tone" size="sm">{{ conversation.status }}</BaseBadge>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Floating WhatsApp message -->
        <button
          ref="waEl"
          type="button"
          class="absolute bottom-4 start-2 z-10 max-w-[250px] cursor-grab touch-none select-none rounded-2xl border bg-surface p-3.5 text-start shadow-md transition-[transform,box-shadow,border-color] duration-300 ease-out hover:shadow-lg active:cursor-grabbing md:bottom-12 md:start-0"
          :class="[
            dragging ? 'demo-dragging' : '',
            converted ? 'border-success' : 'border-line',
          ]"
          :aria-label="`${t('marketing.home.demoWaLabel')}: ${t('marketing.home.demoWaHint')}`"
          @pointerdown="onWaPointerDown"
          @pointermove="onWaPointerMove"
          @pointerup="onWaPointerUp"
          @pointercancel="onWaPointerCancel"
          @keydown.enter.prevent="convert"
          @keydown.space.prevent="convert"
        >
          <small class="mb-1 flex items-center gap-1.5 text-label text-muted">
            <span class="size-2 rounded-full" :class="converted ? 'bg-success' : 'bg-line-strong'" aria-hidden="true" />
            {{ t('marketing.home.demoWaLabel') }}
          </small>
          <span class="block text-small text-ink">{{ t('marketing.home.demoWaMessage') }}</span>
          <span v-if="!converted" class="mt-1.5 block text-label font-semibold text-brand-ink">
            {{ t('marketing.home.demoWaHint') }}
          </span>
          <span v-else class="mt-1.5 block text-label font-semibold text-success-ink">
            ✓ {{ t('marketing.home.demoWaCreated') }}
            · {{ t('marketing.home.demoWaStock') }}
          </span>
        </button>

        <!-- Toast -->
        <div
          role="status"
          class="absolute -top-3 end-2 z-10 hidden items-center gap-2 rounded-2xl border bg-surface px-3.5 py-2.5 text-small shadow-md transition-all duration-300 md:end-0 md:flex"
          :class="converted ? 'border-line opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'"
        >
          <span class="size-2 rounded-full bg-accent-400" aria-hidden="true" />
          <span class="text-ink">{{ t('marketing.home.demoWaCreated') }}</span>
          <span class="text-muted">{{ t('marketing.home.demoWaStock') }}</span>
        </div>
      </div>

      <p class="mt-3.5 text-center text-caption text-muted">{{ t('marketing.home.demoCaption') }}</p>
    </div>
  </div>
</template>

<style scoped>
.demo-line {
  fill: none;
  stroke: var(--color-brand-700);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: demo-draw 1.6s 0.2s ease forwards;
}

.demo-area {
  fill: var(--color-brand-700);
  fill-opacity: 0.1;
  opacity: 0;
  animation: demo-fade 0.8s 1.2s forwards;
}

.demo-dragging {
  cursor: grabbing;
  box-shadow: var(--elev-lg);
  transition: none;
}

.demo-new-row {
  animation: demo-slide-in 0.6s var(--ease-out-quart) both;
  background: color-mix(in srgb, var(--color-accent-400) 16%, transparent);
  border-radius: 0.5rem;
  margin-inline: -0.5rem;
  padding-inline: 0.5rem;
}

@keyframes demo-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes demo-fade {
  to {
    opacity: 1;
  }
}

@keyframes demo-slide-in {
  from {
    opacity: 0;
    transform: translateX(1.5rem);
  }
}

[data-demo-rise] {
  animation: demo-rise 0.6s var(--ease-out-quart) both;
}

@keyframes demo-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
}
</style>
