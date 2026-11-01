import { computed, ref } from 'vue'

/**
 * Client-side view of the currencies Dukavo supports.
 *
 * The server remains the authority: `GET /tenant/currencies` decides what a
 * merchant may select, and the backend rejects anything outside
 * `config/dukavo.php`. This mirror exists only so formatting can be synchronous
 * — a price cannot wait for a network round trip to learn whether it has two or
 * three decimal places.
 *
 * Keep it in step with `backend/config/dukavo.php`.
 */

export interface CurrencyMeta {
  code: string
  name: string
  symbol: string
  decimals: number
  locale: string
}

const CATALOG: Record<string, Omit<CurrencyMeta, 'code'>> = {
  USD: { name: 'US Dollar', symbol: '$', decimals: 2, locale: 'en_US' },
  EUR: { name: 'Euro', symbol: '€', decimals: 2, locale: 'de_DE' },
  GBP: { name: 'British Pound', symbol: '£', decimals: 2, locale: 'en_GB' },
  SAR: { name: 'Saudi Riyal', symbol: 'ر.س', decimals: 2, locale: 'ar_SA' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, locale: 'ar_AE' },
  EGP: { name: 'Egyptian Pound', symbol: 'ج.م', decimals: 2, locale: 'ar_EG' },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3, locale: 'ar_KW' },
  QAR: { name: 'Qatari Riyal', symbol: 'ر.ق', decimals: 2, locale: 'ar_QA' },
  BHD: { name: 'Bahraini Dinar', symbol: 'د.ب', decimals: 3, locale: 'ar_BH' },
  OMR: { name: 'Omani Rial', symbol: 'ر.ع.', decimals: 3, locale: 'ar_OM' },
  JOD: { name: 'Jordanian Dinar', symbol: 'د.أ', decimals: 3, locale: 'ar_JO' },
  MAD: { name: 'Moroccan Dirham', symbol: 'د.م.', decimals: 2, locale: 'ar_MA' },
  TRY: { name: 'Turkish Lira', symbol: '₺', decimals: 2, locale: 'tr_TR' },
  INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2, locale: 'en_IN' },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', decimals: 2, locale: 'en_CA' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2, locale: 'en_AU' },
  JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0, locale: 'ja_JP' },
  CNY: { name: 'Chinese Yuan', symbol: 'CN¥', decimals: 2, locale: 'zh_CN' },
  NGN: { name: 'Nigerian Naira', symbol: '₦', decimals: 2, locale: 'en_NG' },
  ZAR: { name: 'South African Rand', symbol: 'R', decimals: 2, locale: 'en_ZA' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, locale: 'en_KE' },
}

export const DEFAULT_CURRENCY = 'USD'

/**
 * The active workspace's base currency.
 *
 * Kept in a module-level ref rather than the auth store so `format.ts` can read
 * it without importing Pinia — formatting is used by components that render
 * before the store is set up (and by plain utilities and tests).
 */
const active = ref(DEFAULT_CURRENCY)

export function normaliseCurrency(code: string | null | undefined): string {
  const upper = (code ?? '').trim().toUpperCase()

  return upper && CATALOG[upper] ? upper : DEFAULT_CURRENCY
}

/** Called by the auth store whenever the active session changes. */
export function setActiveCurrency(code: string | null | undefined): void {
  active.value = normaliseCurrency(code)
}

export function activeCurrency(): string {
  return active.value
}

/** Reactive read for components that display the current code. */
export const activeCurrencyCode = computed(() => active.value)

export function currencyMeta(code?: string | null): CurrencyMeta {
  const normalised = normaliseCurrency(code ?? active.value)

  // `normaliseCurrency` only returns a key that exists in the catalogue.
  return { code: normalised, ...CATALOG[normalised]! }
}

export function currencyOptions(): CurrencyMeta[] {
  return Object.keys(CATALOG)
    .sort()
    .map((code) => ({ code, ...CATALOG[code]! }))
}

/** `$` for a symbol, falling back to the ISO code when none is configured. */
export function currencySymbol(code?: string | null): string {
  const meta = currencyMeta(code)
  return meta.symbol || meta.code
}

/** The decimal places a currency can represent, e.g. 3 for KWD. */
export function currencyDecimals(code?: string | null): number {
  return currencyMeta(code).decimals
}
