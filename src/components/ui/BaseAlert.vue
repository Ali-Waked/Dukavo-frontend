<script setup lang="ts">
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from '@/components/icons'
import { useI18n } from '@/i18n'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const props = withDefaults(
  defineProps<{
    tone?: AlertTone
    title?: string
    dismissible?: boolean
  }>(),
  { tone: 'info', title: undefined, dismissible: false },
)

const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const TONE = {
  info: { classes: 'bg-info-soft border-info-border text-info-ink', icon: Info },
  success: { classes: 'bg-success-soft border-success-border text-success-ink', icon: CheckCircle2 },
  warning: { classes: 'bg-warning-soft border-warning-border text-warning-ink', icon: AlertTriangle },
  danger: { classes: 'bg-danger-soft border-danger-border text-danger-ink', icon: AlertCircle },
} as const
</script>

<template>
  <div class="flex items-start gap-3 rounded-lg border px-4 py-3" :class="TONE[props.tone].classes" role="status">
    <component :is="TONE[props.tone].icon" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-semibold">{{ title }}</p>
      <div class="text-sm" :class="title ? 'mt-0.5 opacity-90' : ''">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="btn-icon -me-1 -mt-1 size-7 shrink-0"
      :aria-label="t('common.close')"
      @click="emit('dismiss')"
    >
      <X class="size-4" />
    </button>
  </div>
</template>