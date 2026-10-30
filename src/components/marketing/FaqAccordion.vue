<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ChevronDown } from '@/components/icons'
import { useI18n } from '@/i18n'
import type { FaqEntry } from '@/types/marketing'

/**
 * One accessible accordion for every FAQ surface. The trigger owns
 * `aria-expanded` and the panel is referenced by id, so the answer is announced
 * correctly whether it is opened by pointer or keyboard.
 */
const props = withDefaults(
  defineProps<{
    items: FaqEntry[]
    idPrefix?: string
  }>(),
  { idPrefix: 'faq' },
)

const { t } = useI18n()
const openId = ref<number | null>(null)

function toggle(id: number): void {
  openId.value = openId.value === id ? null : id
}

// A filter or new fetch can remove the open row; never leave a dangling panel.
watch(
  () => props.items,
  (items) => {
    if (openId.value !== null && !items.some((item) => item.id === openId.value)) {
      openId.value = null
    }
  },
)

onBeforeUnmount(() => {
  openId.value = null
})
</script>

<template>
  <div class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
    <div v-for="entry in items" :key="entry.id">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 px-4 py-4 text-start transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus md:px-5"
        :aria-expanded="openId === entry.id"
        :aria-controls="`${idPrefix}-panel-${entry.id}`"
        @click="toggle(entry.id)"
      >
        <span class="text-body font-medium text-ink">{{ entry.question }}</span>
        <ChevronDown
          class="size-5 shrink-0 text-muted transition-transform duration-200"
          :class="openId === entry.id ? 'rotate-180' : ''"
          aria-hidden="true"
        />
        <span class="sr-only">
          {{ openId === entry.id ? t('marketing.faq.collapse') : t('marketing.faq.expand') }}
        </span>
      </button>

      <div
        v-show="openId === entry.id"
        :id="`${idPrefix}-panel-${entry.id}`"
        class="border-t border-line px-4 py-4 text-body leading-relaxed text-muted md:px-5"
      >
        {{ entry.answer }}
      </div>
    </div>
  </div>
</template>
