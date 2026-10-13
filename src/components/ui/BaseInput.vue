<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * Single-line text field with label, hint and error state.
 *
 * The error text is wired to the input through `aria-describedby` rather than
 * merely displayed next to it, so screen readers hear the reason a field is
 * rejected at the moment focus lands on it. Server-side 422 messages map
 * straight onto `error` by field name.
 */

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'search'
    placeholder?: string
    hint?: string
    error?: string | null
    required?: boolean
    disabled?: boolean
    autocomplete?: string
    name?: string
    min?: string | number
    max?: string | number
    step?: string | number
  }>(),
  {
    modelValue: '',
    label: undefined,
    type: 'text',
    placeholder: undefined,
    hint: undefined,
    error: null,
    required: false,
    disabled: false,
    autocomplete: undefined,
    name: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const describedBy = computed(() => {
  if (props.error) return `${id}-error`
  if (props.hint) return `${id}-hint`
  return undefined
})
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="id" class="block text-sm font-medium text-ink">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.prefix"
        class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :name="name"
        :min="min"
        :max="max"
        :step="step"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="block w-full rounded-lg border bg-surface py-2 text-sm text-ink outline-none transition placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-inset disabled:text-subtle"
        :class="[
          error
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
            : 'border-line focus:border-brand focus:ring-2 focus:ring-brand-ring',
          $slots.prefix ? 'ps-9' : 'px-3',
          $slots.suffix ? 'pe-9' : '',
        ]"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />

      <div
        v-if="$slots.suffix"
        class="absolute inset-y-0 end-0 flex items-center pe-2.5"
      >
        <slot name="suffix" />
      </div>
    </div>

    <p v-if="error" :id="`${id}-error`" class="text-small text-danger-ink" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="text-small text-muted">
      {{ hint }}
    </p>
  </div>
</template>