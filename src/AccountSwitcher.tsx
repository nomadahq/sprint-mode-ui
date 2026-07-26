// AccountSwitcher.tsx — ACCOUNT-SWITCHER-5
// Two-step switch: click account → see their portals → click portal → switch.
// Session only changes when user commits to a destination portal.

import React, { useState, useEffect, useCallback } from 'react'
import { themedMarkFromLogoUrl } from './dark-mode'

export interface AccountSwitcherProps {
  /** API base URL (empty string for same-origin) */
  apiBase?: string
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

// Module-level cache — survives mount/unmount cycles so the user menu
// opens instantly after the first fetch. The cache is keyed by apiBase
// so different portals don't collide.
var _linkedCache: Record<string, { accounts: LinkedAccount[]; meUserId: string; ts: number }> = {}
var CACHE_TTL = 60000 // refresh in background after 60 s

export function AccountSwitcher(props: AccountSwitcherProps) {
  var apiBase = props.apiBase || ''

  var cached = _linkedCache[apiBase]
  var _accounts = useState<LinkedAccount[]>(cached ? cached.accounts : []); var accounts = _accounts[0]; var setAccounts = _accounts[1]
  var _loaded = useState(!!cached); var loaded = _loaded[0]; var setLoaded = _loaded[1]
  var _expanded = useState<string | null>(null); var expanded = _expanded[0]; var setExpanded = _expanded[1]
  var _meUserId = useState(cached ? cached.meUserId : ''); var meUserId = _meUserId[0]; var setMeUserId = _meUserId[1]

  var fetchAccounts = useCallback(function() {
    var linkedP = fetch(apiBase + '/api/auth/linked-accounts', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; data?: { accounts: LinkedAccount[] } }) {
        if (data.ok && data.data) {
          setAccounts(data.data.accounts)
          var cur = data.data.accounts.find(function(a) { return a.is_current })
          if (cur) setMeUserId(cur.user_id)
          return data.data.accounts
        }
        return null
      })
      .catch(function() { return null })

    var meP = fetch(apiBase + '/auth/me', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; user?: { id: string } }) {
        if (data.ok && data.user) {
          setMeUserId(function(prev: string) { return prev || data.user!.id })
          return data.user.id
        }
        return null
      })
      .catch(function() { return null })

    Promise.all([linkedP, meP]).then(function(results) {
      setLoaded(true)
      // Update cache
      var accts = results[0] as LinkedAccount[] | null
      var uid = results[1] as string | null
      if (accts) {
        var cur = accts.find(function(a) { return a.is_current })
        _linkedCache[apiBase] = {
          accounts: accts,
          meUserId: uid || (cur ? cur.user_id : ''),
          ts: Date.now(),
        }
      }
    })
  }, [apiBase])

  useEffect(function() {
    // If cache is fresh, skip the fetch entirely
    if (cached && Date.now() - cached.ts < CACHE_TTL) return
    fetchAccounts()
  }, [fetchAccounts])

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

  var currentUrl = typeof window !== 'undefined' ? window.location.href : '/'
  var addAccountHref = meUserId
    ? '/auth/link-account?link_to=' + encodeURIComponent(meUserId) + '&redirect=' + encodeURIComponent(currentUrl)
    : ''

  if (!loaded) return null

  var otherAccounts = accounts.filter(function(a) { return !a.is_current })

  // If an account is expanded, show its portal list instead of the account list
  var expandedAccount = expanded ? otherAccounts.find(function(a) { return a.user_id === expanded }) : null

  if (expandedAccount) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
      // Back button + account name
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
      // Portal list
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
              (() => {
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

  // Default view: account list
  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),

    otherAccounts.length > 0
      ? React.createElement('div', {
          style: { padding: '6px 10px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
        }, 'Switch Account')
      : null,

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
}
