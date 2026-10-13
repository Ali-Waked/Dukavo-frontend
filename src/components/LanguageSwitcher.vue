<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocale } from '@/composables/useLocale'
import { useI18n } from '@/i18n'
import type { LanguageConfig } from '@/i18n/languages'
import { Check, ChevronDown, Globe } from '@/components/icons'

/**
 * Header language switcher — a globe trigger that opens a listbox of every
 * supported language, each shown in its own script. One control, used verbatim
 * in the marketing, auth and dashboard headers.
 *
 * The locale itself never lives here: it is read from — and written through —
 * the i18n module, which is the single source of truth for `<html lang>`,
 * `<html dir>` and the persisted copy. See `useLocale`.
 *
 * Accessibility: ARIA listbox pattern with roving focus. Enter/Space open and
 * select (native buttons), Arrow Up/Down and Home/End move between options,
 * Escape closes and returns focus to the trigger, an outside click or a route
 * change closes. The menu anchors to the logical end edge, so it cannot spill
 * off the viewport in either script.
 */

const { locale, dir, languages, setLocale } = useLocale()
const { t } = useI18n()
const route = useRoute()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const optionEls = ref<HTMLButtonElement[]>([])

/** Grow the popover from the edge it is anchored to, in the active script. */
const popOrigin = computed(() => (dir.value === 'rtl' ? 'top left' : 'top right'))

function select(language: LanguageConfig): void {
  setLocale(language.code)
  close()
}

function toggle(): void {
  open.value ? close() : openMenu()
}

function openMenu(): void {
  open.value = true
  nextTick(() => {
    const selectedIndex = optionEls.value.findIndex((el) => el.getAttribute('aria-selected') === 'true')
    optionEls.value[selectedIndex >= 0 ? selectedIndex : 0]?.focus()
  })
}

function close(focusTrigger = true): void {
  if (!open.value) return
  open.value = false
  if (focusTrigger) triggerEl.value?.focus()
}

function onDocumentClick(event: MouseEvent): void {
  if (open.value && rootEl.value && !rootEl.value.contains(event.target as Node)) {
    close(false)
  }
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (!open.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    openMenu()
  }
}

function onListboxKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()

  const count = optionEls.value.length
  if (count === 0) return

  const current = optionEls.value.findIndex((el) => el === document.activeElement)
  let next = current

  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = count - 1
  else if (event.key === 'ArrowDown') next = (current + 1) % count
  else next = (current - 1 + count) % count

  optionEls.value[next]?.focus()
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))

// Any navigation with the menu open closes it; focus stays where the route
// took the user rather than yanking it back to the trigger mid-transition.
watch(() => route.fullPath, () => close(false))
</script>

<template>
  <div ref="rootEl" class="relative inline-block">
    <button
      ref="triggerEl"
      type="button"
      :aria-label="t('language.toggle')"
      aria-haspopup="listbox"
      :aria-expanded="open"
      class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-line px-2.5 text-sm font-semibold text-muted transition hover:border-line-strong hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-9"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <Globe class="size-4" aria-hidden="true" />
      <span class="uppercase">{{ locale }}</span>
      <ChevronDown class="size-3.5" aria-hidden="true" />
    </button>

    <Transition name="pop">
      <div
        v-if="open"
        role="listbox"
        :aria-label="t('language.toggle')"
        class="absolute end-0 top-full z-dropdown mt-1 min-w-44 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-xl"
        :style="{ transformOrigin: popOrigin }"
        @keydown="onListboxKeydown"
      >
        <button
          v-for="language in languages"
          :key="language.code"
          ref="optionEls"
          type="button"
          role="option"
          :aria-selected="language.code === locale"
          :tabindex="language.code === locale ? 0 : -1"
          class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start transition hover:bg-surface-2"
          :class="language.code === locale ? 'bg-brand-soft' : ''"
          @click="select(language)"
        >
          <span
            class="inline-flex min-w-8 items-center justify-center rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted"
            aria-hidden="true"
          >
            {{ language.code.toUpperCase() }}
          </span>
          <span class="flex-1 text-sm font-medium text-ink">{{ language.label }}</span>
          <Check
            v-if="language.code === locale"
            class="size-4 shrink-0 text-brand-ink"
            aria-hidden="true"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>