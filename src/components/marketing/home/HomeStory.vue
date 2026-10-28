<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MessageCircle, Package, ShoppingCart, UserCog, Users } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'
import { useLocale } from '@/composables/useLocale'
import { useAutoplay } from '@/composables/useAutoplay'
import HomeStoryStage from './HomeStoryStage.vue'
import HomeStoryControls from './HomeStoryControls.vue'

/**
 * The "from conversation to order" story — five steps of the daily flow.
 *
 * It plays itself like a small product demo while the section is in view:
 * the active tab fills with progress, the stage performs a choreographed
 * scene per step, and the usual carousel manners apply. Hover, focus or a
 * held pointer pause it mid-step; the Play/Pause button makes the choice
 * sticky; arrow keys drive the tabs; reduced-motion visitors always navigate
 * by hand. The counter only speaks when the visitor is in control.
 */

interface Step {
  id: string
  titleKey: MessageKey
  bodyKey: MessageKey
  icon: typeof MessageCircle
}

const STEPS: Step[] = [
  { id: 'conversation', titleKey: 'marketing.home.stepConversation', bodyKey: 'marketing.home.stepConversationBody', icon: MessageCircle },
  { id: 'customer', titleKey: 'marketing.home.stepCustomer', bodyKey: 'marketing.home.stepCustomerBody', icon: Users },
  { id: 'order', titleKey: 'marketing.home.stepOrder', bodyKey: 'marketing.home.stepOrderBody', icon: ShoppingCart },
  { id: 'inventory', titleKey: 'marketing.home.stepInventory', bodyKey: 'marketing.home.stepInventoryBody', icon: Package },
  { id: 'team', titleKey: 'marketing.home.stepTeam', bodyKey: 'marketing.home.stepTeamBody', icon: UserCog },
]

const { t } = useI18n()
const { dir } = useLocale()

const sectionEl = ref<HTMLElement | null>(null)
const railEl = ref<HTMLElement | null>(null)

const {
  current,
  direction,
  progressKey,
  running,
  reduced,
  userPaused,
  durationMs,
  goTo,
  next,
  previous,
  toggleUserPause,
} = useAutoplay(STEPS.length, { durationMs: 4000, container: sectionEl })

const step = computed<Step>(() => STEPS[current.value] as Step)
const counter = computed(() =>
  t('marketing.home.stepOf', { current: current.value + 1, total: STEPS.length }),
)
const live = computed(() => (running.value ? 'off' : 'polite'))

function selectTab(index: number): void {
  goTo(index, index >= current.value ? 1 : -1)
}

// Keep the active tab centered once the rail scrolls horizontally (mobile).
watch(current, async () => {
  await nextTick()
  railEl.value
    ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    ?.scrollIntoView({ inline: 'center', block: 'nearest' })
})

function onRailKeydown(event: KeyboardEvent): void {
  const forward = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const backward = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  let target = -1
  if (event.key === forward) target = Math.min(current.value + 1, STEPS.length - 1)
  else if (event.key === backward) target = Math.max(current.value - 1, 0)
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = STEPS.length - 1
  else return
  event.preventDefault()
  selectTab(target)
  nextTick(() => railEl.value?.querySelector<HTMLElement>(`[data-index="${target}"]`)?.focus())
}
</script>

<template>
  <section id="story" ref="sectionEl" class="py-16 md:py-24">
    <div class="mx-auto max-w-5xl px-4 md:px-6">
      <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
        >
          {{ t('marketing.home.storyEyebrow') }}
        </span>
        <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
          {{ t('marketing.home.storyTitle') }}
        </h2>
      </div>

      <div class="surface mt-10 overflow-hidden" data-aos="fade-up" data-aos-delay="100">
        <!-- Step rail -->
        <div
          ref="railEl"
          role="tablist"
          :aria-label="t('marketing.home.storyEyebrow')"
          class="flex gap-1 overflow-x-auto border-b border-line bg-canvas p-2 md:justify-center"
          @keydown="onRailKeydown"
        >
          <button
            v-for="(item, index) in STEPS"
            :id="`story-tab-${index}`"
            :key="item.id"
            type="button"
            role="tab"
            :data-index="index"
            aria-controls="story-panel"
            :aria-selected="current === index"
            :tabindex="current === index ? 0 : -1"
            class="relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-small font-medium text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :class="current === index ? 'bg-surface font-semibold text-brand-ink shadow-xs ring-1 ring-line' : ''"
            @click="selectTab(index)"
          >
            <span
              class="metric grid size-5 place-items-center rounded-full text-label"
              :class="current === index ? 'bg-brand-700 text-white' : 'bg-surface-2 text-subtle ring-1 ring-line'"
            >
              {{ index + 1 }}
            </span>
            {{ t(item.titleKey) }}
            <span
              v-if="current === index && !reduced"
              :key="progressKey"
              class="story-progress absolute inset-x-0 bottom-0 block h-0.5 w-full bg-brand-700"
              :style="{
                animationDuration: `${durationMs}ms`,
                animationPlayState: running ? 'running' : 'paused',
              }"
              aria-hidden="true"
            />
          </button>
        </div>

        <!-- Step panel -->
        <div
          id="story-panel"
          role="tabpanel"
          :aria-labelledby="`story-tab-${current}`"
          class="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:items-center md:p-10"
        >
          <!-- Stage first in the DOM so the visual sits above the text on mobile -->
          <HomeStoryStage class="md:order-2" :step-id="step.id" :direction="direction" />

          <div class="md:order-1">
            <span
              class="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-ink ring-1 ring-brand-ring"
            >
              <component :is="step.icon" class="size-6" aria-hidden="true" />
            </span>
            <p class="mt-4 text-caption uppercase tracking-wide text-subtle" :aria-live="live">
              {{ counter }}
            </p>
            <h3 class="mt-1 text-h3 font-semibold text-ink">{{ t(step.titleKey) }}</h3>
            <p class="mt-2 text-body text-muted">{{ t(step.bodyKey) }}</p>

            <!-- Prev / next, plus the visible autoplay control -->
            <HomeStoryControls
              class="mt-6"
              :current="current"
              :total="STEPS.length"
              :user-paused="userPaused"
              :reduced="reduced"
              @previous="previous"
              @next="next"
              @toggle="toggleUserPause"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.story-progress {
  transform-origin: left center;
  animation-name: story-progress;
  animation-timing-function: linear;
  animation-fill-mode: both;
}

[dir='rtl'] .story-progress {
  transform-origin: right center;
}

@keyframes story-progress {
  from {
    transform: scaleX(0);
  }
}
</style>
