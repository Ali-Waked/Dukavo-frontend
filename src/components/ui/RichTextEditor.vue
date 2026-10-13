<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import {
  Bold,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo,
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
  }>(),
  {
    modelValue: '',
    label: undefined,
    hint: undefined,
    error: null,
    placeholder: undefined,
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const id = useId()
const editor = ref<HTMLDivElement | null>(null)

interface ToolbarItem {
  command: string
  argument?: string
  icon: LucideIcon
  label: string
}

const toolbarItems = computed<ToolbarItem[]>(() => [
  { command: 'bold', icon: Bold, label: t('platform.newsletters.bold') },
  { command: 'italic', icon: Italic, label: t('platform.newsletters.italic') },
  { command: 'formatBlock', argument: 'H2', icon: Heading2, label: t('platform.newsletters.heading') },
  { command: 'insertUnorderedList', icon: List, label: t('platform.newsletters.bulletList') },
  { command: 'insertOrderedList', icon: ListOrdered, label: t('platform.newsletters.numberedList') },
  { command: 'formatBlock', argument: 'BLOCKQUOTE', icon: Quote, label: t('platform.newsletters.quote') },
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

function addLink(): void {
  if (props.disabled) {
    return
  }

  const url = window.prompt(t('platform.newsletters.linkPrompt'), 'https://')
  if (url) {
    run('createLink', url)
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
        <button
          v-for="item in toolbarItems"
          :key="item.command + (item.argument ?? '')"
          type="button"
          class="btn-icon"
          :disabled="disabled"
          :aria-label="item.label"
          :title="item.label"
          @mousedown.prevent
          @click="run(item.command, item.argument)"
        >
          <component :is="item.icon" class="size-4" />
        </button>

        <button
          type="button"
          class="btn-icon"
          :disabled="disabled"
          :aria-label="t('platform.newsletters.link')"
          :title="t('platform.newsletters.link')"
          @mousedown.prevent
          @click="addLink"
        >
          <Link class="size-4" />
        </button>

        <span class="mx-1 h-4 w-px bg-line" aria-hidden="true" />

        <button
          type="button"
          class="btn-icon"
          :disabled="disabled"
          :aria-label="t('platform.newsletters.undo')"
          :title="t('platform.newsletters.undo')"
          @mousedown.prevent
          @click="run('undo')"
        >
          <Undo class="size-4" />
        </button>
        <button
          type="button"
          class="btn-icon"
          :disabled="disabled"
          :aria-label="t('platform.newsletters.redo')"
          :title="t('platform.newsletters.redo')"
          @mousedown.prevent
          @click="run('redo')"
        >
          <Redo class="size-4" />
        </button>
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
</style>
