import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { getSession, SessionData, ACCESS_DENIED } from './api.js'
import { IconSearch, IconMoon, IconSun, IconDeviceDesktop } from './Icons.jsx'
import { NotificationBellNav } from './NotificationBellNav.tsx'
import { AccountSwitcher } from './AccountSwitcher.tsx'
import { NoAccessScreen } from './NoAccessScreen.tsx'
import { BugPanel, BugPanelHeaderButton } from './BugPanel.jsx'
import { usePortalConfig } from './usePortalConfig.jsx'

// ─── Global augmentation for window.__SM_SESSION ───────────────────────────

declare global {
  interface Window {
    __SM_SESSION?: SessionData & { portals?: Record<string, {
      access?: boolean
      view_as?: boolean
      name?: string
      portal_type?: string
      brand_color?: string | null
      brand_tint?: string | null
      icon_key?: string | null
      logo_mark_url?: string | null
      custom_domain?: string | null
    }> }
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CmdKItemMeta {
  badge?: string
  badgeColor?: string
  detail?: string
  breadcrumbs?: string[]
  snippet?: string
}

export interface CmdKItem {
  label: string
  to: string
  section?: string
  subsection?: string
  keywords?: string
  step?: number
  Icon?: React.ComponentType
  disabled?: boolean
  meta?: CmdKItemMeta
}

// WAFFLE-3.5: map /api/bugs rows to palette items. Exported for tests and
// for hosts that build their own providers over the same response shape.
// The badge is the display id (BUG-812) with the raw-id handle as fallback
// for rows created before migration 0193's backfill reaches them.
export interface WaffleSearchRow {
  id: string
  display_id?: string | null
  title?: string | null
  status?: string | null
  product?: string | null
  type?: string | null
  tags?: string | null
  subsystem?: string | null
}

export function mapBugsToCmdKItems(rows: WaffleSearchRow[]): CmdKItem[] {
  return (rows || []).map(function(b) {
    var handle = b.display_id || (b.id || '').slice(0, 12)
    return {
      label: b.title || handle,
      to: '?bug=' + encodeURIComponent(b.id),
      section: 'Work items',
      keywords: [b.id, b.display_id, b.tags, b.subsystem, b.product].filter(Boolean).join(' '),
      meta: {
        badge: handle,
        detail: [b.status, b.product].filter(Boolean).join(' \u00b7 '),
      },
    }
  })
}

export interface CmdKProps {
  open: boolean
  onClose: () => void
  items?: CmdKItem[]
  onNavigate?: (to: string) => void
  placeholder?: string
  onSearch?: (query: string) => Promise<{ items: CmdKItem[]; total?: number }>
  recentKey?: string
}

export interface NavItem {
  to: string
  label: string
  icon?: string
  Icon?: React.ComponentType | null
  exact?: boolean
  external?: boolean
  disabled?: boolean
  step?: number
  completed?: boolean
  locked?: boolean
  permKey?: string
  href?: string
}

export interface NavSection {
  key?: string
  label: string
  items: NavItem[]
  sectionIcon?: React.ReactNode
  sectionColor?: string
  product?: string
  flat?: boolean
  type?: string
  /** Render this (non-flat) section collapsed until the user opens it.
   *  User toggles persist to localStorage and win over this default;
   *  a child route becoming active still auto-opens the group. */
  defaultCollapsed?: boolean
}

export interface HeaderCta {
  label: string
  onClick: () => void
  variant?: 'outline' | 'filled'
}

export interface LayoutProps {
  navConfig?: Record<string, { label: string; items: NavItem[] }>
  navSections?: (NavSection & { type?: string; heading?: string })[]
  /** Unfiltered nav sections for route-level permission checking.
   * When the parent component pre-filters navSections (e.g. filterNavByPermissions),
   * denied items are removed and the route guard can't find them. Pass the ORIGINAL
   * unfiltered sections here so the route guard can block direct URL navigation
   * to denied routes. Falls back to navSections if not provided. */
  routeGuardNav?: (NavSection & { type?: string; heading?: string })[]
  navBottom?: NavItem[]
  session?: SessionData | null
  children?: React.ReactNode
  logoSrc?: string
  logoAlt?: string
  title?: string
  headerRight?: React.ReactNode
  sidebarBottom?: React.ReactNode
  viewAsEnabled?: boolean
  viewAsApi?: string
  /** Deprecated (PORTAL-RBAC-VIEWAS-3): the server lens needs no client detail
   *  fetch. Accepted for backward compatibility, ignored. */
  viewAsDetailApi?: string
  /** Base URL for the lens endpoints (/auth/view-as, /auth/exit-view-as).
   *  Defaults to https://api.sprintmode.ai -- override on custom-domain
   *  portals whose cookies cannot cross to sprintmode.ai. */
  viewAsAuthBase?: string
  headerIcon?: React.ReactNode
  onLogout?: string
  profilePath?: string
  cmdK?: boolean | { placeholder?: string }
  cmdKItems?: CmdKItem[]
  onSearch?: (query: string) => Promise<{ items: CmdKItem[]; total?: number }>
  recentKey?: string
  showCompanyName?: boolean
  byLine?: string
  userMenuExtra?: React.ReactNode
  notificationApiBase?: string
  notificationHref?: string
  headerCta?: HeaderCta
  viewAsAnyRole?: boolean
  onViewAsChange?: (viewAs: ViewAsUser | null) => void
  onViewAsTeamChange?: (viewAs: ViewAsUser | null) => void
  bugPanel?: boolean | number
  bugPanelAdmin?: boolean
  bugPanelLabel?: string
  /** WAFFLE-3.5: forwarded to the embedded panel — its MCP Keys button navigates here instead of opening the modal. */
  bugPanelMcpKeysHref?: string
  portalSubdomain?: string
  viewAsClientNav?: (NavSection & { type?: string; heading?: string })[]
}

// ─── Session Context ────────────────────────────────────────────────────────

var SessionContext = createContext<SessionData | null>(null)
export function useSession() { return useContext(SessionContext) }

// ─── View-As Context ────────────────────────────────────────────────────────

export interface ViewAsUser {
  email: string
  name: string
  company_id?: string
  company_name?: string
  portal_role?: string
  role?: string
  role_type?: string
  products?: string[]
  id?: string
  user_id?: string
  contact_id?: string
  role_label?: string
  permissions?: string | Record<string, unknown>
}

export var ViewAsContext = createContext<ViewAsUser | null>(null)
export function useViewAs() { return useContext(ViewAsContext) }

// ViewAsTeamContext — carries the selected team member (role/perms context only, no company scoping)
export var ViewAsTeamContext = createContext<ViewAsUser | null>(null)
export function useViewAsTeam() { return useContext(ViewAsTeamContext) }

// ─── Theme ─────────────────────────────────────────────────────────────────
// 3-state: 'light' | 'dark' | 'auto'
// 'auto' = no data-theme attr on <html>, CSS @media handles it
// 'light'/'dark' = set data-theme attr explicitly

function getStoredTheme(): 'light' | 'dark' | 'auto' {
  try {
    var v = localStorage.getItem('sm-theme')
    if (v === 'light' || v === 'dark') return v
  } catch (_e) { /* noop */ }
  return 'auto'
}
function setStoredTheme(t: 'light' | 'dark' | 'auto') {
  try {
    if (t === 'auto') localStorage.removeItem('sm-theme')
    else localStorage.setItem('sm-theme', t)
  } catch (_e) { /* noop */ }
}

function applyThemeAttr(mode: 'light' | 'dark' | 'auto') {
  // Auto must RESOLVE to a concrete attribute: dark overrides across sm-ui and
  // portal CSS are keyed on [data-theme="dark"] with no @media twins, so
  // "no attribute = auto" left auto+OS-dark half-light (Signal tint cards,
  // sidebar accents rendered light on dark). The stored PREFERENCE stays
  // 'auto'; only the applied attribute is resolved.
  var applied = mode === 'auto' ? (resolveIsDark('auto') ? 'dark' : 'light') : mode
  document.documentElement.setAttribute('data-theme', applied)
}

function resolveIsDark(mode: 'light' | 'dark' | 'auto'): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

export function useTheme() {
  var _m = useState<'light' | 'dark' | 'auto'>(getStoredTheme)
  var mode = _m[0]; var setMode = _m[1]
  var _d = useState(function() { return resolveIsDark(mode) })
  var isDark = _d[0]; var setIsDark = _d[1]

  // Apply data-theme attr + persist
  useEffect(function() {
    applyThemeAttr(mode)
    setStoredTheme(mode)
    setIsDark(resolveIsDark(mode))
  }, [mode])

  // Listen for OS theme changes when in auto mode
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
    setMode: function(m: 'light' | 'dark' | 'auto') { setMode(m) },
    // Cycle: auto → dark → light → auto (matches PAI toggle)
    toggle: function() {
      setMode(function(cur) {
        if (cur === 'auto') return 'dark'
        if (cur === 'dark') return 'light'
        return 'auto'
      })
    }
  }
}

import { isDarkMode, getThemedMarkUrl } from './dark-mode'

// ─── CmdK ──────────────────────────────────────────────────────────────────

var BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  green:  { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  red:    { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
  blue:   { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  amber:  { bg: 'rgba(245,158,11,0.12)',  color: '#d97706' },
  orange: { bg: 'rgba(249,115,22,0.12)',  color: '#ea580c' },
  purple: { bg: 'rgba(168,85,247,0.12)',  color: '#9333ea' },
  indigo: { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
  gray:   { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
}

function getRecent(key: string): CmdKItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]').slice(0, 8) } catch(_e) { return [] }
}
function pushRecent(key: string, item: CmdKItem) {
  try {
    var list = getRecent(key).filter(function(r) { return r.to !== item.to })
    list.unshift({ label: item.label, to: item.to, section: item.section || '', subsection: item.subsection || '' })
    localStorage.setItem(key, JSON.stringify(list.slice(0, 8)))
  } catch(_e) {}
}

function highlightMatch(label: string, query: string): React.ReactNode[] {
  if (!query) return [label]
  var lower = (label || '').toLowerCase()
  var idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return [label]
  return [
    label.slice(0, idx),
    React.createElement('strong', { key: 'hl', style: { fontWeight: 700 } }, label.slice(idx, idx + query.length)),
    label.slice(idx + query.length)
  ]
}

export function CmdK(props: CmdKProps) {
  var open = props.open; var onClose = props.onClose; var items = props.items || []
  var onNavigate = props.onNavigate; var placeholder = props.placeholder || 'Jump to...'
  var onSearch = props.onSearch; var recentKey = props.recentKey
  var _q = useState(''); var q = _q[0]; var setQ = _q[1]
  var _hi = useState(0); var hi = _hi[0]; var setHi = _hi[1]
  var _asyncItems = useState<CmdKItem[]>([]); var asyncItems = _asyncItems[0]; var setAsyncItems = _asyncItems[1]
  var _asyncTotal = useState(0); var asyncTotal = _asyncTotal[0]; var setAsyncTotal = _asyncTotal[1]
  var _loading = useState(false); var loading = _loading[0]; var setLoading = _loading[1]
  var inputRef = useRef<HTMLInputElement>(null)
  var debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  var searchIdRef = useRef(0)

  var filtered = open ? items.filter(function(s) {
    if (s.disabled) return false
    if (!q) return true
    var ql = q.toLowerCase()
    return (s.label || '').toLowerCase().indexOf(ql) !== -1 ||
           (s.section || '').toLowerCase().indexOf(ql) !== -1 ||
           (s.keywords || '').toLowerCase().indexOf(ql) !== -1
  }) : []

  useEffect(function() {
    if (!open || !onSearch) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setAsyncItems([]); setAsyncTotal(0); setLoading(false); return }
    setLoading(true)
    var id = ++searchIdRef.current
    debounceRef.current = setTimeout(function() {
      if (!onSearch) return
      onSearch(q).then(function(result) {
        if (id !== searchIdRef.current) return
        setAsyncItems((result && result.items) || [])
        setAsyncTotal((result && result.total) || 0)
        setLoading(false)
      }).catch(function() {
        if (id !== searchIdRef.current) return
        setAsyncItems([]); setAsyncTotal(0); setLoading(false)
      })
    }, 200)
    return function() { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, open])

  var recentItems: CmdKItem[] = (open && !q && recentKey) ? getRecent(recentKey) : []

  useEffect(function() { if (open && inputRef.current) { inputRef.current.focus(); setQ(''); setHi(0); setAsyncItems([]); setAsyncTotal(0); setLoading(false) } }, [open])
  useEffect(function() { setHi(0) }, [q])

  // Merge static filtered items with async results, deduplicating by `to` path.
  // Static items appear first; async results with the same `to` are suppressed.
  var staticToPaths = new Set(filtered.map(function(i) { return i.to || '' }).filter(Boolean))
  var dedupedAsync = q ? asyncItems.filter(function(i) { return !i.to || !staticToPaths.has(i.to) }) : []
  var allItems = q ? filtered.concat(dedupedAsync) : (recentItems.length > 0 ? recentItems : filtered)

  useEffect(function() {
    if (!open) return
    var handler = function(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(function(h) { return h < allItems.length - 1 ? h + 1 : 0 }) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi(function(h) { return h > 0 ? h - 1 : allItems.length - 1 }) }
      if (e.key === 'Enter') {
        e.preventDefault()
        var sel = allItems[hi]
        if (sel && sel.to) {
          if (recentKey) pushRecent(recentKey, sel)
          onClose()
          if (onNavigate) onNavigate(sel.to); else window.location.href = sel.to
        }
      }
    }
    window.addEventListener('keydown', handler)
    return function() { window.removeEventListener('keydown', handler) }
  }, [open, allItems.length, hi])

  if (!open) return null

  function selectItem(item: CmdKItem) {
    if (recentKey) pushRecent(recentKey, item)
    onClose()
    if (onNavigate) onNavigate(item.to); else if (item.to) window.location.href = item.to
  }

  function renderRow(item: CmdKItem, idx: number, isHi: boolean) {
    var meta = item.meta || {}
    var bc = BADGE_COLORS[meta.badgeColor || ''] || BADGE_COLORS.gray
    var sectionLabel = item.subsection ? (item.section + ' > ' + item.subsection) : ''
    var hasBreadcrumbs = meta.breadcrumbs && meta.breadcrumbs.length > 0

    return React.createElement('a', {
      key: item.to || item.label || idx,
      href: item.to || '#',
      onClick: function(e: React.MouseEvent) { e.preventDefault(); selectItem(item) },
      onMouseEnter: function() { setHi(idx) },
      style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', color: 'var(--foreground)', fontSize: 13, background: isHi ? 'var(--bg-subtle)' : 'transparent', minHeight: 36 }
    },
      React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: (hasBreadcrumbs || meta.snippet) ? 'column' as const : 'row' as const, gap: (hasBreadcrumbs || meta.snippet) ? 1 : 8, minWidth: 0, justifyContent: (hasBreadcrumbs || meta.snippet) ? 'center' : undefined } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
          item.step != null
            ? React.createElement('span', { style: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '1.5px solid var(--accent)', color: 'var(--accent)', background: 'var(--accent-10)', flexShrink: 0 } }, item.step)
            : item.Icon
              ? React.createElement(item.Icon, null)
              : null,
          React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            sectionLabel && !hasBreadcrumbs
              ? React.createElement(React.Fragment, null,
                  React.createElement('span', { style: { color: 'var(--muted)', fontSize: 11 } }, sectionLabel + ' > '),
                  highlightMatch(item.label, q)
                )
              : highlightMatch(item.label, q)
          )
        ),
        hasBreadcrumbs
          ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', paddingLeft: item.step != null || item.Icon ? 30 : 0 } },
              meta.breadcrumbs!.map(function(crumb, i) {
                return React.createElement(React.Fragment, { key: i },
                  i > 0 ? React.createElement('span', { style: { fontSize: 9, opacity: 0.5 } }, '\u203A') : null,
                  React.createElement('span', null, crumb)
                )
              })
            )
          : null,
        meta.snippet
          ? React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: item.step != null || item.Icon ? 30 : 0, maxWidth: 400 } }, meta.snippet)
          : null
      ),
      (meta.badge || (meta.detail && !meta.snippet))
        ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11 } },
            meta.badge
              ? React.createElement('span', { style: { padding: '1px 7px', borderRadius: 9, fontSize: 10, fontWeight: 600, background: bc.bg, color: bc.color, whiteSpace: 'nowrap' } }, meta.badge)
              : null,
            meta.detail && !meta.snippet
              ? React.createElement('span', { style: { color: 'var(--muted)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } }, meta.detail)
              : null
          )
        : null
    )
  }

  function renderGrouped(itemList: CmdKItem[], startIdx: number) {
    var sections: string[] = []; var sectionMap: Record<string, CmdKItem[]> = {}
    itemList.forEach(function(item) {
      var sec = item.section || ''
      if (!sectionMap[sec]) { sectionMap[sec] = []; sections.push(sec) }
      sectionMap[sec].push(item)
    })
    var idx = startIdx
    return sections.map(function(sec) {
      return React.createElement(React.Fragment, { key: sec || '_' + idx },
        sec ? React.createElement('div', { style: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', padding: '8px 12px 4px' } }, sec) : null,
        sectionMap[sec].map(function(item) {
          var i = idx++
          return renderRow(item, i, i === hi)
        })
      )
    })
  }

  function renderSkeletons() {
    return [0, 1, 2].map(function(i) {
      return React.createElement('div', { key: 'skel-' + i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' } },
        React.createElement('div', { style: { width: 180 + (i * 30), height: 12, borderRadius: 4, background: 'var(--bg-subtle)', animation: 'cmdk-pulse 1.2s ease-in-out infinite' } }),
        React.createElement('div', { style: { flex: 1 } }),
        React.createElement('div', { style: { width: 50, height: 12, borderRadius: 4, background: 'var(--bg-subtle)', animation: 'cmdk-pulse 1.2s ease-in-out infinite', animationDelay: '0.2s' } })
      )
    })
  }

  var showRecent = !q && recentItems.length > 0
  var showEmpty = !q && recentItems.length === 0 && filtered.length === 0
  var showNoResults = q && filtered.length === 0 && asyncItems.length === 0 && !loading
  var overflowCount = asyncTotal > asyncItems.length ? asyncTotal - asyncItems.length : 0
  var totalCount = q ? filtered.length + asyncItems.length : (showRecent ? recentItems.length : filtered.length)

  return (
    React.createElement(React.Fragment, null,
      React.createElement('style', null, '@keyframes cmdk-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }'),
      React.createElement('div', { onClick: onClose, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000 } }),
      React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, pointerEvents: 'none' } },
        React.createElement('div', { style: { width: 520, maxWidth: '90vw', pointerEvents: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '60vh', overflow: 'hidden' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 } },
            React.createElement(IconSearch, null),
            React.createElement('input', { ref: inputRef, value: q, onChange: function(e: React.ChangeEvent<HTMLInputElement>) { setQ(e.target.value) }, placeholder: placeholder, style: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--foreground)', fontFamily: 'var(--font)' } }),
            React.createElement('kbd', { style: { fontSize: 11, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--muted)' } }, 'esc')
          ),
          React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: 6 } },
            showRecent
              ? React.createElement(React.Fragment, null,
                  React.createElement('div', { style: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', padding: '8px 12px 4px' } }, 'Recent'),
                  recentItems.map(function(item, i) { return renderRow(item, i, i === hi) })
                )
              : null,
            q && filtered.length > 0 ? renderGrouped(filtered, 0) : null,
            q && asyncItems.length > 0 ? renderGrouped(asyncItems, filtered.length) : null,
            q && loading ? renderSkeletons() : null,
            overflowCount > 0
              ? React.createElement('div', { style: { padding: '6px 12px', fontSize: 11, color: 'var(--muted)', textAlign: 'center' } }, overflowCount + ' more results')
              : null,
            showEmpty
              ? React.createElement('div', { style: { padding: '16px 12px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' } }, 'Start typing to search')
              : null,
            showNoResults
              ? React.createElement('div', { style: { padding: '16px 12px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' } }, 'Try searching by name, domain, or email')
              : null,
            !q && !showRecent && filtered.length > 0 ? renderGrouped(filtered, 0) : null
          ),
          React.createElement('div', { style: { borderTop: '1px solid var(--border)', padding: '6px 16px', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 } },
            React.createElement('span', { style: { fontSize: 9, color: 'var(--muted)' } }, totalCount + ' items'),
            React.createElement('div', { style: { flex: 1 } }),
            React.createElement('span', { style: { fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('kbd', { style: { padding: '1px 4px', background: 'var(--bg-subtle)', borderRadius: 3, border: '0.5px solid var(--border)' } }, '\u2191\u2193'),
              'navigate',
              React.createElement('kbd', { style: { padding: '1px 4px', background: 'var(--bg-subtle)', borderRadius: 3, border: '0.5px solid var(--border)' } }, '\u21B5'),
              'select',
              React.createElement('kbd', { style: { padding: '1px 4px', background: 'var(--bg-subtle)', borderRadius: 3, border: '0.5px solid var(--border)' } }, 'esc'),
              'close'
            )
          )
        )
      )
    )
  )
}

// ─── Header User Menu ───────────────────────────────────────────────────────

function HeaderUserMenu(props: {
  session: SessionData | null
  profilePath?: string
  logoutHref: string
  userMenuExtra?: React.ReactNode
  portalSubdomain?: string
}) {
  var session = props.session; var profilePath = props.profilePath; var logoutHref = props.logoutHref
  var userMenuExtra = props.userMenuExtra
  var _open = useState(false); var open = _open[0]; var setOpen = _open[1]
  var ref = useRef<HTMLDivElement>(null)

  useEffect(function() {
    var close = function(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return function() { document.removeEventListener('mousedown', close) }
  }, [])

  var initials = session ? (session.name || session.email || '?').split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase() : '?'
  var displayName = session ? (session.name ? session.name.split(' ')[0] : (session.email ? session.email.split('@')[0] : '')) : ''
  var roleLabel = session && (session as any).role ? (session as any).role.replace(/_/g, ' ') : (session && session.portal_role ? session.portal_role.replace(/_/g, ' ') : '')
  var photo = session && (session as any).photo as string | undefined

  var avatarEl = photo
    ? React.createElement('img', { src: photo, alt: '', style: { width: 26, height: 26, borderRadius: 6, objectFit: 'cover', display: 'block', flexShrink: 0 } })
    : React.createElement('div', { style: { width: 26, height: 26, borderRadius: 6, background: 'var(--accent-10)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 } }, initials)

  return React.createElement('div', { ref: ref, style: { position: 'relative' } },
    React.createElement('button', {
      onClick: function() { setOpen(function(o) { return !o }) },
      className: 'shell-header-avatar',
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', transition: 'border-color .2s', flexShrink: 0 }
    },
      avatarEl,
      React.createElement('span', { style: { fontSize: 13, color: 'var(--foreground)', fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, displayName)
    ),
    open ? React.createElement('div', { style: { position: 'absolute', right: 0, top: 42, width: 220, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, zIndex: 100 } },
      React.createElement('div', { style: { padding: '8px 10px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--border)', marginBottom: 4 } },
        React.createElement('div', { style: { fontWeight: 600, color: 'var(--foreground)', fontSize: 13 } }, session && session.name),
        session && session.email ? React.createElement('div', null, session.email) : null,
        roleLabel ? React.createElement('div', { style: { marginTop: 2 } }, roleLabel) : (session && (session as any).company_name ? React.createElement('div', { style: { marginTop: 2 } }, (session as any).company_name) : null),
        profilePath ? React.createElement('a', { href: profilePath, style: { display: 'block', marginTop: 6, padding: '5px 0', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 } }, 'View Profile') : null
      ),
      React.createElement('a', { href: '/user/notifications', style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: 'var(--foreground)', textDecoration: 'none' } },
        React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, color: 'var(--muted)' } },
          React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
          React.createElement('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })
        ),
        'Notification Settings'
      ),
      userMenuExtra || null,
      React.createElement(AccountSwitcher, { product: props.portalSubdomain || undefined }),
      React.createElement('a', { href: logoutHref, style: { display: 'block', padding: '8px 10px', borderRadius: 6, fontSize: 13, color: 'var(--foreground)', textDecoration: 'none' } }, 'Sign out')
    ) : null
  )
}

// ─── Portal Switcher ────────────────────────────────────────────────────────

var _ICON_KEY_SVG_PATHS: Record<string, string> = {
  'grid':        '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'code':        '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>',
  'bar-chart':   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  'file-text':   '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"/><path d="M9 9l1 0"/><path d="M9 13l6 0"/><path d="M9 17l6 0"/>',
  'terminal':    '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7l5 5l-5 5"/><path d="M12 19l7 0"/>',
  'book-open':   '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'layers':      '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'shield':      '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
  'lock':        '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>',
  'book':        '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>',
}

// ─── Portal Dock (Cmd+C) — macOS Cmd+Tab style overlay ──────────────────────
// PORTAL-SWITCHER-UX-1: replaced search-list picker with horizontal icon dock.
// Trigger: Cmd+C (hold). Tap C to advance, Shift+C to go back, release to nav.
// Portals sourced from window.__SM_SESSION.portals (access: true only).
// Hide entirely when user has only 1 accessible portal (portalCount <= 1).

function PortalPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  var _sel = useState(0); var sel = _sel[0]; var setSel = _sel[1]
  var _portals = useState<PortalEntry[]>([]); var portals = _portals[0]; var setPortals = _portals[1]

  // Build portal list from session on open
  useEffect(function() {
    if (!open) return
    var sessionPortals = (typeof window !== 'undefined' && window.__SM_SESSION && window.__SM_SESSION.portals) || null
    if (sessionPortals) {
      var list: PortalEntry[] = Object.entries(sessionPortals)
        .filter(function(entry) { return entry[1].access })
        .map(function(entry) {
          var sub = entry[0]
          var p = entry[1]
          return {
            portal: sub,
            role: 'member',
            name: p.name || sub,
            portal_type: p.portal_type || 'sm',
            brand_color: p.brand_color || null,
            brand_tint: p.brand_tint || null,
            icon_key: p.icon_key || null,
            logo_mark_url: p.logo_mark_url || null,
            custom_domain: p.custom_domain || null,
          }
        })
      _portalCache = list
      setPortals(list)
      // Pre-select current portal
      var currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
      var currentIdx = list.findIndex(function(p) {
        var domain = p.custom_domain || (p.portal + '.sprintmode.ai')
        return currentHost === domain || currentHost.startsWith(p.portal + '.')
      })
      setSel(currentIdx >= 0 ? currentIdx : 0)
      return
    }
    if (_portalCache) {
      setPortals(_portalCache)
      setSel(0)
      return
    }
    fetch('/api/my-portals', { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: { portals?: PortalEntry[] } }) {
        if (d.ok && d.data && d.data.portals) { _portalCache = d.data.portals; setPortals(d.data.portals) }
      }).catch(function() {})
  }, [open])

  function navigateToPortal(idx: number) {
    var p = portals[idx]
    if (!p) return
    var domain = p.custom_domain || (p.portal + '.sprintmode.ai')
    var currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
    // If already on selected portal, just dismiss
    if (currentHost === domain || currentHost.startsWith(p.portal + '.')) {
      onClose()
      return
    }
    window.location.href = 'https://' + domain
    onClose()
  }

  useEffect(function() {
    if (!open) return
    function onDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      // Cmd+C / Ctrl+C: advance selection (swallow to prevent browser copy)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setSel(function(s) { return portals.length ? (s + 1) % portals.length : 0 })
        return
      }
      // Cmd+Shift+C / Ctrl+Shift+C: go back
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setSel(function(s) { return portals.length ? (s - 1 + portals.length) % portals.length : 0 })
        return
      }
      // Arrow keys also move selection
      if (e.key === 'ArrowRight') { e.preventDefault(); setSel(function(s) { return portals.length ? (s + 1) % portals.length : 0 }); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(function(s) { return portals.length ? (s - 1 + portals.length) % portals.length : 0 }); return }
    }
    // Cmd keyup = navigate (same as macOS Cmd+Tab releasing Cmd commits selection)
    function onUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control') {
        navigateToPortal(sel)
      }
    }
    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
    return function() {
      window.removeEventListener('keydown', onDown, true)
      window.removeEventListener('keyup', onUp, true)
    }
  }, [open, sel, portals])

  if (!open || portals.length === 0) return null

  // Responsive: each icon slot is 72px, gaps 8px, pill padding 20px each side.
  // Max pill width = 100vw - 32px. If portals overflow, icons scale down uniformly.
  // Icon renders at full 72px — source is 512px so always sharp.
  // No background blur/dim behind the overlay (matches macOS Cmd+Tab exactly).
  // No per-icon color box — transparent background on each slot.
  // Selected icon gets a rounded rect highlight only.

  return React.createElement(React.Fragment, null,
    // Transparent click-away — no blur, no dim
    React.createElement('div', {
      onClick: onClose,
      style: { position: 'fixed', inset: 0, zIndex: 9998 }
    }),
    // Outer wrapper: constrains pill to viewport width with padding
    React.createElement('div', {
      style: {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box' as const,
      }
    },
      // Single pill: icons + labels in one container
      React.createElement('div', {
        style: {
          display: 'flex', flexDirection: 'row' as const, alignItems: 'flex-start',
          flexWrap: 'nowrap' as const,
          padding: '20px 20px 16px',
          borderRadius: 20,
          background: 'rgba(30,30,36,0.90)',
          border: '0.5px solid rgba(255,255,255,0.13)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
          overflowX: 'auto' as const,
          // Hide scrollbar but allow scroll if truly tiny viewport
          msOverflowStyle: 'none' as const,
        }
      },
        portals.map(function(p, i) {
          var isSelected = i === sel
          return React.createElement('div', {
            key: p.portal,
            onClick: function() { navigateToPortal(i) },
            style: {
              display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
              gap: 8,
              // Use vw-based flex to shrink uniformly on narrow screens,
              // capped at 92px per slot (72px icon + 10px padding each side)
              flex: '0 1 auto',
              minWidth: 0,
              width: 'clamp(52px, calc((100vw - 72px) / ' + portals.length + '), 92px)',
              cursor: 'pointer',
              paddingTop: 0,
            }
          },
            // Icon — no color background, selection = highlight rect only
            React.createElement('div', {
              style: {
                // Icon scales with slot width; intrinsic 72px, shrinks on narrow screens
                width: '100%', aspectRatio: '1/1' as const,
                maxWidth: 72, margin: '0 auto',
                borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                outline: isSelected ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                outlineOffset: 2,
                overflow: 'hidden',
                transition: 'background 0.1s, outline-color 0.1s',
                boxSizing: 'border-box' as const,
              }
            },
              p.logo_mark_url
                ? React.createElement('img', {
                    src: p.logo_mark_url.replace('logo_mark.png', 'logo_mark_inverted.png'),
                    alt: p.name || p.portal,
                    style: { width: '100%', height: '100%', objectFit: 'contain' as const, display: 'block' },
                  })
                : React.createElement('span', {
                    style: {
                      fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
                      fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 700,
                      color: '#fff', letterSpacing: '-0.5px',
                    }
                  }, (p.name || p.portal).slice(0, 2).toUpperCase())
            ),
            // Label inside the pill
            React.createElement('div', {
              style: {
                width: '100%', minWidth: 0,
                textAlign: 'center' as const,
                fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
                fontSize: 11, fontWeight: isSelected ? 600 : 400,
                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)',
                whiteSpace: 'nowrap' as const,
                overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '0.01em',
                transition: 'color 0.1s',
              }
            }, p.name || p.portal)
          )
        })
      )
    )
  )
}

interface PortalEntry {
  portal: string
  role?: string
  name?: string
  portal_type?: string
  brand_color?: string | null
  brand_tint?: string | null
  icon_key?: string | null
  logo_mark_url?: string | null
  custom_domain?: string | null
}

var _portalCache: PortalEntry[] | null = null
var _portalFetch: Promise<PortalEntry[]> | null = null

// PortalSwitcher — retained as a no-op export for backward compat.
// Portal list removed from user menu (PORTAL-SWITCHER-FIX-1 B6).
// Users switch portals via Cmd+C shortcut; the badge is shown in the header.
export function PortalSwitcher() {
  return null
}

// ─── Product Colors ─────────────────────────────────────────────────────────

var PRODUCT_COLORS: Record<string, { color: string; tint: string }> = {
  'sprint-mode':    { color: '#2362ea', tint: '#e9effc' },
  'studios':        { color: '#7947d1', tint: '#f1ecfa' },
  'mode':           { color: '#0D9488', tint: '#e6f5f3' },
  'hub':            { color: '#4f5d93', tint: '#eef0f8' },
  'sprint-capital': { color: '#1fac6a', tint: '#e8f6f0' },
  'privacyai':      { color: '#0891b2', tint: '#e0f4f9' },
  'signal':         { color: '#c94277', tint: '#f9ecf1' },
  'waffle':         { color: '#E8A13C', tint: '#FBEEDA' },
  'investor':       { color: '#2362ea', tint: '#e9effc' },
}

// ─── Permission Helpers ─────────────────────────────────────────────────────

export interface Permissions {
  sections?: Record<string, { view?: boolean; login?: boolean }>
  products?: Record<string, boolean>
}

export function parsePerms(session: SessionData | ViewAsUser | null): Permissions | null {
  if (!session || !(session as any).permissions) return null
  try {
    var p = (session as any).permissions
    var raw = typeof p === 'string' ? JSON.parse(p) : p
    if (!raw || typeof raw !== 'object') return null
    // resolvePermissions returns a flat Record<string, Permission> (e.g. { dashboard: { view: true } }).
    // If the object already has a .sections key that is an object, assume it's already wrapped.
    // Otherwise wrap the flat map so canViewSection/canViewProduct can read perms.sections[key].
    if (raw.sections && typeof raw.sections === 'object') return raw
    return { sections: raw, products: raw.products || undefined }
  } catch (_e) { return null }
}

export function canViewSection(perms: Permissions | null, role: string | null | undefined, key: string | undefined): boolean {
  if (!key) return true
  if (role === 'super_admin') return true
  // THE SECOND FLIP (IDENTITY-RECONCILE-1, TASK-1923): a NULL/absent
  // permissions object now DENIES — the A2 "flash of allow" is dead and
  // deny-by-default is total. This is safe because (a) Layout spinner-blocks
  // until /auth/me resolves, so the gate is never consulted mid-load, and
  // (b) post leaf-wins migration 0271 every live role row is complete
  // leaf-only, so a RESOLVED session always carries permissions. A null here
  // therefore means no session / failed resolution — deny, never flash.
  // (The empty-record deny below shipped earlier: PORTAL-RBAC-SHELLS,
  // square 1647, Aaron go 2026-08-07.)
  if (!perms || !perms.sections) return false
  if (Object.keys(perms.sections).length === 0) return false
  var entry = perms.sections[key]
  // Key not in permissions → deny (if other keys exist, this one was
  // intentionally excluded or set to none)
  if (!entry) {
    var dotIdx = key.indexOf('.')
    if (dotIdx > 0) {
      var parentEntry = perms.sections[key.substring(0, dotIdx)]
      if (parentEntry) return parentEntry.view !== false
    }
    return false
  }
  return entry.view !== false
}

function canViewProduct(perms: Permissions | null, role: string | null | undefined, product: string | undefined): boolean {
  if (!product) return true
  if (role === 'super_admin') return true
  // NULL perms deny — same A2 flash-of-allow class as canViewSection
  // (IDENTITY-RECONCILE-1, TASK-1923). Absent-key semantics below unchanged.
  if (!perms) return false
  // Product sections are gated by their section permKey (e.g. signal:{view:true/false}),
  // same as any other section. portal.{product}:{login} is a SEPARATE concern — it
  // controls whether the user can log into the portal itself (signal.sprintmode.ai),
  // not whether they see the admin section on admin.sprintmode.ai.
  if (perms.products && perms.products[product]) return true
  if (perms.sections && perms.sections[product] && perms.sections[product].view === false) return false
  return true
}

// ─── Sidebar Section ────────────────────────────────────────────────────────

function SidebarSection({ label, sectionIcon, sectionColor, items, color, tint, defaultOpen, product, collapsed, onToggle, flat, railCollapsed, onRailEnter, onRailLeave }: {
  label: string
  sectionIcon?: React.ReactNode
  sectionColor?: string
  items: NavItem[]
  color: string
  tint: string
  defaultOpen?: boolean
  product?: string
  collapsed?: boolean
  onToggle?: () => void
  flat?: boolean
  railCollapsed?: boolean
  onRailEnter?: (el: HTMLElement, label: string, items: NavItem[]) => void
  onRailLeave?: () => void
}) {
  var isExternallyManaged = collapsed !== undefined && onToggle !== undefined
  var _useState = useState(defaultOpen !== false)
  var internalOpen = _useState[0]
  var setInternalOpen = _useState[1]
  var location = useLocation()

  var open = isExternallyManaged ? !collapsed : internalOpen

  var hasActive = items.some(function(item) {
    if (item.external) return false
    return item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  })

  var _mounted = useRef(false)
  useEffect(function() {
    if (!_mounted.current) { _mounted.current = true; return }
    if (hasActive && !open) {
      if (isExternallyManaged && onToggle) onToggle()
      else setInternalOpen(true)
    }
  }, [hasActive])

  function handleToggle() {
    if (isExternallyManaged && onToggle) onToggle()
    else setInternalOpen(!open)
  }

  var sectionStyle = { '--section-color': color, '--section-tint': tint } as React.CSSProperties

  return (
    <div
      className={'ps-section' + (flat ? ' ps-flat' : '') + (flat || open ? '' : ' collapsed')}
      data-product={product}
      style={sectionStyle}
      data-label={label}
    >
      {!flat && (
        <button className="ps-section-header" onClick={handleToggle}
          onMouseEnter={railCollapsed && onRailEnter ? function(e: React.MouseEvent<HTMLElement>) { onRailEnter(e.currentTarget as HTMLElement, label, items) } : undefined}
          onMouseLeave={railCollapsed && onRailLeave ? onRailLeave : undefined}>
          {sectionIcon && (
            (() => {
              var _themedUrl = getThemedMarkUrl(product)

              if (_themedUrl) {
                return <span className="ps-section-icon" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, flexShrink: 0,
                  background: 'transparent', border: 'none',
                }}>
                  {React.createElement('img', { src: _themedUrl, width: 20, height: 20, style: { display: 'block' }, alt: '' })}
                </span>
              }

              var sc = sectionColor || color
              var _dark = isDarkMode()
              var bg = 'transparent'
              if (sc && !_dark) {
                bg = sc.includes('hsl') ? sc.replace(')', ', 0.12)').replace('hsl(', 'hsla(') : sc + '1f'
              }
              return <span className="ps-section-icon" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                background: bg, border: 'none', boxSizing: 'border-box' as const,
                color: sc || color,
              }}>{sectionIcon}</span>
            })()
          )}
          {label}
          <svg className="ps-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      )}
      {(
        <div className="ps-section-items" data-label={label}>
          {items.map(function(item) {
            if (item.external) {
              return (
                <a key={item.to || item.href} href={item.to || item.href} target="_blank" rel="noopener noreferrer" className="ps-item">
                  {item.Icon && <item.Icon />}
                  {' '}{item.label}
                </a>
              )
            }
            if (item.disabled) {
              return (
                <span key={item.to || item.label} className="ps-item disabled">
                  {item.step != null ? <span className="ps-step">{item.step}</span> : item.Icon && <item.Icon />}
                  {' '}{item.label}
                </span>
              )
            }
            var stepEl: React.ReactNode = null
            if (item.step != null) {
              if (item.completed) {
                stepEl = React.createElement('span', { className: 'ps-step done' },
                  React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
                    React.createElement('polyline', { points: '20 6 9 17 4 12' })
                  )
                )
              } else {
                stepEl = React.createElement('span', { className: 'ps-step' }, item.step)
              }
            } else if (item.Icon) {
              stepEl = React.createElement(item.Icon)
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={function(p) {
                  var cls = 'ps-item'
                  if (p.isActive) cls += ' active'
                  if (item.locked) cls += ' locked'
                  if (item.completed) cls += ' completed'
                  return cls
                }}
                onMouseEnter={railCollapsed && onRailEnter ? function(e: React.MouseEvent<HTMLElement>) { onRailEnter(e.currentTarget as HTMLElement, item.label, [item]) } : undefined}
                onMouseLeave={railCollapsed && onRailLeave ? onRailLeave : undefined}
              >
                {stepEl}
                {' '}{item.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Default Nav Config ─────────────────────────────────────────────────────

var DEFAULT_NAV: Record<string, { label: string; items: NavItem[] }> = {
  'sprint-mode': {
    label: 'Sprint Mode',
    items: [
      { to: '/client', label: 'Dashboard', icon: 'grid', exact: true },
      { to: '/client/team', label: 'Team', icon: 'users' },
    ]
  },
  'studios': {
    label: 'Studios',
    items: [
      { to: '/client/studios', label: 'Dashboard', icon: 'code', exact: true },
      { to: '/client/studios/billing', label: 'Billing', icon: 'bill' },
    ]
  },
  'mode': {
    label: 'Mode',
    items: [
      { to: '/client/mode/discovery', label: 'Discovery', step: 1 },
      { to: '/client/mode/scan', label: 'Scan', step: 2 },
      { to: '/client/mode/results', label: 'Results', step: 3 },
      { to: '/client/mode/build', label: 'Build', step: 4 },
      { to: '/client/mode/run', label: 'Run Dashboard', step: 5 },
      { to: '/client/mode/reports', label: 'Reports', step: 6 },
      { to: '/client/mode/expand', label: 'Expand', step: 7 },
      { to: '/client/mode/billing', label: 'Billing', icon: 'bill' },
    ]
  },
  'investor': {
    label: 'Investor',
    items: [
      { to: '/investor', label: 'Overview', icon: 'trend', exact: true },
      { to: '/investor/portfolio', label: 'Portfolio', icon: 'portfolio' },
      { to: '/investor/documents', label: 'Documents', icon: 'file' },
      { to: '/investor/updates', label: 'Updates', icon: 'msg' },
    ]
  },
}

function resolveIcon(name: string): (() => React.ReactElement) | null {
  var sp: React.SVGProps<SVGSVGElement> = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 }
  var map: Record<string, () => React.ReactElement> = {
    grid:     function() { return <svg {...sp}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    users:    function() { return <svg {...sp}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    bill:     function() { return <svg {...sp}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    code:     function() { return <svg {...sp}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
    trend:    function() { return <svg {...sp}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    portfolio:function() { return <svg {...sp}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
    file:     function() { return <svg {...sp}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    msg:      function() { return <svg {...sp}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    gear:     function() { return <svg {...sp}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    dollar:   function() { return <svg {...sp}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    search:   function() { return <svg {...sp}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    play:     function() { return <svg {...sp}><polygon points="5 3 19 12 5 21 5 3"/></svg> },
    wrench:   function() { return <svg {...sp}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
    layers:   function() { return <svg {...sp}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
    external: function() { return <svg {...sp}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> },
    terminal: function() { return <svg {...sp}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> },
    user:     function() { return <svg {...sp}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    shield:   function() { return <svg {...sp}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  }
  return map[name] || null
}

// ─── Main Layout ────────────────────────────────────────────────────────────

interface BuiltSection {
  key: string
  heading?: string
  nav?: {
    label: string
    items: NavItem[]
    sectionIcon?: React.ReactNode
    sectionColor?: string
    flat?: boolean
  }
  product?: string
  defaultCollapsed?: boolean
  flat?: boolean
}

const Layout: React.FC<LayoutProps> = function Layout(props: LayoutProps) {
  var navConfig = props.navConfig
  var navSections = props.navSections
  var navBottom = props.navBottom
  var sessionProp = props.session
  var children = props.children
  var logoSrc = props.logoSrc
  var logoAlt = props.logoAlt
  var title = props.title
  var headerRight = props.headerRight
  var sidebarBottom = props.sidebarBottom
  var viewAsEnabled = props.viewAsEnabled
  var viewAsApi = props.viewAsApi || '/api/db/admin-users'
  var headerIcon = props.headerIcon
  var onLogout = props.onLogout
  var profilePath = props.profilePath
  var cmdKPlaceholder = (props.cmdK && typeof props.cmdK === 'object' && props.cmdK.placeholder) || 'Jump to...'
  var cmdKItems = props.cmdKItems
  var cmdKOnSearch = props.onSearch
  var cmdKRecentKey = props.recentKey
  var showCompanyName = props.showCompanyName
  var byLine = props.byLine
  var userMenuExtra = props.userMenuExtra
  var notificationApiBase = props.notificationApiBase !== undefined ? props.notificationApiBase : ''
  var notificationHref = props.notificationHref
  var headerCta = props.headerCta
  var viewAsAnyRole = props.viewAsAnyRole
  var portalCfg = usePortalConfig()
  // cmdK prop takes priority (explicit true/false/object). If not passed, fall back to
  // config.cmdk from Portal Manager. Default to enabled while config is still loading.
  var cmdKEnabled = props.cmdK !== undefined
    ? props.cmdK !== false
    : (portalCfg.config ? (portalCfg.config as any).cmdk !== 0 : true)
  var bugPanelFlag = props.bugPanel !== undefined ? props.bugPanel : (portalCfg.config && (portalCfg.config as any).bug_panel)
  var bugPanelProduct = props.portalSubdomain || 'sm'
  var bugPanelLabel = props.bugPanelLabel

  var _s = useState<SessionData | null>(sessionProp || null); var session = _s[0]; var setSession = _s[1]
  var _l = useState(!sessionProp); var loading = _l[0]; var setLoading = _l[1]
  var _ad = useState(false); var accessDenied = _ad[0]; var setAccessDenied = _ad[1]
  var _adEmail = useState(''); var accessDeniedEmail = _adEmail[0]; var setAccessDeniedEmail = _adEmail[1]

  // Bug panel RBAC (WAFFLE-0): sm-api /auth/me returns bugs_access
  // (0 none / 1 reporting / 2 triage) from the central access model
  // (portal_roles bug_panel keys + admin-row bugs perm — see sm-api
  // src/lib/bug-access.ts). The portal-level flag stays as an AND-gate.
  // Legacy fallback (older sm-api without bugs_access): per-portal bugs
  // permission + SM-team exception, as before.
  var _bugsAccess = session ? (session as any).bugs_access : undefined
  var _bugPerms = session && (session as any).permissions && (session as any).permissions.bugs
  var _isSmTeamUser = session && ((session as any).is_sm_team || (session as any).role === 'super_admin' || (session as any).role === 'admin' || (session as any).portal_role === 'super_admin' || (session as any).portal_role === 'admin')
  var _legacyEnabled = (!!(_bugPerms && _bugPerms.view) || !!_isSmTeamUser)
  var bugPanelEnabled = !!bugPanelFlag && bugPanelFlag !== 0 && (_bugsAccess !== undefined ? _bugsAccess >= 1 : _legacyEnabled)
  // Default to shown while config is still loading (backward compat for portals
  // that haven't set this field yet / config fetch hasn't resolved).
  var notificationBellEnabled = portalCfg.config ? (portalCfg.config as any).notification_bell !== 0 : true
  var bugPanelAdmin = props.bugPanelAdmin || (_bugsAccess !== undefined ? _bugsAccess >= 2 : !!(_bugPerms && _bugPerms.edit))
  var _m = useState(false); var mobileOpen = _m[0]; var setMobileOpen = _m[1]
  var _d = useState(false); var dropdownOpen = _d[0]; var setDropdownOpen = _d[1]
  // Sidebar rail collapse (desktop): narrow to icons; sections reveal a flyout on
  // hover. Persisted to localStorage so it survives navigation/reload.
  var _rail = useState(function() { try { return localStorage.getItem('sm-sidebar-rail') === '1' } catch { return false } })
  var railCollapsed = _rail[0]; var setRailCollapsed = _rail[1]
  function toggleRail() {
    setRailCollapsed(function(v) {
      var nv = !v
      try { localStorage.setItem('sm-sidebar-rail', nv ? '1' : '0') } catch { /* ignore */ }
      return nv
    })
  }
  // Rail flyout: JS-positioned so it escapes the scrolling rail, clamps to the
  // viewport (flips up near the bottom), and survives the icon->menu hop.
  var _fly = useState<{ label: string; items: NavItem[]; top: number } | null>(null)
  var railFlyout = _fly[0]; var setRailFlyout = _fly[1]
  var flyTimer = useRef<any>(null)
  function openRailFlyout(el: HTMLElement, label: string, items: NavItem[]) {
    if (flyTimer.current) { clearTimeout(flyTimer.current); flyTimer.current = null }
    var r = el.getBoundingClientRect()
    setRailFlyout({ label: label, items: items, top: r.top })
  }
  function keepRailFlyout() { if (flyTimer.current) { clearTimeout(flyTimer.current); flyTimer.current = null } }
  function closeRailFlyoutSoon() { flyTimer.current = setTimeout(function() { setRailFlyout(null) }, 200) }
  var _cmdkOpen = useState(false); var cmdkOpen = _cmdkOpen[0]; var setCmdkOpen = _cmdkOpen[1]
  var _bugPanelOpen = useState(false); var bugPanelOpen = _bugPanelOpen[0]; var setBugPanelOpen = _bugPanelOpen[1]
  var _portalPicker = useState(false); var portalPickerOpen = _portalPicker[0]; var setPortalPickerOpen = _portalPicker[1]

  // Count accessible portals for the Cmd+C badge (show only when 2+)
  var portalCount = 0
  if (session && typeof window !== 'undefined' && window.__SM_SESSION && window.__SM_SESSION.portals) {
    var sp = window.__SM_SESSION.portals
    for (var k in sp) { if (sp[k] && sp[k].access) portalCount++ }
  }

  var theme = useTheme()
  var navigate = useNavigate()
  var location = useLocation()

  useEffect(function() {
    var handler = function(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); if (bugPanelEnabled) setBugPanelOpen(function(v) { return !v }) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        var tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag !== 'input' && tag !== 'textarea' && !(document.activeElement as HTMLElement)?.isContentEditable) {
          e.preventDefault(); var inboxDest = notificationHref || 'https://sprintmode.ai/updates'; inboxDest.startsWith('http') ? (window.location.href = inboxDest) : navigate(inboxDest)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Only open dock if user has 2+ accessible portals, no text selected,
        // and not on the marketing website (sprintmode.ai root — not a portal)
        var host = typeof window !== 'undefined' ? window.location.hostname : ''
        var isMarketingSite = host === 'sprintmode.ai' || host === 'www.sprintmode.ai'
        if (!isMarketingSite && !portalPickerOpen && portalCount > 1 && !window.getSelection()?.toString()) {
          e.preventDefault(); setPortalPickerOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return function() { window.removeEventListener('keydown', handler) }
  }, [bugPanelEnabled, portalPickerOpen, portalCount])

  // Deep link: ?bug=bug_xxx opens the bug panel and focuses that bug
  var _focusBug = useState<string | null>(null); var focusBugId = _focusBug[0]; var setFocusBugId = _focusBug[1]
  // WAFFLE-3.5 round 4: waffle:open-item is handled inside BugPanel as the
  // SOLO card modal (Aaron: the card inline, never the whole board) — the
  // Layout-level open-the-panel listener from the first pass is gone.
  useEffect(function() {
    var params = new URLSearchParams(window.location.search)
    var bugId = params.get('bug')
    if (bugId && bugPanelEnabled) {
      setFocusBugId(bugId)
      setBugPanelOpen(true)
    }
  }, [bugPanelEnabled, location.search])

  useEffect(function() {
    if (sessionProp) { setSession(sessionProp); setLoading(false) }
  }, [sessionProp])

  useEffect(function() {
    if (session && typeof window !== 'undefined') {
      window.__SM_SESSION = session as any
    }
  }, [session])

  useEffect(function() {
    if (sessionProp) return
    getSession().then(function(s) {
      if (s === ACCESS_DENIED) {
        setAccessDenied(true)
        setLoading(false)
        return
      }
      if (!s) {
        navigate('/auth/login?redirect=' + encodeURIComponent(location.pathname))
        return
      }
      // Portal access check: if Layout knows which portal it's on and the
      // session includes portals map, check portals[sub].access directly.
      // This works regardless of what the _worker.js proxy does — the data
      // comes from sm-api's /auth/me response.
      var sub = props.portalSubdomain
      if (sub && sub !== 'admin' && (s as any).portals && (s as any).portals[sub] && (s as any).portals[sub].access === false) {
        setAccessDeniedEmail((s as any).email || '')
        setAccessDenied(true)
        setLoading(false)
        return
      }
      setSession(s)
      setLoading(false)
    })
  }, [])

  var portalSubdomain = props.portalSubdomain
  var canViewAsFromSession = portalSubdomain && session && (session as any).portals && (session as any).portals[portalSubdomain]
    ? (session as any).portals[portalSubdomain].view_as as string | false | null
    : null
  var isSuperAdmin = session && ((session as any).role === 'super_admin' || (session as any).portal_role === 'super_admin' || (session as any).role === 'admin' || (session as any).portal_role === 'admin' || (session as any).is_sm_team)
  var showViewAs = canViewAsFromSession !== null
    ? (viewAsEnabled !== false && canViewAsFromSession)
    : (viewAsEnabled && (viewAsAnyRole ? !!session : isSuperAdmin))
  // ── Server lens (PORTAL-RBAC-VIEWAS-3) ─────────────────────────────────────
  // View-as rides the SERVER: POST /api/auth/view-as sets viewing_as on the
  // per-portal session cookie, and /auth/me returns the lensed role,
  // permissions, sections, and company. The old client-side sessionStorage
  // simulation is DELETED (Aaron ruling 2026-08-11, pdec d_c52f32a72370) —
  // it rendered false data. The session is the single source of truth;
  // selecting or exiting a lens reloads the page so every consumer re-reads
  // the lensed session.
  var serverLens = (session && (session as any).viewing_as) || null
  var viewAsTeam: ViewAsUser | null = serverLens && (serverLens.lens === 'team' || serverLens.lens === 'both') ? {
    email: serverLens.email || '',
    name: serverLens.name || '',
    company_id: serverLens.company_id || undefined,
    company_name: serverLens.company_name || '',
    portal_role: serverLens.effective_role || 'member',
    role: serverLens.effective_role || 'member',
    role_type: 'team',
    id: serverLens.user_id || undefined,
  } : null
  var viewAsCustomer: ViewAsUser | null = serverLens && (serverLens.lens === 'customer' || serverLens.lens === 'both') ? {
    email: serverLens.email || '',
    name: (serverLens.lens === 'both' ? serverLens.customer_name : serverLens.name) || '',
    company_id: serverLens.company_id || undefined,
    company_name: serverLens.company_name || '',
    portal_role: serverLens.effective_role || 'member',
    role: serverLens.effective_role || 'member',
    role_type: 'customer',
    id: serverLens.contact_id || serverLens.user_id || undefined,
  } : null
  // Picker data lists. Entries may carry user_id/contact_id — required for
  // person-based selection (team_member_user_id / member_user_id).
  var _at = useState<ViewAsUser[]>([]); var teamDropUsers = _at[0]; var setTeamDropUsers = _at[1]
  var _ac = useState<ViewAsUser[]>([]); var customerDropUsers = _ac[0]; var setCustomerDropUsers = _ac[1]
  var allUsers = teamDropUsers.concat(customerDropUsers)
  var _vaBusy = useState(false); var vaBusy = _vaBusy[0]; var setVaBusy = _vaBusy[1]
  var _vaOpen = useState(false); var vaPickerOpen = _vaOpen[0]; var setVaPickerOpen = _vaOpen[1]
  var _vaTab = useState<'customer' | 'team'>('customer'); var vaTab = _vaTab[0]; var setVaTab = _vaTab[1]
  var _vaQ = useState(''); var vaQuery = _vaQ[0]; var setVaQuery = _vaQ[1]
  var _vaErr = useState(''); var vaError = _vaErr[0]; var setVaError = _vaErr[1]

  useEffect(function() {
    if (!showViewAs) return
    fetch(viewAsApi, { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : {} })
      .then(function(data: any) {
        // Detect split { team: [...], customers: [...] } shape for both mode
        var d = (data && data.ok && data.data) ? data.data : data
        if (d && Array.isArray(d.team) && Array.isArray(d.customers)) {
          setTeamDropUsers(d.team.map(function(u: any) { return Object.assign({}, u, { role_type: 'team' }) }))
          setCustomerDropUsers(d.customers.map(function(u: any) { return Object.assign({}, u, { role_type: 'customer' }) }))
        } else {
          // Legacy flat array or contacts array — single list
          var list: ViewAsUser[] = Array.isArray(d) ? d : (d && Array.isArray(d.contacts) ? d.contacts : [])
          var hasTeam = list.some(function(u) { return u.role_type === 'team' })
          var hasCust = list.some(function(u) { return u.role_type === 'customer' })
          if (hasTeam && hasCust) {
            setTeamDropUsers(list.filter(function(u) { return u.role_type === 'team' }))
            setCustomerDropUsers(list.filter(function(u) { return u.role_type !== 'team' }))
          } else if (hasTeam) {
            setTeamDropUsers(list); setCustomerDropUsers([])
          } else {
            setTeamDropUsers([]); setCustomerDropUsers(list)
          }
        }
      })
      .catch(function() {})
  }, [showViewAs, viewAsApi])

  // Legacy notify props — fired with the server-lens values so host apps that
  // still listen (e.g. sm-admin's onViewAsTeamChange) see the active lens.
  // Host apps should gate on the SESSION (already lensed by /auth/me), not on
  // these objects.
  useEffect(function() {
    if (props.onViewAsTeamChange) props.onViewAsTeamChange(viewAsTeam)
    if (props.onViewAsChange) props.onViewAsChange(viewAsCustomer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Lens endpoints are called DIRECTLY on sm-api (not through the portal
  // worker): every sprintmode.ai portal shares the .sprintmode.ai session
  // cookie, CORS allows credentialed portal origins, and getSessionCookie
  // resolves the per-portal cookie from X-SM-Product -- so one shared-layer
  // path works fleet-wide with no per-portal proxy routes (a portal without
  // a proxy route 405s, which is exactly what broke Studios). Custom-domain
  // portals can override via viewAsAuthBase to a same-origin proxy.
  var vaAuthBase = (props as { viewAsAuthBase?: string }).viewAsAuthBase || 'https://api.sprintmode.ai'

  function applyServerLens(body: Record<string, unknown>) {
    if (vaBusy) return
    setVaBusy(true)
    var headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (portalSubdomain) headers['X-SM-Product'] = portalSubdomain
    fetch(vaAuthBase + '/auth/view-as', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body),
    })
      .then(function(r) {
        return r.json().catch(function() { return null }).then(function(d: any) {
          if (d && d.ok) { window.location.reload(); return }
          // Surface the failure -- a silent catch here cost two blind QA runs
          setVaError('View as failed (HTTP ' + r.status + (d && d.error ? ': ' + d.error : '') + ')')
          setVaBusy(false)
        })
      })
      .catch(function(e: unknown) {
        setVaError('View as failed (network: ' + String(e).slice(0, 120) + ')')
        setVaBusy(false)
      })
  }

  function exitServerLens() {
    if (vaBusy) return
    setVaBusy(true)
    var headers: Record<string, string> = {}
    if (portalSubdomain) headers['X-SM-Product'] = portalSubdomain
    fetch(vaAuthBase + '/auth/exit-view-as', { method: 'POST', credentials: 'include', headers: headers })
      .then(function() { window.location.reload() })
      .catch(function() { setVaBusy(false) })
  }

  function selectTeamMember(u: ViewAsUser) {
    if (u.user_id || u.id) applyServerLens({ team_member_user_id: u.user_id || u.id })
    else if (u.role || u.portal_role) applyServerLens({ team_role: u.role || u.portal_role })
  }

  function selectCustomerPerson(u: ViewAsUser) {
    var body: Record<string, unknown> = u.email ? { email: u.email } : { contact_id: u.contact_id || u.id }
    if (u.user_id) body.member_user_id = u.user_id
    applyServerLens(body)
  }

  function selectCustomerCompany(members: ViewAsUser[]) {
    // Company-level lens: anchor on the first member's contact; the server
    // resolves the effective role (owner-member first, then portal default).
    var first = members[0]
    if (!first) return
    applyServerLens(first.email ? { email: first.email } : { contact_id: first.contact_id || first.id })
  }

  // effectiveRole/Perms come straight from the session — /auth/me already
  // resolves role, permissions, and sections through the lens when
  // viewing_as is active. No client-side overrides.
  var effectiveRole = (session as any)?.role || null
  var effectivePerms = parsePerms(session)

  // 'portal-view-as' events from portal card buttons → server customer lens
  useEffect(function() {
    function onPortalViewAs(e: any) {
      var detail = e.detail || {}
      var match = allUsers.find(function(u: any) {
        return u.id === detail.companyId || u.company_id === detail.companyId || u.name === detail.companyName || u.company_name === detail.companyName
      })
      if (match && match.email) applyServerLens({ email: match.email })
    }
    window.addEventListener('portal-view-as', onPortalViewAs)
    return function() { window.removeEventListener('portal-view-as', onPortalViewAs) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers])

  useEffect(function() { setMobileOpen(false) }, [location.pathname])

  useEffect(function() {
    function handler() { setDropdownOpen(false); setVaPickerOpen(false) }
    document.addEventListener('click', handler)
    return function() { document.removeEventListener('click', handler) }
  }, [])

  var _cs = useState<Record<string, boolean>>(function() {
    if (!navSections) return {}
    // WAFFLE-3.5 (Aaron): sidebar sections default EXPANDED, and the state
    // this function has always written to localStorage is finally read back.
    try {
      var raw = localStorage.getItem('sm-nav-collapsed')
      if (raw) return JSON.parse(raw)
    } catch (_e) { /* noop */ }
    return {}
  })
  var collapsedState = _cs[0]; var setCollapsedState = _cs[1]

  // NAV-COLLAPSE-FIX (2026-08-03): the collapsed prop below is coerced with
  // !! so EVERY section is externally managed when navSections mode is on
  // (NavSection's isExternallyManaged requires a defined value). Untouched
  // sections used to fall back to internal useState, which is destroyed when
  // a heading group collapses (unmount) — manual collapse state was lost and
  // sections remounted expanded. With coercion, all toggles flow through
  // toggleCollapse, live in Layout state, persist to localStorage, and
  // survive group collapse/expand.
  // defaultCollapsed sections yield to deep links: when the current route
  // lives inside the section, the default is open (a stored user toggle
  // still wins). Resolved here rather than via SidebarSection's post-mount
  // effect so a direct page load reveals its own nav group.
  function sectionHasActiveRoute(sec: BuiltSection): boolean {
    var items = (sec.nav && sec.nav.items) || []
    var path = typeof window !== 'undefined' ? window.location.pathname : ''
    return items.some(function(item) {
      if (!item.to || item.external) return false
      return item.exact ? path === item.to : path.indexOf(item.to) === 0
    })
  }

  function toggleCollapse(key: string) {
    setCollapsedState(function(prev) {
      var next = Object.assign({}, prev)
      next[key] = !prev[key]
      try { localStorage.setItem('sm-nav-collapsed', JSON.stringify(next)) } catch (_e) {}
      return next
    })
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  if (accessDenied) return <NoAccessScreen
    portalSubdomain={props.portalSubdomain || ''}
    portalName={props.title || props.portalSubdomain || ''}
    email={accessDeniedEmail}
  />

  var sections: BuiltSection[] = []

  // When viewing as a client and the host app provided a client-specific nav set, use it
  var activeNavSections = (viewAsCustomer && props.viewAsClientNav) ? props.viewAsClientNav : navSections

  if (activeNavSections) {
    activeNavSections.forEach(function(section) {
      if (section.type === 'heading') {
        sections.push({ key: section.key || section.label, heading: section.label })
        return
      }
      if ((section as any).heading) {
        sections.push(section as unknown as BuiltSection)
        return
      }
      if (section.product && !canViewProduct(effectivePerms, effectiveRole, section.product)) return
      var visibleItems = (section.items || []).filter(function(item) {
        return canViewSection(effectivePerms, effectiveRole, item.permKey)
      })
      if (visibleItems.length === 0) return
      sections.push({
        key: section.key || section.label,
        nav: {
          label: section.label,
          items: visibleItems,
          sectionIcon: section.sectionIcon,
          sectionColor: section.sectionColor,
        },
        product: section.product,
        flat: section.flat,
        defaultCollapsed: section.defaultCollapsed,
      })
    })
  } else {
    var nav = Object.assign({}, DEFAULT_NAV, navConfig || {})
    var products = ((session as any)?.products as string[]) || []
    var hasProducts = products.length > 0
    if (hasProducts && nav['sprint-mode']) {
      sections.push({ key: 'sprint-mode', nav: nav['sprint-mode'] })
    }
    products.forEach(function(prod) {
      if (prod === 'sprint-mode') return
      if (nav[prod]) sections.push({ key: prod, nav: nav[prod] })
    })
  }

  sections.forEach(function(section) {
    if (!section.nav) return
    section.nav.items = section.nav.items.map(function(item) {
      if (item.icon && !item.Icon) {
        item = Object.assign({}, item, { Icon: resolveIcon(item.icon) })
      }
      return item
    })
  })

  var initials = session ? ((session.name || session.email || '?').split(' ').map(function(w) { return w[0] || '' }).join('').slice(0, 2).toUpperCase()) : '?'
  var sessionPhoto = session && (session as any).photo as string | undefined
  // Logo: prefer R2 URLs from portal config, fall back to prop, then local file
  var _cfgLogo = portalCfg.config && (portalCfg.config as any).logo_horizontal_url
  var _cfgLogoDark = portalCfg.config && (portalCfg.config as any).logo_dark_url
  var logo = logoSrc || _cfgLogo || '/logo-sprint-mode-horizontal.png'
  var alt = logoAlt || (portalCfg.config && portalCfg.config.name) || 'Sprint Mode'
  var themeLogo = logo
  if (isDarkMode()) {
    // Use explicit dark logo from portal config if available
    if (_cfgLogoDark) {
      themeLogo = _cfgLogoDark
    } else if (logo.indexOf('.png') !== -1) {
      // Fallback: swap .png → -dark.png (works for local files and R2 URLs)
      themeLogo = logo.replace('.png', '-dark.png')
    }
  }
  var hasHeader = !!(title || headerRight)

  var autoCmdKItems: CmdKItem[] = []
  if (!cmdKItems) {
    sections.forEach(function(section) {
      if (!section.nav) return
      var sectionLabel = section.nav.label
      section.nav.items.forEach(function(item) {
        if (item.to && !item.disabled && !item.external) {
          autoCmdKItems.push({ label: item.label, to: item.to, section: sectionLabel, step: item.step, Icon: item.Icon || undefined, meta: { breadcrumbs: [sectionLabel, item.label] } })
        }
      })
    })
    if (navBottom) {
      navBottom.forEach(function(item) {
        if (item.to) autoCmdKItems.push({ label: item.label, to: item.to, Icon: item.Icon || undefined })
      })
    }
  }
  var cmdkItems = cmdKItems || autoCmdKItems

  // WAFFLE-3.5: default Waffle item-search provider. Active when the host
  // passes no custom onSearch and the session can see the board
  // (bugs_access >= 1 from /auth/me). Zero config by design (s12 test 2):
  // no Portal Manager tunable — the existing binary cmdk toggle governs the
  // whole palette. Queries the same api base the panel uses; results
  // deep-link via ?bug=, the existing panel deep-link path, so selecting a
  // result opens the slide-over focused on that item (or focuses the
  // standalone board where it owns the route).
  var sessionBugsAccess = (session as unknown as { bugs_access?: number } | null)?.bugs_access || 0
  var itemSearchActive = !cmdKOnSearch && (sessionBugsAccess >= 1 || !!bugPanelAdmin)
  function waffleItemSearch(q: string): Promise<{ items: CmdKItem[]; total?: number }> {
    return fetch(notificationApiBase + '/api/bugs?q=' + encodeURIComponent(q) + '&limit=8', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null })
      .then(function(d) {
        if (!d || !d.ok || !Array.isArray(d.data)) return { items: [], total: 0 }
        return { items: mapBugsToCmdKItems(d.data), total: d.total || d.data.length }
      })
      .catch(function() { return { items: [], total: 0 } })
  }
  var effectiveCmdKOnSearch = cmdKOnSearch || (itemSearchActive ? waffleItemSearch : undefined)

  var logoutHref = onLogout || ('/api/auth/logout?redirect=' + encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/auth/login'))

  // Determine view_as filter mode from session portal config ('team'|'customers'|'both'|string|false)
  var viewAsMode = canViewAsFromSession && typeof canViewAsFromSession === 'string' ? canViewAsFromSession : null
  var showTeamTab = showViewAs && (viewAsMode === 'team' || viewAsMode === 'both') && teamDropUsers.length > 0
  var showCustomerTab = showViewAs && (viewAsMode === 'customers' || viewAsMode === 'both' || (!viewAsMode && customerDropUsers.length > 0))

  // Group customer entries by company for the picker (approved mock: company
  // rows with their people beneath, role right-aligned).
  var vaQ = vaQuery.trim().toLowerCase()
  function vaMatch(u: ViewAsUser) {
    if (!vaQ) return true
    return (u.name || '').toLowerCase().indexOf(vaQ) !== -1 ||
      (u.email || '').toLowerCase().indexOf(vaQ) !== -1 ||
      (u.company_name || '').toLowerCase().indexOf(vaQ) !== -1
  }
  var vaCompanies: { key: string; name: string; members: ViewAsUser[] }[] = []
  ;(function() {
    var byCo: Record<string, { key: string; name: string; members: ViewAsUser[] }> = {}
    customerDropUsers.filter(vaMatch).forEach(function(u) {
      var key = u.company_id || u.company_name || '_none'
      if (!byCo[key]) {
        byCo[key] = { key: key, name: u.company_name || 'No company', members: [] }
        vaCompanies.push(byCo[key])
      }
      byCo[key].members.push(u)
    })
  })()
  var vaTeamList = teamDropUsers.filter(function(u) { return u.email !== (session && session.email) }).filter(vaMatch)
  // Compound stacking (PORTAL-RBAC-VIEWAS-3): under a single-dimension lens
  // on a both-mode portal, the picker stays available offering ONLY the
  // missing dimension -- the server merges the second POST onto the lens.
  var vaLensDim = serverLens ? serverLens.lens : null
  var vaCanAddDim = !!(serverLens && vaLensDim !== 'both' && viewAsMode === 'both')
  var vaActiveTab: 'customer' | 'team' = vaCanAddDim
    ? (vaLensDim === 'team' ? 'customer' : 'team')
    : (showCustomerTab && showTeamTab ? vaTab : (showTeamTab ? 'team' : 'customer'))

  // Role labels are PER PORTAL (portal_roles.display_name) — the same role
  // key can carry different names on different portals. APIs send role_label
  // when a display_name exists; otherwise humanize the key (never render raw
  // snake_case keys to people).
  var VA_ACRONYMS: Record<string, boolean> = { hr: true, cpa: true, qa: true, ai: true, mcp: true, sso: true, api: true }
  function vaRoleLabel(u: ViewAsUser): string {
    if (u.role_label) return u.role_label
    var key = u.role || u.portal_role || ''
    if (!key) return ''
    return key.split('_').map(function(w) {
      return VA_ACRONYMS[w] ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1))
    }).join(' ')
  }

  var vaEyeIcon = React.createElement('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const },
    React.createElement('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 }))

  // Approved mock: single "View as" button opening a tabbed popover.
  // Hidden while a lens is active — the header carries the lens state instead.
  var viewAsSelect = (showTeamTab || showCustomerTab) && (!serverLens || vaCanAddDim) ? React.createElement('div', {
    className: 'shell-va',
    onClick: function(e: React.MouseEvent) { e.stopPropagation() },
  },
    React.createElement('button', {
      className: 'shell-va-btn',
      onClick: function() { setVaError(''); setVaPickerOpen(!vaPickerOpen) },
      disabled: vaBusy,
    }, 'View as ', vaEyeIcon),
    vaPickerOpen ? React.createElement('div', { className: 'shell-va-pop' },
      (showCustomerTab && showTeamTab && !vaCanAddDim) ? React.createElement('div', { className: 'shell-va-tabs' },
        React.createElement('button', { className: 'shell-va-tab' + (vaActiveTab === 'customer' ? ' active' : ''), onClick: function() { setVaTab('customer') } }, 'Customer'),
        React.createElement('button', { className: 'shell-va-tab' + (vaActiveTab === 'team' ? ' active' : ''), onClick: function() { setVaTab('team') } }, 'Team')
      ) : null,
      React.createElement('input', {
        className: 'shell-va-search',
        placeholder: vaActiveTab === 'customer' ? 'Find a company or person' : 'Find a team member',
        value: vaQuery,
        onChange: function(e: React.ChangeEvent<HTMLInputElement>) { setVaQuery(e.target.value) },
      }),
      vaError ? React.createElement('div', { className: 'shell-va-error', role: 'alert' }, vaError) : null,
      React.createElement('div', { className: 'shell-va-list' },
        vaActiveTab === 'customer'
          ? (vaCompanies.length === 0 ? React.createElement('div', { className: 'shell-va-empty' }, 'No matches') : vaCompanies.map(function(co) {
              return React.createElement(React.Fragment, { key: co.key },
                React.createElement('button', { className: 'shell-va-co', onClick: function() { selectCustomerCompany(co.members) }, disabled: vaBusy }, co.name),
                co.members.map(function(u) {
                  return React.createElement('button', { key: u.email || u.id, className: 'shell-va-person', onClick: function() { selectCustomerPerson(u) }, disabled: vaBusy },
                    React.createElement('span', { className: 'shell-va-person-name' }, u.name || (u.email ? u.email.split('@')[0] : '?')),
                    React.createElement('span', { className: 'shell-va-person-role' }, vaRoleLabel(u)))
                }))
            }))
          : (vaTeamList.length === 0 ? React.createElement('div', { className: 'shell-va-empty' }, 'No matches') : vaTeamList.map(function(u) {
              return React.createElement('button', { key: u.email || u.id, className: 'shell-va-person shell-va-person-team', onClick: function() { selectTeamMember(u) }, disabled: vaBusy },
                React.createElement('span', { className: 'shell-va-person-name' }, u.name || (u.email ? u.email.split('@')[0] : '?')),
                React.createElement('span', { className: 'shell-va-person-role' }, vaRoleLabel(u)))
            }))
      )
    ) : null
  ) : null

  // Lens active — the header carries the state (approved mock: no banner).
  var lensChip = serverLens ? React.createElement('div', { className: 'shell-va-lens' },
    React.createElement('span', { className: 'shell-va-lens-label' },
      vaEyeIcon, ' ',
      serverLens.name || serverLens.email || '',
      serverLens.lens === 'both'
        ? ' \u00B7 viewing ' + (serverLens.customer_name || '') + (serverLens.company_name ? ' \u00B7 ' + serverLens.company_name : '')
        : (serverLens.lens === 'customer' && serverLens.company_name ? ' \u00B7 ' + serverLens.company_name : '')),
    React.createElement('button', { className: 'shell-va-lens-exit', onClick: exitServerLens, disabled: vaBusy }, 'Exit')
  ) : null

  var standardHeaderRight = hasHeader && session ? React.createElement(React.Fragment, null,
    cmdKEnabled ? React.createElement('button', {
      onClick: function() { setCmdkOpen(true) },
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', transition: 'border-color .2s' }
    },
      React.createElement(IconSearch, null),
      React.createElement('span', null, 'Search'),
      React.createElement('kbd', { style: { fontSize: 11, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--muted)', lineHeight: 1.4 } }, (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1) ? '\u2318K' : 'Ctrl+K')
    ) : null,
    React.createElement('button', {
      onClick: theme.toggle,
      'aria-label': theme.mode === 'auto' ? 'Theme: System' : theme.mode === 'dark' ? 'Theme: Dark' : 'Theme: Light',
      title: theme.mode === 'auto' ? 'Theme: System' : theme.mode === 'dark' ? 'Theme: Dark' : 'Theme: Light',
      style: {
        height: 34, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7,
        padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font)', flexShrink: 0,
        transition: 'border-color .2s', boxSizing: 'border-box',
      },
    },
      React.createElement(theme.mode === 'light' ? IconSun : theme.mode === 'dark' ? IconMoon : IconDeviceDesktop, null),
      React.createElement('span', { style: { fontSize: 11, fontWeight: 500, letterSpacing: '0.3px' } },
        theme.mode === 'auto' ? 'Auto' : theme.mode === 'dark' ? 'Dark' : 'Light'
      )
    ),
    notificationBellEnabled ? React.createElement(NotificationBellNav, { apiBase: notificationApiBase, href: notificationHref, onNavigate: function(href: string) { navigate(href) } }) : null,
    bugPanelEnabled ? React.createElement(BugPanelHeaderButton, { onClick: function() { setBugPanelOpen(function(v) { return !v }) } }) : null,
    React.createElement(HeaderUserMenu, { session: session, profilePath: profilePath, logoutHref: logoutHref, userMenuExtra: userMenuExtra, portalSubdomain: portalSubdomain })
  ) : null

  return (
    <SessionContext.Provider value={session}>
    <ViewAsTeamContext.Provider value={viewAsTeam}>
    <ViewAsContext.Provider value={viewAsCustomer}>
      <div className={'shell' + (hasHeader ? ' shell-with-header' : '')}>

        {hasHeader && (
          <header className={'shell-header' + (serverLens ? ' shell-header-lens' : '')}>
            <div className="shell-header-inner">
              <div style={{ display: 'flex', alignItems: 'center' }}>
              <a href="/" className="shell-header-logo">
                {title ? (
                  <>
                    <div className="shell-header-logo-icon" style={isDarkMode() ? { background: 'transparent', border: 'none' } : undefined}>
                      {(() => {
                        var _sub = portalCfg.config && portalCfg.config.subdomain
                        var _themedMark = getThemedMarkUrl(_sub || undefined)
                        if (_themedMark) {
                          return React.createElement('img', { src: _themedMark, width: 28, height: 28, style: { display: 'block' }, alt: '' })
                        }
                        return headerIcon || <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="10 8 14 12 10 16"/>
                        </svg>
                      })()}
                    </div>
                    <span className="shell-header-title">{title}{showCompanyName && session && (session as any).company_name ? React.createElement('span', { className: 'shell-header-company' }, ' // ' + (session as any).company_name) : null}</span>
                    {byLine ? React.createElement('span', { className: 'shell-header-byline' }, byLine) : null}
                  </>
                ) : (
                  <img src={themeLogo} alt={alt} style={{ height: 24, width: 'auto' }} />
                )}
              </a>
              {portalCount > 1 ? React.createElement('kbd', {
                onClick: function(e: React.MouseEvent) { e.preventDefault(); setPortalPickerOpen(true) },
                title: (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318' : 'Ctrl+') + 'C to change portals',
                style: { fontSize: 10, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle, var(--bg))', color: 'var(--muted)', lineHeight: 1.4, cursor: 'pointer', marginLeft: 6, userSelect: 'none' as const, transition: 'border-color .2s' },
                onMouseEnter: function(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' },
                onMouseLeave: function(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' },
              }, (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318C' : 'Ctrl+C')) : null}
              </div>
              {(viewAsSelect || lensChip || headerCta || headerRight || standardHeaderRight) && (
                <div className="shell-header-right">
                  {lensChip}
                  {viewAsSelect}
                  {headerCta && React.createElement('button', {
                    onClick: headerCta.onClick,
                    style: {
                      padding: '6px 14px', borderRadius: 8,
                      background: headerCta.variant === 'outline' ? 'transparent' : 'var(--accent)',
                      color: headerCta.variant === 'outline' ? 'var(--accent)' : '#fff',
                      border: headerCta.variant === 'outline' ? '1px solid var(--accent)' : 'none',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
                      transition: 'opacity .15s', flexShrink: 0,
                    },
                    onMouseOver: function(e: React.MouseEvent<HTMLButtonElement>) { e.currentTarget.style.opacity = '0.85' },
                    onMouseOut: function(e: React.MouseEvent<HTMLButtonElement>) { e.currentTarget.style.opacity = '1' },
                  }, headerCta.label)}
                  {headerRight}
                  {standardHeaderRight}
                </div>
              )}
            </div>
          </header>
        )}

        <div className="shell-body">

        <aside className={'portal-sidebar' + (mobileOpen ? ' open' : '') + (railCollapsed ? ' rail' : '')} id="portalSidebar">
          {!hasHeader && (
            <div className="portal-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={themeLogo} alt={alt} style={{ height: 24, width: 'auto' }} />
              {portalCount > 1 ? React.createElement('kbd', {
                onClick: function(e: React.MouseEvent) { e.preventDefault(); setPortalPickerOpen(true) },
                title: (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318' : 'Ctrl+') + 'C to change portals',
                style: { fontSize: 10, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle, var(--bg))', color: 'var(--muted)', lineHeight: 1.4, cursor: 'pointer', userSelect: 'none' as const, transition: 'border-color .2s' },
                onMouseEnter: function(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' },
                onMouseLeave: function(e: React.MouseEvent<HTMLElement>) { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' },
              }, (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318C' : 'Ctrl+C')) : null}
            </div>
          )}
          <nav className="portal-sidebar-nav">
            {sections.map(function(section) {
              if (section.heading) {
                return (
                  <div key={section.key} className="ps-heading" style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px',
                    color: 'var(--muted)', padding: '16px 14px 6px', userSelect: 'none',
                  }}>{section.heading}</div>
                )
              }
              var pc = PRODUCT_COLORS[section.key] || PRODUCT_COLORS['sprint-mode']
              return (
                <SidebarSection
                  key={section.key}
                  label={section.nav!.label}
                  sectionIcon={section.nav!.sectionIcon}
                  sectionColor={section.nav!.sectionColor}
                  items={section.nav!.items}
                  color={pc.color}
                  tint={pc.tint}
                  product={section.key}
                  flat={sections.length === 1 || section.flat || section.nav!.flat}
                  collapsed={navSections ? (collapsedState[section.key] !== undefined ? !!collapsedState[section.key] : (!!section.defaultCollapsed && !sectionHasActiveRoute(section))) : undefined}
                  onToggle={navSections ? function() { toggleCollapse(section.key) } : undefined}
                  railCollapsed={railCollapsed}
                  onRailEnter={openRailFlyout}
                  onRailLeave={closeRailFlyoutSoon}
                />
              )
            })}
          </nav>

          {navBottom && navBottom.length > 0 && (
            <div className="portal-sidebar-bottom-nav">
              {navBottom.filter(function(item) {
                return canViewSection(effectivePerms, effectiveRole, item.permKey)
              }).map(function(item) {
                return (
                  <NavLink key={item.to} to={item.to} className={function(p) { return 'ps-item' + (p.isActive ? ' active' : '') }}
                    onMouseEnter={railCollapsed ? function(e: React.MouseEvent<HTMLElement>) { openRailFlyout(e.currentTarget as HTMLElement, item.label, [item]) } : undefined}
                    onMouseLeave={railCollapsed ? closeRailFlyoutSoon : undefined}>
                    {item.Icon && <item.Icon />}{' '}{item.label}
                  </NavLink>
                )
              })}
            </div>
          )}

          {sidebarBottom}

          {!hasHeader && (
            <div className="portal-sidebar-user">
              <button className="portal-avatar" onClick={function(e) { e.stopPropagation(); setDropdownOpen(!dropdownOpen) }}>
                {sessionPhoto
                  ? React.createElement('img', { src: sessionPhoto, alt: '', style: { width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover', display: 'block' } })
                  : initials}
              </button>
              <div>
                <div className="portal-sidebar-user-name">{session ? (session.name || session.email) : ''}</div>
                <div className="portal-sidebar-user-co">{session ? ((session as any).company_name || '') : ''}</div>
              </div>
            </div>
          )}
          {!hasHeader && dropdownOpen && (
            <div className="portal-dropdown" style={{ position: 'fixed', bottom: 60, left: 14, zIndex: 100, minWidth: 200, display: 'block' }}>
              <div className="portal-dropdown-name">{session ? (session.name || session.email) : ''}</div>
              <div className="portal-dropdown-company">{session ? ((session as any).company_name || '') : ''}</div>
              <hr />
              <a href={profilePath || '/client/profile'}>Profile</a>
              <a href={logoutHref}>Sign out</a>
            </div>
          )}
          <button
            className="portal-sidebar-collapse"
            onClick={toggleRail}
            title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={railCollapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'} />
            </svg>
            <span className="portal-sidebar-collapse-label">Collapse</span>
          </button>
        </aside>

        {railCollapsed && railFlyout && (
          <div
            className="rail-flyout"
            onMouseEnter={keepRailFlyout}
            onMouseLeave={closeRailFlyoutSoon}
            style={{
              top: Math.max(8, Math.min(
                railFlyout.top,
                (typeof window !== 'undefined' ? window.innerHeight : 800) - (railFlyout.items.length * 34 + 52)
              )),
            }}
          >
            <div className="rail-flyout-label">{railFlyout.label}</div>
            {railFlyout.items.map(function(item) {
              if (item.external) {
                return <a key={item.to || item.href} href={item.to || item.href} target="_blank" rel="noopener noreferrer" className="ps-item">{item.Icon && <item.Icon />}{' '}{item.label}</a>
              }
              if (item.disabled) {
                return <span key={item.to || item.label} className="ps-item disabled">{item.Icon && <item.Icon />}{' '}{item.label}</span>
              }
              return <NavLink key={item.to} to={item.to} end={item.exact} className={function(p) { return 'ps-item' + (p.isActive ? ' active' : '') }}>{item.Icon && <item.Icon />}{' '}{item.label}</NavLink>
            })}
          </div>
        )}

        <div className="portal-mobile-bar">
          <button onClick={function() { setMobileOpen(!mobileOpen) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--foreground)', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--foreground)', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'var(--foreground)', borderRadius: 1 }} />
          </button>
          {!hasHeader && <img src={themeLogo} alt={alt} style={{ height: 24, width: 'auto' }} />}
        </div>

        {mobileOpen && <div className="portal-sidebar-overlay open" onClick={function() { setMobileOpen(false) }} />}

        <main className="portal-main">
          <div key={serverLens ? (serverLens.lens + ':' + (serverLens.user_id || serverLens.contact_id || serverLens.email || '')) : '__self__'}>
            {(() => {
              // Route guard: check if the current route's nav item has permission
              // PORTAL-PERMISSIONS-1: Use the ORIGINAL navSections prop (unfiltered),
              // not activeNavSections (which has denied items removed). If we only
              // check filtered nav, denied routes can't be found and the guard is
              // bypassed by direct URL navigation.
              var routePermKey: string | undefined = undefined
              var allNavItems: NavItem[] = []
              // PORTAL-PERMISSIONS-1: Use routeGuardNav (unfiltered) so denied routes
              // are still matchable. If the parent filters navSections before passing
              // them, denied items are removed and the guard can't find them.
              var guardNav = props.routeGuardNav || navSections || []
              // Collect section-level permKeys and product mappings for gating
              var sectionPermKeys: string[] = []
              var sectionProducts: Record<string, string> = {}
              guardNav.forEach(function(section) {
                if ((section as any).permKey) sectionPermKeys.push((section as any).permKey)
                if ((section as any).product && (section as any).key) {
                  sectionProducts[(section as any).key] = (section as any).product
                }
                if ((section as any).items) {
                  ;(section as any).items.forEach(function(item: NavItem) { allNavItems.push(item) })
                }
              })
              if (navBottom) {
                navBottom.forEach(function(item) { allNavItems.push(item) })
              }
              // Match current path to a nav item — use LONGEST (most specific) match.
              // Without this, /hiring/placements prefix-matches /hiring (Pipeline item,
              // which may be denied) and blocks access even though Placements is allowed.
              var curPath = location.pathname
              var bestMatch = ''
              for (var i = 0; i < allNavItems.length; i++) {
                var navItem = allNavItems[i]
                if (!navItem.to || !navItem.permKey) continue
                if (curPath === navItem.to || curPath.startsWith(navItem.to + '/')) {
                  // Keep the longest matching path (most specific route)
                  if (navItem.to.length > bestMatch.length) {
                    bestMatch = navItem.to
                    routePermKey = navItem.permKey
                  }
                }
              }
              // If we found a permKey for this route and it's denied, show access-denied
              // Also check if the route's permKey belongs to a denied parent section
              // (e.g. finance.reports is denied if finance:{view:false})
              var routeDenied = false
              if (routePermKey && !canViewSection(effectivePerms, effectiveRole, routePermKey)) {
                routeDenied = true
              }
              if (!routeDenied && routePermKey) {
                // Check parent section: if routePermKey is "finance.reports", check "finance"
                var dotIdx = routePermKey.indexOf('.')
                if (dotIdx > 0) {
                  var parentKey = routePermKey.substring(0, dotIdx)
                  // TASK-1919 (IDCORE-APIMCP-1): migration 0275 made portal_roles
                  // storage LEAF-ONLY — parent section keys are absent from every
                  // resolved permissions object by design. The old check ran the
                  // parent through canViewSection, whose deny-by-default treats an
                  // absent key as denied, which locked every non-super_admin role
                  // out of all section routes the moment the drop deployed. The
                  // parent override is now EXPLICIT-DENY ONLY: it fires when the
                  // parent key is present with view:false (a deliberate section
                  // revoke), and an absent parent leaves the decision to the leaf.
                  if (sectionPermKeys.indexOf(parentKey) >= 0) {
                    var parentSectionEntry = effectivePerms && effectivePerms.sections
                      ? effectivePerms.sections[parentKey]
                      : null
                    if (parentSectionEntry && parentSectionEntry.view === false) {
                      routeDenied = true
                    }
                  }
                  // Check product access: if parent is a product section, check portal.{product}
                  if (!routeDenied && sectionProducts[parentKey]) {
                    if (!canViewProduct(effectivePerms, effectiveRole, sectionProducts[parentKey])) {
                      routeDenied = true
                    }
                  }
                }
              }
              if (routeDenied) {
                return React.createElement('div', {
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'var(--font, system-ui, sans-serif)' }
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
              return children || React.createElement(Outlet, null)
            })()}
          </div>
        </main>

        </div>

        {cmdKEnabled && (
          <CmdK
            open={cmdkOpen}
            onClose={function() { setCmdkOpen(false) }}
            items={cmdkItems}
            onNavigate={function(to) { navigate(to) }}
            placeholder={cmdKPlaceholder}
            onSearch={effectiveCmdKOnSearch}
            recentKey={cmdKRecentKey}
          />
        )}

        {bugPanelEnabled && (
          <BugPanel
            visible={bugPanelOpen}
            onClose={function() { setBugPanelOpen(false); setFocusBugId(null) }}
            isAdmin={!!bugPanelAdmin}
            apiBase={notificationApiBase}
            product={bugPanelProduct}
            label={bugPanelLabel}
            mcpKeysHref={props.bugPanelMcpKeysHref}
            focusBugId={focusBugId}
            session={session ? { contact_id: (session as any).contact_id, display_name: session.name, email: session.email } : null}
          />
        )}

        <PortalPicker open={portalPickerOpen} onClose={function() { setPortalPickerOpen(false) }} />
      </div>
    </ViewAsContext.Provider>
    </ViewAsTeamContext.Provider>
    </SessionContext.Provider>
  )
}
export default Layout
