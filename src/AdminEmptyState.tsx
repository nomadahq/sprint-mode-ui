// AdminEmptyState.tsx — ROLE-VIEW-CONTRACT-1
//
// Shown when a user with a team-typed active role navigates to a customer
// portal page. Customer data is never fetched or rendered in this mode.
//
// Contract (Aaron 2026-08-18):
//   - Portal name in the heading.
//   - Role display name (or humanised role key) in the subtext.
//   - [Swap to <customer role>] button only when the identity ALSO holds a
//     customer role on this portal (passed as `customerRole` prop).
//   - VAU/VAT button lives in the header only — never here.
//   - SM Internal page group (Studios) gets real content — callers pass
//     `adminContentPaths` to Layout and those routes never reach this state.

import React from 'react'

export interface AdminEmptyStateProps {
  /** The portal's display name, e.g. "Waffle", "Signal". */
  portalName: string
  /** The active role's display name or key, e.g. "CAIO", "Owner". */
  roleDisplayName: string
  /**
   * When the identity also holds a customer role on this portal, pass the
   * role key so the Swap button can be rendered. Omit or pass null/undefined
   * to suppress the button entirely.
   */
  customerRole?: string | null
  /**
   * Callback fired when the user clicks [Swap to <customerRole>].
   * The host portal is responsible for calling /auth/swap-role or
   * redirecting — this component only triggers the action.
   */
  onSwapToCustomerRole?: (role: string) => void
  /** Customer role display name override; falls back to customerRole key. */
  customerRoleDisplayName?: string | null
}

export function AdminEmptyState(props: AdminEmptyStateProps) {
  var { portalName, roleDisplayName, customerRole, onSwapToCustomerRole, customerRoleDisplayName } = props
  var swapLabel = customerRoleDisplayName || customerRole || ''

  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      fontFamily: 'var(--font, system-ui, -apple-system, sans-serif)',
      padding: '32px 28px',
    },
    'data-testid': 'admin-empty-state',
  },
    React.createElement('div', {
      style: {
        textAlign: 'center',
        maxWidth: 400,
        padding: '0 24px',
      },
    },
      // Lock icon (Tabler-style SVG)
      React.createElement('div', {
        style: { color: 'var(--muted)', marginBottom: 16, display: 'flex', justifyContent: 'center' },
      },
        React.createElement('svg', {
          width: 32,
          height: 32,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
          React.createElement('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }),
          React.createElement('circle', { cx: 12, cy: 16, r: 1 }),
          React.createElement('path', { d: 'M8 11V7a4 4 0 1 1 8 0v4' }),
        ),
      ),
      React.createElement('h3', {
        style: {
          fontSize: 16,
          fontWeight: 600,
          margin: '0 0 8px',
          color: 'var(--foreground)',
        },
      }, 'You\'re viewing ' + portalName + ' in your ' + roleDisplayName + ' role'),
      React.createElement('p', {
        style: {
          fontSize: 13,
          color: 'var(--muted)',
          lineHeight: 1.6,
          margin: '0 0 20px',
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
        },
      }, 'Admin roles hold no workspace data here. To see customer data, switch to a customer role on this portal.'),
      // Swap button — only rendered when customerRole is provided
      customerRole && onSwapToCustomerRole
        ? React.createElement('button', {
            onClick: function() { if (customerRole && onSwapToCustomerRole) onSwapToCustomerRole(customerRole) },
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm, 8px)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent, #2362ea)',
              background: 'var(--accent-10, rgba(35,98,234,0.1))',
              border: 'none',
              cursor: 'pointer',
            },
            'data-testid': 'admin-empty-state-swap-btn',
          },
          // Arrow-left-right icon
          React.createElement('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
          },
            React.createElement('path', { d: 'M8 3L4 7l4 4' }),
            React.createElement('path', { d: 'M4 7h16' }),
            React.createElement('path', { d: 'M16 21l4-4-4-4' }),
            React.createElement('path', { d: 'M20 17H4' }),
          ),
          'Swap to ' + swapLabel,
        )
        : null,
    ),
  )
}
