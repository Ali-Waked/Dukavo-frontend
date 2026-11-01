<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
  type LucideIcon,
} from '@/components/icons'
import { useI18n } from '@/i18n'

/**
 * A dependency-free rich text editor.
 *
 * The project ships no editor library, so this is a `contenteditable` surface
 * driven by the browser's own command API. Everything it can produce is inside
 * the server's allow-list — widening the toolbar without widening that list
 * would let the client emit markup the API strips, so the two move together.
 *
 * The DOM is the source of truth while typing: the element's HTML is only
 * written back when the bound value changes from the outside (a page load or a
 * server rebind). Re-rendering on every keystroke would collapse the caret.
 */

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    hint?: string
    error?: string | null
    placeholder?: string
    disabled?: boolean
    required?: boolean
    /**
     * Uploads one image and resolves to its public URL. When absent the image
     * button is hidden, so the editor stays usable in contexts that do not own
     * storage (for example a read-only preview).
     */
    uploadImage?: (file: File) => Promise<string>
  }>(),
  {
    modelValue: '',
    label: undefined,
    hint: undefined,
    error: null,
    placeholder: undefined,
    disabled: false,
    required: false,
    uploadImage: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const id = useId()
const editor = ref<HTMLDivElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const imageError = ref<string | null>(null)

interface ToolbarItem {
  command?: string
  argument?: string
  icon?: LucideIcon
  label?: string
  action?: 'link' | 'image' | 'divider'
}

const toolbarItems = computed<ToolbarItem[]>(() => [
  { command: 'bold', icon: Bold, label: t('platform.newsletters.bold') },
  { command: 'italic', icon: Italic, label: t('platform.newsletters.italic') },
  { command: 'underline', icon: Underline, label: t('platform.newsletters.underline') },
  { command: 'strikeThrough', icon: Strikethrough, label: t('platform.newsletters.strikethrough') },
  { action: 'divider' },
  { command: 'formatBlock', argument: 'H2', icon: Heading2, label: t('platform.newsletters.heading') },
  { command: 'formatBlock', argument: 'H3', icon: Heading3, label: t('platform.newsletters.subheading') },
  { command: 'formatBlock', argument: 'BLOCKQUOTE', icon: Quote, label: t('platform.newsletters.quote') },
  { action: 'divider' },
  { command: 'insertUnorderedList', icon: List, label: t('platform.newsletters.bulletList') },
  { command: 'insertOrderedList', icon: ListOrdered, label: t('platform.newsletters.numberedList') },
  { command: 'insertHorizontalRule', icon: Minus, label: t('platform.newsletters.separator') },
  { action: 'divider' },
  { command: 'justifyLeft', icon: AlignLeft, label: t('platform.newsletters.alignLeft') },
  { command: 'justifyCenter', icon: AlignCenter, label: t('platform.newsletters.alignCenter') },
  { command: 'justifyRight', icon: AlignRight, label: t('platform.newsletters.alignRight') },
  { action: 'divider' },
  { action: 'link', icon: Link, label: t('platform.newsletters.link') },
  { action: 'image', icon: ImagePlus, label: t('platform.newsletters.insertImage') },
  { action: 'divider' },
  { command: 'undo', icon: Undo, label: t('platform.newsletters.undo') },
  { command: 'redo', icon: Redo, label: t('platform.newsletters.redo') },
])

const describedBy = computed(() => {
  if (props.error) return `${id}-error`
  if (props.hint) return `${id}-hint`
  return undefined
})

onMounted(() => {
  if (editor.value) {
    editor.value.innerHTML = props.modelValue
  }
})

watch(
  () => props.modelValue,
  (value) => {
    if (editor.value && editor.value.innerHTML !== value) {
      editor.value.innerHTML = value
    }
  },
)

function sync(): void {
  emit('update:modelValue', editor.value?.innerHTML ?? '')
}

/**
 * Run a document command. The toolbar buttons cancel `mousedown` so the
 * selection stays in the editor while the button's `click` fires.
 */
function run(command: string, argument?: string): void {
  if (props.disabled) {
    return
  }

  editor.value?.focus()
  document.execCommand(command, false, argument)
  sync()
}

function onToolbarClick(item: ToolbarItem): void {
  if (item.action === 'link') {
    addLink()
    return
  }

  if (item.action === 'image') {
    imageInput.value?.click()
    return
  }

  if (item.command) {
    run(item.command, item.argument)
  }
}

function addLink(): void {
  if (props.disabled) {
    return
  }

  const url = window.prompt(t('platform.newsletters.linkPrompt'), 'https://')
  if (url) {
    run('createLink', url)
  }
}

/**
 * Insert a figure rather than a bare `<img>`.
 *
 * The caption is plain text, written through `textContent`, so an author cannot
 * smuggle markup into it. Width is a percentage so the image still responds to
 * the article column; `max-width: 100%` is kept in the stored markup and by the
 * server allow-list, which is what stops a wide upload from overflowing on a
 * phone.
 */
function insertFigure(url: string, alt: string, caption: string, width: number): void {
  const figure = document.createElement('figure')
  figure.style.textAlign = 'center'

  const image = document.createElement('img')
  image.src = url
  image.alt = alt
  image.loading = 'lazy'
  image.style.width = `${width}%`
  image.style.maxWidth = '100%'

  figure.appendChild(image)

  if (caption.trim() !== '') {
    const figcaption = document.createElement('figcaption')
    figcaption.textContent = caption.trim()
    figure.appendChild(figcaption)
  }

  editor.value?.focus()
  document.execCommand('insertHTML', false, figure.outerHTML)
  sync()
}

function readWidth(): number {
  const answer = window.prompt(t('platform.newsletters.imageWidthPrompt'), '100')
  const parsed = Number(answer)

  if (!Number.isFinite(parsed)) {
    return 100
  }

  return Math.min(100, Math.max(10, Math.round(parsed)))
}

async function onImageChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file || !props.uploadImage) {
    return
  }

  if (!file.type.startsWith('image/')) {
    imageError.value = t('platform.newsletters.imageTypeError')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    imageError.value = t('platform.newsletters.imageSizeError')
    return
  }

  imageError.value = null
  uploading.value = true

  try {
    const url = await props.uploadImage(file)
    const alt = window.prompt(t('platform.newsletters.imageAltPrompt'), '') ?? ''
    const caption = window.prompt(t('platform.newsletters.imageCaptionPrompt'), '') ?? ''

    insertFigure(url, alt.trim(), caption, readWidth())
  } catch {
    imageError.value = t('platform.newsletters.imageUploadFailed')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="id" class="block text-sm font-medium text-ink">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div
      class="overflow-hidden rounded-lg border bg-surface transition focus-within:ring-2"
      :class="error ? 'border-danger focus-within:border-danger' : 'border-line focus-within:border-brand'"
    >
      <div
        role="toolbar"
        :aria-label="t('platform.newsletters.toolbar')"
        class="flex flex-wrap items-center gap-0.5 border-b border-line bg-inset/60 px-1.5 py-1"
      >
        <template v-for="(item, index) in toolbarItems" :key="item.action ?? item.command + (item.argument ?? '') + index">
          <span
            v-if="item.action === 'divider'"
            class="mx-1 h-4 w-px bg-line"
            aria-hidden="true"
          />
          <button
            v-else
            type="button"
            class="btn-icon"
            :disabled="disabled || (item.action === 'image' && (uploading || !uploadImage))"
            :aria-label="item.label"
            :title="item.label"
            @mousedown.prevent
            @click="onToolbarClick(item)"
          >
            <component :is="item.icon" class="size-4" />
          </button>
        </template>

        <input
          ref="imageInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="sr-only"
          tabindex="-1"
          @change="onImageChosen"
        />
      </div>

      <div
        :id="id"
        ref="editor"
        class="rich-content min-h-48 px-3 py-2 text-sm leading-relaxed text-ink outline-none"
        contenteditable
        role="textbox"
        aria-multiline="true"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        :data-placeholder="placeholder"
        @input="sync"
      />
    </div>

    <p v-if="imageError" class="text-small text-danger-ink" role="alert">
      {{ imageError }}
    </p>

    <p v-if="error" :id="`${id}-error`" class="text-small text-danger-ink" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="text-small text-muted">
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.rich-content:empty::before {
  content: attr(data-placeholder);
  color: var(--text-subtle);
  pointer-events: none;
}

.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4) {
  font-weight: 600;
  line-height: 1.3;
  margin: 0.75em 0 0.35em;
  color: var(--text-ink);
}

.rich-content :deep(h2) {
  font-size: 1.25rem;
}

.rich-content :deep(h3) {
  font-size: 1.125rem;
}

.rich-content :deep(p) {
  margin: 0 0 0.75em;
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin: 0 0 0.75em;
  padding-inline-start: 1.5em;
}

.rich-content :deep(ul) {
  list-style: disc;
}

.rich-content :deep(ol) {
  list-style: decimal;
}

.rich-content :deep(li) {
  margin: 0.15em 0;
}

.rich-content :deep(blockquote) {
  border-inline-start: 3px solid var(--border-brand, currentColor);
  padding-inline-start: 0.75em;
  margin: 0 0 0.75em;
  color: var(--text-muted);
}

.rich-content :deep(a) {
  color: var(--text-brand-ink, currentColor);
  text-decoration: underline;
}

.rich-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
}

.rich-content :deep(figure) {
  margin: 0.75em 0;
}

.rich-content :deep(figcaption) {
  margin-top: 0.35em;
  font-size: 0.75rem;
  color: var(--text-subtle);
}

.rich-content :deep(hr) {
  margin: 1.25em auto;
  border: 0;
  border-top: 1px solid var(--border-line);
  width: 40%;
}
</style>
