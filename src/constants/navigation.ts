import type { MessageKey } from '@/i18n'
import type { LucideIcon } from '@/components/icons'
import {
  Activity,
  Boxes,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  Package,
  PackagePlus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tags,
  TrendingDown,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from '@/components/icons'

/**
 * Sidebar structure.
 *
 * There are two distinct interfaces here, not one menu with extra rows:
 *
 *  - `TENANT_NAV_GROUPS` is the merchant's operational workspace. Groups are
 *    named for what the merchant is trying to do ("Catalogue" covers products,
 *    categories and inventory because that is one task).
 *  - `PLATFORM_NAV_GROUPS` is Dukavo's own administration: tenants, marketing
 *    content and the lead inboxes. None of these carry a `tenant_id`, so they
 *    are meaningless inside a workspace and are never shown there.
 *
 * Which set renders is decided by the active context (see `isPlatformMode` on
 * the auth store), never by a permission that a super admin would always pass.
 * Each item may still carry a single permission slug; the sidebar filters on it
 * and the router guards on the same value, so a link never leads to a page that
 * will refuse to render. Platform items that manage a shared concern (users,
 * roles, audit) carry the same slug their route guard enforces, so a platform
 * team member sees only the sections they hold.
 */

export interface NavItem {
  key: string
  labelKey: MessageKey
  /** Route path; kept as a string so navigation can be tested without a router. */
  to: string
  icon: LucideIcon
  /** Permission required to see the item *and* to open the page. */
  permission?: string
  /** Active only on an exact path match (used by the dashboard index). */
  end?: boolean
}

export interface NavGroup {
  key: string
  labelKey: MessageKey
  items: NavItem[]
}

export const TENANT_NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    labelKey: 'nav.overview',
    items: [
      {
        key: 'dashboard',
        labelKey: 'nav.dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        end: true,
      },
      {
        key: 'analytics',
        labelKey: 'nav.analytics',
        to: '/analytics',
        icon: Activity,
        permission: 'dashboard.view',
      },
      {
        key: 'profit',
        labelKey: 'nav.profit',
        to: '/profit',
        icon: TrendingUp,
        permission: 'profit.view',
      },
      {
        key: 'ai-approvals',
        labelKey: 'nav.aiApprovals',
        to: '/ai/approvals',
        icon: ShieldCheck,
        permission: 'ai.use',
      },
      {
        key: 'automations',
        labelKey: 'nav.automation',
        to: '/automations',
        icon: Activity,
        permission: 'automation.view',
      },
    ],
  },
  {
    key: 'sales',
    labelKey: 'nav.sales',
    items: [
      {
        key: 'orders',
        labelKey: 'nav.orders',
        to: '/orders',
        icon: ShoppingCart,
        permission: 'orders.view',
      },
      {
        key: 'recovery',
        labelKey: 'nav.recovery',
        to: '/recovery',
        icon: TrendingDown,
        permission: 'recovery.view',
      },
      {
        key: 'customers',
        labelKey: 'nav.customers',
        to: '/customers',
        icon: Users,
        permission: 'customers.view',
      },
    ],
  },
  {
    key: 'catalog',
    labelKey: 'nav.catalog',
    items: [
      {
        key: 'products',
        labelKey: 'nav.products',
        to: '/products',
        icon: Package,
        permission: 'products.view',
      },
      {
        key: 'bundles',
        labelKey: 'nav.bundles',
        to: '/bundles',
        icon: PackagePlus,
        permission: 'products.view',
      },
      {
        key: 'categories',
        labelKey: 'nav.categories',
        to: '/categories',
        icon: Tags,
        permission: 'categories.view',
      },
      {
        key: 'inventory',
        labelKey: 'nav.inventory',
        to: '/inventory',
        icon: Boxes,
        permission: 'inventory.view',
      },
    ],
  },
  {
    key: 'channels',
    labelKey: 'nav.channels',
    items: [
      {
        key: 'conversations',
        labelKey: 'nav.conversations',
        to: '/conversations',
        icon: MessageSquare,
        permission: 'conversations.view',
      },
      {
        key: 'whatsapp',
        labelKey: 'nav.whatsapp',
        to: '/whatsapp',
        icon: Store,
        permission: 'whatsapp.view',
      },
    ],
  },
  {
    key: 'configuration',
    labelKey: 'nav.settingsTeam',
    items: [
      {
        key: 'stores',
        labelKey: 'nav.stores',
        to: '/stores',
        icon: ShoppingBag,
        permission: 'stores.view',
      },
      {
        key: 'users',
        labelKey: 'nav.users',
        to: '/users',
        icon: UserCog,
        permission: 'users.view',
      },
      {
        key: 'roles',
        labelKey: 'nav.roles',
        to: '/roles',
        icon: ShieldCheck,
        permission: 'roles.view',
      },
      {
        key: 'audit',
        labelKey: 'nav.audit',
        to: '/audit',
        icon: FileText,
        permission: 'audit.view',
      },
    ],
  },
]

/**
 * Dukavo's own administration.
 *
 * Only implemented surfaces appear. The platform users, roles and audit items
 * carry a permission slug — the same slug their route guards check — because a
 * dukavo-admin platform team member must not see the levers they do not hold.
 * Billing and platform analytics have no implemented surface yet, so no dead
 * links are rendered for them.
 */
export const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    key: 'platformOverview',
    labelKey: 'nav.overview',
    items: [
      {
        key: 'platform-dashboard',
        labelKey: 'nav.platformDashboard',
        to: '/platform',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    key: 'platformManagement',
    labelKey: 'nav.platformManagement',
    items: [
      {
        key: 'tenants',
        labelKey: 'nav.tenants',
        to: '/tenants',
        icon: Layers,
      },
      {
        key: 'users',
        labelKey: 'nav.users',
        to: '/platform/users',
        icon: UserCog,
        permission: 'users.view',
      },
      {
        key: 'roles',
        labelKey: 'nav.roles',
        to: '/platform/roles',
        icon: ShieldCheck,
        permission: 'roles.view',
      },
      {
        key: 'audit',
        labelKey: 'nav.audit',
        to: '/platform/audit',
        icon: FileText,
        permission: 'audit.view',
      },
    ],
  },
  {
    key: 'platformContent',
    labelKey: 'nav.marketingContent',
    items: [
      {
        key: 'pricing-plans',
        labelKey: 'nav.pricingPlans',
        to: '/pricing-plans',
        icon: Wallet,
      },
      {
        key: 'faq-entries',
        labelKey: 'nav.faqEntries',
        to: '/faq-entries',
        icon: HelpCircle,
      },
      {
        key: 'newsletters',
        labelKey: 'nav.newsletters',
        to: '/newsletters',
        icon: Newspaper,
      },
      {
        key: 'content-pages',
        labelKey: 'nav.contentPages',
        to: '/content-pages',
        icon: FileText,
      },
    ],
  },
  {
    key: 'platformLeads',
    labelKey: 'nav.leads',
    items: [
      {
        key: 'waitlist-entries',
        labelKey: 'nav.waitlistEntries',
        to: '/waitlist-entries',
        icon: UserPlus,
      },
      {
        key: 'contact-messages',
        labelKey: 'nav.contactMessages',
        to: '/contact-messages',
        icon: Inbox,
      },
      {
        key: 'newsletter-subscribers',
        labelKey: 'nav.newsletterSubscribers',
        to: '/newsletter-subscribers',
        icon: Mail,
      },
    ],
  },
]

/** Sits outside the groups — reachable from anywhere, never inside one. */
export const SETTINGS_NAV_ITEM: NavItem = {
  key: 'settings',
  labelKey: 'nav.settings',
  to: '/settings',
  icon: Settings,
}

/** The groups that belong to the active context. */
export function navGroupsFor(isPlatformMode: boolean): NavGroup[] {
  return isPlatformMode ? PLATFORM_NAV_GROUPS : TENANT_NAV_GROUPS
}

/** Flat list, used by router guards and by the command palette. */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...TENANT_NAV_GROUPS.flatMap((group) => group.items),
  ...PLATFORM_NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
]

/**
 * The groups the active context should render, with permission-gated items
 * removed and any group left empty dropped.
 */
export function visibleNavGroups(
  isPlatformMode: boolean,
  has: (permission: string) => boolean,
): NavGroup[] {
  return navGroupsFor(isPlatformMode)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || has(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}
