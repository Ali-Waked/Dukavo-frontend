import { useI18n } from '@/i18n'
import { LANGUAGES } from '@/i18n/languages'
import type { LanguageConfig } from '@/i18n/languages'

/**
 * The active locale, its rendering direction and the full language list, plus
 * the action to change it.
 *
 * All state lives in the i18n module, not here: locale switching, the
 * `lang`/`dir` attributes on `<html>`, localStorage persistence and browser
 * detection are that module's job (it has to run before Pinia exists). This
 * composable is the thin, typed surface the presentational layer uses, exactly
 * like `useTheme` delegates to the UI store.
 */
export function useLocale(): {
  /** Active locale code, e.g. `'en'`. */
  locale: ReturnType<typeof useI18n>['locale']
  /** Reading direction of the active locale (`rtl` | `ltr`). */
  dir: ReturnType<typeof useI18n>['dir']
  /** Every language the interface ships in — the single source of truth. */
  languages: readonly LanguageConfig[]
  /** Switch the interface language. Instant, persisted, mirrored on `<html>`. */
  setLocale: ReturnType<typeof useI18n>['setLocale']
} {
  const { locale, dir, setLocale } = useI18n()

  return {
    locale,
    dir,
    languages: LANGUAGES,
    setLocale,
  }
}