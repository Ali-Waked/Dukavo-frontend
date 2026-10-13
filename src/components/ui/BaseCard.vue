<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Removes the inner padding — for cards whose content manages its own. */
    flush?: boolean
    /** Adds hover affordance for card-as-link. */
    interactive?: boolean
  }>(),
  { flush: false, interactive: false },
)
</script>

<template>
  <div class="surface" :class="interactive ? 'surface-hover cursor-pointer' : ''">
    <div v-if="$slots.header" class="border-b border-line px-5 py-4">
      <slot name="header" />
    </div>
    <div :class="flush ? '' : 'p-5'">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-line bg-surface-2 px-5 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>