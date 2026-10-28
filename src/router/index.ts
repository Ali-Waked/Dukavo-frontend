import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { onUnauthorized } from '@/lib/axiosClient'
import AuthLayout from '@/layouts/AuthLayout.vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import MarketingLayout from '@/layouts/MarketingLayout.vue'

import LoginPage from '@/pages/auth/LoginPage.vue'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage.vue'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage.vue'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage.vue'

import HomePage from '@/pages/marketing/HomePage.vue'
import FeaturesPage from '@/pages/marketing/FeaturesPage.vue'
import HowItWorksPage from '@/pages/marketing/HowItWorksPage.vue'
import PricingPage from '@/pages/marketing/PricingPage.vue'
import WaitlistPage from '@/pages/marketing/WaitlistPage.vue'
import ContactPage from '@/pages/marketing/ContactPage.vue'
import AboutPage from '@/pages/marketing/AboutPage.vue'
import BlogPage from '@/pages/marketing/BlogPage.vue'
import BlogArticlePage from '@/pages/marketing/BlogArticlePage.vue'
import HelpPage from '@/pages/marketing/HelpPage.vue'
import TermsPage from '@/pages/marketing/TermsPage.vue'
import PrivacyPage from '@/pages/marketing/PrivacyPage.vue'
import AcceptableUsePage from '@/pages/marketing/AcceptableUsePage.vue'
import ProductsPage from '@/pages/marketing/features/ProductsPage.vue'
import OrdersPage from '@/pages/marketing/features/OrdersPage.vue'
import InventoryPage from '@/pages/marketing/features/InventoryPage.vue'
import CustomersPage from '@/pages/marketing/features/CustomersPage.vue'
import ConversationsPage from '@/pages/marketing/features/ConversationsPage.vue'
import TeamPage from '@/pages/marketing/features/TeamPage.vue'

import NotFoundPage from '@/pages/errors/NotFoundPage.vue'
import ForbiddenPage from '@/pages/errors/ForbiddenPage.vue'
import ErrorPage from '@/pages/errors/ErrorPage.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Open only to guests; authenticated visitors are steered to the dashboard. */
    guest?: boolean
    /** Open only to signed-in visitors; defaults to true for layout children. */
    requiresAuth?: boolean
    /** Permission slug the active tenant must hold. */
    permission?: string
    /** Requires the platform operator role, independent of tenant permissions. */
    requiresPlatform?: boolean
    /** Human title for the browser tab and the topbar breadcrumb. */
    title?: string
    /** Suppresses the shared footer's newsletter card on pages that carry their own. */
    hideFooterNewsletter?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MarketingLayout,
      children: [
        {
          path: '',
          name: 'marketing.home',
          component: HomePage,
          meta: { title: 'Dukavo', hideFooterNewsletter: true },
        },
        { path: 'features', name: 'marketing.features', component: FeaturesPage, meta: { title: 'Features' } },
        { path: 'how-it-works', name: 'marketing.how-it-works', component: HowItWorksPage, meta: { title: 'How it works' } },
        { path: 'pricing', name: 'marketing.pricing', component: PricingPage, meta: { title: 'Pricing' } },
        { path: 'waitlist', name: 'marketing.waitlist', component: WaitlistPage, meta: { title: 'Waitlist' } },
        { path: 'contact', name: 'marketing.contact', component: ContactPage, meta: { title: 'Contact' } },
        { path: 'about', name: 'marketing.about', component: AboutPage, meta: { title: 'About' } },
        { path: 'blog', name: 'marketing.blog', component: BlogPage, meta: { title: 'Blog' } },
        {
          path: 'blog/:slug',
          name: 'marketing.blog.article',
          component: BlogArticlePage,
          meta: { title: 'Blog' },
        },
        { path: 'help', name: 'marketing.help', component: HelpPage, meta: { title: 'Help' } },
        { path: 'terms', name: 'marketing.terms', component: TermsPage, meta: { title: 'Terms' } },
        { path: 'privacy', name: 'marketing.privacy', component: PrivacyPage, meta: { title: 'Privacy' } },
        { path: 'acceptable-use', name: 'marketing.acceptable-use', component: AcceptableUsePage, meta: { title: 'Acceptable Use' } },
        { path: 'features/products', name: 'marketing.features.products', component: ProductsPage, meta: { title: 'Products' } },
        { path: 'features/orders', name: 'marketing.features.orders', component: OrdersPage, meta: { title: 'Orders' } },
        { path: 'features/inventory', name: 'marketing.features.inventory', component: InventoryPage, meta: { title: 'Inventory' } },
        { path: 'features/customers', name: 'marketing.features.customers', component: CustomersPage, meta: { title: 'Customers' } },
        { path: 'features/conversations', name: 'marketing.features.conversations', component: ConversationsPage, meta: { title: 'Conversations' } },
        { path: 'features/team', name: 'marketing.features.team', component: TeamPage, meta: { title: 'Team' } },
      ],
    },
    {
      path: '/',
      component: AuthLayout,
      meta: { guest: true },
      children: [
        { path: 'login', name: 'auth.login', component: LoginPage, meta: { title: 'Sign in' } },
        {
          path: 'forgot-password',
          name: 'auth.forgot-password',
          component: ForgotPasswordPage,
          meta: { title: 'Reset password' },
        },
        {
          path: 'reset-password',
          name: 'auth.reset-password',
          component: ResetPasswordPage,
          meta: { title: 'Reset password' },
        },
      ],
    },
    {
      path: '/verify-email',
      name: 'auth.verify-email',
      component: VerifyEmailPage,
      meta: { requiresAuth: true, title: 'Verify your email' },
    },
    {
      path: '/',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard.index',
          component: () => import('@/pages/dashboard/DashboardPage.vue'),
          meta: { permission: 'dashboard.view', title: 'Dashboard' },
        },
        {
          path: 'profit',
          name: 'profit.index',
          component: () => import('@/pages/profit/ProfitPage.vue'),
          meta: { permission: 'profit.view', title: 'Profit' },
        },
        {
          path: 'analytics',
          name: 'analytics.index',
          component: () => import('@/pages/analytics/AnalyticsPage.vue'),
          meta: { permission: 'dashboard.view', title: 'Analytics' },
        },
        {
          path: 'products',
          name: 'catalogue.products',
          component: () => import('@/pages/products/ProductListPage.vue'),
          meta: { permission: 'products.view', title: 'Products' },
        },
        {
          path: 'products/new',
          name: 'catalogue.products.create',
          component: () => import('@/pages/products/ProductFormPage.vue'),
          meta: { permission: 'products.create', title: 'New product' },
        },
        {
          path: 'products/:slug',
          name: 'catalogue.products.show',
          component: () => import('@/pages/products/ProductDetailPage.vue'),
          meta: { permission: 'products.view', title: 'Product' },
        },
        {
          path: 'products/:slug/edit',
          name: 'catalogue.products.edit',
          component: () => import('@/pages/products/ProductFormPage.vue'),
          meta: { permission: 'products.update', title: 'Edit product' },
        },
        {
          path: 'bundles',
          name: 'catalogue.bundles',
          component: () => import('@/pages/bundles/BundlesPage.vue'),
          meta: { permission: 'products.view', title: 'Bundles' },
        },
        {
          path: 'categories',
          name: 'catalogue.categories',
          component: () => import('@/pages/categories/CategoriesPage.vue'),
          meta: { permission: 'categories.view', title: 'Categories' },
        },
        {
          path: 'inventory',
          name: 'inventory.index',
          component: () => import('@/pages/inventory/InventoryPage.vue'),
          meta: { permission: 'inventory.view', title: 'Inventory' },
        },
        {
          path: 'customers',
          name: 'customers.index',
          component: () => import('@/pages/customers/CustomerListPage.vue'),
          meta: { permission: 'customers.view', title: 'Customers' },
        },
        {
          path: 'customers/:id',
          name: 'customers.show',
          component: () => import('@/pages/customers/CustomerDetailPage.vue'),
          meta: { permission: 'customers.view', title: 'Customer' },
        },
        {
          path: 'orders',
          name: 'orders.index',
          component: () => import('@/pages/orders/OrderListPage.vue'),
          meta: { permission: 'orders.view', title: 'Orders' },
        },
        {
          path: 'orders/:orderNumber',
          name: 'orders.show',
          component: () => import('@/pages/orders/OrderDetailPage.vue'),
          meta: { permission: 'orders.view', title: 'Order' },
        },
        {
          path: 'recovery',
          name: 'recovery.index',
          component: () => import('@/pages/recovery/RecoveryPage.vue'),
          meta: { permission: 'recovery.view', title: 'Lost sales' },
        },
        {
          path: 'automations',
          name: 'automation.index',
          component: () => import('@/pages/automation/AutomationsPage.vue'),
          meta: { permission: 'automation.view', title: 'Automations' },
        },
        {
          path: 'conversations',
          name: 'conversations.index',
          component: () => import('@/pages/conversations/ConversationsPage.vue'),
          meta: { permission: 'conversations.view', title: 'Conversations' },
        },
        {
          path: 'whatsapp',
          name: 'whatsapp.index',
          component: () => import('@/pages/whatsapp/WhatsappPage.vue'),
          meta: { permission: 'whatsapp.view', title: 'WhatsApp' },
        },
        {
          path: 'stores',
          name: 'stores.index',
          component: () => import('@/pages/stores/StoresPage.vue'),
          meta: { permission: 'stores.view', title: 'Stores' },
        },
        {
          path: 'users',
          name: 'users.index',
          component: () => import('@/pages/users/UsersPage.vue'),
          meta: { permission: 'users.view', title: 'Users' },
        },
        {
          path: 'roles',
          name: 'roles.index',
          component: () => import('@/pages/roles/RolesPage.vue'),
          meta: { permission: 'roles.view', title: 'Roles' },
        },
        {
          path: 'ai/approvals',
          name: 'ai-approvals',
          component: () => import('@/pages/ai/AiApprovalsPage.vue'),
          meta: { titleKey: 'ai.approvals.title', permission: 'ai.approve' },
        },
        {
          path: 'ai/merchant-copilot',
          name: 'ai-merchant-copilot',
          component: () => import('@/pages/ai/MerchantCopilotPage.vue'),
          meta: { titleKey: 'ai.merchantCopilot.title', permission: 'ai.use' },
        },
        {
          path: 'audit',
          name: 'audit.index',
          component: () => import('@/pages/audit/AuditPage.vue'),
          meta: { permission: 'audit.view', title: 'Audit log' },
        },
        {
          path: 'notifications',
          name: 'notifications.index',
          component: () => import('@/pages/notifications/NotificationsPage.vue'),
          meta: { title: 'Notifications' },
        },
        {
          path: 'profile',
          name: 'profile.index',
          component: () => import('@/pages/profile/ProfilePage.vue'),
          meta: { title: 'Profile' },
        },
        {
          path: 'settings',
          component: () => import('@/pages/settings/SettingsLayout.vue'),
          meta: { title: 'Settings' },
          children: [
            {
              path: '',
              name: 'settings.index',
              component: () => import('@/pages/settings/SettingsPage.vue'),
              meta: { title: 'Settings' },
            },
            {
              path: 'security',
              name: 'settings.security',
              component: () => import('@/pages/settings/SecurityPage.vue'),
              meta: { title: 'Security' },
            },
            {
              path: 'notifications',
              name: 'settings.notifications',
              component: () => import('@/pages/settings/NotificationsPage.vue'),
              meta: { title: 'Notifications' },
            },
            {
              path: 'workspace',
              name: 'settings.workspace',
              component: () => import('@/pages/settings/WorkspaceSettingsPage.vue'),
              meta: { title: 'Workspace', permission: 'settings.view' },
            },
          ],
        },
        {
          path: 'platform',
          name: 'platform.dashboard',
          component: () => import('@/pages/platform/PlatformOverviewPage.vue'),
          meta: { requiresPlatform: true, title: 'Platform overview' },
        },
        {
          path: 'tenants',
          name: 'platform.tenants',
          component: () => import('@/pages/platform/TenantsPage.vue'),
          meta: { requiresPlatform: true, title: 'Tenants' },
        },
        {
          path: 'platform/users',
          name: 'platform.users',
          component: () => import('@/pages/platform/PlatformUsersPage.vue'),
          meta: { requiresPlatform: true, permission: 'users.view', title: 'Platform users' },
        },
        {
          path: 'platform/roles',
          name: 'platform.roles',
          component: () => import('@/pages/roles/RolesPage.vue'),
          props: { platform: true },
          meta: { requiresPlatform: true, permission: 'roles.view', title: 'Roles & Permissions' },
        },
        {
          path: 'platform/audit',
          name: 'platform.audit',
          component: () => import('@/pages/audit/AuditPage.vue'),
          props: { platform: true },
          meta: { requiresPlatform: true, permission: 'audit.view', title: 'Audit log' },
        },
        {
          path: 'pricing-plans',
          name: 'platform.pricing-plans',
          component: () => import('@/pages/platform/PricingPlansPage.vue'),
          meta: { requiresPlatform: true, title: 'Pricing plans' },
        },
        {
          path: 'faq-entries',
          name: 'platform.faq-entries',
          component: () => import('@/pages/platform/FaqEntriesPage.vue'),
          meta: { requiresPlatform: true, title: 'Help & FAQ' },
        },
        {
          path: 'content-pages',
          name: 'platform.content-pages',
          component: () => import('@/pages/platform/ContentPagesPage.vue'),
          meta: { requiresPlatform: true, title: 'Content pages' },
        },
        {
          path: 'waitlist-entries',
          name: 'platform.waitlist-entries',
          component: () => import('@/pages/platform/WaitlistEntriesPage.vue'),
          meta: { requiresPlatform: true, title: 'Waitlist' },
        },
        {
          path: 'contact-messages',
          name: 'platform.contact-messages',
          component: () => import('@/pages/platform/ContactMessagesPage.vue'),
          meta: { requiresPlatform: true, title: 'Contact messages' },
        },
        {
          path: 'newsletter-subscribers',
          name: 'platform.newsletter-subscribers',
          component: () => import('@/pages/platform/NewsletterSubscribersPage.vue'),
          meta: { requiresPlatform: true, title: 'Newsletter subscribers' },
        },
        {
          path: 'newsletters',
          name: 'platform.newsletters',
          component: () => import('@/pages/platform/NewslettersPage.vue'),
          meta: { requiresPlatform: true, title: 'Newsletter' },
        },
        {
          path: 'newsletters/new',
          name: 'platform.newsletters.create',
          component: () => import('@/pages/platform/NewsletterFormPage.vue'),
          meta: { requiresPlatform: true, title: 'New edition' },
        },
        {
          path: 'newsletters/:id/edit',
          name: 'platform.newsletters.edit',
          component: () => import('@/pages/platform/NewsletterFormPage.vue'),
          meta: { requiresPlatform: true, title: 'Edit edition' },
        },
      ],
    },
    {
      path: '/403',
      name: 'errors.forbidden',
      component: ForbiddenPage,
      meta: { title: 'Forbidden' },
    },
    {
      path: '/500',
      name: 'errors.fatal',
      component: ErrorPage,
      meta: { title: 'Something went wrong' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'errors.not-found',
      component: NotFoundPage,
      meta: { title: 'Not found' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // The first navigation settles whether a session exists; everything after can
  // be answered synchronously.
  if (!auth.initialised) {
    await auth.bootstrap()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'auth.login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard.index' }
  }

  if (to.meta.requiresPlatform && !auth.isPlatformUser) {
    return { name: 'errors.forbidden' }
  }

  // A merchant page needs a workspace in context. A platform operator browsing
  // in platform mode is steered to the platform overview rather than left on a
  // page whose requests would resolve no tenant and fail. Platform-mode routes
  // (users, roles, audit) are exempt: they resolve against platform roles, which
  // need no tenant.
  if (to.meta.permission && !auth.activeTenant && !to.meta.requiresPlatform) {
    return auth.isPlatformUser
      ? { name: 'platform.dashboard' }
      : { name: 'errors.forbidden' }
  }

  if (to.meta.permission && !auth.can(to.meta.permission)) {
    return { name: 'errors.forbidden' }
  }

  return true
})

// A session that dies mid-use (401 under active navigation) lands on the sign-in
// screen, carrying the reason so the form can explain itself.
onUnauthorized(() => {
  const auth = useAuthStore()
  auth.clear()
  if (router.currentRoute.value.name !== 'auth.login') {
    void router.push({ name: 'auth.login', query: { reason: 'expired' } })
  }
})

export default router