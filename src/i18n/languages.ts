import type { Locale } from '@/types/enums'

/**
 * The single source of truth for which languages the interface ships in.
 *
 * Every consumer — the switcher, the RTL direction set, browser detection,
 * persistence — is derived from this one list. Adding a language is exactly one
 * line here (plus the corresponding message catalogue and a union member in
 * `types/enums.ts`); nothing else needs to change.
 */
export interface LanguageConfig {
  code: Locale
  /** Endonym — the language's name written in its own script, never translated. */
  label: string
  /** The reading direction its script needs. */
  dir: 'rtl' | 'ltr'
}

export const LANGUAGES: readonly LanguageConfig[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
] as const

/** Fallback when nothing stored and the browser language is unsupported. */
export const DEFAULT_LOCALE: Locale = 'en'

/** True when `value` is a code the interface actually ships. */
export function isSupportedLocale(value: unknown): value is Locale {
  return LANGUAGES.some((language) => language.code === value)
}