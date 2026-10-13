/**
 * Badge colour tokens, in plain TS so components and helper modules can share
 * the maps that a plain `<script setup>` SFC cannot export.
 *
 * One tone → one set of token classes, so a badge, its leading dot and the
 * status picker row share the same colours in every mode. The palette itself
 * lives in `tokens.css`; these only reference the semantic token families.
 */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-brand-soft text-brand-ink border-brand-soft-border',
  success: 'bg-success-soft text-success-ink border-success-border',
  warning: 'bg-warning-soft text-warning-ink border-warning-border',
  danger: 'bg-danger-soft text-danger-ink border-danger-border',
  info: 'bg-info-soft text-info-ink border-info-border',
  accent: 'bg-accent-soft text-accent-ink border-accent-400/40',
}

export const BADGE_DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-muted',
  brand: 'bg-brand-700',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent-500',
}