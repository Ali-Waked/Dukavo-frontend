import { computed, readonly, ref, watch, type ComputedRef, type DeepReadonly, type Ref } from 'vue'
import { en, type MessageKey } from './en'
import { ar } from './ar'
import { DEFAULT_LOCALE, LANGUAGES, isSupportedLocale } from './languages'
import type { Locale } from '@/types/enums'

/**
 * Translation and direction, in one module.
 *
 * Direction is not a separate concern from language: `dir` follows the active
 * locale, which is what lets the UI be written once with logical properties
 * (`ps-`, `pe-`, `text-start`, `inset-inline-*`) and behave correctly in both
 * scripts without a second layout tree.
 *
 * The module owns its own state rather than living in a store, so it can be
 * imported by `main.ts` and by the theme bootstrap in `index.html` without
 * pulling in Pinia before it exists.
 */

const catalogues: Record<Locale, Record<MessageKey, string>> = { en, ar }

const STORAGE_KEY = 'dukavo.locale'

/** Every code whose script reads right-to-left, derived from the config list. */
const RTL_CODES: ReadonlySet<string> = new Set(
  LANGUAGES.filter((language) => language.dir === 'rtl').map((language) => language.code),
)

function detectInitialLocale(): Locale {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null

  if (isSupportedLocale(stored)) {
    return stored
  }

  const preferred = typeof navigator !== 'undefined' ? navigator.language : ''
  if (preferred) {
    const base = preferred.toLowerCase().split('-')[0]
    const matched = LANGUAGES.find((language) => language.code.toLowerCase() === base)
    if (matched) {
      return matched.code
    }
  }

  return DEFAULT_LOCALE
}

const locale: Ref<Locale> = ref(detectInitialLocale())

/** `rtl` for Arabic, `ltr` for English — assigned straight onto `<html>`. */
const dir: ComputedRef<'rtl' | 'ltr'> = computed(() =>
  RTL_CODES.has(locale.value) ? 'rtl' : 'ltr',
)

function applyDocumentState(): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.lang = locale.value
  root.dir = dir.value
}

/**
 * One write-through path for the whole application.
 *
 * The reactive locale, the persisted copy and the `lang`/`dir` attributes on
 * `<html>` are always updated together, so no two of them can ever disagree:
 * there is no code path that touches one without touching the others. Running
 * immediate also persists the first-visit browser detection, so a visitor who
 * arrives with an Arabic browser sees Arabic again tomorrow.
 */
watch(
  locale,
  (next) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
    }
    applyDocumentState()
  },
  { immediate: true },
)

/** Switch the interface language. Persists the choice across visits. */
export function setLocale(next: Locale): void {
  if (next === locale.value) {
    return
  }

  locale.value = next
}

/**
 * Translate `key`, substituting `{name}` placeholders from `params`.
 *
 * A missing key returns the key itself rather than an empty string — visible in
 * development, harmless in production, and far easier to spot than a blank cell
 * in a table.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message = lookup(locale.value, key)

  if (message === undefined) {
    return key
  }

  if (!params) {
    return message
  }

  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

/**
 * Translate a dynamic key (a status slug, a module name) when a message exists,
 * and fall back to a readable form of the raw value when it does not.
 *
 * Statuses and permission modules are open sets on the server, so the UI has to
 * render values it has never seen without showing a bare enum string.
 */
export function tDynamic(prefix: string, value: string): string {
  const message = lookup(locale.value, `${prefix}.${value}`)

  if (message !== undefined) {
    return message
  }

  return value.replace(/[_.-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function lookup(current: Locale, key: string): string | undefined {
  const catalogue = catalogues[current] as Record<string, string | undefined>

  return catalogue[key] ?? (en as Record<string, string | undefined>)[key]
}

export function hasMessage(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, key)
}

export const currentLocale: DeepReadonly<Ref<Locale>> = readonly(locale)

export function useI18n(): {
  locale: DeepReadonly<Ref<Locale>>
  dir: ComputedRef<'rtl' | 'ltr'>
  t: typeof t
  setLocale: typeof setLocale
  tDynamic: typeof tDynamic
} {
  return {
    locale: currentLocale,
    dir,
    t,
    setLocale,
    tDynamic,
  }
}

export type { MessageKey }
