<script setup lang="ts">
import { AlertTriangle, RefreshCw, Sparkles } from '@/components/icons'
import { useI18n } from '@/i18n'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'

/**
 * The shared frame for an AI result.
 *
 * AI is not always available: the installation may be switched off, the
 * provider may be down, the caller may be over their daily allowance, or the
 * answer may simply be empty. Each of those deserves its own sentence rather
 * than an eternal spinner, so this component renders the idle, loading,
 * unavailable, error and empty states in the same place, and leaves only the
 * successful result to the caller's slot.
 *
 * `state` is computed by the parent from its own data, which keeps this
 * component free of any assumption about what the result contains.
 */

type AiRequestState = 'idle' | 'loading' | 'unavailable' | 'error' | 'empty' | 'ready'

withDefaults(
  defineProps<{
    state: AiRequestState
    /** The already-translated failure message, when `state` is `error`. */
    error?: string | null
    /** Copy shown while the request is in flight. */
    loadingLabel?: string
  }>(),
  { error: null, loadingLabel: undefined },
)

defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <!-- Idle: the call has not been made, and the parent offers the trigger. -->
  <div v-if="state === 'idle'" class="space-y-3">
    <slot name="idle">
      <p class="text-small text-muted">{{ t('ai.state.idle') }}</p>
    </slot>
  </div>

  <!-- Loading: a shape that matches the eventual result, never a bare spinner. -->
  <div
    v-else-if="state === 'loading'"
    class="space-y-3"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <BaseSkeleton height="h-4" block />
    <BaseSkeleton class="w-5/6" height="h-4" block />
    <BaseSkeleton class="w-2/3" height="h-4" block />
    <p class="text-small text-muted">{{ loadingLabel ?? t('ai.state.loading') }}</p>
  </div>

  <!-- Unavailable: switched off or no provider can serve it. Retrying now would fail. -->
  <BaseAlert v-else-if="state === 'unavailable'" class="mt-1" tone="warning">
    <div class="flex items-start gap-2">
      <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{{ t('ai.unavailable') }}</span>
    </div>
  </BaseAlert>

  <!-- Error: something went wrong, and trying again is reasonable. -->
  <BaseAlert v-else-if="state === 'error'" class="mt-1" tone="danger">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span>{{ error ?? t('ai.failed') }}</span>
      <BaseButton size="sm" variant="secondary" :icon="RefreshCw" @click="$emit('retry')">
        {{ t('action.retry') }}
      </BaseButton>
    </div>
  </BaseAlert>

  <!-- Empty: the call succeeded but there is nothing to show. -->
  <div v-else-if="state === 'empty'" class="flex items-start gap-2 py-2 text-small text-muted">
    <Sparkles class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <span>{{ t('ai.state.empty') }}</span>
  </div>

  <!-- Ready: the parent owns the successful presentation. -->
  <slot v-else />
</template>
