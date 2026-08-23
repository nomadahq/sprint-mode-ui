// AccountSwitcher.tsx — USER-MENU-IDENTITY-1 P2
// Rewrites the user menu to show:
//   1. "Roles on {Portal}"   — portal-scoped roles, star-set default, kind label
//   2. "Portal access"       — other portals the current identity can access
//   3. "Linked accounts"     — separate sign-ins (unchanged logic, collapse-by-default)
//
// All three sections collapse by default; click header to expand.
// Fetch routing fix (B0): when not on *.sprintmode.ai, identity calls route
// through the same-origin proxy (idBase = '' = relative) so the portal's own
// session cookie is used, not the SM/admin one.

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
  /** portal_url: user-facing URL from portal_configs (NULL = fallback to subdomain.sprintmode.ai).
   *  HARD RULE: safeshepherd custom_domain is the Access-gated staging door — never link it. */
  portal_url?: string | null
  /** Role the linked account holds on this portal (from /api/auth/linked-accounts) */
  role?: string | null
  /** Whether this is the default role for this portal entry */
  is_default?: boolean
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

function ArrowIcon({ rotated }: { rotated?: boolean }) {
  return React.createElement('svg', {
    width: 12, height: 12, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: {
      flexShrink: 0, color: 'var(--muted)',
      transform: rotated ? 'rotate(90deg)' : 'rotate(-90deg)',
      transition: 'transform .12s',
    },
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

/** Resolve the user-facing URL for a portal.
 *  Prefers portal_url (explicit override from portal_configs).
 *  HARD RULE: safeshepherd custom_domain is the Access-gated staging
 *  login door — never use it as a navigation target.
 */
function portalUrl(p: PortalInfo): string {
  if (p.portal_url) return p.portal_url
  // Belt+braces: if portal_url is somehow missing for SS, hard-code the pages.dev URL
  if (p.subdomain === 'safeshepherd') return 'https://safeshepherd.pages.dev'
  // custom_domain is safe for non-SS portals
  if (p.custom_domain && p.subdomain !== 'safeshepherd') return 'https://' + p.custom_domain
  return 'https://' + p.subdomain + '.sprintmode.ai'
}

function titleCase(s: string): string {
  return s.split(/[_\s]+/).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1) }).join(' ')
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

  // B0 fetch-routing fix: when NOT on *.sprintmode.ai, route identity calls
  // through the same-origin proxy so the portal's own session cookie is used.
  var onSmHost = typeof window !== 'undefined' &&
    /\.sprintmode\.ai$/.test(window.location.hostname)
  // idBase for /auth/me, /auth/swap-role, /auth/default-role:
  //   - on *.sprintmode.ai: use authBase (direct to api.sprintmode.ai)
  //   - elsewhere (e.g. safeshepherd.pages.dev): use '' (same-origin proxy)
  var idBase = onSmHost ? authBase : ''
  // Path convention: same-origin proxy exposes /api/auth/*, direct uses /auth/*
  var idMePath = onSmHost ? '/auth/me' : '/api/auth/me'
  var idSwapPath = onSmHost ? '/auth/swap-role' : '/api/auth/swap-role'
  var idDefaultRolePath = onSmHost ? '/auth/default-role' : '/api/auth/default-role'

  var cached = _linkedCache[cacheKey]
  var _accounts = useState<LinkedAccount[]>(cached ? cached.accounts : []); var accounts = _accounts[0]; var setAccounts = _accounts[1]
  var _loaded = useState(!!cached); var loaded = _loaded[0]; var setLoaded = _loaded[1]
  var _expanded = useState<string | null>(null); var expanded = _expanded[0]; var setExpanded = _expanded[1]
  var _expandedSection = useState<string | null>(null); var expandedSection = _expandedSection[0]; var setExpandedSection = _expandedSection[1]
  var _meUserId = useState(cached ? cached.meUserId : ''); var meUserId = _meUserId[0]; var setMeUserId = _meUserId[1]
  var _me = useState<SessionData | null>(props.session || null); var me = _me[0]; var setMe = _me[1]
  var _swapBusy = useState<string | null>(null); var swapBusy = _swapBusy[0]; var setSwapBusy = _swapBusy[1]
  var _defaultMsg = useState<string | null>(null); var defaultMsg = _defaultMsg[0]; var setDefaultMsg = _defaultMsg[1]
  var _defaultMsgOk = useState(true); var defaultMsgOk = _defaultMsgOk[0]; var setDefaultMsgOk = _defaultMsgOk[1]
  var _starHover = useState<string | null>(null); var starHover = _starHover[0]; var setStarHover = _starHover[1]

  // Clear defaultMsg on unmount
  useEffect(function() {
    return function() { setDefaultMsg(null) }
  }, [])

  var authHeaders = useCallback(function(extra?: Record<string, string>): Record<string, string> {
    var h: Record<string, string> = extra ? { ...extra } : {}
    if (product) h['X-SM-Product'] = product
    return h
  }, [product])

  var fetchMe = useCallback(function() {
    fetch(idBase + idMePath, { credentials: 'include', headers: authHeaders() })
      .then(function(r) { return r.json() })
      .then(function(d: SessionData) { if (d && d.ok) setMe(d) })
      .catch(function() {})
  }, [idBase, idMePath, authHeaders])

  var fetchAccounts = useCallback(function() {
    // Dedupe each account's portal list by subdomain, preferring is_default row
    function dedupePortals(accs: LinkedAccount[]): LinkedAccount[] {
      return accs.map(function(a) {
        var seen: Record<string, PortalInfo> = {}
        ;(a.portals || []).forEach(function(p) {
          if (!seen[p.subdomain] || p.is_default) {
            seen[p.subdomain] = p
          }
        })
        return { ...a, portals: Object.values(seen) }
      })
    }
    fetch(apiBase + '/api/auth/linked-accounts', { credentials: 'include', headers: authHeaders() })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; data?: { accounts: LinkedAccount[] } }) {
        setLoaded(true)
        if (data.ok && data.data) {
          var deduped = dedupePortals(data.data.accounts)
          setAccounts(deduped)
          var cur = deduped.find(function(a) { return a.is_current })
          if (cur) {
            setMeUserId(cur.user_id)
            _linkedCache[cacheKey] = { accounts: deduped, meUserId: cur.user_id, ts: Date.now() }
          }
        }
      })
      .catch(function() { setLoaded(true) })
  }, [apiBase, authHeaders, cacheKey])

  useEffect(function() {
    fetchMe()
    if (cached && Date.now() - cached.ts < CACHE_TTL) return
    fetchAccounts()
  }, [fetchAccounts, fetchMe])

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
    fetch(idBase + idSwapPath, {
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

  function setDefaultRole(role: string, displayName: string) {
    fetch(idBase + idDefaultRolePath, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ portal: product, role: role }),
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; error?: string }) {
        if (d.ok) {
          // Optimistically update local me state
          if (me && me.my_roles) {
            var updated = me.my_roles.map(function(r2: any) {
              return { ...r2, is_default: r2.role === role ? 1 : 0 }
            })
            setMe({ ...me, my_roles: updated } as SessionData)
          }
          setDefaultMsgOk(true)
          setDefaultMsg('Default updated \u2014 next sign-in resolves as ' + displayName)
        } else {
          setDefaultMsgOk(false)
          setDefaultMsg(d.error || 'Could not update')
        }
      })
      .catch(function() {
        setDefaultMsgOk(false)
        setDefaultMsg('Could not update')
      })
  }

  var currentUrl = typeof window !== 'undefined' ? window.location.href : '/'
  var addAccountHref = meUserId
    ? '/auth/link-account?link_to=' + encodeURIComponent(meUserId) + '&redirect=' + encodeURIComponent(currentUrl)
    : ''

  if (!loaded && !me) return null

  // BUG-2033: never render operator data inside a lensed shell
  var lensed = !!(props.session && (props.session as any).viewing_as) || !!(me && (me as any).viewing_as)
  if (lensed) return null

  // Section toggle helper
  function toggleSection(key: string) {
    setExpandedSection(expandedSection === key ? null : key)
  }

  function sectionHeader(key: string, label: string, count: number, subtitle?: string) {
    var isOpen = expandedSection === key
    return React.createElement('button', {
      onClick: function() { toggleSection(key) },
      style: {
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '6px 10px', width: '100%', border: 'none',
        background: 'transparent', cursor: 'pointer', textAlign: 'left' as const,
      },
    },
      React.createElement('span', {
        style: { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', flex: 1 }
      },
        label,
        React.createElement('span', {
          style: { fontWeight: 600, textTransform: 'none' as const, letterSpacing: 0, marginLeft: 4 }
        }, '(' + count + ')'),
        subtitle ? React.createElement('span', {
          style: { fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }
        }, ' \u00b7 ' + subtitle) : null
      ),
      React.createElement(ArrowIcon, { rotated: isOpen })
    )
  }

  // ── Portal icon helper (reused across sections) ───────────────────────────
  function portalIcon(p: PortalInfo) {
    return (function() {
      var _themed = themedMarkFromLogoUrl(p.logo_mark_url || null)
      if (_themed) {
        return React.createElement('img', { src: _themed, alt: '', style: { width: 18, height: 18, display: 'block', flexShrink: 0 } })
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
    })()
  }

  // ── Star glyph for default-role ────────────────────────────────────────────
  function StarGlyph({ isDefault, role, onClick, disabled }: { isDefault: boolean; role: string; onClick?: () => void; disabled?: boolean }) {
    var filled = isDefault
    var isHover = starHover === role
    var color = filled ? '#ba7517' : (isHover ? 'var(--muted)' : 'var(--border)')
    // inline SVG star
    return React.createElement('button', {
      onClick: onClick,
      disabled: disabled || !onClick,
      onMouseEnter: onClick ? function() { setStarHover(role) } : undefined,
      onMouseLeave: onClick ? function() { setStarHover(null) } : undefined,
      title: filled ? 'Default role' : 'Set as default',
      style: {
        padding: 0, background: 'transparent', border: 'none',
        lineHeight: 1, cursor: onClick && !disabled ? 'pointer' : 'default',
        flexShrink: 0, display: 'inline-flex', alignItems: 'center',
      },
      'aria-label': filled ? 'Default role' : 'Set as default role',
    },
      React.createElement('svg', {
        width: 11, height: 11, viewBox: '0 0 24 24',
        fill: filled ? color : 'none',
        stroke: color,
        strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        React.createElement('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
      )
    )
  }

  // ── Section 1: Roles on {Portal} ─────────────────────────────────────────
  var myRoles = (me && (me as any).my_roles) || []

  // Portal display name from linked-accounts current account
  var currentAccount = accounts.find(function(a) { return a.is_current })
  var currentPortalInfo = currentAccount && product
    ? (currentAccount.portals || []).find(function(p) { return p.subdomain === product })
    : null
  var portalDisplayName = (currentPortalInfo && currentPortalInfo.name) ||
    (product ? (product.charAt(0).toUpperCase() + product.slice(1)) : 'this portal')

  var rolesSection = myRoles.length > 0 ? React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionHeader('roles', 'Roles on ' + portalDisplayName, myRoles.length),
    expandedSection === 'roles' ? React.createElement('div', null,
      myRoles.map(function(r: any) {
        var kindText = r.role_type === 'customer' ? 'User' : (r.role_type ? 'Admin' : null)
        var isSingleRole = myRoles.length === 1
        return React.createElement('div', {
          key: r.role,
          style: {
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            fontSize: 13, color: 'var(--foreground)',
          },
        },
          React.createElement('span', {
            style: {
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const, fontWeight: r.is_active ? 600 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }
          },
            r.display_name,
            // Star immediately after role name
            React.createElement(StarGlyph, {
              isDefault: !!r.is_default,
              role: r.role,
              onClick: isSingleRole ? undefined : function() { setDefaultRole(r.role, r.display_name) },
              disabled: !!r.is_default,
            }),
            kindText ? React.createElement('span', {
              style: { fontSize: 10, color: 'var(--muted)', marginLeft: 5 }
            }, kindText) : null
          ),
          r.is_active
            ? React.createElement('span', {
                style: {
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.4px', color: 'var(--accent)', background: 'var(--accent-10)',
                  padding: '2px 8px', borderRadius: 9, flexShrink: 0,
                }
              }, 'Active')
            : React.createElement('button', {
                onClick: function() { swapTo(r.role) },
                disabled: swapBusy !== null,
                style: {
                  fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '3px 10px',
                  cursor: swapBusy ? 'wait' : 'pointer', flexShrink: 0,
                },
              }, swapBusy === r.role ? '\u2026' : 'Swap')
        )
      }),
      // Default-role confirmation/error message
      defaultMsg ? React.createElement('div', {
        style: {
          fontSize: 11, padding: '2px 10px 6px',
          color: defaultMsgOk ? 'hsl(142,71%,30%)' : 'hsl(0,84%,40%)',
        }
      }, defaultMsg) : null
    ) : null
  ) : null

  // ── Section 2: Portal access ──────────────────────────────────────────────
  // Other portals this identity can access (excluding the current portal)
  var accessPortals = currentAccount
    ? (currentAccount.portals || []).filter(function(p) { return p.subdomain !== product })
    : []

  var accessSection = accessPortals.length > 0 ? React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionHeader('access', 'Portal access', accessPortals.length),
    expandedSection === 'access' ? React.createElement('div', null,
      accessPortals.map(function(p) {
        return React.createElement('button', {
          key: p.subdomain,
          onClick: function() { handlePortalClick(currentAccount!.user_id, portalUrl(p), p.subdomain) },
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
            width: '100%', textAlign: 'left' as const, fontSize: 13, color: 'var(--foreground)',
            transition: 'background .15s',
          },
          onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
          onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
        },
          portalIcon(p),
          React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } },
            p.name || titleCase(p.subdomain)
          ),
          p.role ? React.createElement('span', { style: { fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 4 } }, titleCase(p.role)) : null,
          React.createElement(ArrowIcon, { rotated: false })
        )
      })
    ) : null
  ) : null

  // ── Section 3: Linked accounts ────────────────────────────────────────────
  var otherAccounts = accounts.filter(function(a) {
    if (a.is_current) return false
    if (!a.email || a.email === 'unknown') return false
    return (a.portals || []).length > 0
  })

  // Expanded drill-in for a specific linked account (nested inside section 3)
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
              portalIcon(p),
              React.createElement('span', { style: { flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, p.name || p.subdomain),
              p.role ? React.createElement('span', { style: { fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 4 } }, titleCase(p.role)) : null
            )
          })
        : React.createElement('div', {
            style: { padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }
          }, 'No portals available')
    )
  }

  var linkedSection = React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
    sectionHeader('linked', 'Linked accounts', otherAccounts.length, 'separate sign-ins'),
    expandedSection === 'linked' ? React.createElement('div', null,
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
          React.createElement(ArrowIcon, { rotated: false })
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
    ) : null
  )

  return React.createElement(React.Fragment, null,
    rolesSection,
    accessSection,
    linkedSection
  )
}
