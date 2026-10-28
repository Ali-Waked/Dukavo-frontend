<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, CheckCircle2, MessageCircle, Package, ShoppingCart, Users } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'

/**
 * Before / after comparison, revealed by dragging the divider.
 *
 * The stage is deliberately `dir="ltr"`: the clip, the handle and the native
 * range that drives them are all physical, left-based geometry, and forcing
 * the stage into one direction keeps them from disagreeing under RTL. Panel
 * copy keeps its own direction, and the layout follows the page's reading
 * order — "Before" sits on the right (where Arabic reading starts) and the
 * tidied Dukavo view is revealed toward the left.
 *
 * The `<input type="range">` is the real control: invisible over the stage, so
 * dragging works with a pointer and the keyboard works out of the box.
 */

const { t } = useI18n()

const pos = ref(55)

const BEFORE_NOTES: { key: MessageKey; rotate: string }[] = [
  { key: 'marketing.home.compareNote1', rotate: '-rotate-2' },
  { key: 'marketing.home.compareNote2', rotate: 'rotate-1' },
  { key: 'marketing.home.compareNote3', rotate: 'rotate-2' },
  { key: 'marketing.home.compareNote4', rotate: '-rotate-1' },
]

const AFTER_ROWS = computed(() => [
  { icon: MessageCircle, label: t('marketing.home.demoSource'), value: t('marketing.home.demoWhatsapp') },
  { icon: Users, label: t('marketing.home.demoIdentified'), value: t('marketing.home.demoCustomerAhmed') },
  { icon: ShoppingCart, label: t('marketing.home.demoPreviousOrders'), value: '12' },
  { icon: Package, label: t('marketing.home.demoStockAlert'), value: `${t('marketing.home.demoProductJacket')} · 12` },
])
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div class="mx-auto max-w-xl text-center" data-aos="fade-up">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted"
        >
          {{ t('marketing.home.compareEyebrow') }}
        </span>
        <h2 class="mt-4 text-h1 font-semibold tracking-tight text-ink">
          {{ t('marketing.home.compareTitle') }}
        </h2>
      </div>

      <div class="relative mt-10" data-aos="fade-up" data-aos-delay="100">
        <div
          dir="ltr"
          class="compare-stage relative h-[340px] select-none overflow-hidden rounded-2xl border border-line shadow-md md:h-[400px]"
          :style="{ '--pos': pos }"
        >
          <!-- Before (right side, read first in RTL) -->
          <div class="absolute inset-0 bg-canvas">
            <div class="absolute inset-y-0 right-0 flex w-full items-center justify-end p-5 md:p-8">
              <div dir="rtl" class="grid max-w-md gap-3 sm:grid-cols-2">
                <span
                  v-for="note in BEFORE_NOTES"
                  :key="note.key"
                  class="rounded-lg border border-dashed border-line-strong bg-warning-soft px-3.5 py-3 text-small text-warning-ink shadow-xs"
                  :class="note.rotate"
                >
                  {{ t(note.key) }}
                </span>
              </div>
            </div>
            <span
              class="absolute right-3 top-3 rounded-full border border-line bg-surface px-2.5 py-1 text-caption font-semibold text-muted shadow-xs"
              dir="rtl"
            >
              {{ t('marketing.home.compareBefore') }}
            </span>
          </div>

          <!-- After (revealed from the left) -->
          <div
            class="absolute inset-0 bg-surface transition-[clip-path] duration-150 ease-out"
            :style="{ clipPath: 'inset(0 calc(100% - var(--pos) * 1%) 0 0)' }"
          >
            <div class="absolute inset-y-0 left-0 flex w-full items-center p-5 md:p-8">
              <div dir="rtl" class="w-full max-w-sm space-y-2.5 rounded-xl border border-line bg-canvas p-4 shadow-xs">
                <div
                  v-for="row in AFTER_ROWS"
                  :key="row.label"
                  class="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5 shadow-xs"
                >
                  <span class="flex items-center gap-2 text-small text-muted">
                    <component :is="row.icon" class="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                    {{ row.label }}
                  </span>
                  <b class="text-small font-semibold text-ink">{{ row.value }}</b>
                </div>
                <p class="flex items-center justify-center gap-1.5 pt-1 text-caption font-medium text-success-ink">
                  <CheckCircle2 class="size-3.5" aria-hidden="true" />
                  {{ t('marketing.home.compareAfter') }}
                </p>
              </div>
            </div>
            <span
              class="absolute left-3 top-3 rounded-full border border-brand-soft bg-brand-soft px-2.5 py-1 text-caption font-semibold text-brand-ink shadow-xs"
              dir="rtl"
            >
              {{ t('marketing.home.compareAfter') }}
            </span>
          </div>

          <!-- Real control (visual handle follows, see the focus rule below) -->
          <input
            v-model.number="pos"
            type="range"
            min="0"
            max="100"
            step="1"
            dir="ltr"
            :aria-label="t('marketing.home.compareSlider')"
            class="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
          />

          <!-- Handle -->
          <div
            class="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-700"
            :style="{ left: 'calc(var(--pos) * 1%)', transform: 'translateX(-50%)' }"
            aria-hidden="true"
          >
            <span
              class="knob absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border-2 border-brand-700 bg-surface text-brand-700 shadow-md"
            >
              <ArrowLeftRight class="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * The range is invisible, so the handle is what has to show focus: the knob
 * picks up a brand halo while the control has keyboard focus.
 */
.compare-stage > input:focus-visible ~ div .knob {
  box-shadow: 0 0 0 4px var(--color-brand-ring), var(--elev-md);
}
</style>
