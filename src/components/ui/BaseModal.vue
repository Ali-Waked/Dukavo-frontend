<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@/components/icons'
import { useI18n } from '@/i18n'

/**
 * Modal dialog.
 *
 * Focus moves into the panel on open and is restored to whatever opened it on
 * close, Tab is trapped inside, Escape always closes, and the page behind
 * cannot scroll — a dialog that leaks focus or traps the body underneath is a
 * keyboard user's dead end, not a polish issue.
 */

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    /** Disable closing via backdrop click or Escape (blocking confirmations). */
    persistent?: boolean
  }>(),
  {
    title: undefined,
    description: undefined,
    size: 'md',
    persistent: false,
  },
)

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const panel = ref<HTMLElement | null>(null)
let restoreFocusTo: HTMLElement | null = null

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

function focusables(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null || element === document.activeElement)
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return

  if (event.key === 'Escape' && !props.persistent) {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const items = focusables()
  if (items.length === 0) return

  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      restoreFocusTo = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => focusables()[0]?.focus())
    } else {
      document.body.style.overflow = ''
      restoreFocusTo?.focus()
      restoreFocusTo = null
    }
  },
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div
          class="fixed inset-0 bg-scrim backdrop-blur-[2px]"
          aria-hidden="true"
          @click="!persistent && emit('close')"
        />

        <Transition appear name="modal-panel" mode="out-in">
          <div
            ref="panel"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            :aria-describedby="description ? 'modal-description' : undefined"
            class="relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
            :class="sizeClasses[size]"
          >
            <header class="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4">
              <div class="min-w-0 flex-1">
                <h2 v-if="title" class="text-h4 font-semibold text-ink">{{ title }}</h2>
                <p v-if="description" id="modal-description" class="mt-1 text-small text-muted">
                  {{ description }}
                </p>
              </div>
              <button
                v-if="!persistent"
                type="button"
                class="btn-icon -me-1.5 -mt-1"
                :aria-label="t('common.close')"
                @click="emit('close')"
              >
                <X class="size-5" />
              </button>
            </header>

            <div class="flex-1 overflow-y-auto px-5 py-4">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>