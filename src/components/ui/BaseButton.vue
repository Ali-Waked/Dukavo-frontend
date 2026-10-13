<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { LoaderCircle, type LucideIcon } from '@/components/icons'

/**
 * The one button in the application.
 *
 * Variants are fixed rather than arbitrary so a destructive action never looks
 * like a constructive one by accident, and `loading` disables and replaces the
 * leading icon rather than swapping in a spinner somewhere else — the label
 * keeps its width, so the button never jumps under the cursor mid-click.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    /** Leading icon, rendered before the label. */
    icon?: LucideIcon
    /** Renders the button stretched to its container's width. */
    block?: boolean
    /** Internal navigation; renders a RouterLink instead of a button. */
    to?: string
    ariaLabel?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    icon: undefined,
    block: false,
    to: undefined,
    ariaLabel: undefined,
  },
)

defineEmits<{ click: [event: MouseEvent] }>()

const classes = computed(() => {
  const base = [
    'relative inline-flex items-center justify-center gap-2 font-medium',
    'transition-[background-color,color,border-color,opacity,box-shadow] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:pointer-events-none disabled:opacity-55',
    'select-none whitespace-nowrap',
  ]

  const variants: Record<ButtonVariant, string[]> = {
    primary: ['bg-brand-700 text-white shadow-xs hover:bg-brand-800 active:bg-brand-800'],
    secondary: [
      'border border-line bg-surface text-ink shadow-xs hover:bg-surface-2 active:bg-surface-3',
    ],
    ghost: ['text-ink hover:bg-surface-2 active:bg-surface-3'],
    danger: ['bg-danger text-white shadow-xs hover:brightness-95 active:brightness-90'],
    link: ['text-brand-ink underline-offset-4 hover:underline'],
  }

  const sizes: Record<ButtonSize, string[]> = {
    sm: ['h-8 px-3 text-sm rounded-md'],
    md: ['h-9 px-4 text-sm rounded-lg'],
    lg: ['h-11 px-5 text-body rounded-lg'],
  }

  if (props.variant === 'link') {
    return [...base, ...variants[props.variant], props.block ? 'w-full' : ''].join(' ')
  }

  return [
    ...base,
    ...variants[props.variant],
    ...sizes[props.size],
    props.block ? 'w-full' : '',
  ].join(' ')
})
</script>

<template>
  <RouterLink
    v-if="to && !disabled"
    :to="to"
    :class="classes"
    :aria-label="ariaLabel"
    @click="$emit('click', $event)"
  >
    <LoaderCircle v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </RouterLink>

  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <LoaderCircle v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </button>
</template>