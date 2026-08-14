// AccountSwitcher.tsx — UX-1940 (I-32, Identity Core L8)
// The SWITCH ACCOUNT section becomes three sections (v3 mock, approved
// 2026-08-12 with the permission-gated Manage-in-Portal-Manager amendment):
//
//   1. ROLES — read-only list of the caller's OWN roles on this portal
//      (my_roles from /auth/me): Active marker on the resolving row, Swap on
//      the rest (POST /auth/swap-role). NO self-service role add — grants
//      live in Portal Manager (FEAT-1798 rule 1). The "Manage in Portal
//      Manager" shortcut renders ONLY when the viewer's resolved permissions
//      include portal_manager edit (no dead links).
//   2. SIGN-IN EMAILS · all open this account — plain text rows, no avatars,
//      no chevrons, nothing clickable except "Link an email" (verified magic
//      link to the NEW address via /api/identity/link-email-request; the
//      user_emails row attaches on the CURRENT user_id at verify).
//   3. OTHER ACCOUNTS · separate sign-ins — genuinely-linked personal
//      identities only (avatar + chevron because clicking switches
//      identity); consolidated-away records (no email / no portals) are
//      hidden; Add Account retained for the gmail class.
//
// The two-step portal drill-in for other accounts is unchanged
// (ACCOUNT-SWITCHER-5 mechanics): linked-accounts + switch-account stay on
// the SAME-ORIGIN portal proxy; the new identity endpoints ride authBase
// (api.sprintmode.ai, cookie Domain=.sprintmode.ai — the view-as contract).

import React, { useState, useEffect, useCallback } from 'react'
import { themedMarkFromLogoUrl } from './dark-mode'
import type { SessionData } from './api.js'

export interface AccountSwitcherProps {
  /** API base URL for the same-origin proxy paths (empty string = same origin) */
  apiBase?: string
  /** Portal subdomain — sent as X-SM-Product so the API resolves THIS
   *  portal's session cookie. Without it the linked-accounts fetch reads
   *  the wrong cookie and returns nothing on non-admin portals (Waffle). */
  product?: string
  /** Base URL for the sm-api auth/identity endpoints (/auth/me, /auth/swap-role,
   *  /api/identity/*). Defaults to https://api.sprintmode.ai — the same
   *  contract as the view-as controls. Override on custom-domain portals. */
  authBase?: string
  /** Session from the shell — used as the initial Roles/emails data source
   *  while the fresh /auth/me fetch is in flight. */
  session?: SessionData | null
}

interface PortalInfo {
  subdomain: string
  name: string
  brand_color: string | null
  brand_tint: string | null
  logo_mark_url: string | null
  custom_domain: string | null
}

interface LinkedAccount {
  user_id: string
  display_name: string
  email: string
  photo_url: string | null
  is_current: boolean
  portals: PortalInfo[]
}

function PlusIcon() {
  return React.createElement('svg', {
    width: 14, height: 14, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0, color: 'var(--muted)' },
    'aria-hidden': 'true',
  },
    React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
    React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
  )
}

function ArrowIcon() {
  return React.createElement('svg', {
    width: 12, height: 12, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0, color: 'var(--muted)' },
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M9 18l6-6-6-6' })
  )
}

function BackIcon() {
  return React.createElement('svg', {
    width: 12, height: 12, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0 },
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M15 18l-6-6 6-6' })
  )
}

function portalUrl(p: PortalInfo): string {
  if (p.custom_domain) return 'https://' + p.custom_domain
  return 'https://' + p.subdomain + '.sprintmode.ai'
}

function sectionLabel(text: string, sub?: string) {
  return React.createElement('div', {
    style: { padding: '6px 10px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
  }, text, sub ? React.createElement('span', { style: { fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 } }, ' \u00b7 ' + sub) : null)
}

/** portal_manager edit gate for the Manage shortcut (approval amendment):
 *  the leaf key on the resolved permissions map, super_admin bypass. The
 *  materialized section key (BUG-1988) is accepted as a fallback. */
function canManagePortalManager(session: SessionData | null | undefined): boolean {
  if (!session) return false
  var role = (session.role || session.portal_role || '') as string
  if (role === 'super_admin') return true
  var perms = session.permissions
  if (!perms || typeof perms === 'string') return false
  var leaf = (perms as Record<string, { edit?: boolean }>)['portal_manager.portal_manager']
  if (leaf && leaf.edit === true) return true
  var section = (perms as Record<string, { edit?: boolean }>)['portal_manager']
  return !!(section && section.edit === true)
}

// Module-level cache — survives mount/unmount cycles so the user menu
// opens instantly after the first fetch. Keyed by apiBase|product so
// different portals don't collide.
var _linkedCache: Record<string, { accounts: LinkedAccount[]; meUserId: string; ts: number }> = {}
var CACHE_TTL = 60000 // refresh in background after 60 s

export function AccountSwitcher(props: AccountSwitcherProps) {
  var apiBase = props.apiBase || ''
  var product = props.product || ''
  var authBase = props.authBase || 'https://api.sprintmode.ai'
  var cacheKey = apiBase + '|' + product

  var cached = _linkedCache[cacheKey]
  var _accounts = useState<LinkedAccount[]>(cached ? cached.accounts : []); var accounts = _accounts[0]; var setAccounts = _accounts[1]
  var _loaded = useState(!!cached); var loaded = _loaded[0]; var setLoaded = _loaded[1]
  var _expanded = useState<string | null>(null); var expanded = _expanded[0]; var setExpanded = _expanded[1]
  var _meUserId = useState(cached ? cached.meUserId : ''); var meUserId = _meUserId[0]; var setMeUserId = _meUserId[1]
  // Fresh /auth/me for Roles + Sign-in emails (shell session as initial data).
  var _me = useState<SessionData | null>(props.session || null); var me = _me[0]; var setMe = _me[1]
  var _swapBusy = useState<string | null>(null); var swapBusy = _swapBusy[0]; var setSwapBusy = _swapBusy[1]
  // Link-an-email inline flow
  var _linkOpen = useState(false); var linkOpen = _linkOpen[0]; var setLinkOpen = _linkOpen[1]
  var _linkVal = useState(''); var linkVal = _linkVal[0]; var setLinkVal = _linkVal[1]
  var _linkState = useState<null | 'sending' | 'sent' | 'error'>(null); var linkState = _linkState[0]; var setLinkState = _linkState[1]
  var _linkMsg = useState(''); var linkMsg = _linkMsg[0]; var setLinkMsg = _linkMsg[1]

  var authHeaders = useCallback(function(extra?: Record<string, string>): Record<string, string> {
    var h: Record<string, string> = extra ? { ...extra } : {}
    if (product) h['X-SM-Product'] = product
    return h
  }, [product])

  var fetchMe = useCallback(function() {
    fetch(authBase + '/auth/me', { credentials: 'include', headers: authHeaders() })
      .then(function(r) { return r.json() })
      .then(function(d: SessionData) { if (d && d.ok) setMe(d) })
      .catch(function() {})
  }, [authBase, authHeaders])

  var fetchAccounts = useCallback(function() {
    fetch(apiBase + '/api/auth/linked-accounts', { credentials: 'include', headers: authHeaders() })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; data?: { accounts: LinkedAccount[] } }) {
        setLoaded(true)
        if (data.ok && data.data) {
          setAccounts(data.data.accounts)
          var cur = data.data.accounts.find(function(a) { return a.is_current })
          if (cur) {
            setMeUserId(cur.user_id)
            _linkedCache[cacheKey] = { accounts: data.data.accounts, meUserId: cur.user_id, ts: Date.now() }
          }
        }
      })
      .catch(function() { setLoaded(true) })
  }, [apiBase, authHeaders, cacheKey])

  useEffect(function() {
    fetchMe() // Roles/emails always fresh — a stale role list misleads
    if (cached && Date.now() - cached.ts < CACHE_TTL) return
    fetchAccounts()
  }, [fetchAccounts, fetchMe])

  // POST through the portal proxy (same-origin), not directly to api.sprintmode.ai.
  // The proxy forwards cookies + X-SM-Product correctly and passes Set-Cookie back.
  function handlePortalClick(userId: string, targetUrl: string, portalSubdomain: string) {
    fetch('/api/auth/switch-account', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, target_portal: portalSubdomain }),
    })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean }) {
        if (data.ok) {
          window.location.href = targetUrl
        } else {
          setExpanded(null)
        }
      })
      .catch(function() { setExpanded(null) })
  }

  function swapTo(role: string) {
    if (swapBusy) return
    setSwapBusy(role)
    fetch(authBase + '/auth/swap-role', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ portal: product || undefined, role: role }),
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean }) {
        if (d && d.ok) { window.location.reload(); return }
        setSwapBusy(null)
      })
      .catch(function() { setSwapBusy(null) })
  }

  function sendLinkEmail() {
    var email = linkVal.trim().toLowerCase()
    if (!email || email.indexOf('@') === -1 || linkState === 'sending') return
    setLinkState('sending')
    fetch(authBase + '/api/identity/link-email-request', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: email, redirect: typeof window !== 'undefined' ? window.location.href : undefined }),
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; error?: string }) {
        if (d && d.ok) {
          setLinkState('sent')
          setLinkMsg('Check ' + email + ' for a confirmation link.')
          setLinkVal('')
        } else {
          setLinkState('error')
          setLinkMsg((d && d.error) || 'Could not send the confirmation link.')
        }
      })
      .catch(function() { setLinkState('error'); setLinkMsg('Network error \u2014 try again.') })
  }

  var currentUrl = typeof window !== 'undefined' ? window.location.href : '/'
  var addAccountHref = meUserId
    ? '/auth/link-account?link_to=' + encodeURIComponent(meUserId) + '&redirect=' + encodeURIComponent(currentUrl)
    : ''

  if (!loaded && !me) return null

  // Claim-return confirmation: the email-claim verify redirect appends
  // ?linked=<email>. Shown once, then cleared from the URL.
  var linkedParam: string | null = null
  try {
    var _sp = new URLSearchParams(window.location.search)
    linkedParam = _sp.get('linked')
    if (linkedParam) {
      _sp.delete('linked')
      var _qs = _sp.toString()
      window.history.replaceState({}, '', window.location.pathname + (_qs ? '?' + _qs : ''))
    }
  } catch (_e) { linkedParam = null }

  // OTHER ACCOUNTS: genuinely-linked personal identities only. Records the
  // consolidation emptied (no email, nothing to open) are dead weight in
  // linked_accounts until I-29/I-30 deletes them — hide, don't render.
  var otherAccounts = accounts.filter(function(a) {
    if (a.is_current) return false
    if (!a.email || a.email === 'unknown') return false
    return (a.portals || []).length > 0
  })

  // If an account is expanded, show its portal list instead of the sections
  var expandedAccount = expanded ? otherAccounts.find(function(a) { return a.user_id === expanded }) : null

  if (expandedAccount) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
      React.createElement('button', {
        onClick: function() { setExpanded(null) },
        style: {
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          width: '100%', textAlign: 'left' as const, fontSize: 11, fontWeight: 600,
          color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
        }
      },
        React.createElement(BackIcon, null),
        expandedAccount.email
      ),
      expandedAccount.portals.length > 0
        ? expandedAccount.portals.map(function(p) {
            return React.createElement('button', {
              key: p.subdomain,
              onClick: function() { handlePortalClick(expandedAccount!.user_id, portalUrl(p), p.subdomain) },
              style: {
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
                width: '100%', textAlign: 'left' as const, fontSize: 13, color: 'var(--foreground)',
                transition: 'background .15s',
              },
              onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
              onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
            },
              (function() {
                var _themed = themedMarkFromLogoUrl(p.logo_mark_url)
                if (_themed) {
                  return React.createElement('img', { src: _themed, alt: '', style: { width: 18, height: 18, display: 'block' } })
                }
                if (p.logo_mark_url) {
                  return React.createElement('img', { src: p.logo_mark_url, alt: '', style: { width: 18, height: 18, borderRadius: 4, objectFit: 'contain' as const, display: 'block', flexShrink: 0 } })
                }
                var bc = p.brand_color || 'var(--accent)'
                return React.createElement('div', {
                  style: {
                    width: 18, height: 18, borderRadius: 4,
                    background: p.brand_tint || 'var(--accent-10)',
                    color: bc,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, flexShrink: 0,
                  }
                }, (p.name || p.subdomain).charAt(0).toUpperCase())
              })(),
              React.createElement('span', { style: { fontSize: 13 } }, p.name || p.subdomain)
            )
          })
        : React.createElement('div', {
            style: { padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }
          }, 'No portals available')
    )
  }

  // ── Section 1: ROLES (UX-1940 §1) ───────────────────────────────────────
  var myRoles = (me && me.my_roles) || []
  var manageGate = canManagePortalManager(me)
  var rolesSection = myRoles.length > 0 ? React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionLabel('Roles'),
    myRoles.map(function(r) {
      return React.createElement('div', {
        key: r.role,
        style: {
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          fontSize: 13, color: 'var(--foreground)',
        },
      },
        React.createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontWeight: r.is_active ? 600 : 400 } },
          r.display_name,
          r.is_default ? React.createElement('span', { title: 'Your default role on this portal', style: { fontSize: 10, color: 'var(--muted)', marginLeft: 6 } }, 'default') : null
        ),
        r.is_active
          ? React.createElement('span', { style: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.4px', color: 'var(--accent)', background: 'var(--accent-10)', padding: '2px 8px', borderRadius: 9, flexShrink: 0 } }, 'Active')
          : React.createElement('button', {
              onClick: function() { swapTo(r.role) },
              disabled: swapBusy !== null,
              style: { fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: swapBusy ? 'wait' : 'pointer', flexShrink: 0 },
            }, swapBusy === r.role ? '\u2026' : 'Swap')
      )
    }),
    manageGate ? React.createElement('a', {
      href: 'https://admin.sprintmode.ai/portals' + (product ? '/' + product : '') + '?tab=roles',
      style: { display: 'block', padding: '4px 10px 6px', fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
    }, 'Manage in Portal Manager \u2197') : null
  ) : null

  // ── Section 2: SIGN-IN EMAILS (UX-1940 §2) ──────────────────────────────
  var emails = (me && me.emails) || []
  var emailsSection = React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionLabel('Sign-in emails', 'all open this account'),
    linkedParam
      ? React.createElement('div', {
          style: {
            margin: '2px 8px 4px', padding: '7px 10px', borderRadius: 6,
            background: 'var(--accent-10)', color: 'var(--accent)',
            fontSize: 12, lineHeight: 1.4,
          }
        }, linkedParam + ' is now linked to this account.')
      : null,
    emails.map(function(em) {
      // Plain text rows: no avatars, no chevrons, nothing clickable (the
      // ruled affordance split vs Other accounts).
      return React.createElement('div', {
        key: em.email,
        style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12, color: 'var(--foreground)' },
      },
        React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, em.email),
        em.is_primary ? React.createElement('span', { style: { fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 9, background: 'var(--accent-10)', color: 'var(--accent)', flexShrink: 0 } }, 'Primary') : null
      )
    }),
    linkOpen
      ? React.createElement('div', { style: { padding: '4px 10px 6px' } },
          React.createElement('div', { style: { display: 'flex', gap: 5 } },
            React.createElement('input', {
              autoFocus: true, type: 'email', value: linkVal, placeholder: 'name@example.com',
              onChange: function(e: React.ChangeEvent<HTMLInputElement>) { setLinkVal(e.target.value) },
              onKeyDown: function(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter') sendLinkEmail(); if (e.key === 'Escape') { setLinkOpen(false); setLinkState(null) } },
              style: { flex: 1, minWidth: 0, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--foreground)', outline: 'none' },
            }),
            React.createElement('button', {
              onClick: sendLinkEmail,
              disabled: linkState === 'sending' || !linkVal.trim(),
              style: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', flexShrink: 0 },
            }, linkState === 'sending' ? '\u2026' : 'Send')
          ),
          linkState === 'sent' || linkState === 'error'
            ? React.createElement('div', { style: { marginTop: 4, fontSize: 11, color: linkState === 'error' ? 'var(--red, #dc2626)' : 'var(--muted)', lineHeight: 1.4 } }, linkMsg)
            : React.createElement('div', { style: { marginTop: 4, fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 } }, 'We send a confirmation link to the address; it joins this account once verified.')
        )
      : React.createElement('button', {
          onClick: function() { setLinkOpen(true); setLinkState(null); setLinkMsg('') },
          style: {
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 6,
            fontSize: 12, color: 'var(--foreground)', border: 'none', background: 'transparent',
            cursor: 'pointer', width: '100%', textAlign: 'left' as const, transition: 'background .15s',
          },
          onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
          onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
        },
          React.createElement(PlusIcon, null),
          'Link an email'
        )
  )

  // ── Section 3: OTHER ACCOUNTS (UX-1940 §3) ──────────────────────────────
  var otherSection = React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionLabel('Other accounts', 'separate sign-ins'),

    otherAccounts.map(function(account) {
      var initials = (account.display_name || account.email || '?')
        .split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase()

      return React.createElement('button', {
        key: account.user_id,
        onClick: function() { setExpanded(account.user_id) },
        style: {
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 6,
          border: 'none', background: 'transparent',
          cursor: 'pointer', width: '100%', textAlign: 'left' as const,
          fontSize: 13, color: 'var(--foreground)',
          transition: 'background .15s',
        },
        onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
        onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
      },
        account.photo_url
          ? React.createElement('img', {
              src: account.photo_url, alt: '',
              style: { width: 22, height: 22, borderRadius: 5, objectFit: 'cover' as const, flexShrink: 0 }
            })
          : React.createElement('div', {
              style: {
                width: 22, height: 22, borderRadius: 5,
                background: 'var(--accent-10)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 600, flexShrink: 0,
              }
            }, initials),
        React.createElement('div', { style: { flex: 1, minWidth: 0, overflow: 'hidden' } },
          React.createElement('div', {
            style: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }
          }, account.display_name || account.email),
          React.createElement('div', {
            style: { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }
          }, account.email)
        ),
        React.createElement(ArrowIcon, null)
      )
    }),

    React.createElement('a', {
      href: addAccountHref,
      style: {
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 10px', borderRadius: 6,
        fontSize: 13, color: 'var(--foreground)',
        textDecoration: 'none', transition: 'background .15s',
      },
      onMouseEnter: function(e: React.MouseEvent<HTMLAnchorElement>) { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-subtle)' },
      onMouseLeave: function(e: React.MouseEvent<HTMLAnchorElement>) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' },
    },
      React.createElement(PlusIcon, null),
      'Add Account'
    )
  )

  return React.createElement(React.Fragment, null,
    rolesSection,
    emailsSection,
    otherSection
  )
}
