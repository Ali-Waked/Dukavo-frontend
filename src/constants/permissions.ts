import type { MessageKey } from '@/i18n'

/**
 * The permission catalogue, mirrored from `App\Support\PermissionRegistry`.
 *
 * The authoritative list comes from `GET /me` (`permission_catalogue`) and
 * `GET /permissions` (full descriptions); these constants exist so route
 * guards, navigation and page-level checks have statically typed slugs to
 * reference, and so a typo in `can('products.craete')` fails to compile.
 *
 * Frontend permission checks are a UX affordance only. The Laravel `permission`
 * middleware is the security boundary and refuses the same requests regardless
 * of what this file or any component believes.
 */

export const PERMISSIONS = {
  products: {
    view: 'products.view',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete',
  },
  categories: {
    view: 'categories.view',
    manage: 'categories.manage',
  },
  inventory: {
    view: 'inventory.view',
    manage: 'inventory.manage',
  },
  orders: {
    view: 'orders.view',
    create: 'orders.create',
    update: 'orders.update',
    delete: 'orders.delete',
  },
  customers: {
    view: 'customers.view',
    create: 'customers.create',
    update: 'customers.update',
    delete: 'customers.delete',
  },
  conversations: {
    view: 'conversations.view',
    reply: 'conversations.reply',
    assign: 'conversations.assign',
  },
  whatsapp: {
    view: 'whatsapp.view',
    manage: 'whatsapp.manage',
  },
  stores: {
    view: 'stores.view',
    manage: 'stores.manage',
  },
  users: {
    view: 'users.view',
    manage: 'users.manage',
  },
  roles: {
    view: 'roles.view',
    manage: 'roles.manage',
  },
  dashboard: {
    view: 'dashboard.view',
  },
  audit: {
    view: 'audit.view',
  },
  settings: {
    view: 'settings.view',
    manage: 'settings.manage',
  },
  ai: {
    use: 'ai.use',
  },
} as const satisfies Record<string, Record<string, string>>

type Values<T> = T[keyof T]

/** Every slug the product defines, as a literal union. */
export type PermissionSlug = Values<{ [M in keyof typeof PERMISSIONS]: Values<(typeof PERMISSIONS)[M]> }>

/**
 * Modules in display order with the heading that groups them in the role
 * editor. The slugs are the module's own permissions, so a module added to
 * `PERMISSIONS` but not listed here is caught by the type checker rather than
 * silently absent from the UI.
 */
export const PERMISSION_MODULES: Array<{
  module: keyof typeof PERMISSIONS
  labelKey: MessageKey
  permissions: PermissionSlug[]
}> = [
  { module: 'dashboard', labelKey: 'permission.module.dashboard', permissions: [PERMISSIONS.dashboard.view] },
  { module: 'products', labelKey: 'permission.module.products', permissions: [PERMISSIONS.products.view, PERMISSIONS.products.create, PERMISSIONS.products.update, PERMISSIONS.products.delete] },
  { module: 'categories', labelKey: 'permission.module.categories', permissions: [PERMISSIONS.categories.view, PERMISSIONS.categories.manage] },
  { module: 'inventory', labelKey: 'permission.module.inventory', permissions: [PERMISSIONS.inventory.view, PERMISSIONS.inventory.manage] },
  { module: 'orders', labelKey: 'permission.module.orders', permissions: [PERMISSIONS.orders.view, PERMISSIONS.orders.create, PERMISSIONS.orders.update, PERMISSIONS.orders.delete] },
  { module: 'customers', labelKey: 'permission.module.customers', permissions: [PERMISSIONS.customers.view, PERMISSIONS.customers.create, PERMISSIONS.customers.update, PERMISSIONS.customers.delete] },
  { module: 'conversations', labelKey: 'permission.module.conversations', permissions: [PERMISSIONS.conversations.view, PERMISSIONS.conversations.reply, PERMISSIONS.conversations.assign] },
  { module: 'whatsapp', labelKey: 'permission.module.whatsapp', permissions: [PERMISSIONS.whatsapp.view, PERMISSIONS.whatsapp.manage] },
  { module: 'stores', labelKey: 'permission.module.stores', permissions: [PERMISSIONS.stores.view, PERMISSIONS.stores.manage] },
  { module: 'users', labelKey: 'permission.module.users', permissions: [PERMISSIONS.users.view, PERMISSIONS.users.manage] },
  { module: 'roles', labelKey: 'permission.module.roles', permissions: [PERMISSIONS.roles.view, PERMISSIONS.roles.manage] },
  { module: 'audit', labelKey: 'permission.module.audit', permissions: [PERMISSIONS.audit.view] },
  { module: 'settings', labelKey: 'permission.module.settings', permissions: [PERMISSIONS.settings.view, PERMISSIONS.settings.manage] },
  { module: 'ai', labelKey: 'permission.module.ai', permissions: [PERMISSIONS.ai.use] },
]
