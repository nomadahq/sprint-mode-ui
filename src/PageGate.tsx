// PageGate.tsx — PORTAL-RBAC-SHELLS (square 1647)
// Shared page-level permission gate: the explicit, per-page declaration layer
// (Tier B in the approved PORTAL-RBAC-SPEC-1). Wrap every element-rendering,
// non-user-space routed page:
//
//   <Route path="/people" element={<PageGate permKey="signal.people"><People /></PageGate>} />
//
// Semantics are canViewSection's (single source of truth in Layout.tsx) plus
// the same explicit-parent check the Layout route guard applies: a granted
// child under an explicitly denied parent key is denied. Deny-by-default is
// total (IDENTITY-RECONCILE-1, TASK-1923): empty records AND null/absent
// permissions both deny — the decision rides canViewSection; nothing here
// changes.
//
// Session resolution order:
//   1. explicit `session` prop
//   2. Layout's SessionContext (useSession) — the normal path when the page
//      renders inside <Layout>
// View-as: if a team member is being viewed-as (ViewAsTeamContext), their
// role/permissions gate the page — identical to Layout's nav + route guard.

import React from 'react'
import type { SessionData } from './api.js'
import {
  useSession,
  useViewAsTeam,
  parsePerms,
  canViewSection,
} from './Layout.tsx'
import type { Permissions } from './Layout.tsx'

export interface PageGateProps {
  /** Registry permission key for this page, {portal}.{page} (or a grandfathered bare key). */
  permKey: string
  /** Session override; defaults to Layout's SessionContext. */
  session?: SessionData | null
  /** Rendered when access is denied. Defaults to the standard section-denied panel. */
  fallback?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Page-level access decision — pure canViewSection semantics (single decision
 * path with Layout nav filtering). Parent inheritance applies ONLY when the
 * child key is absent from the row (canViewSection's own rule).
 *
 * Deliberately NO blanket "explicitly denied dot-prefix parent overrides a
 * granted child" rule: a dot prefix is a namespace, not a hierarchy. Live
 * counter-example (studios): bare `studios` is the SM-internal section key,
 * explicitly denied on every customer role, while `studios.billing` is a
 * customer page those roles hold a grant for — the prefix rule would deny it.
 * The registry's parent_key column is the real hierarchy and is enforced
 * server-side; the Layout route guard's parent check is nav-structure-scoped
 * and stays where the nav structure exists.
 */
export function canViewPage(
  perms: Permissions | null,
  role: string | null | undefined,
  permKey: string | undefined,
): boolean {
  return canViewSection(perms, role, permKey)
}

/**
 * Standard denied panel — visually identical to the Layout route guard's
 * inline panel ("Section not available"). Kept here so PageGate has no render
 * dependency on Layout internals.
 */
export function SectionDeniedPanel() {
  return React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'var(--font, system-ui, sans-serif)' },
    'data-testid': 'page-gate-denied',
  },
    React.createElement('div', { style: { textAlign: 'center', maxWidth: 400, padding: '0 24px' } },
      React.createElement('div', { style: { fontSize: 20, color: 'var(--muted)', marginBottom: 8 } },
        React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
          React.createElement('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }),
          React.createElement('circle', { cx: 12, cy: 16, r: 1 }),
          React.createElement('path', { d: 'M8 11V7a4 4 0 1 1 8 0v4' })
        )
      ),
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 500, margin: '0 0 6px', color: 'var(--foreground)' } }, 'Section not available'),
      React.createElement('p', { style: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 } },
        'Your role does not have access to this section. Contact your admin to request access.'
      )
    )
  )
}

export function PageGate(props: PageGateProps) {
  var ctxSession = useSession()
  var viewAsTeam = useViewAsTeam()
  var session = props.session !== undefined ? props.session : ctxSession

  var role: string | null | undefined = viewAsTeam
    ? (viewAsTeam.role || viewAsTeam.portal_role)
    : ((session as any)?.role || (session as any)?.portal_role || null)
  var perms = viewAsTeam ? parsePerms(viewAsTeam) : parsePerms(session)

  if (!canViewPage(perms, role, props.permKey)) {
    return React.createElement(React.Fragment, null,
      props.fallback !== undefined ? props.fallback : React.createElement(SectionDeniedPanel, null))
  }
  return React.createElement(React.Fragment, null, props.children)
}
