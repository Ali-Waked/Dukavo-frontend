import type { ProductStatus, InventoryMovementType, StoreStatus } from './enums'

export interface ProductVariant {
  id: number
  product_id: number
  name: string
  sku: string | null
  barcode?: string | null
  price: number
  cost: number
  is_default: boolean
  position: number
  stock?: {
    quantity: number
    reserved: number
    available: number
  }
}

export interface ProductImage {
  id: number
  url?: string
  path?: string
  alt?: string | null
  position?: number
  is_primary?: boolean
}

export interface Product {
  id: number
  store_id: number | null
  category_id: number | null
  name: string
  slug: string
  sku: string | null
  description?: string | null
  status: ProductStatus
  status_label: string
  price: number
  cost: number
  currency: string
  is_taxable: boolean
  category?: { id: number; name: string } | null
  variants?: ProductVariant[]
  images?: ProductImage[]
  stock?: {
    quantity: number
    reserved: number
    available: number
  }
  created_at?: string | null
  updated_at?: string | null
}

export interface Category {
  id: number
  parent_id: number | null
  name: string
  slug: string
  description?: string | null
  is_active: boolean
  sort_order: number
  parent?: { id: number; name: string } | null
  children?: Category[]
  products_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface Inventory {
  id: number
  store_id: number | null
  product_id: number
  product_variant_id: number | null
  quantity: number
  reserved_quantity: number
  available: number
  low_stock_threshold: number
  is_low_stock: boolean
  product?: { id: number; name: string; sku: string | null } | null
  variant?: { id: number; name: string; sku: string | null } | null
  store?: { id: number; name: string } | null
  updated_at?: string | null
}

export interface InventoryMovement {
  id: number
  inventory_id?: number
  type: InventoryMovementType
  type_label?: string
  quantity: number
  balance_after?: number
  reference?: string | null
  note?: string | null
  created_at?: string | null
}

export interface Store {
  id: number
  tenant_id: number
  name: string
  slug: string
  status: StoreStatus
  status_label?: string
  email?: string | null
  phone?: string | null
  currency: string
  timezone: string
  is_default: boolean
  products_count?: number
  created_at?: string | null
  updated_at?: string | null
}
