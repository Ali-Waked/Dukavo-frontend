<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertCircle, Download, FileText } from '@/components/icons'
import { useI18n } from '@/i18n'
import { fetchMessageMedia } from '@/services/conversationService'
import type { ConversationMessage } from '@/types/inbox'

const props = defineProps<{ message: ConversationMessage }>()
const { t } = useI18n()

const loading = ref(false)
const failed = ref(false)
const objectUrl = ref<string | null>(null)

const mime = computed(() => props.message.media?.mime_type ?? '')
const isImage = computed(() => mime.value.startsWith('image/'))
const isAudio = computed(() => mime.value.startsWith('audio/'))
const isVideo = computed(() => mime.value.startsWith('video/'))
const filename = computed(() => props.message.media?.filename ?? t('conversations.attachment'))
const size = computed(() => {
  const bytes = props.message.media?.size
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

async function load(): Promise<void> {
  if (!props.message.media) return
  loading.value = true
  failed.value = false

  try {
    const blob = await fetchMessageMedia(props.message)
    objectUrl.value = URL.createObjectURL(blob)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function revoke(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

onMounted(load)
onBeforeUnmount(revoke)
</script>

<template>
  <div class="mt-1.5">
    <div v-if="loading" class="flex items-center gap-2 rounded-lg bg-surface/60 px-3 py-2 text-caption">
      <span class="size-3 animate-pulse rounded-full bg-current opacity-40" aria-hidden="true" />
      {{ t('conversations.loadingAttachment') }}
    </div>

    <div v-else-if="failed" class="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-caption text-danger-ink">
      <AlertCircle class="size-4 shrink-0" aria-hidden="true" />
      {{ t('conversations.attachmentFailed') }}
    </div>

    <template v-else-if="objectUrl">
      <a
        v-if="isImage"
        :href="objectUrl"
        :download="filename"
        target="_blank"
        rel="noopener"
        class="block overflow-hidden rounded-lg border border-line/60"
      >
        <img :src="objectUrl" :alt="filename" class="max-h-72 w-full object-cover" loading="lazy" />
      </a>

      <audio v-else-if="isAudio" :src="objectUrl" controls class="w-full max-w-sm" :aria-label="filename" />

      <video
        v-else-if="isVideo"
        :src="objectUrl"
        controls
        class="max-h-72 w-full rounded-lg border border-line/60"
        :aria-label="filename"
      />

      <div v-else class="flex items-center gap-2.5 rounded-lg border border-line/60 bg-surface/60 px-3 py-2">
        <FileText class="size-5 shrink-0 opacity-70" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ filename }}</span>
          <span v-if="size" class="block text-caption opacity-70">{{ size }}</span>
        </span>
      </div>

      <a
        v-if="!isImage"
        :href="objectUrl"
        :download="filename"
        class="mt-1 inline-flex items-center gap-1 text-caption font-medium underline-offset-4 hover:underline"
      >
        <Download class="size-3.5" aria-hidden="true" />
        {{ t('conversations.downloadAttachment') }}
      </a>
    </template>
  </div>
</template>
