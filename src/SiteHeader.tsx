// SiteHeader -- the Portal Manager shell for LOGGED-OUT public marketing sites.
// FEAT-2997.
//
// This module is deliberately self-contained: it imports ONLY React. Nothing in
// its dependency graph reaches Layout.tsx, api.ts, auth.ts, or any session code,
// so a marketing site that imports it never pulls the auth bundle. It ships as
// its own package entry ('@sprintmode/ui/site') precisely so the consumer bundle
// tree-shakes to a chunk with no session code in it (see the chunk-grep evidence
// on FEAT-2997).
//
// It renders what the fleet shell renders when there is no session: the portal
// mark + wordmark and brand tokens (resolved from portal_configs via the public
// /api/portal/config endpoint), the labeled Auto/Light/Dark theme pill using the
// SAME storage key and data-theme convention as Layout's useTheme, the sign-in
// entry, and the "by Sprint Mode" lockup. It does NOT render cmd-K: the fleet
// shell only shows cmd-K when there is a session, and this is the logged-out
// shell -- match the fleet, do not invent.

import React, { useState, useEffect } from 'react'

// ─── Theme: mirrors Layout.tsx useTheme EXACTLY ─────────────────────────────
// Storage key 'sm-theme'; stored values 'light' | 'dark'; absent = auto. The
// applied data-theme attribute on <html> is always concrete ('light'|'dark')
// because dark overrides across sm-ui and portal CSS are keyed on
// [data-theme="dark"] with no @media twins. This is byte-for-byte the contract
// in Layout.tsx so a theme chosen on the site is honored on the portal and back.

type ThemeMode = 'light' | 'dark' | 'auto'

function getStoredTheme(): ThemeMode {
  try {
    var v = localStorage.getItem('sm-theme')
    if (v === 'light' || v === 'dark') return v
  } catch (_e) { /* private browsing */ }
  return 'auto'
}

function setStoredTheme(t: ThemeMode) {
  try {
    if (t === 'auto') localStorage.removeItem('sm-theme')
    else localStorage.setItem('sm-theme', t)
  } catch (_e) { /* private browsing */ }
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

function applyThemeAttr(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  var applied = mode === 'auto' ? (resolveIsDark('auto') ? 'dark' : 'light') : mode
  document.documentElement.setAttribute('data-theme', applied)
}

function useSiteTheme() {
  var _m = useState<ThemeMode>(getStoredTheme)
  var mode = _m[0]; var setMode = _m[1]
  var _d = useState(function() { return resolveIsDark(mode) })
  var isDark = _d[0]; var setIsDark = _d[1]

  useEffect(function() {
    applyThemeAttr(mode)
    setStoredTheme(mode)
    setIsDark(resolveIsDark(mode))
  }, [mode])

  useEffect(function() {
    if (mode !== 'auto') return
    if (typeof window === 'undefined' || !window.matchMedia) return
    var mq = window.matchMedia('(prefers-color-scheme: dark)')
    var handler = function(e: MediaQueryListEvent) { setIsDark(e.matches); applyThemeAttr('auto') }
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else if (mq.addListener) mq.addListener(handler)
    return function() {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else if (mq.removeListener) mq.removeListener(handler)
    }
  }, [mode])

  return {
    mode: mode,
    isDark: isDark,
    // Cycle: auto -> dark -> light -> auto (matches Layout useTheme).
    toggle: function() {
      setMode(function(cur) {
        if (cur === 'auto') return 'dark'
        if (cur === 'dark') return 'light'
        return 'auto'
      })
    },
  }
}

// ─── Portal config resolution (public endpoint, no session) ─────────────────

export interface SiteHeaderConfig {
  subdomain?: string
  name?: string
  brand_color?: string | null
  brand_tint?: string | null
  logo_mark_url?: string | null
  logo_horizontal_url?: string | null
  logo_dark_url?: string | null
  [key: string]: unknown
}

// Public per-portal logo endpoints (R2-backed, no auth). Used as a fallback when
// the config row does not carry the URLs. Note logo.svg / logo_dark.png 404 for
// some portals (FLEET-MAP 2026-09-02); the config row is the source of truth and
// these paths are only the documented default shape.
function portalAsset(base: string, sub: string, file: string): string {
  return base + '/portals/' + encodeURIComponent(sub) + '/' + file
}

// ─── Inline Tabler-style icons (design-system compliant, no Icons.jsx dep) ──

var ICO = {
  xmlns: 'http://www.w3.org/2000/svg', width: 16, height: 16, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}
function IconSun(p: Record<string, unknown>) {
  return <svg {...ICO} {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function IconMoon(p: Record<string, unknown>) {
  return <svg {...ICO} {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}
function IconDeviceDesktop(p: Record<string, unknown>) {
  return <svg {...ICO} {...p}><rect x="3" y="4" width="18" height="12" rx="1"/><line x1="7" y1="20" x2="17" y2="20"/><line x1="9" y1="16" x2="9" y2="20"/><line x1="15" y1="16" x2="15" y2="20"/></svg>
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SiteHeaderNavLink {
  label: string
  href: string
  external?: boolean
}

export interface SiteHeaderProps {
  /** Portal subdomain. Everything else (name, brand, logos) resolves from
   *  portal_configs via the public /api/portal/config endpoint. */
  subdomain: string
  /** Primary nav links rendered in the header. */
  navLinks?: SiteHeaderNavLink[]
  /** Sign-in destination. Omit to hide the sign-in entry. */
  signInHref?: string
  /** Sign-in label. Default "Sign in". */
  signInLabel?: string
  /** The "by ..." lockup rendered beside the wordmark. Default "by Sprint Mode".
   *  Pass null to hide it. */
  byline?: string | null
  /** Where the logo links to. Default "/". */
  homeHref?: string
  /** Optional element rendered at the far right of the control row. */
  rightSlot?: React.ReactNode
  /** Override the API base for config resolution. Default api.sprintmode.ai. */
  apiBase?: string
  /** Pre-resolved config, to skip the network fetch (e.g. SSR/prerender). */
  config?: SiteHeaderConfig | null
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Rendered inline as a <style> in the header so the layout is correct in SSR /
// prerender output (before hydration) and needs no separate CSS import. Uses the
// sm-ui design tokens the consuming site already loads. Collapses on narrow
// viewports to logo + icon-only theme control + sign-in so it fits phones.

var SITE_HEADER_CSS =
  '.smsh{background:var(--bg-card,var(--bg));border-bottom:1px solid var(--border);position:sticky;top:0;z-index:9000;flex-shrink:0}' +
  '.smsh__inner{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 20px;gap:16px;max-width:var(--max-w,80rem);margin:0 auto}' +
  '.smsh__brand{display:flex;align-items:baseline;gap:8px;text-decoration:none;color:var(--foreground);flex-shrink:0;min-width:0}' +
  '.smsh__logo{height:26px;width:auto;display:block}' +
  '.smsh__name{font-size:17px;font-weight:500;letter-spacing:-0.3px}' +
  '.smsh__byline{font-size:13px;font-weight:400;color:var(--muted);white-space:nowrap}' +
  '.smsh__right{display:flex;align-items:center;gap:10px}' +
  '.smsh__nav{display:flex;align-items:center;gap:20px;margin-right:6px}' +
  '.smsh__nav a{font-size:14px;text-decoration:none;font-family:var(--font);color:var(--muted);white-space:nowrap}' +
  '.smsh__nav a[data-active="true"]{color:var(--foreground);font-weight:600}' +
  '.smsh__pill{height:34px;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:0 10px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);font-family:var(--font);flex-shrink:0;transition:border-color .2s;box-sizing:border-box}' +
  '.smsh__pill:hover{border-color:var(--accent)}' +
  '.smsh__pill-label{font-size:11px;font-weight:500;letter-spacing:.3px}' +
  '.smsh__signin{display:flex;align-items:center;height:34px;padding:0 14px;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none;font-family:var(--font);flex-shrink:0;box-sizing:border-box;white-space:nowrap}' +
  '.smsh__signin:hover{opacity:.9}' +
  '@media (max-width:680px){' +
  '.smsh__inner{padding:0 14px;gap:10px}' +
  '.smsh__byline{display:none}' +
  '.smsh__nav{display:none}' +
  '.smsh__pill-label{display:none}' +
  '.smsh__pill{padding:0 9px}' +
  '}'

// ─── Component ────────────────────────────────────────────────────────────────

export function SiteHeader(props: SiteHeaderProps) {
  var theme = useSiteTheme()
  var navLinks = props.navLinks || []
  var byline = props.byline === undefined ? 'by Sprint Mode' : props.byline
  var homeHref = props.homeHref || '/'
  var signInLabel = props.signInLabel || 'Sign in'

  var _cfg = useState<SiteHeaderConfig | null>(props.config || null)
  var config = _cfg[0]; var setConfig = _cfg[1]

  // Resolve config from the public portal endpoint unless one was supplied.
  useEffect(function() {
    if (props.config) { setConfig(props.config); return }
    if (!props.subdomain) return
    if (typeof fetch === 'undefined') return
    var base = props.apiBase || 'https://api.sprintmode.ai'
    var cancelled = false
    fetch(base + '/api/portal/config?subdomain=' + encodeURIComponent(props.subdomain))
      .then(function(r) { return r.json() })
      .then(function(d: { ok?: boolean; config?: SiteHeaderConfig }) {
        if (!cancelled && d && d.ok && d.config) setConfig(d.config)
      })
      .catch(function() { /* header degrades to the text wordmark */ })
    return function() { cancelled = true }
  }, [props.subdomain, props.apiBase, props.config])

  // Apply brand tokens to :root, same as PortalConfigProvider, so the site and
  // the portal agree on the accent even when the page did not set data-product.
  useEffect(function() {
    if (!config || typeof document === 'undefined') return
    if (config.brand_color) document.documentElement.style.setProperty('--accent', String(config.brand_color))
    if (config.brand_tint) document.documentElement.style.setProperty('--accent-10', String(config.brand_tint))
  }, [config])

  var base = props.apiBase || 'https://api.sprintmode.ai'
  var sub = props.subdomain
  var name = (config && config.name) || 'Sprint Mode'
  // Wordmark = the horizontal lockup image (mark + name), themed light/dark, the
  // same asset the fleet shell renders when there is no page title. The config
  // row is the source of truth; the documented PNG paths are the fallback shape.
  var wordmarkLight = (config && config.logo_horizontal_url) || (sub ? portalAsset(base, sub, 'logo_horizontal.png') : null)
  var wordmarkDark = (config && config.logo_dark_url) || (sub ? portalAsset(base, sub, 'logo_horizontal_dark.png') : null)
  var wordmark = theme.isDark ? (wordmarkDark || wordmarkLight) : wordmarkLight

  var _logoOk = useState(true); var logoOk = _logoOk[0]; var setLogoOk = _logoOk[1]
  useEffect(function() { setLogoOk(true) }, [wordmark])

  var themeLabel = theme.mode === 'auto' ? 'Auto' : theme.mode === 'dark' ? 'Dark' : 'Light'
  var themeTitle = theme.mode === 'auto' ? 'Theme: System' : theme.mode === 'dark' ? 'Theme: Dark' : 'Theme: Light'
  var pathname = typeof window !== 'undefined' ? window.location.pathname : ''

  var ThemeIcon = theme.mode === 'light' ? IconSun : theme.mode === 'dark' ? IconMoon : IconDeviceDesktop

  return (
    <header className="smsh">
      <style dangerouslySetInnerHTML={{ __html: SITE_HEADER_CSS }} />
      <div className="smsh__inner">
        {/* Logo lockup: the portal's horizontal wordmark (themed) + "by ..."
            byline -- the same asset the fleet shell shows with no page title.
            Falls back to the portal name as text if the image fails to load. */}
        <a href={homeHref} className="smsh__brand">
          {wordmark && logoOk ? (
            <picture style={{ display: 'flex', alignItems: 'center' }}>
              {wordmarkDark ? <source srcSet={wordmarkDark} media="(prefers-color-scheme: dark)" /> : null}
              <img
                className="smsh__logo"
                src={wordmark}
                alt={name}
                onError={function() { setLogoOk(false) }}
              />
            </picture>
          ) : (
            <span className="smsh__name">{name}</span>
          )}
          {byline ? <span className="smsh__byline">{byline}</span> : null}
        </a>

        {/* Control row: nav links, theme pill, sign-in, optional right slot */}
        <div className="smsh__right">
          {navLinks.length > 0 ? (
            <nav className="smsh__nav">
              {navLinks.map(function(link) {
                var active = !link.external && pathname === link.href
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    data-active={active ? 'true' : 'false'}
                    {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {link.label}
                  </a>
                )
              })}
            </nav>
          ) : null}

          <button
            className="smsh__pill"
            onClick={theme.toggle}
            aria-label={themeTitle}
            title={themeTitle}
          >
            <ThemeIcon />
            <span className="smsh__pill-label">{themeLabel}</span>
          </button>

          {props.signInHref ? (
            <a className="smsh__signin" href={props.signInHref}>{signInLabel}</a>
          ) : null}

          {props.rightSlot}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
