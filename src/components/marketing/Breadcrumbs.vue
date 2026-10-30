<script setup lang="ts">
import { ChevronRight } from '@/components/icons'
import { useI18n } from '@/i18n'

export interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{ items: BreadcrumbItem[] }>()

const { t } = useI18n()
</script>

<template>
  <nav :aria-label="t('marketing.breadcrumbLabel')">
    <ol class="flex flex-wrap items-center gap-1.5 text-small text-muted">
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`" class="flex items-center gap-1.5">
        <RouterLink
          v-if="item.to"
          :to="item.to"
          class="transition hover:text-ink hover:underline"
        >
          {{ item.label }}
        </RouterLink>
        <span v-else class="max-w-[18rem] truncate text-ink" aria-current="page">{{ item.label }}</span>
        <ChevronRight
          v-if="index < items.length - 1"
          class="size-3.5 shrink-0 text-subtle rtl:-scale-x-100"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>
