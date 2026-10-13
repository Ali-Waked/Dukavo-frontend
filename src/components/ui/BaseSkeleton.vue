<script setup lang="ts">
withDefaults(
  defineProps<{
    /** How many bars to render. */
    rows?: number
    /** CSS height class for each bar. */
    height?: string
    /** Render as a single block rather than a stack of lines. */
    block?: boolean
  }>(),
  { rows: 3, height: 'h-4', block: false },
)
</script>

<template>
  <div class="space-y-3" :aria-hidden="true">
    <div
      v-if="block"
      class="shimmer w-full rounded-md"
      :class="height"
    />
    <template v-else>
      <div
        v-for="index in rows"
        :key="index"
        class="shimmer rounded-md"
        :class="[height, index === rows && rows > 1 ? 'w-2/3' : 'w-full']"
      />
    </template>
  </div>
</template>