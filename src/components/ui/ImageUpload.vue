<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Image as ImageIcon, Trash2, Upload } from '@/components/icons'
import { useI18n } from '@/i18n'

/**
 * A single cover image picker with a live preview.
 *
 * The selected file is held in memory and only uploaded when the form is saved;
 * the object URL shown in the preview is revoked as soon as it is replaced so a
 * long editing session does not leak blobs. `remove` is tracked separately from
 * the file so the editor can ask for an existing cover to be cleared without
 * pretending a replacement was chosen.
 */

const MAX_BYTES = 4 * 1024 * 1024

const props = withDefaults(
  defineProps<{
    file?: File | null
    remove?: boolean
    currentUrl?: string | null
    label?: string
    hint?: string
    error?: string | null
    disabled?: boolean
  }>(),
  {
    file: null,
    remove: false,
    currentUrl: null,
    label: undefined,
    hint: undefined,
    error: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:file': [value: File | null]
  'update:remove': [value: boolean]
}>()

const { t } = useI18n()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const localError = ref<string | null>(null)
const objectUrl = ref<string | null>(null)

function revoke(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

watch(
  () => props.file,
  (file) => {
    revoke()
    if (file) {
      objectUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true },
)

onBeforeUnmount(revoke)

const previewUrl = computed<string | null>(() => {
  if (objectUrl.value) {
    return objectUrl.value
  }
  return props.remove ? null : props.currentUrl
})

const shownError = computed(() => props.error ?? localError.value)

function accept(file: File | null | undefined): void {
  if (!file) {
    return
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    localError.value = t('platform.newsletters.coverTypeError')
    return
  }

  if (file.size > MAX_BYTES) {
    localError.value = t('platform.newsletters.coverSizeError')
    return
  }

  localError.value = null
  emit('update:file', file)
  emit('update:remove', false)
}

function onPick(event: Event): void {
  const target = event.target as HTMLInputElement
  accept(target.files?.[0])
  target.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  if (props.disabled) {
    return
  }
  accept(event.dataTransfer?.files?.[0])
}

function clear(): void {
  localError.value = null
  emit('update:file', null)
  emit('update:remove', true)
}

function undoRemove(): void {
  emit('update:remove', false)
}
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" class="block text-sm font-medium text-ink">{{ label }}</label>

    <div
      class="rounded-lg border-2 border-dashed p-3 transition"
      :class="[
        dragging ? 'border-brand bg-brand-soft' : 'border-line',
        shownError ? 'border-danger' : '',
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-brand',
      ]"
      @click="!disabled && input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="input"
        type="file"
        class="sr-only"
        accept="image/png,image/jpeg,image/webp"
        :disabled="disabled"
        @change="onPick"
      />

      <div v-if="previewUrl" class="relative">
        <img
          :src="previewUrl"
          alt=""
          class="mx-auto max-h-48 w-auto rounded-md object-contain"
        />
      </div>

      <div v-else class="flex flex-col items-center gap-2 py-6 text-center text-muted">
        <ImageIcon class="size-7" aria-hidden="true" />
        <span class="text-sm">{{ t('platform.newsletters.coverDrop') }}</span>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span
        v-if="file"
        class="truncate text-small text-muted"
        :title="file.name"
      >{{ file.name }}</span>
      <span v-else-if="remove && currentUrl" class="text-small text-muted">
        {{ t('platform.newsletters.coverWillRemove') }}
      </span>
      <span v-else />

      <div class="flex shrink-0 items-center gap-1">
        <button
          v-if="remove && currentUrl"
          type="button"
          class="text-sm font-medium text-brand-ink hover:underline disabled:opacity-60"
          :disabled="disabled"
          @click.stop="undoRemove"
        >
          {{ t('action.restore') }}
        </button>

        <button
          v-if="previewUrl"
          type="button"
          class="btn-icon text-danger-ink"
          :disabled="disabled"
          :aria-label="t('platform.newsletters.removeCover')"
          :title="t('platform.newsletters.removeCover')"
          @click.stop="clear"
        >
          <Trash2 class="size-4" />
        </button>

        <button
          v-if="!previewUrl"
          type="button"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline disabled:opacity-60"
          :disabled="disabled"
          @click.stop="input?.click()"
        >
          <Upload class="size-4" />
          {{ t('platform.newsletters.chooseCover') }}
        </button>
      </div>
    </div>

    <p v-if="shownError" class="text-small text-danger-ink" role="alert">{{ shownError }}</p>
    <p v-else-if="hint" class="text-small text-muted">{{ hint }}</p>
  </div>
</template>
