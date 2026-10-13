<script setup lang="ts" generic="T extends string">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Check, ChevronDown, LoaderCircle } from '@/components/icons'
import { useI18n } from '@/i18n'
import { BADGE_DOT_CLASSES } from '@/components/ui/badgeTones'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { StatusSelectOption } from '@/constants/statusConfig'

/**
 * A colored status badge that opens a listbox to pick another status.
 *
 * The trigger is the same pill the Orders page renders (`BaseBadge` with a dot)
 * and the same `BadgeTone` tokens, so a status looks identical whether it is
 * displayed read-only or being edited. The dropdown is teleported to `<body>`
 * and positioned against the trigger so the table's `overflow-x-auto` never
 * clips it, and it flips upward when there is no room below.
 *
 * Updates are optimistic: the badge shows the new choice immediately, `change`
 * is dispatched once, and the badge only rolls back if the caller never writes
 * the new value back through `modelValue` (i.e. the request failed) — see the
 * `loading` watcher. Selecting the current status is a no-op.
 */

const props = withDefaults(
  defineProps<{
    modelValue: T
    options: StatusSelectOption<T>[]
    disabled?: boolean
    loading?: boolean
  }>(),
  { disabled: false, loading: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
  change: [value: T]
}>()

const { t, dir } = useI18n()
const route = useRoute()

const listboxId = useId()
const open = ref(false)
const positioned = ref(false)
const activeIndex = ref(0)
const triggerEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

/** Optimistic value shown in the badge; mirrors `modelValue` when not pending. */
const selected = ref<T>(props.modelValue)
watch(
  () => props.modelValue,
  (next) => {
    selected.value = next
  },
)

/** If a request finishes without the caller confirming the optimistic value. */
watch(
  () => props.loading,
  (busy) => {
    if (!busy && selected.value !== props.modelValue) {
      selected.value = props.modelValue
    }
  },
)

const currentOption = computed<StatusSelectOption<T> | null>(
  () =>
    props.options.find((option) => option.value === selected.value) ??
    props.options.find((option) => option.value === props.modelValue) ??
    null,
)

const currentLabel = computed(() =>
  currentOption.value ? t(currentOption.value.labelKey) : String(selected.value),
)

const triggerAriaLabel = computed(() => t('common.changeStatus', { status: currentLabel.value }))

const menuStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
  maxHeight: 'min(20rem, calc(100dvh - 1rem))',
  '--pop-origin': 'top center',
})

function toggle(): void {
  open.value ? close(true) : show()
}

function show(): void {
  if (props.disabled || props.loading || props.options.length === 0 || open.value) return
  open.value = true
  positioned.value = false
  const selectedIndex = props.options.findIndex((option) => option.value === selected.value)
  activeIndex.value = selectedIndex === -1 ? 0 : selectedIndex
  void nextTick().then(() => {
    positionMenu()
    positioned.value = true
    focusOption(activeIndex.value)
  })
}

function close(focusTrigger = true): void {
  if (!open.value) return
  open.value = false
  positioned.value = false
  if (focusTrigger && !props.disabled) triggerEl.value?.focus()
}

function positionMenu(): void {
  const trigger = triggerEl.value
  const menu = menuEl.value
  if (!trigger || !menu) return

  const rect = trigger.getBoundingClientRect()
  const menuHeight = menu.offsetHeight
  const menuWidth = menu.offsetWidth
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  const placeBelow = spaceBelow >= menuHeight || spaceBelow >= spaceAbove
  let top = placeBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4)
  top = Math.min(top, viewportHeight - menuHeight - 8)

  let left: number
  if (dir.value === 'rtl') {
    left = rect.right - menuWidth
  } else {
    left = rect.left
  }
  left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8))

  const origin = placeBelow ? 'top center' : 'bottom center'
  menuStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: 'min(20rem, calc(100dvh - 1rem))',
    '--pop-origin': origin,
  }
}

function focusOption(index: number): void {
  menuEl.value
    ?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)
    ?.focus({ preventScroll: false })
}

function move(delta: number): void {
  const length = props.options.length
  if (length === 0) return
  const next = Math.min(length - 1, Math.max(0, activeIndex.value + delta))
  activeIndex.value = next
  focusOption(next)
}

function moveTo(index: number): void {
  const length = props.options.length
  const clamped = Math.min(length - 1, Math.max(0, index))
  activeIndex.value = clamped
  focusOption(clamped)
}

function setActive(index: number): void {
  activeIndex.value = index
  focusOption(index)
}

function select(index: number): void {
  if (props.disabled || props.loading) return
  const option = props.options[index]
  if (!option) return

  selected.value = option.value
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
  close(true)
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      show()
      if (event.key === 'ArrowDown' && props.options.length > 1) moveTo(1)
    } else if (event.key === 'ArrowDown') {
      move(1)
    } else {
      move(-1)
    }
  }
}

function onMenuKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home':
      event.preventDefault()
      moveTo(0)
      break
    case 'End':
      event.preventDefault()
      moveTo(props.options.length - 1)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      select(activeIndex.value)
      break
    case 'Escape':
      event.preventDefault()
      close(true)
      break
    case 'Tab':
      close(false)
      break
  }
}

function onGlobalPointerDown(event: PointerEvent): void {
  if (!open.value) return
  const target = event.target as Node
  if (menuEl.value?.contains(target)) return
  if (rootEl.value?.contains(target)) return
  close(false)
}

function onGlobalScroll(event: Event): void {
  if (!open.value) return
  const target = event.target as Node
  if (menuEl.value?.contains(target)) return
  close(false)
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

watch(
  () => route.fullPath,
  () => close(false),
)

onMounted(() => {
  document.addEventListener('pointerdown', onGlobalPointerDown, true)
  document.addEventListener('scroll', onGlobalScroll, true)
  document.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('resize', () => close(false))
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onGlobalPointerDown, true)
  document.removeEventListener('scroll', onGlobalScroll, true)
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', () => close(false))
})
</script>

<template>
  <div ref="rootEl" class="inline-flex">
    <BaseBadge v-if="disabled" :tone="currentOption?.tone ?? 'neutral'" dot size="md">
      {{ currentLabel }}
    </BaseBadge>

    <button
      v-else
      ref="triggerEl"
      type="button"
      class="group inline-flex min-h-8 max-sm:min-h-11 items-center gap-1 rounded-lg px-1 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-75"
      :disabled="loading"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-label="triggerAriaLabel"
      :aria-busy="loading || undefined"
      @click="toggle"
      @keydown="onTriggerKeydown"
      @keydown.esc.prevent="close(true)"
    >
      <BaseBadge :tone="currentOption?.tone ?? 'neutral'" dot size="md">
        {{ currentLabel }}
      </BaseBadge>

      <LoaderCircle v-if="loading" class="size-4 shrink-0 animate-spin text-muted" aria-hidden="true" />
      <ChevronDown
        v-else
        class="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:text-ink"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </button>

    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open && !disabled"
          :id="listboxId"
          ref="menuEl"
          role="listbox"
          tabindex="-1"
          :aria-label="t('common.status')"
          class="fixed z-[60] flex w-max max-w-[calc(100vw-1rem)] min-w-44 flex-col overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface py-1 shadow-xl"
          :class="positioned ? 'visible' : 'invisible'"
          :style="menuStyle"
          @keydown="onMenuKeydown"
        >
          <div
            v-for="(option, index) in options"
            :key="option.value"
            :data-option-index="index"
            role="option"
            :aria-selected="option.value === selected"
            tabindex="-1"
            class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-surface-2"
            :class="[
              index === activeIndex ? 'bg-surface-2 outline-2 -outline-offset-2 outline-focus' : 'outline-none',
              option.value === selected ? 'font-medium text-ink' : 'text-muted',
            ]"
            @click="select(index)"
            @pointermove="setActive(index)"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="BADGE_DOT_CLASSES[option.tone]"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ t(option.labelKey) }}</span>
            <Check
              v-if="option.value === selected"
              class="size-4 shrink-0 text-brand-700"
              aria-hidden="true"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>