<script setup lang="ts">
import { Minus, Plus } from '@/components/icons'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    disabled?: boolean
    label?: string
  }>(),
  {
    min: 1,
    max: 999,
    disabled: false,
    label: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const { t } = useI18n()

function change(next: number): void {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, next)))
}
</script>

<template>
  <div
    class="inline-flex items-center rounded-lg border border-line bg-surface"
    role="group"
    :aria-label="label || t('shop.product.quantity')"
  >
    <button
      type="button"
      class="grid size-9 place-items-center rounded-s-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      :disabled="disabled || modelValue <= min"
      :aria-label="t('shop.product.decrease')"
      @click="change(modelValue - 1)"
    >
      <Minus class="size-4" aria-hidden="true" />
    </button>

    <span class="min-w-9 px-1 text-center text-sm font-medium tabular-nums text-ink">
      {{ modelValue }}
    </span>

    <button
      type="button"
      class="grid size-9 place-items-center rounded-e-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      :disabled="disabled || modelValue >= max"
      :aria-label="t('shop.product.increase')"
      @click="change(modelValue + 1)"
    >
      <Plus class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
