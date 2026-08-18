// user-menu-lens.test.jsx — BUG-2033
// (1) Under an active view-as lens the user menu renders the TARGET's
//     identity with a visible lens indicator — never the operator's name,
//     email, photo, or title blended with the target's role.
// (2) The operator's sign-in emails and Other Accounts never render inside
//     a lensed shell (AccountSwitcher hard-guards on viewing_as).
// (3) The role Swap control gates on the same permission basis as
//     Manage-in-Portal-Manager.
// (4) Sign-in emails display rule: Primary + addresses used to sign in in
//     the last 90 days render by default; the rest collapse behind
//     "Show all (N)".
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout.tsx'
import { AccountSwitcher } from '../AccountSwitcher.tsx'


function operatorFields() {
  return {
    ok: true,
    user_id: 'usr_aaron',
    email: 'aaron@sprintmode.ai',
    name: 'Aaron Hall',
    title: 'CAIO',
    role: 'platform_ops',
    portal_role: 'platform_ops',
    role_display_name: 'Platform Ops',
    portals: { admin: { access: true, view_as: 'both' } },
    permissions: { dashboard: { view: true } },
    emails: [
      { email: 'aaron@sprintmode.ai', is_primary: true },
      { email: 'aaron@codepwr.com', is_primary: false },
    ],
  }
}

// A TEAM lens: viewing_as.email carries the OPERATOR's email (the serializer
// echoes session.email for team/'both' lenses) — the menu must not render it.
function teamLensSession() {
  return Object.assign(operatorFields(), {
    viewing_as: {
      user_id: 'usr_nikola',
      contact_id: '',
      email: 'aaron@sprintmode.ai',
      name: 'Nikola Dulovic',
      company_id: null,
      company_name: '',
      lens: 'team',
      portal: 'admin',
      effective_role: 'platform_ops',
    },
  })
}

function customerLensSession() {
  return Object.assign(operatorFields(), {
    role: 'owner',
    portal_role: 'owner',
    role_display_name: 'Owner',
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
  })
}

function renderLayout(session) {
  return render(
    React.createElement(MemoryRouter, null,
      React.createElement(Layout, {
        session: session,
        portalSubdomain: 'admin',
        title: 'Sprint Mode Admin',
        viewAsEnabled: true,
      }, React.createElement('div', null, 'PAGE')))
  )
}

function openMenu(container) {
  fireEvent.click(container.querySelector('.shell-header-avatar'))
}

function meResponse(extra) {
  // AccountSwitcher fetches a fresh /auth/me — echo the same lens/email data.
  return Promise.resolve({ ok: true, status: 200, json: function() { return Promise.resolve(extra) } })
}

function stubFetchWithMe(me) {
  vi.stubGlobal('fetch', vi.fn(function(url) {
    var u = String(url)
    if (u.indexOf('/auth/me') !== -1) return meResponse(me)
    if (u.indexOf('/api/auth/linked-accounts') !== -1) {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true, data: { accounts: [
        { user_id: 'usr_aaron', display_name: 'Aaron Hall', email: 'aaron@sprintmode.ai', photo_url: null, is_current: true, portals: [] },
        { user_id: 'usr_personal', display_name: 'Aaron Personal', email: 'aaronmhall@gmail.com', photo_url: null, is_current: false, portals: [{ subdomain: 'signal', name: 'Signal', brand_color: null, brand_tint: null, logo_mark_url: null, custom_domain: null }] },
      ] } }) } })
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ ok: true }) } })
  }))
}

beforeEach(function() {
  vi.restoreAllMocks()
})

describe('lensed user menu identity (BUG-2033 items 1 + 2)', function() {
  it('team lens: renders the TARGET name + lens indicator; never the operator name, email, or title', async function() {
    var s = teamLensSession()
    stubFetchWithMe(s)
    var r = renderLayout(s)
    openMenu(r.container)
    // Target identity renders (collapsed pill shows first name; expanded shows full name)
    expect(screen.getAllByText(/Nikola/).length).toBeGreaterThan(0)
    expect(screen.getByText('Viewing as')).toBeInTheDocument()
    // Operator identity never renders inside the menu: name, title, or email.
    // (The team-lens serializer echoes the OPERATOR email in viewing_as.email —
    // the menu must not print it.)
    var menu = r.container.querySelector('.shell-header-avatar').parentElement
    expect(menu.textContent).not.toContain('Aaron')
    expect(menu.textContent).not.toContain('CAIO')
    expect(menu.textContent).not.toContain('aaron@sprintmode.ai')
  })

  it('customer lens: renders the target name and the TARGET email (genuinely theirs)', async function() {
    var s = customerLensSession()
    stubFetchWithMe(s)
    var r = renderLayout(s)
    openMenu(r.container)
    expect(screen.getAllByText(/Claire Fontaine/).length).toBeGreaterThan(0)
    var menu = r.container.querySelector('.shell-header-avatar').parentElement
    expect(menu.textContent).toContain('claire@northwind.example')
    expect(menu.textContent).not.toContain('aaron@sprintmode.ai')
  })

  it('lensed menu never renders Sign-in emails, Other accounts, Swap, or View Profile', async function() {
    var s = teamLensSession()
    stubFetchWithMe(s)
    var r = renderLayout(s)
    openMenu(r.container)
    await waitFor(function() {
      expect(screen.queryByText('Sign-in emails')).toBeNull()
    })
    expect(screen.queryByText('Other accounts')).toBeNull()
    expect(screen.queryByText('Swap')).toBeNull()
    expect(screen.queryByText('View Profile')).toBeNull()
    expect(r.container.textContent).not.toContain('aaron@codepwr.com')
    expect(r.container.textContent).not.toContain('aaronmhall@gmail.com')
  })

  it('unlensed menu still renders the operator identity and sections', async function() {
    var s = operatorFields()
    stubFetchWithMe(s)
    var r = renderLayout(s)
    openMenu(r.container)
    expect(screen.getAllByText(/Aaron/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Viewing as')).toBeNull()
    // I-29 menu cleanup: Sign-in emails moved to the profile page; the menu
    // must not render the section even unlensed.
    await waitFor(function() {
      expect(screen.getByText('aaron@sprintmode.ai')).toBeInTheDocument()
    })
    expect(screen.queryByText('Sign-in emails')).toBeNull()
    expect(screen.queryByText('Link an email')).toBeNull()
  })

  it('AccountSwitcher hard-guards: renders null when the fresh /auth/me carries viewing_as, even if the shell session does not', async function() {
    // Simulates a stale shell prop: the host passed an unlensed session but
    // the live cookie has a lens — the fresh fetch must still suppress.
    var stale = operatorFields()
    var lensedMe = teamLensSession()
    stubFetchWithMe(lensedMe)
    var r = render(React.createElement(AccountSwitcher, { product: 'admin', session: stale }))
    await waitFor(function() {
      expect(r.container.textContent).not.toContain('aaron@codepwr.com')
      expect(screen.queryByText('Sign-in emails')).toBeNull()
    })
  })
})

describe('role Swap permission gate (BUG-2033 item 3)', function() {
  function withRoles(perms) {
    return Object.assign(operatorFields(), {
      permissions: perms,
      my_roles: [
        { role: 'platform_ops', display_name: 'Platform Ops', is_default: true, is_active: true },
        { role: 'support', display_name: 'Support', is_default: false, is_active: false },
      ],
    })
  }

  it('no portal_manager edit -> role list renders, Swap does not', async function() {
    var s = withRoles({ dashboard: { view: true } })
    stubFetchWithMe(s)
    render(React.createElement(AccountSwitcher, { product: 'admin', session: s }))
    await waitFor(function() { expect(screen.getByText('Support')).toBeInTheDocument() })
    expect(screen.queryByText('Swap')).toBeNull()
    expect(screen.queryByText(/Manage in Portal Manager/)).toBeNull()
  })

  it('portal_manager edit -> Swap renders on non-active roles', async function() {
    var s = withRoles({ 'portal_manager.portal_manager': { edit: true } })
    stubFetchWithMe(s)
    render(React.createElement(AccountSwitcher, { product: 'admin', session: s }))
    await waitFor(function() { expect(screen.getByText('Swap')).toBeInTheDocument() })
    expect(screen.getByText(/Manage in Portal Manager/)).toBeInTheDocument()
  })

  it('super_admin bypass -> Swap renders', async function() {
    var s = withRoles({})
    s.role = 'super_admin'
    stubFetchWithMe(s)
    render(React.createElement(AccountSwitcher, { product: 'admin', session: s }))
    await waitFor(function() { expect(screen.getByText('Swap')).toBeInTheDocument() })
  })
})

// I-29 menu cleanup (Aaron ruling 2026-08-18): the sign-in emails 90-day
// display-rule tests were removed with the menu section itself. The managed
// Sign-in emails surface lives on the profile page (ProfileCard, UX-1943).
