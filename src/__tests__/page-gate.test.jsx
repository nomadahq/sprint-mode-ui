// page-gate.test.jsx — PORTAL-RBAC-SHELLS (square 1647)
// PageGate semantics: canViewSection pass-through + explicit-parent deny.
// The empty-permissions cases pin the FLIPPED deny-default behavior; the
// deny-flip PR (decision RBAC-SMUI-DENY-FLIP) will amend those two tests.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageGate, canViewPage } from '../PageGate.tsx'
import { parsePerms } from '../Layout.tsx'

function sess(role, permissions) {
  return { ok: true, role: role, permissions: permissions }
}

describe('canViewPage', () => {
  it('allows a granted key', () => {
    var perms = parsePerms(sess('owner', { 'signal.people': { view: true } }))
    expect(canViewPage(perms, 'owner', 'signal.people')).toBe(true)
  })

  it('denies an explicitly denied key', () => {
    var perms = parsePerms(sess('member', { 'signal.people': { view: false }, 'signal.dashboard': { view: true } }))
    expect(canViewPage(perms, 'member', 'signal.people')).toBe(false)
  })

  it('denies a key missing from an otherwise-populated row', () => {
    var perms = parsePerms(sess('member', { 'signal.dashboard': { view: true } }))
    expect(canViewPage(perms, 'member', 'signal.people')).toBe(false)
  })

  it('inherits an allowed bare parent for a missing namespaced key', () => {
    var perms = parsePerms(sess('member', { studios: { view: true } }))
    expect(canViewPage(perms, 'member', 'studios.meetings')).toBe(true)
  })

  it('a granted child key wins over an explicitly denied same-prefix key (namespace, not hierarchy)', () => {
    // Live studios model: bare `studios` = SM-internal section, denied to
    // customers; `studios.billing` = customer page they hold a grant for.
    var perms = parsePerms(sess('member', { studios: { view: false }, 'studios.billing': { view: true } }))
    expect(canViewPage(perms, 'member', 'studios.billing')).toBe(true)
  })

  it('an explicitly denied same-prefix key still denies a MISSING child (inheritance)', () => {
    var perms = parsePerms(sess('member', { studios: { view: false }, dashboard: { view: true } }))
    expect(canViewPage(perms, 'member', 'studios.meetings')).toBe(false)
  })

  it('super_admin always passes', () => {
    expect(canViewPage(null, 'super_admin', 'anything.at_all')).toBe(true)
  })

  it('CURRENT default: null permissions (session not loaded) allows', () => {
    expect(canViewPage(null, 'member', 'signal.people')).toBe(true)
  })

  it('FLIPPED default: empty permissions object DENIES (RBAC-SMUI-DENY-FLIP, square 1647)', () => {
    var perms = parsePerms(sess('member', {}))
    // parsePerms returns { sections: {} } — the empty-object branch.
    // An empty record post-flip means misconfigured/revoked, not legacy:
    // every live role row was verified complete before this shipped.
    expect(canViewPage(perms, 'member', 'signal.people')).toBe(false)
  })

  it('FLIPPED default: null permissions (session not loaded) still allows — flash-of-allow, never lockout', () => {
    expect(canViewPage(null, 'member', 'signal.people')).toBe(true)
  })
})

describe('PageGate component', () => {
  it('renders children when granted (explicit session prop)', () => {
    render(
      <PageGate permKey="signal.people" session={sess('owner', { 'signal.people': { view: true } })}>
        <div data-testid="page-content">People</div>
      </PageGate>
    )
    expect(screen.getByTestId('page-content')).toBeTruthy()
    expect(screen.queryByTestId('page-gate-denied')).toBeNull()
  })

  it('renders the denied panel when the key is denied', () => {
    render(
      <PageGate permKey="signal.people" session={sess('member', { 'signal.people': { view: false } })}>
        <div data-testid="page-content">People</div>
      </PageGate>
    )
    expect(screen.queryByTestId('page-content')).toBeNull()
    expect(screen.getByTestId('page-gate-denied')).toBeTruthy()
    expect(screen.getByText('Section not available')).toBeTruthy()
  })

  it('renders a custom fallback when provided', () => {
    render(
      <PageGate
        permKey="signal.people"
        session={sess('member', { 'signal.people': { view: false } })}
        fallback={<div data-testid="custom-fallback">nope</div>}
      >
        <div data-testid="page-content">People</div>
      </PageGate>
    )
    expect(screen.getByTestId('custom-fallback')).toBeTruthy()
    expect(screen.queryByTestId('page-gate-denied')).toBeNull()
  })

  it('accepts string permissions JSON (session.permissions as string)', () => {
    render(
      <PageGate permKey="mode.discovery" session={sess('member', JSON.stringify({ 'mode.discovery': { view: true } }))}>
        <div data-testid="page-content">Discovery</div>
      </PageGate>
    )
    expect(screen.getByTestId('page-content')).toBeTruthy()
  })

  it('super_admin renders children regardless of rows', () => {
    render(
      <PageGate permKey="waffle.anything" session={sess('super_admin', {})}>
        <div data-testid="page-content">SA</div>
      </PageGate>
    )
    expect(screen.getByTestId('page-content')).toBeTruthy()
  })
})
