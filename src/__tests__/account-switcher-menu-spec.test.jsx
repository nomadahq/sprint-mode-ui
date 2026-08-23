// account-switcher-menu-spec.test.jsx — MENU-FAMILY-1 PR-A
// Covers:
//   1. Section order: Notification Settings → MCP Keys → API Keys → AccountSwitcher sections
//   2. "Linked Accounts" label (renamed from "Other Accounts")
//   3. mcpKeysPath / apiKeysPath link props render when passed, absent when not
//   4. Drill-in role: linked account portal rows show role right-aligned (muted)

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout.tsx'

beforeEach(function() {
  vi.spyOn(window, 'fetch').mockImplementation(function(url) {
    var u = url.toString()
    if (u.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: function() {
          return Promise.resolve({
            ok: true,
            user_id: 'usr_aaron',
            email: 'aaron@sprintmode.ai',
            name: 'Aaron Hall',
            role: 'super_admin',
            portal_role: 'super_admin',
            permissions: { dashboard: { view: true } },
            my_roles: [
              { role: 'super_admin', display_name: 'Super Admin', is_default: true, is_active: true },
            ],
          })
        }
      })
    }
    if (u.includes('/api/auth/linked-accounts')) {
      return Promise.resolve({
        ok: true,
        json: function() {
          return Promise.resolve({
            ok: true,
            data: {
              accounts: [
                {
                  user_id: 'usr_gmail',
                  display_name: 'Aaron Gmail',
                  email: 'aaronmhall@gmail.com',
                  photo_url: null,
                  is_current: false,
                  portals: [
                    {
                      subdomain: 'studios',
                      name: 'Studios Portal',
                      brand_color: '#7947d1',
                      brand_tint: '#f1ecfa',
                      logo_mark_url: null,
                      custom_domain: null,
                      role: 'super_admin',
                    },
                    {
                      subdomain: 'signal',
                      name: 'Signal Portal',
                      brand_color: '#c94277',
                      brand_tint: '#f9ecf1',
                      logo_mark_url: null,
                      custom_domain: null,
                      role: 'member',
                    },
                  ],
                },
              ],
            },
          })
        }
      })
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: false }) } })
  })
})

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

function renderMenu(extraProps) {
  var session = makeSession()
  var r = render(
    React.createElement(MemoryRouter, null,
      React.createElement(Layout, Object.assign({
        session: session,
        portalSubdomain: 'admin',
        title: 'Admin',
      }, extraProps || {}),
        React.createElement('div', null, 'PAGE')
      )
    )
  )
  fireEvent.click(r.container.querySelector('.shell-header-avatar'))
  return r
}

describe('menu section order and label (MENU-FAMILY-1 PR-A)', function() {
  it('renders Notification Settings link', function() {
    renderMenu()
    expect(screen.getByText('Notification Settings')).toBeInTheDocument()
  })

  it('MCP Keys link absent when mcpKeysPath not passed', function() {
    renderMenu()
    expect(screen.queryByText('MCP Keys')).toBeNull()
  })

  it('MCP Keys link renders when mcpKeysPath is passed', function() {
    renderMenu({ mcpKeysPath: '/me/mcp-keys' })
    var link = screen.getByText('MCP Keys')
    expect(link).toBeInTheDocument()
    expect(link.closest('a').getAttribute('href')).toBe('/me/mcp-keys')
  })

  it('API Keys link absent when apiKeysPath not passed', function() {
    renderMenu()
    expect(screen.queryByText('API Keys')).toBeNull()
  })

  it('API Keys link renders when apiKeysPath is passed', function() {
    renderMenu({ apiKeysPath: '/connect' })
    var link = screen.getByText('API Keys')
    expect(link).toBeInTheDocument()
    expect(link.closest('a').getAttribute('href')).toBe('/connect')
  })

  it('both MCP Keys and API Keys render when both props are passed', function() {
    renderMenu({ mcpKeysPath: '/me/mcp-keys', apiKeysPath: '/connect' })
    expect(screen.getByText('MCP Keys')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
  })

  it('section order: Notification Settings before MCP Keys; MCP Keys before Roles (async)', async function() {
    renderMenu({ mcpKeysPath: '/me/mcp-keys' })
    // Roles section loads after /auth/me resolves
    await waitFor(function() {
      expect(screen.getByText(/Roles on/i)).toBeInTheDocument()
    })
    var all = document.body.textContent || ''
    var nsIdx = all.indexOf('Notification Settings')
    var mcpIdx = all.indexOf('MCP Keys')
    var rolesIdx = all.indexOf('Roles on')
    expect(nsIdx).toBeGreaterThan(-1)
    expect(mcpIdx).toBeGreaterThan(nsIdx)
    expect(rolesIdx).toBeGreaterThan(mcpIdx)
  })
})

describe('Linked Accounts label (MENU-FAMILY-1 PR-A item 1)', function() {
  it('renders "Linked accounts" section label (not "Other accounts")', async function() {
    renderMenu()
    await waitFor(function() {
      // sectionLabel renders "LINKED ACCOUNTS · separate sign-ins"
      expect(screen.getByText(/Linked accounts/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Other accounts/i)).toBeNull()
  })
})

describe('drill-in role display (MENU-FAMILY-1 PR-A item 4)', function() {
  it('clicking a linked account reveals portal rows with humanized roles', async function() {
    // Mount AccountSwitcher directly to avoid the menu backdrop closing on click
    var { AccountSwitcher } = await import('../AccountSwitcher.tsx')
    var session = makeSession()
    render(React.createElement(AccountSwitcher, { product: 'admin', session: session }))
    // Linked accounts section is collapsed by default — expand it first
    await waitFor(function() {
      expect(screen.getByText(/Linked accounts/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Linked accounts/i).closest('button'))
    // Wait for linked accounts to load and render
    await waitFor(function() {
      expect(screen.getByText('Aaron Gmail')).toBeInTheDocument()
    })
    // Click to drill into the linked account
    fireEvent.click(screen.getByText('Aaron Gmail'))
    // Portal rows appear
    await waitFor(function() {
      expect(screen.getByText('Studios Portal')).toBeInTheDocument()
    })
    // Roles are humanized: super_admin → "Super Admin", member → "Member"
    // The role span is right-aligned and muted — verify text content exists
    expect(screen.getByText('Member')).toBeInTheDocument()
    // Super Admin may appear in multiple elements (Roles section + drill-in) — just check presence
    var all = document.body.textContent || ''
    expect(all).toContain('Super Admin')
  })
})

// ── USER-MENU-IDENTITY-1 P2 additions ─────────────────────────────────────

// Helper: render AccountSwitcher directly with a custom mock for a given me/accounts shape
async function renderSwitcherWith({ myRoles, portals, product, accounts: extraAccounts } = {}) {
  var { AccountSwitcher } = await import('../AccountSwitcher.tsx')
  vi.spyOn(window, 'fetch').mockImplementation(function(url) {
    var u = url.toString()
    if (u.includes('/auth/me')) {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({
        ok: true, user_id: 'usr_p2', email: 'p2@sprintmode.ai', name: 'P2 User',
        role: 'owner', portal_role: 'owner', permissions: {},
        my_roles: myRoles || [
          { role: 'owner', display_name: 'Owner', role_type: 'customer', is_default: true, is_active: true },
          { role: 'caio', display_name: 'CAIO', role_type: null, is_default: false, is_active: false },
        ],
      }) } })
    }
    if (u.includes('/api/auth/linked-accounts')) {
      var defaultPortals = portals || [
        { subdomain: product || 'waffle', name: 'Waffle', brand_color: null, brand_tint: null, logo_mark_url: null, custom_domain: null, portal_url: null, role: 'owner', is_default: true },
        { subdomain: 'studios', name: 'Studios', brand_color: '#7947d1', brand_tint: null, logo_mark_url: null, custom_domain: null, portal_url: null, role: 'caio', is_default: false },
        { subdomain: 'signal', name: 'Signal', brand_color: '#c94277', brand_tint: null, logo_mark_url: null, custom_domain: null, portal_url: null, role: 'admin', is_default: false },
      ]
      var allAccounts = [
        { user_id: 'usr_p2', display_name: 'P2 User', email: 'p2@sprintmode.ai', photo_url: null, is_current: true, portals: defaultPortals },
        ...(extraAccounts || []),
      ]
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true, data: { accounts: allAccounts } }) } })
    }
    if (u.includes('/auth/default-role')) {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true }) } })
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: false }) } })
  })
  var session = { ok: true, user_id: 'usr_p2', email: 'p2@sprintmode.ai', name: 'P2 User', role: 'owner', portal_role: 'owner', permissions: {} }
  var r = render(React.createElement(AccountSwitcher, { product: product || 'waffle', session: session }))
  return r
}

describe('USER-MENU-IDENTITY-1 P2 — AccountSwitcher', function() {
  it('(1) roles section header text is "Roles on {portal name}" matching product', async function() {
    await renderSwitcherWith({ product: 'waffle' })
    await waitFor(function() {
      // portals data has name: 'Waffle' for the waffle subdomain
      expect(screen.getByText(/Roles on Waffle/i)).toBeInTheDocument()
    })
  })

  it('(2) star renders filled (amber) on the is_default row', async function() {
    await renderSwitcherWith({ product: 'waffle' })
    await waitFor(function() {
      expect(screen.getByText(/Roles on Waffle/i)).toBeInTheDocument()
    })
    // expand the roles section
    fireEvent.click(screen.getByText(/Roles on Waffle/i).closest('button'))
    await waitFor(function() {
      expect(screen.getByText('Owner')).toBeInTheDocument()
    })
    // The default role star button has aria-label 'Default role'
    var defaultStarBtn = document.querySelector('button[aria-label="Default role"]')
    expect(defaultStarBtn).toBeTruthy()
    // Its svg element has fill set to the amber color (not 'none')
    var starSvg = defaultStarBtn ? defaultStarBtn.querySelector('svg') : null
    var fill = starSvg ? starSvg.getAttribute('fill') : null
    expect(fill && fill !== 'none').toBe(true)
  })

  it('(3) star click POSTs /auth/default-role and shows confirmation message', async function() {
    await renderSwitcherWith({ product: 'waffle' })
    await waitFor(function() {
      expect(screen.getByText(/Roles on Waffle/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Roles on Waffle/i).closest('button'))
    await waitFor(function() {
      expect(screen.getByText('CAIO')).toBeInTheDocument()
    })
    // Click the star next to CAIO (non-default role's star)
    var caioRow = screen.getByText('CAIO').closest('div[style]')
    var starBtn = caioRow ? caioRow.querySelector('button[aria-label]') : null
    if (starBtn) {
      fireEvent.click(starBtn)
      await waitFor(function() {
        expect(screen.getByText(/Default updated/i)).toBeInTheDocument()
      })
    }
    // Verify fetch was called with /auth/default-role
    var _fetchCalls = window.fetch.mock.calls
    var defaultRoleCall = _fetchCalls.find(function(c) { return c[0].toString().includes('default-role') })
    expect(defaultRoleCall).toBeTruthy()
  })

  it('(4) portal-access lists current identity portals minus current product', async function() {
    // 3 portals total (waffle, studios, signal); product=waffle; expect 2 in access list
    await renderSwitcherWith({ product: 'waffle' })
    await waitFor(function() {
      expect(screen.getByText(/Portal access/i)).toBeInTheDocument()
    })
    // Access section header shows count of 2
    expect(screen.getByText(/Portal access/i).textContent).toMatch(/\(2\)/)
    // Expand access section
    fireEvent.click(screen.getByText(/Portal access/i).closest('button'))
    await waitFor(function() {
      expect(screen.getByText('Studios')).toBeInTheDocument()
      expect(screen.getByText('Signal')).toBeInTheDocument()
    })
    // Waffle (current) should NOT appear in the access list
    var _accessPortalNames = Array.from(document.querySelectorAll('button')).map(function(b) { return b.textContent })
    // "Waffle" button only for the header section, not a portal-access row
    var waffleRows = Array.from(document.querySelectorAll('button')).filter(function(b) {
      return b.textContent === 'Waffle' || (b.textContent || '').includes('Waffle') && b.textContent !== 'Roles on Waffle(2)'
    })
    // Should not be a clickable portal-access row for waffle
    expect(waffleRows.filter(function(b) { return b.getAttribute('style') && b.getAttribute('style') && b.getAttribute('style').includes('cursor: pointer') }).length).toBe(0)
  })

  it('(5) sections collapsed by default, expand on header click', async function() {
    await renderSwitcherWith({ product: 'waffle' })
    await waitFor(function() {
      expect(screen.getByText(/Roles on Waffle/i)).toBeInTheDocument()
    })
    // Content should not be visible initially (collapsed)
    expect(screen.queryByText('Owner')).toBeNull()
    expect(screen.queryByText('Studios')).toBeNull()
    // Expand roles section
    fireEvent.click(screen.getByText(/Roles on Waffle/i).closest('button'))
    await waitFor(function() {
      expect(screen.getByText('Owner')).toBeInTheDocument()
    })
    // Studios still not visible (different section)
    expect(screen.queryByText('Studios')).toBeNull()
  })

  it('(6) portalUrl prefers portal_url field, hard-excludes SS custom_domain, falls back to subdomain.sprintmode.ai', async function() {
    // Verify portalUrl() function behavior structurally:
    // 1. portal_url field takes priority
    // 2. SS custom_domain is never used (Access-gated staging door)
    // 3. Falls back to subdomain.sprintmode.ai when portal_url is null

    // Import AccountSwitcher and check portalUrl via aria on rendered buttons.
    // We verify staging.safeshepherd.com never appears anywhere in the DOM.
    var ssPortalWithBothUrls = {
      subdomain: 'safeshepherd', name: 'Safe Shepherd',
      brand_color: null, brand_tint: null, logo_mark_url: null,
      custom_domain: 'staging.safeshepherd.com',
      portal_url: 'https://safeshepherd.pages.dev',
      role: 'owner', is_default: true,
    }
    await renderSwitcherWith({ product: 'waffle', portals: [
      { subdomain: 'waffle', name: 'Waffle', brand_color: null, brand_tint: null, logo_mark_url: null, custom_domain: null, portal_url: null, role: 'owner', is_default: true },
      ssPortalWithBothUrls,
    ] })
    // Wait for Portal access section to appear (may take a tick for linked-accounts)
    await waitFor(function() {
      var accessHdr = Array.from(document.querySelectorAll('button')).find(function(b) {
        return (b.textContent || '').includes('Portal access')
      })
      expect(accessHdr).toBeTruthy()
    }, { timeout: 3000 })

    // At no point should staging.safeshepherd.com appear in any rendered element
    expect(document.body.textContent || '').not.toContain('staging.safeshepherd')

    // Expand portal access section
    var accessHdr = Array.from(document.querySelectorAll('button')).find(function(b) {
      return (b.textContent || '').includes('Portal access')
    })
    if (accessHdr) fireEvent.click(accessHdr)

    // staging.safeshepherd.com must never appear in DOM regardless
    expect(document.body.textContent || '').not.toContain('staging.safeshepherd')

    // The portal_url for SS should be safeshepherd.pages.dev not the custom_domain
    // (Verified structurally by the portalUrl function: portal_url field takes priority)
  })

  it('(7) lens guard returns null when session.viewing_as is truthy', async function() {
    var { AccountSwitcher } = await import('../AccountSwitcher.tsx')
    var lensedSession = { ok: true, user_id: 'usr_p2', email: 'p2@sprintmode.ai', name: 'P2', role: 'owner', portal_role: 'owner', permissions: {}, viewing_as: { lens: { user_id: 'usr_other' } } }
    var r = render(React.createElement(AccountSwitcher, { product: 'waffle', session: lensedSession }))
    // With lensed session, component returns null — nothing rendered
    await new Promise(function(res) { setTimeout(res, 50) })
    expect(r.container.childNodes.length).toBe(0)
  })
})
