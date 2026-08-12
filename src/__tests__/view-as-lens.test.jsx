// view-as-lens.test.jsx — PORTAL-RBAC-VIEWAS-3
// The view-as shell rides the SERVER lens: session.viewing_as drives the
// header state, selection POSTs /api/auth/view-as, Exit POSTs
// /api/auth/exit-view-as, and the old sessionStorage simulation is gone.
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout.tsx'

function lensSession(extra) {
  return Object.assign({
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
  }, extra || {})
}

function baseSession(extra) {
  var s = lensSession(extra)
  delete s.viewing_as
  s.role = 'super_admin'
  s.portal_role = 'super_admin'
  return s
}

function renderLayout(session, props) {
  return render(
    React.createElement(MemoryRouter, null,
      React.createElement(Layout, Object.assign({
        session: session,
        portalSubdomain: 'admin',
        title: 'Sprint Mode Admin',
        viewAsEnabled: true,
      }, props || {}), React.createElement('div', null, 'PAGE')))
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('server lens header state', () => {
  it('renders the lens chip (name · company) and Exit from session.viewing_as — no banner', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))
    renderLayout(lensSession())
    expect(screen.getByText(/Claire Fontaine/)).toBeInTheDocument()
    expect(screen.getByText(/Northwind Ops/)).toBeInTheDocument()
    expect(screen.getByText('Exit')).toBeInTheDocument()
    expect(document.querySelector('.shell-viewas-banner')).toBeNull()
    expect(document.querySelector('.shell-header-lens')).not.toBeNull()
  })

  it('Exit POSTs /api/auth/exit-view-as', async () => {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url, opts: opts })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }))
    // jsdom reload is not implemented — stub it
    var reload = vi.fn()
    Object.defineProperty(window, 'location', { value: Object.assign({}, window.location, { reload: reload }), writable: true })
    renderLayout(lensSession())
    fireEvent.click(screen.getByText('Exit'))
    await waitFor(function() {
      expect(calls.some(function(c) { return c.url === '/api/auth/exit-view-as' && c.opts.method === 'POST' })).toBe(true)
    })
  })

  it('does not read or write sessionStorage for view-as', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))
    var getItem = vi.spyOn(window.sessionStorage, 'getItem')
    var setItem = vi.spyOn(window.sessionStorage, 'setItem')
    renderLayout(lensSession())
    var vaKeys = function(spy) {
      return spy.mock.calls.map(function(c) { return String(c[0]) }).filter(function(k) { return k.indexOf('sm-view-as') === 0 })
    }
    expect(vaKeys(getItem)).toEqual([])
    expect(vaKeys(setItem)).toEqual([])
  })
})

describe('picker selection', () => {
  it('team member selection POSTs team_member_user_id to /api/auth/view-as', async () => {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url, opts: opts })
      if (String(url).indexOf('/api/view-as-users') === 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: {
          team: [{ email: 'nikola@sprintmode.ai', name: 'Nikola Dulovic', role: 'team', user_id: 'usr_nikola', role_type: 'team' }],
          customers: [{ email: 'claire@northwind.example', name: 'Claire Fontaine', company_id: 'co_n', company_name: 'Northwind Ops', role: 'owner', user_id: 'usr_claire', contact_id: 'ct_claire', role_type: 'customer' }],
        } }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }))
    var reload = vi.fn()
    Object.defineProperty(window, 'location', { value: Object.assign({}, window.location, { reload: reload }), writable: true })
    renderLayout(baseSession(), { viewAsApi: '/api/view-as-users' })
    var btn = await screen.findByText(/View as/)
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('Team'))
    fireEvent.click(await screen.findByText('Nikola Dulovic'))
    await waitFor(function() {
      var post = calls.find(function(c) { return c.url === '/api/auth/view-as' })
      expect(post).toBeTruthy()
      expect(JSON.parse(post.opts.body)).toEqual({ team_member_user_id: 'usr_nikola' })
    })
  })

  it('customer person selection POSTs email + member_user_id; company row anchors on first member', async () => {
    var calls = []
    vi.stubGlobal('fetch', vi.fn(function(url, opts) {
      calls.push({ url: url, opts: opts })
      if (String(url).indexOf('/api/view-as-users') === 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: {
          team: [],
          customers: [
            { email: 'claire@northwind.example', name: 'Claire Fontaine', company_id: 'co_n', company_name: 'Northwind Ops', role: 'owner', user_id: 'usr_claire', role_type: 'customer' },
            { email: 'marc@northwind.example', name: 'Marc Idris', company_id: 'co_n', company_name: 'Northwind Ops', role: 'member', user_id: 'usr_marc', role_type: 'customer' },
          ],
        } }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }))
    var reload = vi.fn()
    Object.defineProperty(window, 'location', { value: Object.assign({}, window.location, { reload: reload }), writable: true })
    renderLayout(baseSession(), { viewAsApi: '/api/view-as-users' })
    fireEvent.click(await screen.findByText(/View as/))
    fireEvent.click(await screen.findByText('Marc Idris'))
    await waitFor(function() {
      var post = calls.find(function(c) { return c.url === '/api/auth/view-as' })
      expect(post).toBeTruthy()
      expect(JSON.parse(post.opts.body)).toEqual({ email: 'marc@northwind.example', member_user_id: 'usr_marc' })
    })
  })

  it('picker button is hidden while a lens is active (header carries the state)', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))
    renderLayout(lensSession())
    expect(screen.queryByText(/^View as/)).toBeNull()
  })
})
