import assert from 'node:assert/strict'
import test from 'node:test'
import { isSafeInternalRedirect, resolveAuthDestination } from '../src/lib/authDestination.ts'

function session(overrides = {}) {
  return {
    user: {
      id: 1,
      name: 'Merchant',
      email: 'merchant@example.test',
      status: 'active',
      is_platform_user: false,
      is_super_admin: false,
    },
    active_tenant: null,
    tenants: [],
    roles: [],
    permissions: [],
    permission_catalogue: {},
    ...overrides,
  }
}

const tenant = {
  id: 10,
  name: 'Baker Street',
  slug: 'baker-street',
  status: 'active',
  is_active: true,
  currency: 'USD',
  timezone: 'UTC',
  locale: 'en',
}

test('no session lands on sign-in', () => {
  assert.deepEqual(resolveAuthDestination(null), { name: 'auth.login' })
})

test('an invited account is held at the account-status page', () => {
  const result = resolveAuthDestination(
    session({
      user: {
        id: 1,
        name: 'Invitee',
        email: 'invitee@example.test',
        status: 'invited',
        is_platform_user: false,
        is_super_admin: false,
      },
      active_tenant: tenant,
      tenants: [tenant],
      permissions: ['dashboard.view'],
    }),
  )

  assert.deepEqual(result, { name: 'account.status', query: { status: 'invited' } })
})

test('a suspended account is held at the account-status page', () => {
  const result = resolveAuthDestination(
    session({
      user: {
        id: 1,
        name: 'Suspended',
        email: 'suspended@example.test',
        status: 'suspended',
        is_platform_user: false,
        is_super_admin: false,
      },
    }),
  )

  assert.deepEqual(result, { name: 'account.status', query: { status: 'suspended' } })
})

test('a platform operator lands on the platform overview', () => {
  const result = resolveAuthDestination(
    session({
      user: {
        id: 1,
        name: 'Operator',
        email: 'ops@example.test',
        status: 'active',
        is_platform_user: true,
        is_super_admin: true,
      },
      active_tenant: tenant,
      tenants: [tenant],
      permissions: ['dashboard.view'],
    }),
  )

  assert.deepEqual(result, { name: 'platform.dashboard' })
})

test('a merchant with dashboard permission lands on the workspace dashboard', () => {
  const result = resolveAuthDestination(
    session({ active_tenant: tenant, tenants: [tenant], permissions: ['dashboard.view'] }),
  )

  assert.deepEqual(result, { name: 'dashboard.index' })
})

test('an employee without dashboard permission lands on the first section they can open', () => {
  const result = resolveAuthDestination(
    session({ active_tenant: tenant, tenants: [tenant], permissions: ['orders.view'] }),
  )

  assert.deepEqual(result, { name: 'orders.index' })
})

test('a member with no operational permissions still reaches their profile', () => {
  const result = resolveAuthDestination(
    session({ active_tenant: tenant, tenants: [tenant], permissions: [] }),
  )

  assert.deepEqual(result, { name: 'profile.index' })
})

test('an active account with no workspace goes to onboarding', () => {
  assert.deepEqual(resolveAuthDestination(session()), { name: 'onboarding' })
})

test('a merchant whose only workspace is suspended sees the workspace status page', () => {
  const suspended = { ...tenant, status: 'suspended', is_active: false }
  const result = resolveAuthDestination(session({ tenants: [suspended] }))

  assert.deepEqual(result, {
    name: 'account.status',
    query: { status: 'tenant-suspended' },
  })
})

test('an active workspace reported as suspended is never routed into', () => {
  const suspended = { ...tenant, status: 'suspended', is_active: false }
  const result = resolveAuthDestination(
    session({ active_tenant: suspended, tenants: [suspended], permissions: ['dashboard.view'] }),
  )

  assert.deepEqual(result, {
    name: 'account.status',
    query: { status: 'tenant-suspended' },
  })
})

test('only same-origin paths survive redirect validation', () => {
  assert.equal(isSafeInternalRedirect('/orders?page=2'), true)
  assert.equal(isSafeInternalRedirect('https://evil.example'), false)
  assert.equal(isSafeInternalRedirect('//evil.example'), false)
  assert.equal(isSafeInternalRedirect('/\\evil.example'), false)
  assert.equal(isSafeInternalRedirect('/login\nLocation: https://evil.example'), false)
  assert.equal(isSafeInternalRedirect(null), false)
})
