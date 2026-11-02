import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { StorefrontCartLine } from '@/types/storefront'

/**
 * The public cart.
 *
 * A shopper has no account, so the cart lives in this browser and is scoped to
 * one tenant/store pair: opening a second shop never mixes the two baskets.
 * Nothing here is authoritative. Prices and stock are re-read by the server on
 * checkout, and the UI labels the local totals as an estimate for that reason.
 */

const STORAGE_PREFIX = 'dukavo.storefront.cart.v1'
const MAX_LINES = 80

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`
}

function read(scope: string): StorefrontCartLine[] {
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((line): line is StorefrontCartLine => {
      if (!line || typeof line !== 'object') return false
      const candidate = line as Partial<StorefrontCartLine>
      return (
        typeof candidate.variantId === 'number' &&
        typeof candidate.productSlug === 'string' &&
        typeof candidate.productName === 'string' &&
        typeof candidate.variantName === 'string' &&
        typeof candidate.unitPrice === 'number' &&
        typeof candidate.quantity === 'number' &&
        typeof candidate.currency === 'string' &&
        typeof candidate.available === 'number'
      )
    })
  } catch {
    // Corrupt storage must not take the shop down; an empty basket is safe.
    return []
  }
}

export const useStorefrontCartStore = defineStore('storefrontCart', () => {
  const scope = ref<string | null>(null)
  const lines = ref<StorefrontCartLine[]>([])

  const itemCount = computed(() => lines.value.reduce((total, line) => total + line.quantity, 0))
  const subtotal = computed(() =>
    lines.value.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
  )
  const isEmpty = computed(() => lines.value.length === 0)
  const currency = computed(() => lines.value[0]?.currency ?? null)

  function persist(): void {
    if (!scope.value) return

    try {
      localStorage.setItem(storageKey(scope.value), JSON.stringify(lines.value))
    } catch {
      // A private-mode quota failure only costs persistence, never the basket.
    }
  }

  /** Point the store at one shop, loading that shop's saved basket. */
  function setScope(next: string): void {
    if (scope.value === next) return

    persist()
    scope.value = next
    lines.value = read(next)
  }

  function addLine(line: StorefrontCartLine, quantity = 1): void {
    if (!scope.value || line.available < 1 || quantity < 1) return

    const existing = lines.value.find((entry) => entry.variantId === line.variantId)

    if (existing) {
      existing.quantity = Math.min(existing.available, existing.quantity + quantity)
    } else if (lines.value.length < MAX_LINES) {
      lines.value.push({
        ...line,
        quantity: Math.min(line.available, quantity),
      })
    }

    persist()
  }

  function setQuantity(variantId: number, quantity: number): void {
    const line = lines.value.find((entry) => entry.variantId === variantId)
    if (!line) return

    if (quantity < 1) {
      removeLine(variantId)
      return
    }

    line.quantity = Math.min(line.available, quantity)
    persist()
  }

  function removeLine(variantId: number): void {
    lines.value = lines.value.filter((line) => line.variantId !== variantId)
    persist()
  }

  function clear(): void {
    lines.value = []
    persist()
  }

  /** Refresh the cached availability after a product page has been re-read. */
  function updateAvailability(variantId: number, available: number, unitPrice?: number): void {
    const line = lines.value.find((entry) => entry.variantId === variantId)
    if (!line) return

    line.available = Math.max(0, available)
    if (unitPrice !== undefined) line.unitPrice = unitPrice

    if (line.available === 0) {
      removeLine(variantId)
      return
    }

    line.quantity = Math.min(line.quantity, line.available)
    persist()
  }

  return {
    scope,
    lines,
    itemCount,
    subtotal,
    isEmpty,
    currency,
    setScope,
    addLine,
    setQuantity,
    removeLine,
    clear,
    updateAvailability,
  }
})
