// NoAccessScreen.tsx — ACCOUNT-SWITCHER-3
// Full-page replacement for the emoji lock access-denied screens.
// Built pixel-for-pixel from Aaron's approved HTML mockups:
//   no_access_redirect_screen.html (Variant A)
//   no_access_switch_available.html (Variant B)

import React, { useState, useEffect } from 'react'

interface PortalInfo {
  subdomain: string
  role: string
  name: string
  brand_color: string | null
  brand_tint: string | null
  icon_key: string | null
  logo_mark_url: string | null
  custom_domain: string | null
  portal_type: string
}

interface LinkedAccount {
  user_id: string
  display_name: string
  email: string
  photo_url: string | null
  is_current: boolean
  portals: PortalInfo[]
}

export interface NoAccessScreenProps {
  portalSubdomain: string
  portalName?: string
  portalBrandColor?: string
  portalIconKey?: string
  email?: string
}

// Inline SVG icons — no Tabler webfont dependency
function LockSvg() {
  return React.createElement('svg', {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
    React.createElement('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }),
    React.createElement('circle', { cx: 12, cy: 16, r: 1 }),
    React.createElement('path', { d: 'M8 11V7a4 4 0 1 1 8 0v4' })
  )
}

function ArrowSvg() {
  return React.createElement('svg', {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M5 12h14' }),
    React.createElement('path', { d: 'M13 18l6-6' }),
    React.createElement('path', { d: 'M13 6l6 6' })
  )
}

function LogoutSvg() {
  return React.createElement('svg', {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { verticalAlign: -1, marginRight: 6 },
    'aria-hidden': 'true',
  },
    React.createElement('path', { d: 'M14 8v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2' }),
    React.createElement('path', { d: 'M9 12h12l-3-3' }),
    React.createElement('path', { d: 'M18 15l3-3' })
  )
}

// Icon paths for portal icons (fallback when no R2 logo)
var ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  code: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'bar-chart': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  shield: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  terminal: '<path d="M5 7l5 5l-5 5"/><path d="M12 19l7 0"/>',
  home: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
}

function portalUrl(p: PortalInfo): string {
  if (p.custom_domain) return 'https://' + p.custom_domain
  return 'https://' + p.subdomain + '.sprintmode.ai'
}

export function NoAccessScreen(props: NoAccessScreenProps) {
  var _accounts = useState<LinkedAccount[]>([]); var accounts = _accounts[0]; var setAccounts = _accounts[1]
  var _loaded = useState(false); var _loadedVal = _loaded[0]; var setLoaded = _loaded[1]
  var _switching = useState(false); var switching = _switching[0]; var setSwitching = _switching[1]
  var _email = useState(props.email || ''); var email = _email[0]; var setEmail = _email[1]

  useEffect(function() {
    fetch('/api/auth/linked-accounts', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean; data?: { accounts: LinkedAccount[] } }) {
        if (data.ok && data.data) {
          setAccounts(data.data.accounts)
          if (!email) {
            var cur = data.data.accounts.find(function(a) { return a.is_current })
            if (cur) setEmail(cur.email)
          }
        }
      })
      .catch(function() {})
      .finally(function() { setLoaded(true) })
  }, [])

  var sub = props.portalSubdomain
  var portalName = props.portalName || sub
  var brandColor = props.portalBrandColor || '#2362ea'
  var currentAccount = accounts.find(function(a) { return a.is_current })
  var currentPortals = currentAccount ? currentAccount.portals : []
  var otherAccounts = accounts.filter(function(a) { return !a.is_current })

  // Find a linked account that has access to this portal
  var switchTarget: LinkedAccount | null = null
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].is_current) continue
    for (var j = 0; j < accounts[i].portals.length; j++) {
      if (accounts[i].portals[j].subdomain === sub) {
        switchTarget = accounts[i]
        break
      }
    }
    if (switchTarget) break
  }

  function handleSwitch(userId: string) {
    setSwitching(true)
    fetch('/api/auth/switch-account', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, target_portal: sub }),
    })
      .then(function(r) { return r.json() })
      .then(function(data: { ok: boolean }) {
        if (data.ok) window.location.reload()
        else setSwitching(false)
      })
      .catch(function() { setSwitching(false) })
  }

  // R2 logo URL (inverted white-on-transparent for colored header box)
  var logoInvertedUrl = 'https://api.sprintmode.ai/portals/' + sub + '/logo_mark_inverted.png'

  // Hover helpers
  function hoverBg(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle, #f3f4f6)' }
  function unhoverBg(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.background = 'transparent' }

  // ── Render — matches approved mockup HTML structure ──
  return React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "var(--font, 'Geist', system-ui, sans-serif)", padding: 24, background: 'var(--bg, #fff)' }
  },
    React.createElement('div', {
      // .frame from approved mockup
      style: { background: 'var(--bg-card, #fff)', borderRadius: 12, padding: 24, maxWidth: 540, width: '100%', border: '0.5px solid var(--border, #e5e7eb)' }
    },
      // ── Header: logo + portal name, left-aligned, border-bottom ──
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, paddingBottom: 16, borderBottom: '0.5px solid var(--border, #e5e7eb)' }
      },
        React.createElement('div', {
          style: { width: 28, height: 28, borderRadius: 6, background: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
        },
          React.createElement('img', {
            src: logoInvertedUrl, alt: '', width: 16, height: 16,
            style: { display: 'block' },
            onError: function(e: React.SyntheticEvent<HTMLImageElement>) {
              // Fallback: render icon SVG path
              var el = e.currentTarget as HTMLImageElement
              el.style.display = 'none'
              var svgNs = 'http://www.w3.org/2000/svg'
              var svg = document.createElementNS(svgNs, 'svg')
              svg.setAttribute('width', '14')
              svg.setAttribute('height', '14')
              svg.setAttribute('viewBox', '0 0 24 24')
              svg.setAttribute('fill', 'none')
              svg.setAttribute('stroke', 'white')
              svg.setAttribute('stroke-width', '2.5')
              svg.setAttribute('stroke-linecap', 'round')
              svg.setAttribute('stroke-linejoin', 'round')
              svg.innerHTML = ICON_PATHS[props.portalIconKey || ''] || ICON_PATHS.grid
              el.parentNode?.appendChild(svg)
            }
          })
        ),
        React.createElement('span', {
          style: { fontSize: 14, fontWeight: 500, color: 'var(--foreground, #171717)' }
        }, portalName)
      ),

      // ── Message: lock icon + heading + email ──
      React.createElement('div', {
        style: { textAlign: 'center', padding: '20px 0 ' + (switchTarget ? '24px' : '28px') }
      },
        React.createElement('div', {
          style: { color: 'var(--muted, #9ca3af)', marginBottom: 8 }
        }, React.createElement(LockSvg, null)),
        React.createElement('h3', {
          style: { fontSize: 16, fontWeight: 500, margin: '0 0 6px', color: 'var(--foreground, #171717)' }
        }, "You don't have access to " + portalName),
        React.createElement('p', {
          style: { fontSize: 13, color: 'var(--muted, #6b7280)', margin: 0, lineHeight: 1.5 }
        }, email ? 'Signed in as ' + email : '')
      ),

      // ── Variant B: Switch CTA ──
      switchTarget ? React.createElement('div', {
        onClick: function() { if (!switching) handleSwitch(switchTarget!.user_id) },
        style: {
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 8,
          border: '1.5px solid var(--accent, #2362ea)',
          background: 'var(--accent-10, rgba(35,98,234,0.1))',
          cursor: switching ? 'wait' : 'pointer',
          marginBottom: 20, opacity: switching ? 0.7 : 1,
        }
      },
        React.createElement('div', {
          style: {
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(35,98,234,0.15)', color: '#2362ea',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 500, flexShrink: 0,
          }
        }, (switchTarget.display_name || switchTarget.email || '?')[0].toUpperCase()),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', {
            style: { fontSize: 13, fontWeight: 500, color: 'var(--accent, #2362ea)' }
          }, 'Switch to ' + switchTarget.email),
          React.createElement('div', {
            style: { fontSize: 11, color: 'var(--muted, #6b7280)' }
          }, 'This account has access to ' + portalName)
        ),
        React.createElement('span', {
          style: { color: 'var(--accent, #2362ea)', flexShrink: 0 }
        }, React.createElement(ArrowSvg, null))
      ) : null,

      // ── Your Portals ──
      currentPortals.length > 0 ? React.createElement(React.Fragment, null,
        switchTarget ? React.createElement('div', {
          style: { height: 0.5, background: 'var(--border, #e5e7eb)', margin: '16px 0' }
        }) : null,
        React.createElement('div', {
          style: { fontSize: 11, fontWeight: 500, color: 'var(--muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 8px' }
        }, 'Your portals'),
        React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }
        },
          currentPortals.map(function(p) {
            var iconColor = p.brand_color || '#2362ea'
            var iconTint = (p.brand_tint || iconColor + '1a')
            var iconPath = ICON_PATHS[p.icon_key || ''] || ICON_PATHS.grid
            return React.createElement('a', {
              key: p.subdomain, href: portalUrl(p),
              style: {
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                textDecoration: 'none', color: 'var(--foreground, #171717)',
                fontSize: 13, fontWeight: 500,
              },
              onMouseEnter: hoverBg, onMouseLeave: unhoverBg,
            },
              // Portal icon — R2 logo or SVG fallback (dark mode: subtle-stroke treatment)
              (() => {
                var _isDk = typeof document !== 'undefined' && (document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches))
                if (p.logo_mark_url) {
                  var _cs: React.CSSProperties = _isDk
                    ? { width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: iconColor + '14', border: '1px solid ' + iconColor + '40', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
                    : { width: 22, height: 22, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }
                  return React.createElement('div', { style: _cs },
                    React.createElement('img', { src: p.logo_mark_url, alt: '', width: _isDk ? 16 : 22, height: _isDk ? 16 : 22, style: { display: 'block', objectFit: 'contain' as const } })
                  )
                }
                return React.createElement('div', {
                  style: {
                    width: 22, height: 22, borderRadius: 5,
                    background: _isDk ? (iconColor + '14') : iconTint,
                    border: _isDk ? ('1px solid ' + iconColor + '40') : 'none',
                    boxSizing: 'border-box' as const,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }
                },
                  React.createElement('svg', {
                    width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none',
                    stroke: iconColor, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
                    dangerouslySetInnerHTML: { __html: iconPath }, 'aria-hidden': 'true',
                  })
                )
              })(),
              p.name,
              React.createElement('span', {
                style: { marginLeft: 'auto', color: 'var(--muted, #9ca3af)', fontSize: 14 }
              }, React.createElement(ArrowSvg, null))
            )
          })
        )
      ) : null,

      // ── Switch Account section (Variant A only — when no switchTarget) ──
      !switchTarget && otherAccounts.length > 0 ? React.createElement(React.Fragment, null,
        React.createElement('div', {
          style: { height: 0.5, background: 'var(--border, #e5e7eb)', margin: '16px 0' }
        }),
        React.createElement('div', {
          style: { fontSize: 11, fontWeight: 500, color: 'var(--muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 8px' }
        }, 'Switch account'),
        otherAccounts.map(function(acct) {
          var initials = (acct.display_name || acct.email || '?')
            .split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase()
          var acctColor = acct.portals.length > 0 && acct.portals[0].brand_color ? acct.portals[0].brand_color : '#6b7280'
          var acctTint = acctColor + '26'
          return React.createElement('div', {
            key: acct.user_id,
            onClick: function() { if (!switching) handleSwitch(acct.user_id) },
            style: {
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6,
              cursor: switching ? 'wait' : 'pointer',
            },
            onMouseEnter: hoverBg, onMouseLeave: unhoverBg,
          },
            React.createElement('div', {
              style: {
                width: 24, height: 24, borderRadius: 6,
                background: acctTint, color: acctColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 500, flexShrink: 0,
              }
            }, initials),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', {
                style: { fontSize: 13, fontWeight: 500, color: 'var(--foreground, #171717)' }
              }, acct.display_name || acct.email),
              React.createElement('div', {
                style: { fontSize: 11, color: 'var(--muted, #6b7280)' }
              }, acct.email)
            )
          )
        })
      ) : null,

      // ── Sign out ──
      React.createElement('div', {
        style: { height: 0.5, background: 'var(--border, #e5e7eb)', margin: '16px 0' }
      }),
      React.createElement('a', {
        href: '/api/auth/logout',
        style: {
          display: 'block', padding: '8px 10px', borderRadius: 6,
          fontSize: 13, color: 'var(--muted, #6b7280)',
          textDecoration: 'none',
        },
        onMouseEnter: function(e: React.MouseEvent<HTMLAnchorElement>) {
          hoverBg(e)
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--foreground, #171717)'
        },
        onMouseLeave: function(e: React.MouseEvent<HTMLAnchorElement>) {
          unhoverBg(e)
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted, #6b7280)'
        },
      },
        React.createElement(LogoutSvg, null),
        'Sign out'
      )
    )
  )
}
