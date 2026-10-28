import { api } from '@/lib/axiosClient'
import type { Cart, CartDetailsPayload } from '@/types/cart'
import type { Order } from '@/types/commerce'

const base = (conversationId: number) => `/tenant/conversations/${conversationId}/cart`

export function fetchCart(conversationId: number): Promise<Cart> {
  return api.get<Cart>(base(conversationId))
}

export function openCart(conversationId: number): Promise<Cart> {
  return api.post<Cart>(base(conversationId))
}

export function updateCart(conversationId: number, payload: CartDetailsPayload): Promise<Cart> {
  return api.patch<Cart>(base(conversationId), payload)
}

export function addCartItem(
  conversationId: number,
  payload: {
    version: number
    product_id: number
    product_variant_id: number
    quantity?: number
    discount_total?: number
  },
): Promise<Cart> {
  return api.post<Cart>(`${base(conversationId)}/items`, payload)
}

export function updateCartItem(
  conversationId: number,
  itemId: number,
  payload: { version: number; quantity: number; discount_total?: number },
): Promise<Cart> {
  return api.patch<Cart>(`${base(conversationId)}/items/${itemId}`, payload)
}

export function removeCartItem(
  conversationId: number,
  itemId: number,
  version: number,
): Promise<Cart> {
  return api.delete<Cart>(`${base(conversationId)}/items/${itemId}`, { data: { version } })
}

export function requestCartConfirmation(
  conversationId: number,
  payload: { version: number; notify?: boolean; message?: string | null },
): Promise<Cart> {
  return api.post<Cart>(`${base(conversationId)}/request-confirmation`, payload)
}

export function reopenCart(conversationId: number, version: number): Promise<Cart> {
  return api.post<Cart>(`${base(conversationId)}/reopen`, { version })
}

export function cancelCart(conversationId: number, version: number): Promise<Cart> {
  return api.delete<Cart>(base(conversationId), { data: { version } })
}

export function confirmCart(
  conversationId: number,
  payload: { version: number; expected_grand_total: number },
): Promise<Order> {
  return api.post<Order>(`${base(conversationId)}/confirm`, payload)
}
