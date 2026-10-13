<script setup lang="ts">
import { computed, useId } from 'vue'
import { ChevronDown } from '@/components/icons'

/** Native select — keyboard, mobile and screen-reader behaviour for free. */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    label?: string
    hint?: string
    error?: string | null
    required?: boolean
    disabled?: boolean
    name?: string
    placeholder?: string
    options?: Array<{ value: string | number; label: string; disabled?: boolean }>
  }>(),
  {
    modelValue: '',
    label: undefined,
    hint: undefined,
    error: null,
    required: false,
    disabled: false,
    name: undefined,
    placeholder: undefined,
    options: () => [],
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
      <select
        :id="id"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :name="name"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="block w-full appearance-none rounded-lg border bg-surface px-3 py-2 pe-9 text-sm text-ink outline-none transition disabled:cursor-not-allowed disabled:bg-inset disabled:text-subtle"
        :class="
          error
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
            : 'border-line focus:border-brand focus:ring-2 focus:ring-brand-ring'
        "
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
        <slot />
      </select>

      <ChevronDown
        class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>

    <p v-if="error" :id="`${id}-error`" class="text-small text-danger-ink" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="text-small text-muted">
      {{ hint }}
    </p>
  </div>
</template>