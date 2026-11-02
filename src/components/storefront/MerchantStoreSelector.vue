<script setup lang="ts">
import { computed } from 'vue'
import { Store } from '@/components/icons'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useI18n } from '@/i18n'
import type { Store as StoreRecord } from '@/types/catalogue'

/**
 * The store a configuration screen applies to.
 *
 * A tenant can run several outlets, and storefront settings are per outlet.
 * Showing the active store as a visible label — not only as a dropdown value —
 * keeps the scope of the form unambiguous.
 */

const props = withDefaults(
  defineProps<{
    stores: StoreRecord[]
    modelValue: string
    loading?: boolean
    hint?: string
  }>(),
  { loading: false, hint: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const options = computed(() =>
  props.stores.map((store) => ({
    value: String(store.id),
    label: store.is_default ? `${store.name} · ${t('shop.admin.defaultStore')}` : store.name,
  })),
)

const selected = computed(
  () => props.stores.find((store) => String(store.id) === props.modelValue) ?? null,
)
</script>

<template>
  <div class="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
    <div class="flex min-w-0 items-center gap-3 sm:w-64">
      <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
        <Store class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <p class="text-caption font-medium uppercase tracking-wide text-subtle">
          {{ t('shop.admin.store') }}
        </p>
        <p class="truncate text-sm font-semibold text-ink">
          {{ selected?.name ?? t('shop.admin.noStore') }}
        </p>
      </div>
    </div>

    <BaseSelect
      v-if="stores.length > 1"
      :model-value="modelValue"
      class="sm:w-72"
      :label="t('shop.admin.switchStore')"
      :options="options"
      :disabled="loading"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <p v-if="hint" class="text-caption text-subtle sm:ms-auto sm:max-w-xs">
      {{ hint }}
    </p>
  </div>
</template>
