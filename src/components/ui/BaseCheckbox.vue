<script setup lang="ts">
import { useId } from 'vue'
import { Check, Minus } from '@/components/icons'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    label?: string
    hint?: string
    error?: string | null
    disabled?: boolean
    required?: boolean
    /** Mixed state for select-all rows. */
    indeterminate?: boolean
    name?: string
  }>(),
  {
    modelValue: false,
    label: undefined,
    hint: undefined,
    error: null,
    disabled: false,
    required: false,
    indeterminate: false,
    name: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <div>
    <label
      :for="id"
      class="group flex cursor-pointer items-start gap-2.5 select-none"
      :class="disabled ? 'cursor-not-allowed opacity-60' : ''"
    >
      <input
        :id="id"
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        :required="required"
        :name="name"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span
        class="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
        :class="
          modelValue || indeterminate
            ? 'border-brand-700 bg-brand-700 text-white'
            : error
              ? 'border-danger bg-surface'
              : 'border-line bg-surface group-hover:border-brand-700'
        "
      >
        <Minus v-if="indeterminate" class="size-3" />
        <Check v-else-if="modelValue" class="size-3" :stroke-width="3" />
      </span>

      <span v-if="label || hint" class="min-w-0 text-sm">
        <span class="block font-medium text-ink">
          {{ label }}
          <span v-if="required" class="text-danger" aria-hidden="true">*</span>
        </span>
        <span v-if="hint" :id="`${id}-hint`" class="mt-0.5 block text-small text-muted">
          {{ hint }}
        </span>
      </span>
    </label>

    <p v-if="error" :id="`${id}-error`" class="mt-1 ps-7 text-small text-danger-ink" role="alert">
      {{ error }}
    </p>
  </div>
</template>