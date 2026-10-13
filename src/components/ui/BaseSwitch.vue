<script setup lang="ts">
import { useId } from 'vue'

/** Toggle switch for settings that apply immediately (no Save button). */
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    label?: string
    hint?: string
    disabled?: boolean
    'aria-label'?: string
  }>(),
  {
    modelValue: false,
    label: undefined,
    hint: undefined,
    disabled: false,
    'aria-label': undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div v-if="label || hint" class="min-w-0">
      <label :for="id" class="block cursor-pointer text-sm font-medium text-ink">
        {{ label }}
      </label>
      <p v-if="hint" class="mt-0.5 text-small text-muted">{{ hint }}</p>
    </div>

    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="props['aria-label'] ?? label"
      :disabled="disabled"
      class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55"
      :class="modelValue ? 'bg-brand-700' : 'bg-line'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="modelValue ? 'translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-0.5'"
        aria-hidden="true"
      />
    </button>
  </div>
</template>