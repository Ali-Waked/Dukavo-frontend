<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    hint?: string
    error?: string | null
    required?: boolean
    disabled?: boolean
    rows?: number
    placeholder?: string
    maxlength?: number
    name?: string
  }>(),
  {
    modelValue: '',
    label: undefined,
    hint: undefined,
    error: null,
    required: false,
    disabled: false,
    rows: 4,
    placeholder: undefined,
    maxlength: undefined,
    name: undefined,
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

    <textarea
      :id="id"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :maxlength="maxlength"
      :name="name"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="block w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-inset disabled:text-subtle"
      :class="
        error
          ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
          : 'border-line focus:border-brand focus:ring-2 focus:ring-brand-ring'
      "
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <p v-if="error" :id="`${id}-error`" class="text-small text-danger-ink" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="text-small text-muted">
      {{ hint }}
    </p>
  </div>
</template>