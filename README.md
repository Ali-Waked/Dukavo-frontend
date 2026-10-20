# Dukavo Frontend

The Vue 3 single-page application for **Dukavo**, a multi-tenant commerce
platform for merchants who sell and support customers over WhatsApp.

This repository owns everything the browser renders: the marketing site, the
authentication flow, the merchant workspace (catalogue, inventory, customers,
orders, the WhatsApp inbox) and the platform administration screens. It talks
to the Laravel API in the sibling `backend/` repository over a versioned JSON
surface under `/api/v1`.

---

## Contents

1. [Key features](#1-key-features)
2. [Technology stack](#2-technology-stack)
3. [Architecture and directory structure](#3-architecture-and-directory-structure)
4. [Prerequisites](#4-prerequisites)
5. [Installation and local development](#5-installation-and-local-development)
6. [Environment variables](#6-environment-variables)
7. [Backend API integration](#7-backend-api-integration)
8. [Routing and application layout](#8-routing-and-application-layout)
9. [State management](#9-state-management)
10. [UI and design system](#10-ui-and-design-system)
11. [Authentication and authorization](#11-authentication-and-authorization)
12. [Testing and quality checks](#12-testing-and-quality-checks)
13. [Troubleshooting](#13-troubleshooting)
14. [Production build and deployment](#14-production-build-and-deployment)
15. [Contributing](#15-contributing)
16. [License](#16-license)

---

## 1. Key features

Everything below is implemented in this repository and backed by real routes
and pages.

- **Marketing site** — home, features (with six product detail pages),
  how-it-works, pricing, blog, help, about, contact, legal pages
  (terms/privacy/acceptable use), waitlist and newsletter capture, all
  server-rendered from the backend's public API.
- **Authentication** — sign in, forgot/reset password and email verification
  against the backend's Fortify endpoints, with "remember me" (local vs
  session storage) and an explanatory screen when a session expires.
- **Merchant workspace** — dashboard with charts, categories, products with
  variants and image galleries, inventory with movements and low-stock
  reporting, customers, orders with status transitions, stores, team users,
  custom roles and an audit log.
- **WhatsApp inbox** — conversation list and thread view, replies, assignment,
  and a WhatsApp numbers screen that connects accounts and shows the platform
  setup state (which credentials the server holds, webhook URLs to paste into
  Meta, and whether inbound signatures are enforced).
- **Notifications** — an in-app bell with unread count and polling, a full
  notification centre, and per-channel preference settings that reflect what
  the backend can actually send.
- **Platform administration** — tenant management, platform users and roles,
  the platform audit log, pricing plans, FAQ, content pages, waitlist/contact
  inboxes, newsletter subscribers and a newsletter composer.
- **AI assistance** — reply-draft suggestions in the inbox and insights panels
  for tenant and platform dashboards, shown only when the `ai.use` permission
  is granted and the backend has AI enabled.
- **Internationalisation** — English (LTR) and Arabic (RTL) with a
  pre-paint locale bootstrap, persisted preference, and `Accept-Language`
  sent on every request.
- **Theming** — light/dark/system theme with a class-based dark palette and a
  pre-paint bootstrap to avoid a flash of the wrong theme.

Deliberately **not** present: self-service registration (the register page was
removed — the backend has no registration endpoint either), and any payment or
checkout flow.

## 2. Technology stack

Verified from [`package.json`](package.json):

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Vue 3 (`vue`, `<script setup>`) | `^3.5.42` |
| Build | Vite + `@vitejs/plugin-vue` | `^8.2.2` / `^6.0.8` |
| Language | TypeScript (`vue-tsc --build`) | `~6.0.0` |
| Router | `vue-router` (history mode) | `^5.3.1` |
| State | Pinia | `^4.0.3` |
| HTTP | Axios (one shared instance) | `^1.20.0` |
| Styling | Tailwind CSS **v4** (CSS-first, `@tailwindcss/vite`, no config file) | `^4.3.3` |
| Icons | `@lucide/vue` | `^1.52.0` |
| Charts | D3 (`src/components/charts`) | `^7.9.0` |
| Animation | AOS (scroll reveals on marketing pages) | `^2.3.4` |
| Fonts | Fontsource — Inter variable, IBM Plex Sans Arabic | `^5.3.0` |
| Dev tooling | `vite-plugin-vue-devtools`, `npm-run-all2` | — |
| Package manager | npm (`package-lock.json`, lockfileVersion 3) | — |

Not installed in this repository: Vue I18n (i18n is a small custom module),
Pinia plugins, UI component libraries, form-validation libraries, ESLint,
Prettier, and any test runner (Vitest/Jest/Cypress/Playwright). Those names
appear only in leftover template files and are not available.

## 3. Architecture and directory structure

```text
frontend/
├── index.html                  # pre-paint bootstrap: locale/dir + dark theme
├── package.json                # scripts: dev, build, preview, type-check
├── vite.config.ts              # tailwind/vue/devtools plugins, @ alias,
│                               #   /api + /sanctum dev proxy, manual chunks
├── tsconfig.json               # references tsconfig.app + tsconfig.node
├── tsconfig.app.json           # strict-ish (@ alias, noUncheckedIndexedAccess)
├── env.d.ts                    # vite client types
├── .env.example                # VITE_API_BASE_URL, VITE_API_PROXY_TARGET
├── public/                     # favicons
└── src/
    ├── main.ts                 # boot: fonts, styles, Pinia, router, CSRF prime
    ├── App.vue                 # RouterView + page transitions + ToastHost
    ├── router/index.ts         # 62 named routes + the global guard
    ├── lib/
    │   └── axiosClient.ts      # the only axios instance: envelope unwrap,
    │                           #   Bearer + X-Tenant + Accept-Language,
    │                           #   CSRF prime/419 replay, ApiError mapping
    ├── stores/                 # Pinia: auth, notifications, toast, ui
    ├── services/               # 23 modules — one per API domain
    ├── composables/            # useAuth, usePermissions, useToast, useTheme,
    │                           #   useLocale, useModal, useDebounce,
    │                           #   useResponsive, useSeo, useSlugAvailability
    ├── constants/              # navigation, permissions, statuses, pagination
    ├── types/                  # 12 domain modules (auth, commerce, inbox, …)
    ├── i18n/                   # custom i18n: index.ts, languages.ts,
    │                           #   en.ts + ar.ts (~1,250 keys each)
    ├── layouts/                # MarketingLayout, AuthLayout, DashboardLayout
    ├── pages/                  # route components (see below)
    ├── components/
    │   ├── ui/                 # 17 Base* primitives + PageHeader, StatCard,
    │   │                       #   ImageUpload, RichTextEditor, UserAvatar,
    │   │                       #   StatusSelect, AppLogo, AiInsightsPanel
    │   ├── layout/             # Sidebar, SidebarBody, Topbar
    │   ├── charts/             # d3: TrendChart, RevenueChart, BarMeters, MiniList
    │   ├── marketing/          # Hero, MarketingFooter, LegalDocument, …
    │   ├── notifications/      # NotificationBell, NotificationItem
    │   ├── feedback/           # ToastHost
    │   ├── icons/index.ts      # Lucide re-exports
    │   └── LanguageSwitcher.vue
    ├── utils/                  # format, status, content, ai helpers
    └── assets/
        ├── styles/             # main.css (tailwind v4 import), tokens.css,
        │                       #   base.css, typography.css, transitions.css
        ├── images/  logo/
```

A few empty placeholder directories exist (`components/dashboard`, `forms`,
`navigation`, `tables`) and contain no files.

**Data flow.** Every screen follows the same chain:

```text
Component → Pinia store → service module → axios client → Laravel API
```

Components never import `axios` directly; services never build URLs by hand
outside their module; the client is the only place that knows about the
response envelope, credentials and headers.

**Pages** (59 `.vue` files across 19 areas): `auth`, `marketing` (12 + 6
feature pages), `dashboard`, `products`, `categories`, `inventory`,
`customers`, `orders`, `conversations`, `whatsapp`, `stores`, `users`,
`roles`, `audit`, `notifications`, `profile`, `settings`, `platform` (11
screens) and `errors` (404/403/500).

## 4. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js `^22.18.0` or `>=24.12.0` | `engines` field in `package.json` |
| npm | lockfile is `package-lock.json` |
| A running Dukavo backend | the API — see `../backend/README.md`. Default target `http://127.0.0.1:8000` |

## 5. Installation and local development

```bash
git clone <frontend-repository> frontend   # or copy the directory
cd frontend
npm install                                # npm ci for an exact lockfile build
cp .env.example .env
npm run dev                                # http://localhost:5173
```

Start the backend first (`php artisan serve` in `../backend`, port 8000): the
dev server proxies `/api` and `/sanctum` to `VITE_API_PROXY_TARGET`, so the
browser stays on one origin and cookies/CSRF behave exactly as in production.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR (default port 5173; no custom port is configured) |
| `npm run type-check` | `vue-tsc --build` — the only static check in this repo |
| `npm run build` | `run-p type-check "build-only {@}" --` → type-check **and** production bundle |
| `npm run build-only` | Vite bundle only (skips type checking) |
| `npm run preview` | Serve the production bundle locally |

## 6. Environment variables

[`.env.example`](.env.example) — both are safe for browser exposure; Vite
inlines only `VITE_*` prefixed values into the client bundle.

| Variable | Purpose | Default | Required |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Base path/URL for API calls. Keep it relative (`/api/v1`) in development so requests go through the proxy; set an absolute backend URL in production. | `/api/v1` | yes |
| `VITE_API_PROXY_TARGET` | Where the dev server forwards `/api` and `/sanctum`. Development only — never reaches the bundle. | `http://127.0.0.1:8000` | no |

**Never put secrets in `VITE_*` variables.** Anything prefixed with `VITE_` is
shipped to every browser. Server secrets (WhatsApp token, App Secret, AI key)
live exclusively in the backend environment.

## 7. Backend API integration

### The HTTP client

[`src/lib/axiosClient.ts`](src/lib/axiosClient.ts) is the **only** axios
instance in the application.

- **Base URL** — `import.meta.env.VITE_API_BASE_URL` (fallback `/api`);
  `withCredentials` and `withXSRFToken` are always on; 30 s timeout; JSON and
  `X-Requested-With` headers on every request.
- **Request interceptor** attaches `Authorization: Bearer <token>` (token held
  in memory, supplied by the auth store), `X-Tenant: <slug>` for the active
  workspace, and `Accept-Language` from the current locale.
- **CSRF** — `ensureCsrfToken()` primes `GET /sanctum/csrf-cookie` before the
  app mounts; a `419` response re-primes the cookie and replays the request
  exactly once.
- **Session loss** — on `401` the client clears the token and notifies
  subscribers registered through `onUnauthorized()`; the auth store then
  resets state and routes to the sign-in screen with `?reason=expired`.
  (The client deliberately does not import the router — that keeps the
  dependency cycle out of the module graph.)
- **Errors** — every failure is normalised into `ApiError`
  (`status`, `fields` from a 422's `errors`, `code`, `isNetworkError`,
  `isValidation`). When the server sends no message, a per-status fallback
  map produces user-facing text; a request that never reached the server
  produces a "couldn't reach the server" message.
- **Envelope helpers** — `api.get/list/post/put/patch/delete` unwrap
  `{ success, data }` once, so services only ever see their own payload type;
  `api.list` returns `{ data, meta, links }` for paginated endpoints and
  `api.raw` is the escape hatch.

### URL conventions

| Client call | Resolved URL |
| --- | --- |
| `api.get('/tenant/products')` with base `/api/v1` | `GET /api/v1/tenant/products` |
| `authService.login()` | `POST /api/v1/auth/login` |
| `healthService.check()` | `GET /api/health` (outside `/v1`, bypasses the envelope) |
| CSRF prime | `GET /sanctum/csrf-cookie` (derived from the base URL) |

Service modules map one-to-one onto backend route groups: `productService`,
`categoryService`, `inventoryService`, `customerService`, `orderService`,
`conversationService`, `whatsappService`, `storeService`, `userService`,
`roleService`, `auditService`, `dashboardService`, `profileService`,
`notificationService`, `aiService`, `platformService`,
`platformUserService`, `platformContentService`, `marketingService`,
`permissionService`, `tenantService`, `authService`, `healthService`.

### State handling on screens

Every list/detail screen distinguishes loading (skeletons), empty
(`BaseEmptyState`), error (alert + retry action) and success; mutations report
through the toast store; 422 responses bind per-field messages to form inputs
via `ApiError.fields`.

### CORS

The backend allows credentials from `FRONTEND_URL`. In development you never
hit CORS because the Vite proxy keeps everything on `localhost:5173`; when the
SPA is hosted separately, set `VITE_API_BASE_URL` to the backend origin and
make sure the backend's `FRONTEND_URL` matches the SPA origin exactly.

## 8. Routing and application layout

62 named routes in [`src/router/index.ts`](src/router/index.ts), history mode
based on `import.meta.env.BASE_URL`. Three layouts are route-level parents:

| Layout | Used by |
| --- | --- |
| `MarketingLayout` | the public marketing tree (`/`, `/features`, `/pricing`, `/blog`, legal pages, …) — no auth |
| `AuthLayout` | `/login`, `/forgot-password`, `/reset-password` (`meta.guest`) |
| `DashboardLayout` | the authenticated workspace and platform trees (`meta.requiresAuth`) |

Standalone routes: `/verify-email`, `/403`, `/500` and the catch-all 404.

Route `meta` carries `requiresAuth`, `guest`, `requiresPlatform`, `permission`
(a tenant permission slug) and `title`.

**The guard** (`router.beforeEach`):

1. Bootstraps the session once (`auth.bootstrap()`), then evaluates
   synchronously.
2. `requiresAuth` without a session → `/login?redirect=…`.
3. `guest` with a session → `/dashboard`.
4. `requiresPlatform` without a platform role → `/403`.
5. A `permission` route with no active workspace → platform users to
   `/platform`, everyone else to `/403` (platform-mode routes are exempt).
6. A `permission` route whose slug the user lacks → `/403`.

A session that dies mid-navigation is handled by the axios `401` handler, not
by the guard.

Representative groups:

- **Tenant** (`permission`): `/dashboard`, `/products` (+ `new`, `/:slug`,
  `/:slug/edit`), `/categories`, `/inventory`, `/customers`, `/orders`,
  `/conversations`, `/whatsapp`, `/stores`, `/users`, `/roles`, `/audit`,
  `/settings` (workspace/security/notifications children).
- **Platform** (`requiresPlatform`, plus optional `permission`): `/platform`,
  `/tenants`, `/platform/users`, `/platform/roles`, `/platform/audit`,
  `/pricing-plans`, `/faq-entries`, `/content-pages`, `/waitlist-entries`,
  `/contact-messages`, `/newsletter-subscribers`, `/newsletters`.
- **Personal** (auth required, no permission): `/notifications`, `/profile`.

## 9. State management

Four Pinia stores — no plugins, no persisted-store library (persistence is
written by hand where it matters):

| Store | State / responsibility |
| --- | --- |
| `authStore` (`auth`) | session, user, tenants, active tenant, permission set; `login`, `logout`, `bootstrap` (restores the token), `switchTenant` (sets and persists `X-Tenant`), `can()` / `anyOf()` |
| `notificationStore` | items, unread count, polling (60 s), mark read/dismiss |
| `toastStore` | toast queue with `success/error/warning/info` (8 s for errors, 5 s otherwise) |
| `uiStore` | theme (light/dark/system, persisted `dukavo.theme`), mobile nav, collapsed sidebar |

Token persistence: `dukavo.token` in `localStorage` when "remember me" is
checked, otherwise `sessionStorage`; the active workspace slug is persisted as
`dukavo.tenant`; the locale as `dukavo.locale`.

## 10. UI and design system

- **Tailwind CSS v4, CSS-first.** There is no `tailwind.config` file; the
  plugin lives in `vite.config.ts` and design tokens are declared in
  [`src/assets/styles/tokens.css`](src/assets/styles/tokens.css) as `@theme`
  primitives plus semantic variables (`--bg-surface`, `--text-ink`, …) that
  are swapped wholesale under `.dark`. Component rule stated in the code: no
  component hardcodes a hex value.
- **Global classes** in `main.css` (`@layer components`): `.surface`,
  `.rule`, `.focus-ring`, and shared button/input utilities (`.btn-icon`, …).
- **Dark mode** — class-based `.dark` on `<html>`; a bootstrap script in
  `index.html` reads `localStorage['dukavo.theme']` (falling back to
  `prefers-color-scheme`) before first paint; `uiStore.setTheme()` toggles it
  at runtime and updates `color-scheme`.
- **RTL/Arabic** — direction is derived from the locale (`ar` → `rtl`) and
  written to `<html lang dir>` pre-paint; the codebase uses logical properties
  (`ps-`, `pe-`, `text-start`, `inset-inline-*`) and the stylesheet defines
  `rtl`/`ltr` custom variants. Arabic text renders in IBM Plex Sans Arabic.
- **Components** — 17 `Base*` primitives (alert, badge, button, card, checkbox,
  dropdown, empty state, input, modal, pagination, select, skeleton, spinner,
  switch, table, tabs, textarea) plus `PageHeader`, `StatCard`, `StatusSelect`,
  `UserAvatar`, `ImageUpload`, `RichTextEditor` and the d3 chart set. Toasts
  are rendered globally by `ToastHost`.
- **Forms** — every input accepts `label`, `error` and `hint` props; server
  422s are bound per field; destructive actions go through `BaseModal`
  confirmations.
- **Responsive** — a `lg:` sidebar layout with a collapsible/overlay mobile
  navigation (`useResponsive` + `uiStore.mobileNavOpen`).

## 11. Authentication and authorization

The frontend mirrors the backend's permission catalogue for **usability
only**: `src/constants/permissions.ts` is compiled against
`PermissionSlug`, `usePermissions().can()` and the router guard hide controls
the user cannot use, and the sidebar is filtered by the same slugs returned by
`GET /api/v1/me`.

**The backend is the security boundary.** Hiding a button protects nothing on
its own — every request is re-authorized by the Laravel `permission:`
middleware, and a user who bypasses the UI simply gets a `403`. Keep the two
catalogues in sync when adding a permission: `PermissionRegistry` on the
server, `src/constants/permissions.ts` here.

Session handling (who stores the token, when it is cleared, how CSRF is
primed) is described in [Backend API integration](#7-backend-api-integration).

## 12. Testing and quality checks

```bash
npm run type-check    # vue-tsc --build — the only automated check
npm run build         # type-check + production bundle (what CI would run)
```

There is **no** unit/E2E test suite and **no** linter configured in this
repository: no test runner, test files, ESLint or Prettier configuration
exists. `tsconfig.node.json` references `vitest.config.*`/`eslint.config.*`
from the original template, but those files do not exist and those tools are
not installed. Treat `npm run build` passing as the merge gate, and run it
before every commit.

## 13. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Every request 404s or returns HTML | Wrong `VITE_API_BASE_URL`. Keep it relative (`/api/v1`) behind the proxy, or point it at the backend's origin, then restart `npm run dev`. |
| Backend unreachable in dev | `VITE_API_PROXY_TARGET` does not match the backend address (default `http://127.0.0.1:8000`); confirm `php artisan serve` is running. |
| `419` on every call | The CSRF cookie is not being set — `/sanctum` must be proxied too (it is, by default) and the backend's `SANCTUM_STATEFUL_DOMAINS` must include your dev origin. |
| `401` immediately after login, or instant logout | Cookie/session mismatch: the backend's `FRONTEND_URL` must match the origin the browser shows, including port. |
| `403` on a page that should load | The signed-in user lacks that permission, or no workspace is selected — the guard redirects to `/403`. Select a tenant from the workspace switcher. |
| `TypeError` reading `import.meta.env` | A non-`VITE_` variable was used, or `.env` was added after the dev server started — restart it. |
| Build fails in `vue-tsc` | Type errors: run `npm run type-check` alone and fix them; `npm run build-only` bypasses the check but should not be used to hide failures. |
| Arabic text or RTL looks wrong | The locale bootstrap in `index.html` sets `dir`; clear `localStorage['dukavo.locale']` if it was set to a stale value. |
| Fonts missing offline | Fonts come from `@fontsource` packages bundled at build time; a blocked CDN is not the cause (the dev-only Eruda console script is the only CDN reference, and only in dev). |

## 14. Production build and deployment

```bash
npm run build     # type-check + bundle into dist/
npm run preview   # sanity-check the bundle locally
```

Verified behaviour of the production bundle:

- Output goes to `dist/` with hashed filenames; vendor code is split into
  `vendor-core`, `vendor-http` and `vendor` chunks, and routes are lazily
  imported by the router.
- The app assumes it is served from the domain root (`base` is not
  overridden) — deploy `dist/` as static files at `/`.
- Set `VITE_API_BASE_URL` to the backend's API base **at build time**; if the
  API is on another origin, configure the backend's `FRONTEND_URL` and CORS
  for that origin, and serve both over HTTPS so cookies work.
- No Docker, Nginx or platform configuration (`vercel.json`, `netlify.toml`,
  …) exists in this repository — hosting is whatever your team standardises
  on.

## 15. Contributing

1. Branch from `main`; keep each change to one concern.
2. Follow the existing patterns: a new screen = route + page component +
   service module (if it needs a new endpoint) + i18n keys in **both**
   `en.ts` and `ar.ts` + `constants/` entries when navigation or statuses
   change.
3. Never import `axios` outside `src/lib/axiosClient.ts`; never hardcode a
   colour outside `tokens.css`; use logical properties so RTL keeps working.
4. Run `npm run build` (type-check + bundle) before committing.
5. Do not commit `.env`, secrets, `dist/` noise or lockfile churn from
   unrelated upgrades.
6. Use Conventional Commits (`feat:`, `fix:`, `style:`, `docs:`, `chore:`).

## 16. License

No `LICENSE` file exists in this repository. The companion backend declares
MIT in its `composer.json`; add an authoritative license file before
distributing either package.
