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
      expect(screen.getByText('Roles')).toBeInTheDocument()
    })
    var all = document.body.textContent || ''
    var nsIdx = all.indexOf('Notification Settings')
    var mcpIdx = all.indexOf('MCP Keys')
    var rolesIdx = all.indexOf('Roles')
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
    // Wait for linked accounts to load
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
