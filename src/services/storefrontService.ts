import { api } from '@/lib/axiosClient'
import type { Paginated } from '@/types/api'
import type {
  MerchantStorefrontPayload,
  MerchantStorefrontSettings,
  PaymentMethodOption,
  PublicCategory,
  PublicOrder,
  PublicProduct,
  PublicProductFilters,
  PublicStorefront,
  ShippingZone,
  ShippingZonePayload,
  StorePaymentResponse,
  StorefrontCheckoutPayload,
} from '@/types/storefront'

const publicBase = (tenantSlug: string, storeSlug: string) =>
  `/public/storefront/${tenantSlug}/${storeSlug}`

const tenantBase = (storeId: number | string) => `/tenant/stores/${storeId}`

export function fetchPublicStorefront(tenantSlug: string, storeSlug: string): Promise<PublicStorefront> {
  return api.get<PublicStorefront>(publicBase(tenantSlug, storeSlug))
}

export function fetchPublicCategories(tenantSlug: string, storeSlug: string): Promise<PublicCategory[]> {
  return api.get<PublicCategory[]>(`${publicBase(tenantSlug, storeSlug)}/categories`)
}

export function fetchPublicProducts(
  tenantSlug: string,
  storeSlug: string,
  params: PublicProductFilters = {},
): Promise<Paginated<PublicProduct>> {
  return api.list<PublicProduct>(`${publicBase(tenantSlug, storeSlug)}/products`, {
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    category: params.category,
    sort: params.sort,
  })
}

export function fetchPublicProduct(
  tenantSlug: string,
  storeSlug: string,
  productSlug: string,
): Promise<PublicProduct> {
  return api.get<PublicProduct>(`${publicBase(tenantSlug, storeSlug)}/products/${productSlug}`)
}

export function fetchPublicShippingZones(tenantSlug: string, storeSlug: string): Promise<ShippingZone[]> {
  return api.get<ShippingZone[]>(`${publicBase(tenantSlug, storeSlug)}/shipping-zones`)
}

export function fetchPublicPaymentMethods(
  tenantSlug: string,
  storeSlug: string,
): Promise<{ methods: PaymentMethodOption[] }> {
  return api.get<{ methods: PaymentMethodOption[] }>(`${publicBase(tenantSlug, storeSlug)}/payment-methods`)
}

export function placeStorefrontOrder(
  tenantSlug: string,
  storeSlug: string,
  payload: StorefrontCheckoutPayload,
): Promise<PublicOrder> {
  return api.post<PublicOrder>(`${publicBase(tenantSlug, storeSlug)}/checkout`, payload)
}

export function fetchPublicOrder(
  tenantSlug: string,
  storeSlug: string,
  token: string,
): Promise<PublicOrder> {
  return api.get<PublicOrder>(`${publicBase(tenantSlug, storeSlug)}/orders/${token}`)
}

export function fetchMerchantStorefront(storeId: number | string): Promise<MerchantStorefrontSettings> {
  return api.get<MerchantStorefrontSettings>(`${tenantBase(storeId)}/storefront`)
}

export function updateMerchantStorefront(
  storeId: number | string,
  payload: MerchantStorefrontPayload,
): Promise<MerchantStorefrontSettings> {
  return api.patch<MerchantStorefrontSettings>(`${tenantBase(storeId)}/storefront`, payload)
}

export function fetchShippingZones(storeId: number | string): Promise<ShippingZone[]> {
  return api.get<ShippingZone[]>(`${tenantBase(storeId)}/shipping-zones`)
}

export function createShippingZone(
  storeId: number | string,
  payload: ShippingZonePayload,
): Promise<ShippingZone> {
  return api.post<ShippingZone>(`${tenantBase(storeId)}/shipping-zones`, payload)
}

export function updateShippingZone(
  storeId: number | string,
  zoneId: number | string,
  payload: Partial<ShippingZonePayload>,
): Promise<ShippingZone> {
  return api.patch<ShippingZone>(`${tenantBase(storeId)}/shipping-zones/${zoneId}`, payload)
}

export function deleteShippingZone(storeId: number | string, zoneId: number | string): Promise<void> {
  return api.delete<void>(`${tenantBase(storeId)}/shipping-zones/${zoneId}`)
}

export function fetchStorePayments(storeId: number | string): Promise<StorePaymentResponse> {
  return api.get<StorePaymentResponse>(`${tenantBase(storeId)}/payments`)
}

export function updateStorePayments(
  storeId: number | string,
  payload: Partial<{ cod_enabled: boolean; cod_instructions: string | null }>,
): Promise<StorePaymentResponse> {
  return api.patch<StorePaymentResponse>(`${tenantBase(storeId)}/payments`, payload)
}
