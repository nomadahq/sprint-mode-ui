// ActingRoleChip.tsx — UX-1941 (I-33, Identity Core L8)
// Compact header-bar chip shown while the session is acting in a NON-default
// role (a self role-swap set via /auth/swap-role). Aaron-ruled 2026-08-12:
// a chip INSIDE the header control row, never a content-area banner; the
// view-as lens banner stays PORTAL-RBAC-VIEWAS-3's surface. The approval
// amendment makes the chip ADDITIVE — it slots into the existing control row
// and removes nothing.
//
// Shows "Acting: {role display name}"; x returns to the default role
// (POST /auth/exit-swap-role + reload); hover carries the ledger-attribution
// note. Renders nothing when no swap is active for this portal.

import React, { useState } from 'react'
import type { SessionData } from './api.js'

export interface ActingRoleChipProps {
  session: SessionData | null
  /** Base URL for /auth/exit-swap-role (empty string for same-origin proxy). */
  apiBase?: string
  /** Portal subdomain — sent as X-SM-Product so the right per-door cookie is
   *  re-minted (same contract as the view-as controls). */
  portalSubdomain?: string
}

export function ActingRoleChip(props: ActingRoleChipProps) {
  var session = props.session
  var _busy = useState(false); var busy = _busy[0]; var setBusy = _busy[1]

  var acting = session && session.acting_role
  if (!session || !acting || !acting.role) return null

  // Display name: the my_roles entry for the acting role (server-resolved
  // display), else the session's resolved-role display, else a humanized key
  // — a raw snake_case key never renders (UX-1941 wrong-value).
  var actingEntry = (session.my_roles || []).find(function(r) { return r.role === acting!.role })
  var display = (actingEntry && actingEntry.display_name)
    || session.role_display_name
    || acting.role.split(/[_\s]+/).filter(Boolean).map(function(w, i) {
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w
    }).join(' ')

  function exitSwap() {
    if (busy) return
    setBusy(true)
    var headers: Record<string, string> = {}
    if (props.portalSubdomain) headers['X-SM-Product'] = props.portalSubdomain
    fetch((props.apiBase || '') + '/auth/exit-swap-role', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
    })
      .then(function() { window.location.reload() })
      .catch(function() { setBusy(false) })
  }

  return React.createElement('div', {
    title: 'You are acting as ' + display + ' — actions are recorded under this role. Click x to return to your default role.',
    style: {
      display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 6px 0 10px',
      border: '1px solid var(--accent)', borderRadius: 7, background: 'var(--accent-10, rgba(35,98,234,.08))',
      color: 'var(--accent)', fontSize: 12, fontWeight: 600, flexShrink: 0, boxSizing: 'border-box' as const,
    },
  },
    React.createElement('span', { style: { whiteSpace: 'nowrap' as const } }, 'Acting: ' + display),
    React.createElement('button', {
      onClick: exitSwap,
      disabled: busy,
      'aria-label': 'Return to your default role',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 4, border: 'none', cursor: busy ? 'wait' : 'pointer',
        background: 'transparent', color: 'var(--accent)', padding: 0, fontSize: 12, lineHeight: 1,
      },
    },
      React.createElement('svg', {
        width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
        React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
      )
    )
  )
}
