// src/user-menu-standalone.ts
// Standalone entry point for the SMUserMenu widget.
// Truly self-contained: bundles React, ReactDOM, and the UserMenu component.
//
// Usage:
//   <script src="user-menu.js"></script>
//   <script>SMUserMenu.mount(element, session, logoutHref)</script>
//
// Mount signature matches the original committed blob exactly.

import { createElement, useState, useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// ── Token CSS ──────────────────────────────────────────────────────────────
// Injected once so the bundle works on pages without portal CSS.
const TOKEN_CSS = `
:root {
  --bg: hsl(0, 0%, 100%);
  --bg-subtle: hsl(220, 14%, 97%);
  --bg-card: hsl(0, 0%, 100%);
  --foreground: hsl(0, 0%, 9%);
  --muted: hsl(220, 9%, 40%);
  --border: hsl(214, 32%, 91%);
  --accent: hsl(221, 83%, 53%);
  --accent-10: hsla(221, 83%, 53%, 0.1);
  --radius: 0.75rem;
  --radius-sm: 0.5rem;
  --font: 'Geist', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
`

var injected = false
function injectDeps() {
  if (injected) return
  injected = true
  var style = document.createElement('style')
  style.setAttribute('data-sm-user-menu-tokens', '')
  style.textContent = TOKEN_CSS
  document.head.appendChild(style)
  if (!document.querySelector('link[href*="Geist"]')) {
    var link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'
    document.head.appendChild(link)
  }
}

// ── Icons ──────────────────────────────────────────────────────────────────
var SettingsIcon = createElement('svg', {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
  style: { flexShrink: 0, color: 'var(--muted)' }
},
  createElement('circle', { cx: 12, cy: 12, r: 3 }),
  createElement('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })
)

// ── UserMenu component ─────────────────────────────────────────────────────
interface Session {
  name?: string
  email?: string
  role?: string
  portal_role?: string
  company_name?: string
  photo?: string
  photo_url?: string
  [key: string]: unknown
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

function UserMenu(props: { session: Session; logoutHref: string }) {
  var session = props.session
  var logoutHref = props.logoutHref
  var _open = useState(false); var isOpen = _open[0]; var setOpen = _open[1]
  var ref = useRef<HTMLDivElement>(null)
  var _accounts = useState<LinkedAccount[]>([]); var accounts = _accounts[0]; var setAccounts = _accounts[1]
  var _expanded = useState<string | null>(null); var expanded = _expanded[0]; var setExpanded = _expanded[1]
  var _meUserId = useState(''); var meUserId = _meUserId[0]; var setMeUserId = _meUserId[1]

  useEffect(function() {
    var handler = function(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setExpanded(null) }
    }
    document.addEventListener('mousedown', handler)
    return function() { document.removeEventListener('mousedown', handler) }
  }, [])

  // Fetch linked accounts
  useEffect(function() {
    fetch('/api/auth/linked-accounts', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; data?: { accounts: LinkedAccount[] } }) {
        if (data.ok && data.data) {
          setAccounts(data.data.accounts)
          var cur = data.data.accounts.find(function(a) { return a.is_current })
          if (cur) setMeUserId(cur.user_id)
        }
      })
      .catch(function() {})
    fetch('/auth/me', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; user?: { id: string } }) {
        if (data.ok && data.user) {
          setMeUserId(function(prev: string) { return prev || data.user!.id })
        }
      })
      .catch(function() {})
  }, [])

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

  function portalUrl(p: { subdomain: string; custom_domain: string | null }): string {
    if (p.custom_domain) return 'https://' + p.custom_domain
    return 'https://' + p.subdomain + '.sprintmode.ai'
  }

  var initials = (session.name || session.email || '?')
    .split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase()
  var firstName = session.name ? session.name.split(' ')[0]
    : session.email ? session.email.split('@')[0] : ''
  var roleLine = session.role ? session.role.replace(/_/g, ' ')
    : session.portal_role ? session.portal_role.replace(/_/g, ' ') : ''
  var photoUrl = session.photo || session.photo_url
  var otherAccounts = accounts.filter(function(a) { return !a.is_current })
  var expandedAccount = expanded ? otherAccounts.find(function(a) { return a.user_id === expanded }) || null : null

  var avatar = photoUrl
    ? createElement('img', {
        src: photoUrl, alt: '',
        style: { width: 26, height: 26, borderRadius: 6, objectFit: 'cover' as const, display: 'block', flexShrink: 0 }
      })
    : createElement('div', {
        style: { width: 26, height: 26, borderRadius: 6, background: 'var(--accent-10)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }
      }, initials)

  return createElement('div', { ref: ref, style: { position: 'relative' as const } },
    createElement('button', {
      onClick: function() { setOpen(function(v) { return !v }) },
      className: 'shell-header-avatar',
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)',
        cursor: 'pointer', transition: 'border-color .2s', flexShrink: 0 }
    },
      avatar,
      createElement('span', {
        style: { fontSize: 13, color: 'var(--foreground)', fontWeight: 500, maxWidth: 100,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }
      }, firstName)
    ),
    isOpen ? createElement('div', {
      style: { position: 'absolute' as const, right: 0, top: 42, width: 220,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, zIndex: 9200 }
    },
      createElement('div', {
        style: { padding: '8px 10px', fontSize: 12, color: 'var(--muted)',
          borderBottom: '1px solid var(--border)', marginBottom: 4 }
      },
        createElement('div', { style: { fontWeight: 600, color: 'var(--foreground)', fontSize: 13 } }, session.name),
        session.email ? createElement('div', null, session.email) : null,
        roleLine ? createElement('div', { style: { marginTop: 2 } }, roleLine)
          : session.company_name ? createElement('div', { style: { marginTop: 2 } }, session.company_name) : null
      ),
      createElement('a', {
        href: '/user/notifications',
        style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
          borderRadius: 6, fontSize: 13, color: 'var(--foreground)', textDecoration: 'none' }
      }, SettingsIcon, 'Notification Settings'),
      // ── Linked accounts: two-step portal picker ──
      otherAccounts.length > 0 ? createElement('div', null,
        createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
        expandedAccount
          // ── Expanded: show portals for selected account ──
          ? createElement('div', null,
              createElement('button', {
                onClick: function() { setExpanded(null) },
                style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  width: '100%', textAlign: 'left' as const, fontSize: 11, fontWeight: 600,
                  color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
              },
                createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none',
                  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
                  style: { flexShrink: 0 } },
                  createElement('path', { d: 'M15 18l-6-6 6-6' })
                ),
                expandedAccount.email
              ),
              expandedAccount.portals.length > 0
                ? expandedAccount.portals.map(function(p) {
                    return createElement('button', {
                      key: p.subdomain,
                      onClick: function() { handlePortalClick(expandedAccount!.user_id, portalUrl(p), p.subdomain) },
                      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                        borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
                        width: '100%', textAlign: 'left' as const, fontSize: 13, color: 'var(--foreground)',
                        transition: 'background .15s' },
                      onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
                      onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
                    },
                      (function() {
                        var _isDk = typeof document !== 'undefined' && (document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches))
                        if (p.logo_mark_url) {
                          var _sub = p.logo_mark_url.match(/\/portals\/([^/]+)\//)
                          var _prods = ['admin','studios','signal','mode','hub','privacyai','sprint-mode','sprint-capital','platform','dev','docs','investors','nomada']
                          if (_sub && _prods.indexOf(_sub[1]) !== -1) {
                            var _themedUrl = _isDk
                              ? 'https://api.sprintmode.ai/brand/' + _sub[1] + '-mark-dark.svg?v=4'
                              : 'https://api.sprintmode.ai/portals/' + _sub[1] + '/logo_mark.svg?v=4'
                            return createElement('img', { src: _themedUrl, alt: '', style: { width: 18, height: 18, display: 'block' } })
                          }
                          return createElement('img', { src: p.logo_mark_url, alt: '', style: { width: 18, height: 18, borderRadius: 4, objectFit: 'contain' as const, display: 'block', flexShrink: 0 } })
                        }
                        var _bc = p.brand_color || 'var(--accent)'
                        return createElement('div', {
                          style: { width: 18, height: 18, borderRadius: 4,
                            background: p.brand_tint || 'var(--accent-10)',
                            color: _bc,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 700, flexShrink: 0 }
                        }, (p.name || p.subdomain).charAt(0).toUpperCase())
                      })(),
                      createElement('span', { style: { fontSize: 13 } }, p.name || p.subdomain)
                    )
                  })
                : createElement('div', { style: { padding: '8px 10px', fontSize: 12, color: 'var(--muted)' } }, 'No portals available')
            )
          // ── Default: show account list ──
          : createElement('div', null,
              createElement('div', {
                style: { padding: '6px 10px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
              }, 'Switch Account'),
              otherAccounts.map(function(acct) {
                var acctInitials = (acct.display_name || acct.email || '?')
                  .split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase()
                return createElement('button', {
                  key: acct.user_id,
                  onClick: function() { setExpanded(acct.user_id) },
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
                    width: '100%', textAlign: 'left' as const, fontSize: 13, color: 'var(--foreground)',
                    transition: 'background .15s' },
                  onMouseEnter: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' },
                  onMouseLeave: function(e: React.MouseEvent<HTMLButtonElement>) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' },
                },
                  acct.photo_url
                    ? createElement('img', { src: acct.photo_url, alt: '',
                        style: { width: 22, height: 22, borderRadius: 5, objectFit: 'cover' as const, flexShrink: 0 } })
                    : createElement('div', {
                        style: { width: 22, height: 22, borderRadius: 5, background: 'var(--accent-10)',
                          color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 600, flexShrink: 0 }
                      }, acctInitials),
                  createElement('div', { style: { flex: 1, minWidth: 0, overflow: 'hidden' } },
                    createElement('div', {
                      style: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }
                    }, acct.display_name || acct.email),
                    createElement('div', {
                      style: { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }
                    }, acct.email)
                  ),
                  createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none',
                    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
                    style: { flexShrink: 0, color: 'var(--muted)' } },
                    createElement('path', { d: 'M9 18l6-6-6-6' })
                  )
                )
              })
            )
      ) : null,
      // ── Add Account ──
      !expandedAccount && meUserId ? createElement('a', {
        href: '/auth/link-account?link_to=' + encodeURIComponent(meUserId) + '&redirect=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/'),
        style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
          borderRadius: 6, fontSize: 13, color: 'var(--foreground)', textDecoration: 'none' }
      },
        createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          style: { flexShrink: 0, color: 'var(--muted)' } },
          createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
          createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
        ),
        'Add Account'
      ) : null,
      createElement('a', {
        href: logoutHref,
        style: { display: 'block', padding: '8px 10px', borderRadius: 6, fontSize: 13,
          color: 'var(--foreground)', textDecoration: 'none' }
      }, 'Sign out')
    ) : null
  )
}

// ── Mount function ─────────────────────────────────────────────────────────
// Signature: mount(element, session, logoutHref)
// Matches the original committed blob exactly.
function mount(element: HTMLElement, session: Session, logoutHref: string) {
  injectDeps()
  ;(window as unknown as Record<string, unknown>).__SM_SESSION = session
  var root: Root = createRoot(element)
  root.render(createElement(UserMenu, { session: session, logoutHref: logoutHref }))
  return { unmount: function() { root.unmount() } }
}

// Expose on window for script-tag usage
declare global {
  interface Window {
    SMUserMenu: { mount: typeof mount }
  }
}

window.SMUserMenu = { mount }
