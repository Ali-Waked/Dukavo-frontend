<script setup lang="ts">
import { useToastStore, type Toast as ToastItem } from '@/stores/toastStore'
import { useI18n } from '@/i18n'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X,
  type LucideIcon,
} from '@/components/icons'

/**
 * Renders the toast queue. One instance lives at the app root; it is always
 * mounted so a toast can surface regardless of which screen produced it.
 */

const toastStore = useToastStore()
const { t } = useI18n()

const TONE_META: Record<
  ToastItem['tone'],
  { icon: LucideIcon; iconClass: string; barClass: string }
> = {
  success: { icon: CheckCircle2, iconClass: 'text-success-ink', barClass: 'bg-success' },
  error: { icon: AlertCircle, iconClass: 'text-danger-ink', barClass: 'bg-danger' },
  warning: { icon: AlertTriangle, iconClass: 'text-warning-ink', barClass: 'bg-warning' },
  info: { icon: Circle, iconClass: 'text-info-ink', barClass: 'bg-info' },
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="pointer-events-none fixed bottom-4 end-4 z-[70] flex w-full max-w-sm flex-col items-end gap-2">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto relative w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
      >
        <span :class="TONE_META[toast.tone].barClass" class="absolute inset-y-0 start-0 w-1" aria-hidden="true" />
        <div class="flex items-start gap-3 px-4 py-3 ps-5">
          <component :is="TONE_META[toast.tone].icon" :class="TONE_META[toast.tone].iconClass" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p v-if="toast.title" class="text-sm font-semibold text-ink">{{ toast.title }}</p>
            <p class="text-sm text-muted" :class="toast.title ? 'mt-0.5' : ''">{{ toast.message }}</p>
          </div>
          <button
            type="button"
            class="btn-icon -me-1 -mt-1 size-7 shrink-0"
            :aria-label="t('toast.dismiss')"
            @click="toastStore.dismiss(toast.id)"
          >
            <X class="size-4" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>