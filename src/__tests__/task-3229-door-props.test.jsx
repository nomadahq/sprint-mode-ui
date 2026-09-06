// task-3229-door-props.test.jsx — TASK-3229 (D2 one door shape)
//
// Covers the Done-when regression contract: Layout threads authBase/apiBase
// to AccountSwitcher and to the view-as base; AccountSwitcher honors an
// explicit authBase/apiBase on every host, routing through the portal's own
// proxy instead of api.sprintmode.ai; and a portal that passes NONE of the
// new props gets byte-identical v1.2.3 behavior.

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout.tsx'
import { AccountSwitcher } from '../AccountSwitcher.tsx'

function makeSession() {
  return {
    ok: true,
    user_id: 'usr_aaron',
    email: 'aaron@sprintmode.ai',
    name: 'Aaron Hall',
    role: 'super_admin',
    portal_role: 'super_admin',
    portals: { admin: { access: true } },
    permissions: { dashboard: { view: true } },
  }
}

function lensSession() {
  return {
    ok: true,
    email: 'aaron@sprintmode.ai',
    name: 'Aaron',
    role: 'member',
    portal_role: 'member',
    portals: { admin: { access: true, view_as: 'both' } },
    permissions: { dashboard: { view: true } },
    viewing_as: {
      user_id: 'usr_claire',
      contact_id: 'ct_claire',
      email: 'claire@northwind.example',
      name: 'Claire Fontaine',
      company_id: 'co_northwind',
      company_name: 'Northwind Ops',
      lens: 'customer',
      portal: 'admin',
      effective_role: 'owner',
    },
  }
}

function meAndLinkedAccountsPayload() {
  return {
    me: {
      ok: true,
      user_id: 'usr_aaron',
      email: 'aaron@sprintmode.ai',
      name: 'Aaron Hall',
      role: 'super_admin',
      portal_role: 'super_admin',
      permissions: { dashboard: { view: true } },
      my_roles: [{ role: 'super_admin', display_name: 'Super Admin', is_default: true, is_active: true }],
    },
    linked: {
      ok: true,
      data: { accounts: [{ user_id: 'usr_aaron', display_name: 'Aaron Hall', email: 'aaron@sprintmode.ai', photo_url: null, is_current: true, portals: [] }] },
    },
  }
}

function mockFetchCapturing(calls) {
  var payload = meAndLinkedAccountsPayload()
  return vi.spyOn(window, 'fetch').mockImplementation(function(url) {
    var u = url.toString()
    calls.push(u)
    if (u.indexOf('/auth/me') !== -1) {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve(payload.me) } })
    }
    if (u.indexOf('/auth/linked-accounts') !== -1) {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve(payload.linked) } })
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: false }) } })
  })
}

function setHostname(hostname) {
  Object.defineProperty(window, 'location', {
    value: Object.assign({}, window.location, { hostname: hostname }),
    writable: true,
  })
}

var ORIGINAL_LOCATION = window.location

afterEach(function() {
  Object.defineProperty(window, 'location', { value: ORIGINAL_LOCATION, writable: true })
  vi.restoreAllMocks()
})

// ── 1. Layout threads authBase/apiBase to AccountSwitcher, and to the
//       view-as base when viewAsAuthBase is absent ─────────────────────────

describe('Layout threads authBase/apiBase (TASK-3229)', function() {
  it('passes authBase and apiBase through to AccountSwitcher (both reach the fetch layer)', async function() {
    var calls = []
    mockFetchCapturing(calls)
    render(
      React.createElement(MemoryRouter, null,
        React.createElement(Layout, { session: makeSession(), portalSubdomain: 'admin-t1', title: 'Admin', authBase: '/api', apiBase: '' },
          React.createElement('div', null, 'PAGE')
        )
      )
    )
    fireEvent.click(document.querySelector('.shell-header-avatar'))
    await waitFor(function() {
      expect(calls.some(function(u) { return u === '/api/auth/me'; })).toBe(true)
    })
    expect(calls.some(function(u) { return u === '/api/auth/linked-accounts'; })).toBe(true)
    // Never reaches api.sprintmode.ai directly once authBase/apiBase are passed
    expect(calls.some(function(u) { return u.indexOf('api.sprintmode.ai') !== -1; })).toBe(false)
  })

  it('uses authBase as the view-as base (Exit POSTs authBase + /auth/exit-view-as) when viewAsAuthBase is not passed', async function() {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url.toString(), opts: opts })
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true }) } })
    }))
    render(
      React.createElement(MemoryRouter, null,
        React.createElement(Layout, {
          session: lensSession(), portalSubdomain: 'admin', title: 'Sprint Mode Admin',
          viewAsEnabled: true, authBase: '/api', apiBase: '',
        },
          React.createElement('div', null, 'PAGE')
        )
      )
    )
    fireEvent.click(screen.getByText('Exit'))
    await waitFor(function() {
      expect(calls.some(function(c) { return c.url === '/api/auth/exit-view-as' && c.opts.method === 'POST'; })).toBe(true)
    })
    // never falls back to the direct sm-api host once authBase is passed
    expect(calls.some(function(c) { return c.url.indexOf('api.sprintmode.ai') !== -1; })).toBe(false)
  })

  it('viewAsAuthBase still wins over authBase when both are passed (precedence order)', async function() {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url.toString(), opts: opts })
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true }) } })
    }))
    render(
      React.createElement(MemoryRouter, null,
        React.createElement(Layout, {
          session: lensSession(), portalSubdomain: 'admin', title: 'Sprint Mode Admin',
          viewAsEnabled: true, authBase: '/api', apiBase: '', viewAsAuthBase: '/vas',
        },
          React.createElement('div', null, 'PAGE')
        )
      )
    )
    fireEvent.click(screen.getByText('Exit'))
    await waitFor(function() {
      expect(calls.some(function(c) { return c.url === '/vas/auth/exit-view-as'; })).toBe(true)
    })
  })
})

// ── 2. AccountSwitcher honors an explicit authBase/apiBase on every host ───

describe('AccountSwitcher explicit authBase/apiBase on a *.sprintmode.ai host (TASK-3229)', function() {
  it('fetches /api/auth/me-style same-origin URLs and never api.sprintmode.ai', async function() {
    setHostname('admin.sprintmode.ai')
    var calls = []
    mockFetchCapturing(calls)
    render(React.createElement(AccountSwitcher, { product: 'admin-t2', session: makeSession(), authBase: '/api', apiBase: '' }))
    await waitFor(function() {
      expect(calls.length).toBeGreaterThan(0)
    })
    expect(calls).toContain('/api/auth/me')
    expect(calls).toContain('/api/auth/linked-accounts')
    expect(calls.some(function(u) { return u.indexOf('api.sprintmode.ai') !== -1; })).toBe(false)
  })
})

// ── 3. Regression: no new props => byte-identical v1.2.3 behavior ─────────

describe('Regression: default (no authBase/apiBase) is unchanged (TASK-3229)', function() {
  it('on a *.sprintmode.ai host with no props, /auth/me is called directly on api.sprintmode.ai (v1.2.3 default)', async function() {
    setHostname('admin.sprintmode.ai')
    var calls = []
    mockFetchCapturing(calls)
    render(React.createElement(AccountSwitcher, { product: 'admin-t3', session: makeSession() }))
    await waitFor(function() {
      expect(calls.length).toBeGreaterThan(0)
    })
    expect(calls).toContain('https://api.sprintmode.ai/auth/me')
    // linked-accounts always goes through apiBase (default ''), unaffected by authBase
    expect(calls).toContain('/api/auth/linked-accounts')
  })

  it('off *.sprintmode.ai with no props, identity reads go through the same-origin proxy path (v1.2.3 default)', async function() {
    setHostname('safeshepherd.pages.dev')
    var calls = []
    mockFetchCapturing(calls)
    render(React.createElement(AccountSwitcher, { product: 'admin-t4', session: makeSession() }))
    await waitFor(function() {
      expect(calls.length).toBeGreaterThan(0)
    })
    expect(calls).toContain('/api/auth/me')
    expect(calls.some(function(u) { return u.indexOf('api.sprintmode.ai') !== -1; })).toBe(false)
  })

  it('Layout with no new props keeps the view-as base at https://api.sprintmode.ai (v1.2.3 default)', async function() {
    setHostname('admin.sprintmode.ai')
    var calls = []
    mockFetchCapturing(calls)
    render(
      React.createElement(MemoryRouter, null,
        React.createElement(Layout, { session: makeSession(), portalSubdomain: 'admin-t5', title: 'Admin' },
          React.createElement('div', null, 'PAGE')
        )
      )
    )
    fireEvent.click(document.querySelector('.shell-header-avatar'))
    await waitFor(function() {
      expect(calls).toContain('https://api.sprintmode.ai/auth/me')
    })
  })

  it('Exit still POSTs to https://api.sprintmode.ai/auth/exit-view-as when no authBase/viewAsAuthBase is passed (v1.2.3 default)', async function() {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url.toString(), opts: opts })
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true }) } })
    }))
    render(
      React.createElement(MemoryRouter, null,
        React.createElement(Layout, {
          session: lensSession(), portalSubdomain: 'admin', title: 'Sprint Mode Admin', viewAsEnabled: true,
        },
          React.createElement('div', null, 'PAGE')
        )
      )
    )
    fireEvent.click(screen.getByText('Exit'))
    await waitFor(function() {
      expect(calls.some(function(c) { return c.url === 'https://api.sprintmode.ai/auth/exit-view-as' && c.opts.method === 'POST'; })).toBe(true)
    })
  })
})
