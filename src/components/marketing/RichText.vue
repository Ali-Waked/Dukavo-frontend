<script setup lang="ts">
import { computed } from 'vue'
import { Info } from '@/components/icons'
import { parseContentBlocks } from '@/utils/content'

/**
 * Renders a content page's plain-text body. The parser is shared with the
 * public pages so a section reads the same everywhere; nothing here ever
 * injects HTML — placing text in an interpolation is the whole defence.
 */
const props = defineProps<{ body: string }>()

const blocks = computed(() => parseContentBlocks(props.body))
</script>

<template>
  <div class="space-y-4">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'paragraph'" class="text-body leading-relaxed text-muted">
        {{ block.text }}
      </p>

      <div
        v-else-if="block.kind === 'note'"
        class="flex items-start gap-3 rounded-xl border border-brand-soft-border bg-brand-soft p-4 text-body text-brand-ink"
      >
        <Info class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p class="leading-relaxed">{{ block.text }}</p>
      </div>

      <ol
        v-else-if="block.kind === 'list' && block.ordered"
        class="ms-1 list-decimal space-y-2 ps-5 text-body leading-relaxed text-muted marker:font-medium marker:text-subtle"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex" class="ps-1">{{ item }}</li>
      </ol>

      <ul
        v-else-if="block.kind === 'list'"
        class="ms-1 list-disc space-y-2 ps-5 text-body leading-relaxed text-muted marker:text-brand-400"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex" class="ps-1">{{ item }}</li>
      </ul>
    </template>
  </div>
</template>
