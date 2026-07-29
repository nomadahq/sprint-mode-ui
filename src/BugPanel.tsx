import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, CSSProperties } from 'react'
import { UpdateAttachments } from './UpdateAttachments'

export interface BugPanelSession {
  contact_id?: string
  display_name?: string
  email?: string
}

export interface BugPanelProps {
  isAdmin?: boolean
  apiBase?: string
  product?: string
  label?: string
  session?: BugPanelSession | null
  offsetFab?: boolean
  onClose?: () => void
  visible?: boolean
  focusBugId?: string | null
  /** BUG-PANEL-STANDALONE-1: When true, renders as a full-viewport page instead of a side panel */
  standalone?: boolean
}

export interface BugPanelHeaderButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export interface BugComment {
  id: string
  author_name?: string
  body?: string
  created_at?: string
}

export interface BugAttachment {
  id: string
  type: 'image' | 'file'
  filename: string
  r2_key?: string
  size?: number
  mime?: string
}

export interface VerificationResult {
  id: string
  status: 'pass' | 'fail'
  screenshots?: string[]
  error?: string
  duration_ms?: number
}

export interface Bug {
  id: string
  title: string
  description?: string
  type?: string
  product?: string
  status: string
  priority?: string
  page_url?: string
  created_at?: string
  submitted_by_name?: string
  ai_classification?: string | Record<string, unknown>
  fire_prompt?: string
  close_reason?: string
  verified_status?: string | null
  verified_at?: string | null
  verification_run_id?: string | null
  test_spec?: string | Record<string, unknown> | null
  verification_results?: VerificationResult[] | null
  comments?: BugComment[]
  attachments?: BugAttachment[]
  // WAFFLE-0 work board fields
  assigned_to?: string | null
  subsystem?: string | null
  due_date?: string | null
  tags?: string | null
}

export interface ThreadItem {
  id: string
  title: string
  body?: string
  product?: string
  thread_id?: string
  priority?: string
  status?: string
  tags?: string
  created_at?: string
}

var STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  open:        { color: 'var(--red)',    bg: 'var(--red-light)',    label: 'open' },
  in_progress: { color: 'var(--blue)',   bg: 'var(--blue-10)',      label: 'in progress' },
  blocked:     { color: '#e67700',       bg: '#fff3e0',             label: 'blocked' },
  fixed:       { color: 'var(--green)',  bg: 'var(--green-light)',  label: 'fixed' },
  deferred:    { color: 'var(--muted)',  bg: 'var(--bg-subtle)',    label: 'deferred' },
  closed:      { color: 'var(--muted)',  bg: 'var(--bg-subtle)',    label: 'closed' },
  // Legacy statuses (pre-migration fallback)
  triaged:     { color: 'var(--blue)',   bg: 'var(--blue-10)',      label: 'in progress' },
  fixing:      { color: 'var(--blue)',   bg: 'var(--blue-10)',      label: 'in progress' },
  qa:          { color: 'var(--green)',  bg: 'var(--green-light)',  label: 'in progress' },
  verified:    { color: 'var(--muted)',  bg: 'var(--bg-subtle)',    label: 'closed' },
}

var TYPES = ['bug', 'feature', 'ux', 'task', 'human_action']

// WAFFLE-0: seed subsystem vocabulary for the edit datalist, so the first
// user of a subsystem gets a suggestion before any rows exist. The filter
// dropdown uses the live DISTINCT list from /api/bugs/subsystems instead.
var SUBSYSTEM_SUGGESTIONS = [
  'bookkeeper', 'launchpad', 'support', 'portal_manager', 'bug_panel', 'analytics', 'finance',
  'signal_core', 'signal_billing', 'signal_integrations', 'signal_gtm',
  'pai_engine', 'pai_dashboard', 'pai_billing',
  'ss_auth', 'ss_email', 'ss_billing', 'ss_portal',
  'website', 'investors',
]

var VERIFIED_META: Record<string, { color: string; bg: string; label: string }> = {
  pw_verifying: { color: '#e67700', bg: '#fff3e0', label: 'verifying' },
  verified:     { color: 'var(--green)', bg: 'var(--green-light)', label: 'verified' },
  pw_failed:    { color: 'var(--red)', bg: 'var(--red-light)', label: 'verify failed' },
}

var PRIORITY_META: Record<string, { label: string; sublabel: string; color: string; bg: string; sort: number }> = {
  critical: { label: 'P0', sublabel: 'Critical', color: 'var(--red)',   bg: 'var(--red-light)',   sort: 0 },
  high:     { label: 'P1', sublabel: 'High',     color: '#e67700',      bg: '#fff3e0',            sort: 1 },
  normal:   { label: 'P2', sublabel: 'Normal',   color: 'var(--amber)', bg: 'var(--amber-light)', sort: 2 },
  medium:   { label: 'P2', sublabel: 'Normal',   color: 'var(--amber)', bg: 'var(--amber-light)', sort: 2 },
  low:      { label: 'P3', sublabel: 'Low',      color: 'var(--green)', bg: 'var(--green-light)', sort: 3 },
}

function priorityBadge(priority: string | undefined) {
  var m = PRIORITY_META[priority || ''] || PRIORITY_META['normal']
  return { label: m.label, sublabel: m.sublabel, color: m.color, bg: m.bg }
}

var PRODUCTS_FALLBACK: Record<string, string[]> = {
  'Portals': ['admin', 'studios', 'signal', 'privacyai', 'safeshepherd', 'website'],
}

// WAFFLE-FIX-1 (bug_w2f_tabrow): labels shortened so all five tabs fit the
// 480px slide-over simultaneously with real counts — Mine (was My Tasks),
// Fixed (was Fixed/Unverified; the tab still excludes verified items, the
// Verified tab next to it carries the distinction). Counts stay real numbers.
var ADMIN_TABS = [
  { id: 'queue',    label: 'Queue',    statuses: ['open', 'in_progress', 'blocked'] },
  // WAFFLE-2: Mine — queue statuses assigned to the current session
  // contact. Server-side via tab=mine; client fallback filters assigned_to.
  { id: 'mine',     label: 'Mine',     statuses: ['open', 'in_progress', 'blocked'], mine: true },
  { id: 'closed',   label: 'Fixed',    statuses: ['closed', 'fixed'], excludeVerified: true },
  { id: 'verified', label: 'Verified', statuses: ['closed', 'fixed'], verified: true },
  { id: 'deferred', label: 'Deferred', statuses: ['deferred'] },
]

// ── WAFFLE-FIX-1 (bug_w2o_copypass): voice helpers ──────────────────────────
// Puns live in MOMENTS (empty, loading, success) — never in data. See
// sm-jockey/_briefs/WAFFLE-VOICE.md. Restraint list: no puns in tab labels,
// counts, error states, delegation rows.

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (_e) { return false }
}

var WAFFLE_VOICE_CSS =
  '@keyframes waffleToast{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
  '@keyframes waffleMelt{0%{opacity:1;transform:scaleY(1)}100%{opacity:0;transform:scaleY(0.15) translateY(5px)}}'

function ensureWaffleVoiceCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById('waffle-voice-css')) return
  var el = document.createElement('style')
  el.id = 'waffle-voice-css'
  el.textContent = WAFFLE_VOICE_CSS
  document.head.appendChild(el)
}

// ONE butter pat that melts (~400ms). Never a shower. Skipped entirely under
// prefers-reduced-motion.
function ButterPat() {
  if (prefersReducedMotion()) return null
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 11, marginLeft: 6, borderRadius: 3, background: 'linear-gradient(180deg,#F9DE7B,#E8A13C)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', animation: 'waffleMelt 400ms ease-in forwards', transformOrigin: 'bottom center', verticalAlign: 'middle', flexShrink: 0 }} />
}

// Loading skeleton = the iron heating: pale pockets toast left-to-right to
// golden as content arrives. Static pale under prefers-reduced-motion.
function ToastSkeleton() {
  var anim: CSSProperties = prefersReducedMotion() ? {} : {
    backgroundImage: 'linear-gradient(90deg, var(--bg-subtle) 25%, #F2DCB3 50%, var(--bg-subtle) 75%)',
    backgroundSize: '200% 100%',
    animation: 'waffleToast 1.2s linear infinite',
  }
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4].map(function(i) {
        return <div key={i} style={Object.assign({ height: 34, margin: '6px 12px', borderRadius: 6, background: 'var(--bg-subtle)' }, anim)} />
      })}
    </div>
  )
}

// WAFFLE-2: server counts shape from GET /api/bugs (see sm-api PR #968)
export interface BugCounts {
  queue: number
  mine: number
  closed: number
  verified: number
  deferred: number
  total: number
}

// WAFFLE-1 GET /api/bugs/my-day response sections (bug rows; recent_activity
// rows carry kind: 'comment' | 'update')
export interface MyDayData {
  overdue: Bug[]
  due_today: Bug[]
  in_progress_mine: Bug[]
  newly_assigned: Bug[]
  recent_activity: Array<Bug & { kind?: string }>
  unassigned_on_my_products: Bug[]
}

export interface ProductCount {
  product: string
  queue: number
  open: number
  in_progress: number
  blocked: number
  verified: number
  deferred: number
  total: number
  oldest_queue_at?: string | null
}

var PAGE_SIZE = 100

var REPORTER_FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'open',     label: 'Open',        statuses: ['open', 'in_progress'] },
  { id: 'done',     label: 'Closed',      statuses: ['closed'] },
]

function BugIcon({ size }: { size?: number }) {
  return React.createElement('svg', { width: size || 18, height: size || 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M9 9v-1a3 3 0 0 1 6 0v1' }),
    React.createElement('path', { d: 'M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3' }),
    React.createElement('path', { d: 'M3 13l4 0' }),
    React.createElement('path', { d: 'M17 13l4 0' }),
    React.createElement('path', { d: 'M12 20l0 -6' }),
    React.createElement('path', { d: 'M4 19l3.35 -2' }),
    React.createElement('path', { d: 'M20 19l-3.35 -2' }),
    React.createElement('path', { d: 'M4 7l3.75 2.4' }),
    React.createElement('path', { d: 'M20 7l-3.75 2.4' })
  )
}

// WAFFLE-2: Waffle icon — tabler grid-4x4
function WaffleIcon({ size }: { size?: number }) {
  return React.createElement('svg', { width: size || 18, height: size || 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M6 4v16' }),
    React.createElement('path', { d: 'M12 4v16' }),
    React.createElement('path', { d: 'M18 4v16' }),
    React.createElement('path', { d: 'M4 6h16' }),
    React.createElement('path', { d: 'M4 12h16' }),
    React.createElement('path', { d: 'M4 18h16' })
  )
}

// WAFFLE-2: standalone favicon (grid-4x4, Sprint Mode blue)
var WAFFLE_FAVICON =
  'data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%226%22%20fill%3D%22rgba%28232%2C161%2C60%2C0.1%29%22/%3E%20%3Cg%20transform%3D%22translate%282.4%2C%202.4%29%20scale%280.8%29%22%20stroke%3D%22%23E8A13C%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20fill%3D%22none%22%3E%20%3Cpath%20d%3D%22M3%206h18%22/%3E%3Cpath%20d%3D%22M3%2012h18%22/%3E%3Cpath%20d%3D%22M3%2018h18%22/%3E%20%3Cpath%20d%3D%22M6%203v18%22/%3E%3Cpath%20d%3D%22M12%203v18%22/%3E%3Cpath%20d%3D%22M18%203v18%22/%3E%20%3C/g%3E%20%3C/svg%3E'


function CloseIcon() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' },
    React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
    React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
  )
}

function PopoutIcon() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
    React.createElement('polyline', { points: '15 3 21 3 21 9' }),
    React.createElement('line', { x1: 10, y1: 14, x2: 21, y2: 3 })
  )
}

// WAFFLE-1: Waffle MCP key management (tabler key outline)
function KeyIcon() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z' }),
    React.createElement('path', { d: 'M15 9h.01' })
  )
}

function UploadIcon() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    React.createElement('polyline', { points: '17 8 12 3 7 8' }),
    React.createElement('line', { x1: 12, y1: 3, x2: 12, y2: 15 })
  )
}

function CameraIcon() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 })
  )
}

function PlayIcon() {
  return React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 },
    React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' })
  )
}

var S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 8999 } as CSSProperties,
  panel: { position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: 'var(--bg)', borderLeft: '1px solid var(--border)', zIndex: 9000, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' } as CSSProperties,
  panelMobile: { width: '100%' } as CSSProperties,
  header: { padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } as CSSProperties,
  title: { fontSize: 15, fontWeight: 700, color: 'var(--foreground)' } as CSSProperties,
  closeBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', cursor: 'pointer', padding: 0 } as CSSProperties,
  sourceToggle: { display: 'flex', padding: '6px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 0 } as CSSProperties,
  sourceBtn: function(active: boolean): CSSProperties { return { flex: 1, padding: '7px 8px', fontSize: 12, fontFamily: 'var(--font)', fontWeight: 600, border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)', background: active ? 'var(--accent)' : 'var(--bg-subtle)', color: active ? '#fff' : 'var(--muted)', cursor: 'pointer', textAlign: 'center' } },
  sourceBtnFirst: { borderRadius: '6px 0 0 6px', borderRight: 'none' } as CSSProperties,
  sourceBtnLast: { borderRadius: '0 6px 6px 0' } as CSSProperties,
  filterBar: { display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' } as CSSProperties,
  filterSelect: { fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--foreground)', outline: 'none' } as CSSProperties,
  // WAFFLE-FIX-1 (bug_w2f_tabrow/bug_w2f_hscroll): tabs shrink to fit —
  // flex '1 1 auto' + minWidth 0, no overflowX scrolling. A scrollable tab
  // strip was explicitly rejected; with the shortened labels all five tabs
  // fit the 480px panel with real counts.
  // WAFFLE-FIX-1 regression fix (bug_w2f_tabrow): the panel is width:100% on
  // mobile (< 480px), where the fixed 11px sizing overflowed and per-button
  // overflow:hidden silently truncated count digits ("Fixed 19|1", Deferred's
  // count clipped away entirely). Buttons keep overflow:hidden only as a
  // paint guard; a layout-effect measures button scrollWidth and escalates
  // tabFit full -> compact (10px, tighter padding) -> elide (99+) before
  // paint, so no clipped digit is ever shown. Real numbers whenever they fit.
  tabBar: { display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' } as CSSProperties,
  tabBtn: function(active: boolean, compact?: boolean): CSSProperties { return { flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', padding: compact ? '8px 2px' : '8px 4px', fontSize: compact ? 10 : 11, fontFamily: 'var(--font-mono)', fontWeight: active ? 700 : 400, color: active ? 'var(--accent)' : 'var(--muted)', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', textAlign: 'center' } },
  list: { flex: 1, overflowY: 'auto', padding: 8 } as CSSProperties,
  rpills: { display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 } as CSSProperties,
  rpill: function(active: boolean): CSSProperties { return { padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, borderRadius: 999, border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--muted)', cursor: 'pointer' } },
  // WAFFLE-FIX-1 (bug_w2f_hscroll): overflowWrap 'anywhere' inherits to every
  // text block in the card (title, description, comments). Unbroken tokens —
  // e.g. a 100-char slash-joined method list in a description — otherwise
  // render wider than the panel and drag the list container into horizontal
  // scroll (the bottom scrollbar in Aaron's recording). Ellipsis one-liners
  // (nowrap) are unaffected since no wrapping applies to them.
  card: function(expanded: boolean): CSSProperties { return { background: 'var(--bg-subtle)', border: '1px solid', borderColor: expanded ? 'var(--accent)' : 'var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer', transition: 'border-color 0.15s', overflowWrap: 'anywhere' } },
  meta: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } as CSSProperties,
  dot: function(color: string): CSSProperties { return { width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 } },
  typeBadge: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' } as CSSProperties,
  productBadge: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' } as CSSProperties,
  submittedBy: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)' } as CSSProperties,
  statusPill: function(status: string): CSSProperties { var m = STATUS_META[status] || STATUS_META['open']; return { display: 'inline-block', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 999, marginLeft: 'auto', flexShrink: 0, background: m.bg, color: m.color } },
  bugTitle: { fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' } as CSSProperties,
  bugDesc: { fontSize: 12, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.4 } as CSSProperties,
  bugUrl: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 6 } as CSSProperties,
  bugTime: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' } as CSSProperties,
  bugId: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 3, cursor: 'pointer', userSelect: 'all' } as CSSProperties,
  detail: { marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' } as CSSProperties,
  sectionLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '10px 0 4px' } as CSSProperties,
  aiTriage: { marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--accent-10, rgba(35,98,234,0.1))', border: '1px solid var(--border)' } as CSSProperties,
  aiHeader: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 } as CSSProperties,
  aiBadge: function(bg: string, color: string): CSSProperties { return { display: 'inline-block', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: bg, color: color, marginRight: 4 } },
  aiNotes: { fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, marginTop: 4 } as CSSProperties,
  fireSection: { marginTop: 10, padding: 10, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' } as CSSProperties,
  fireHeader: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  firePreview: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', lineHeight: 1.5, background: 'var(--bg-subtle)', padding: 8, borderRadius: 4, border: '1px solid var(--border)', maxHeight: 60, overflow: 'hidden', marginBottom: 8, whiteSpace: 'pre-wrap' } as CSSProperties,
  btnSm: function(bg: string, color: string, border?: string): CSSProperties { return { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', border: border || 'none', background: bg, color: color } },
  commentAvatar: function(): CSSProperties { return { width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-10, rgba(35,98,234,0.1))', color: 'var(--accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)' } },
  commentInput: { flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--foreground)', fontFamily: 'var(--font)', outline: 'none' } as CSSProperties,
  commentSubmit: { padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 } as CSSProperties,
  formArea: { borderTop: '1px solid var(--border)', padding: 12, background: 'var(--bg-subtle)', flexShrink: 0 } as CSSProperties,
  formSelect: { fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--foreground)', flex: 1, outline: 'none' } as CSSProperties,
  formInput: { width: '100%', padding: 8, fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--foreground)', fontFamily: 'var(--font)', marginBottom: 6, outline: 'none', boxSizing: 'border-box' } as CSSProperties,
  formTextarea: { width: '100%', padding: 8, fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--foreground)', fontFamily: 'var(--font)', resize: 'vertical', marginBottom: 6, outline: 'none', boxSizing: 'border-box' } as CSSProperties,
  screenshotZone: { flex: 1, border: '1.5px dashed var(--border)', borderRadius: 6, padding: 10, textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', cursor: 'pointer' } as CSSProperties,
  captureBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-10, rgba(35,98,234,0.1))', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 } as CSSProperties,
  fileBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' } as CSSProperties,
  submitBtn: { flex: 1, padding: 8, borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' } as CSSProperties,
  cancelBtn: { padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' } as CSSProperties,
  fab: { position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' } as CSSProperties,
  fabOffset: { bottom: 80 } as CSSProperties,
  empty: { textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 } as CSSProperties,
  // WAFFLE-2 manager view styles
  groupHeader: { padding: '10px 8px 4px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  groupCount: { fontWeight: 400 } as CSSProperties,
  loadMore: { display: 'block', width: '100%', margin: '8px 0', padding: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' } as CSSProperties,
  viewBar: { display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'center' } as CSSProperties,
  delRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 12 } as CSSProperties,
  threadBadge: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--blue-10)', color: 'var(--blue)' } as CSSProperties,
}

function initials(name: string | undefined): string {
  if (!name) return '?'
  var parts = name.split(' ')
  if (parts.length >= 2) return ((parts[0][0] || '') + (parts[1][0] || '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function shortId(id: string | undefined, type?: string): string {
  if (!id) return ''
  var prefix = type === 'feature' ? 'FEAT' : type === 'ux' ? 'UX' : type === 'task' ? 'TASK' : 'BUG'
  if (id.startsWith('bug_')) return prefix + '-' + id.slice(4, 10)
  return 'PS-' + id.slice(0, 6)
}

function relTime(iso: string | undefined): string {
  if (!iso) return ''
  var diff = Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
  var m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  var h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  var d = Math.floor(h / 24)
  if (d < 30) return d + 'd ago'
  return new Date(iso).toLocaleDateString()
}

function blastColor(blast: string | undefined): { bg: string; color: string } {
  if (blast === 'low') return { bg: 'var(--green-light)', color: 'var(--green)' }
  if (blast === 'medium') return { bg: 'var(--amber-light)', color: 'var(--amber)' }
  return { bg: 'var(--red-light)', color: 'var(--red)' }
}

interface AiClassification {
  classification?: string
  blast_radius?: string
  auto_fixable?: boolean
  suggested_priority?: string
  triage_notes?: string
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !query.trim() || !text) return text
  var q = query.trim()
  var idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return React.createElement(React.Fragment, null,
    text.slice(0, idx),
    React.createElement('mark', { style: { background: 'var(--amber-light)', color: 'var(--foreground)', padding: '0 1px', borderRadius: 2 } }, text.slice(idx, idx + q.length)),
    text.slice(idx + q.length)
  )
}

function CommentAttThumb({ att, bugId, isImage, apiBase, product }: { att: BugAttachment; bugId: string; isImage: boolean; apiBase: string; product: string }) {
  var _url = useState<string | null>(null); var url = _url[0]; var setUrl = _url[1]
  useEffect(function() {
    fetch(apiBase + '/api/bugs/' + bugId + '/attachments/' + att.id + '/url', { credentials: 'include' as RequestCredentials, headers: { 'X-SM-Product': product } })
      .then(function(r) { return r.json() })
      .then(function(d: any) { if (d.ok && d.data?.url) setUrl(d.data.url) })
      .catch(function() {})
  }, [att.id, bugId, apiBase, product])
  return React.createElement('div', {
    style: { border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', maxWidth: isImage ? 200 : 180 },
    onClick: function(e: React.MouseEvent) { e.stopPropagation(); if (url) window.open(url, '_blank') }
  },
    isImage && url ? React.createElement('img', { src: url, style: { width: '100%', maxHeight: 150, objectFit: 'cover' } }) : null,
    React.createElement('div', { style: { padding: '4px 8px', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, att.filename)
  )
}

function BugCard({ bug, isAdmin, expanded, onToggle, onAction, onComment, onDelete, onFire, onFireTerminal, onVerify, apiBase, product, searchQuery, assignees, flash }: {
  bug: Bug
  isAdmin?: boolean
  expanded: boolean
  onToggle: () => void
  onAction: (bugId: string, updates: Record<string, string>) => void
  onComment: (bugId: string, body: string, files?: Array<{ name: string; dataUrl: string; file?: File }>) => Promise<void>
  onDelete?: (bugId: string) => void
  onFire?: (bugId: string) => void
  onFireTerminal?: (bugId: string) => void
  onVerify?: (bugId: string) => void
  // WAFFLE-FIX-1 (bug_w2o_copypass): brief golden-brown flash on verify
  flash?: boolean
  apiBase: string
  product: string
  searchQuery?: string
  assignees?: Array<{ id: string; name: string }>
}) {
  // WAFFLE-0: resolve assigned_to contact_id -> display name
  var assignedName = ''
  if (bug.assigned_to && assignees) {
    var _match = assignees.find(function(a) { return a.id === bug.assigned_to })
    assignedName = _match ? _match.name : bug.assigned_to
  } else if (bug.assigned_to) {
    assignedName = bug.assigned_to
  }
  var isOverdue = !!(bug.due_date && bug.status !== 'closed' && bug.status !== 'fixed' && bug.due_date < new Date().toISOString().slice(0, 10))
  var _comment = useState(''); var comment = _comment[0]; var setComment = _comment[1]
  var _copied = useState(false); var copied = _copied[0]; var setCopied = _copied[1]
  var _posting = useState(false); var posting = _posting[0]; var setPosting = _posting[1]
  var _closing = useState(false); var closing = _closing[0]; var setClosure = _closing[1]
  var _closeReason = useState(''); var closeReason = _closeReason[0]; var setCloseReason = _closeReason[1]
  var _confirmDelete = useState(false); var confirmDelete = _confirmDelete[0]; var setConfirmDelete = _confirmDelete[1]
  var _viewingAtt = useState<string | null>(null); var _viewingAttVal = _viewingAtt[0]; var _setViewingAtt = _viewingAtt[1]
  var _commentFiles = useState<Array<{ id: string; name: string; dataUrl: string; file?: File }>>([]); var commentFiles = _commentFiles[0]; var setCommentFiles = _commentFiles[1]
  var commentFileInputRef = useRef<HTMLInputElement>(null)
  var commentFileIdRef = useRef(0)

  var sm = STATUS_META[bug.status] || STATUS_META['open']
  var TYPE_COLORS: Record<string, string> = { feature: 'var(--blue)', ux: 'var(--amber)', task: 'var(--green)', human_action: '#e67700' }
  var dotColor = (bug.status === 'open' && bug.type && TYPE_COLORS[bug.type]) ? TYPE_COLORS[bug.type] : sm.color
  var ai: AiClassification | null = null
  try { ai = typeof bug.ai_classification === 'string' ? JSON.parse(bug.ai_classification) : (bug.ai_classification as AiClassification) || null } catch(_e) {}

  function copyId(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(bug.id).then(function() { setCopied(true); setTimeout(function() { setCopied(false) }, 1200) })
  }

  function postComment(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if ((!comment.trim() && commentFiles.length === 0) || posting) return
    setPosting(true)
    var filesToSend = commentFiles.slice()
    onComment(bug.id, comment.trim() || (filesToSend.length > 0 ? '[attachment]' : ''), filesToSend.length > 0 ? filesToSend : undefined).then(function() {
      setComment('')
      setCommentFiles([])
      setPosting(false)
    }).catch(function() { setPosting(false) })
  }

  function copyFirePrompt(e: React.MouseEvent) {
    e.stopPropagation()
    if (bug.fire_prompt) navigator.clipboard.writeText(bug.fire_prompt)
  }

  function fireBug(e: React.MouseEvent) {
    e.stopPropagation()
    if (bug.fire_prompt) navigator.clipboard.writeText(bug.fire_prompt)
    onFire && onFire(bug.id)
  }

  function fireTerminal(e: React.MouseEvent) {
    e.stopPropagation()
    onFireTerminal && onFireTerminal(bug.id)
  }

  return (
    <div style={Object.assign({}, S.card(expanded), { transition: 'background 0.9s ease' }, flash ? { background: 'rgba(232,161,60,0.22)' } : {})} onClick={onToggle} data-bug-id={bug.id}>
      <div style={S.meta}>
        <span style={S.dot(dotColor)} />
        <span style={S.typeBadge}>{bug.type || 'bug'}</span>
        <span style={S.productBadge}>{bug.product}</span>
        {bug.subsystem && <span style={Object.assign({}, S.productBadge, { color: 'var(--accent)' })}>{bug.subsystem}</span>}
        {isAdmin && bug.submitted_by_name && <span style={S.submittedBy}>{bug.submitted_by_name.split(' ')[0].toLowerCase()}</span>}
        {isAdmin && assignedName && <span style={Object.assign({}, S.submittedBy, { color: 'var(--accent)' })} title={'Assigned to ' + assignedName}>{'\u2192 ' + assignedName.split(' ')[0].toLowerCase()}</span>}
        {isAdmin ? <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', marginLeft: 'auto', color: sm.color }}>{bug.status}</span>
                 : <span style={S.statusPill(bug.status)}>{sm.label}</span>}
        {bug.verified_status && VERIFIED_META[bug.verified_status] && (
          <span style={{ display: 'inline-block', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 6px', borderRadius: 999, flexShrink: 0, background: VERIFIED_META[bug.verified_status].bg, color: VERIFIED_META[bug.verified_status].color, marginLeft: 4 }}>{VERIFIED_META[bug.verified_status].label}</span>
        )}
        {flash && <ButterPat />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={S.bugId} onClick={copyId} title="Click to copy ID">{shortId(bug.id, bug.type)}</span>
        {copied && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>copied</span>}
      </div>
      <div style={S.bugTitle}>{highlightText(bug.title, searchQuery || '')}</div>

      {bug.description && <div style={S.bugDesc}>{bug.description.length > 120 ? bug.description.slice(0, 120) + '...' : bug.description}</div>}
      {bug.page_url && <div style={S.bugUrl}>{bug.page_url}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
        <div style={S.bugTime}>{relTime(bug.created_at)}</div>
        {bug.due_date && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: isOverdue ? 700 : 400, color: isOverdue ? 'var(--red)' : 'var(--muted)' }}>
            {isOverdue ? 'overdue ' : 'due '}{bug.due_date}
          </span>
        )}
        {bug.tags && bug.tags.split(',').map(function(t) {
          var tag = t.trim()
          if (!tag) return null
          return <span key={tag} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 999, background: 'var(--bg-subtle)', color: 'var(--muted)' }}>{tag}</span>
        })}
      </div>

      {expanded && (
        <div style={S.detail}>
          {bug.description && bug.description.length > 120 && (
            <>
              <div style={Object.assign({}, S.sectionLabel, { marginTop: 0 })}>Full Description</div>
              <div style={S.bugDesc}>{bug.description}</div>
            </>
          )}

          {bug.attachments && bug.attachments.length > 0 && (
            <>
              <div style={S.sectionLabel}>Attachments</div>
              <div onClick={function(e) { e.stopPropagation() }}>
              <UpdateAttachments
                attachments={bug.attachments.map(function(att) { return { id: att.id, type: att.type || 'file', filename: att.filename, r2Key: att.r2_key || att.id, size: att.size, mime: att.mime } })}
                updateId={bug.id}
                getSignedUrl={function(_uid: string, attId: string) {
                  return fetch(apiBase + '/api/bugs/' + bug.id + '/attachments/' + attId + '/url', { credentials: 'include', headers: { 'X-SM-Product': product } })
                    .then(function(r) { return r.json() })
                }}
              />
              </div>
            </>
          )}

          {ai && (
            <div style={S.aiTriage}>
              <div style={S.aiHeader}>AI Triage{ai.auto_fixable ? ' (auto)' : ''}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={S.aiBadge('var(--blue-10)', 'var(--blue)')}>{ai.classification || bug.type}</span>
                {ai.blast_radius && <span style={S.aiBadge(blastColor(ai.blast_radius).bg, blastColor(ai.blast_radius).color)}>blast: {ai.blast_radius}</span>}
                {ai.auto_fixable !== undefined && <span style={S.aiBadge(ai.auto_fixable ? 'var(--green-light)' : 'var(--bg-subtle)', ai.auto_fixable ? 'var(--green)' : 'var(--muted)')}>{ai.auto_fixable ? 'auto-fixable' : 'manual fix'}</span>}
                {ai.suggested_priority && (function() { var pb = priorityBadge(ai.suggested_priority); return <span style={S.aiBadge(pb.bg, pb.color)}>{pb.label} {pb.sublabel}</span> })()}
              </div>
              {ai.triage_notes && <div style={S.aiNotes}>{ai.triage_notes}</div>}
            </div>
          )}

          {isAdmin && bug.fire_prompt && (
            <div style={S.fireSection}>
              <div style={S.fireHeader}><PlayIcon /> Fire Prompt Ready</div>
              <div style={S.firePreview}>{bug.fire_prompt}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={S.btnSm('var(--green)', '#fff', 'none')} onClick={fireBug}>Fire &amp; Push Brief</button>
                <button style={S.btnSm('var(--bg-subtle)', 'var(--green)', '1px solid var(--green)')} onClick={fireTerminal}>Push to Terminal</button>
                <button style={S.btnSm('transparent', 'var(--muted)', '1px solid var(--border)')} onClick={copyFirePrompt}>Copy Prompt</button>
              </div>
            </div>
          )}

          <div style={S.sectionLabel}>Comments</div>
          {bug.comments && bug.comments.map(function(c) {
            var commentAtts = (bug.attachments || []).filter(function(a) { return (a as any).comment_id === c.id })
            return (
              <div key={c.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={S.commentAvatar()}>{initials(c.author_name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{c.author_name}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{relTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>{c.body}</div>
                  {commentAtts.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {commentAtts.map(function(att) {
                        var isImage = att.type === 'image' || /\.(png|jpg|jpeg|gif|webp)$/i.test(att.filename)
                        return <CommentAttThumb key={att.id} att={att} bugId={bug.id} isImage={isImage} apiBase={apiBase} product={product} />
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', flexDirection: 'column' }}>
            {commentFiles.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {commentFiles.map(function(f) {
                  return <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                    {f.dataUrl.startsWith('data:image') ? <img src={f.dataUrl} style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2 }} /> : null}
                    {f.name.length > 20 ? f.name.slice(0, 17) + '...' : f.name}
                    <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }} onClick={function(e) { e.stopPropagation(); setCommentFiles(function(prev) { return prev.filter(function(x) { return x.id !== f.id }) }) }}>{'\u00d7'}</button>
                  </span>
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={S.commentInput} placeholder="Comment or paste screenshot..." value={comment}
                onChange={function(e) { setComment(e.target.value) }}
                onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) postComment(e) }}
                onClick={function(e) { e.stopPropagation() }}
                onPaste={function(e) {
                  var items = e.clipboardData && e.clipboardData.items
                  if (!items) return
                  for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      e.preventDefault()
                      var file = items[i].getAsFile()
                      if (!file) continue
                      var reader = new FileReader()
                      reader.onload = function(ev) {
                        commentFileIdRef.current++
                        setCommentFiles(function(prev) { return prev.concat([{ id: 'catt_' + commentFileIdRef.current + '_' + Date.now(), name: file!.name || 'screenshot.png', dataUrl: ev.target!.result as string, file: file! }]) })
                      }
                      reader.readAsDataURL(file)
                    }
                  }
                }} />
              <input type="file" ref={commentFileInputRef} style={{ display: 'none' }} multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={function(e) {
                var files = e.target.files
                if (!files) return
                for (var i = 0; i < files.length; i++) {
                  (function(f) {
                    var reader = new FileReader()
                    reader.onload = function(ev) {
                      commentFileIdRef.current++
                      setCommentFiles(function(prev) { return prev.concat([{ id: 'catt_' + commentFileIdRef.current + '_' + Date.now(), name: f.name, dataUrl: ev.target!.result as string, file: f }]) })
                    }
                    reader.readAsDataURL(f)
                  })(files[i])
                }
                e.target.value = ''
              }} />
              <button style={Object.assign({}, S.commentSubmit, { background: 'var(--bg-subtle)', color: 'var(--muted)', padding: '6px 8px' })} onClick={function(e) { e.stopPropagation(); commentFileInputRef.current?.click() }} title="Attach file">{'\ud83d\udcce'}</button>
              <button style={S.commentSubmit} onClick={postComment} disabled={posting}>{posting ? '...' : 'Post'}</button>
            </div>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' as const, alignItems: 'center' }} onClick={function(e) { e.stopPropagation() }}>
              <select
                style={Object.assign({}, S.btnSm('transparent', 'var(--foreground)', '1px solid var(--border)'), { cursor: 'pointer', fontSize: 11, maxWidth: 140 })}
                value={bug.assigned_to || ''}
                onChange={function(e) { onAction(bug.id, { assigned_to: e.target.value }) }}
                title="Assigned to"
              >
                <option value="">Unassigned</option>
                {(assignees || []).map(function(a) { return <option key={a.id} value={a.id}>{a.name}</option> })}
              </select>
              <datalist id={'wfl-subsystems-' + bug.id}>
                {SUBSYSTEM_SUGGESTIONS.map(function(ss) { return <option key={ss} value={ss} /> })}
              </datalist>
              <input
                list={'wfl-subsystems-' + bug.id}
                placeholder="subsystem"
                defaultValue={bug.subsystem || ''}
                onBlur={function(e) { var v = e.target.value.trim(); if (v !== (bug.subsystem || '')) onAction(bug.id, { subsystem: v }) }}
                onKeyDown={function(e) { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                style={Object.assign({}, S.btnSm('transparent', 'var(--foreground)', '1px solid var(--border)'), { fontSize: 11, width: 110 })}
                title="Subsystem"
              />
              <input
                type="date"
                defaultValue={bug.due_date || ''}
                onChange={function(e) { onAction(bug.id, { due_date: e.target.value }) }}
                style={Object.assign({}, S.btnSm('transparent', 'var(--foreground)', '1px solid var(--border)'), { fontSize: 11 })}
                title="Due date"
              />
              <input
                placeholder="tags, comma,separated"
                defaultValue={bug.tags || ''}
                onBlur={function(e) { var v = e.target.value.trim(); if (v !== (bug.tags || '')) onAction(bug.id, { tags: v }) }}
                onKeyDown={function(e) { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                style={Object.assign({}, S.btnSm('transparent', 'var(--foreground)', '1px solid var(--border)'), { fontSize: 11, width: 130 })}
                title="Tags (comma-separated)"
              />
            </div>
          )}

          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {bug.status === 'open' && (
                <>
                  <button style={S.btnSm('var(--accent)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'in_progress' }) }}>Start</button>
                  <button style={S.btnSm('var(--green)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'closed', verified_status: 'verified' }) }}>{'\u2713'} Verify & Close</button>
                  {!closing ? (
                    <button style={S.btnSm('transparent', 'var(--muted)', '1px solid var(--border)')} onClick={function(e) { e.stopPropagation(); setClosure(true) }}>Close</button>
                  ) : (
                    <>
                      <select style={Object.assign({}, S.btnSm('transparent', 'var(--muted)', '1px solid var(--border)'), { cursor: 'pointer', fontSize: 11 })} value={closeReason} onChange={function(e) { e.stopPropagation(); setCloseReason(e.target.value) }} onClick={function(e) { e.stopPropagation() }}>
                        <option value="">Select reason...</option>
                        <option value="invalid">Invalid</option>
                        <option value="duplicate">Duplicate</option>
                        <option value="already_fixed">Already Fixed</option>
                        <option value="wont_fix">Won't Fix</option>
                        <option value="moved_to_feature">Moved to Feature</option>
                      </select>
                      {closeReason && <button style={S.btnSm('var(--red)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'closed', close_reason: closeReason }); setClosure(false); setCloseReason('') }}>Confirm</button>}
                      <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }} onClick={function(e) { e.stopPropagation(); setClosure(false); setCloseReason('') }}>Cancel</button>
                    </>
                  )}
                </>
              )}
              {bug.status === 'in_progress' && (
                <>
                  <button style={S.btnSm('var(--green)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'closed', verified_status: 'verified' }) }}>{'\u2713'} Verify & Close</button>
                  {!closing ? (
                    <button style={S.btnSm('transparent', 'var(--muted)', '1px solid var(--border)')} onClick={function(e) { e.stopPropagation(); setClosure(true) }}>Close</button>
                  ) : (
                    <>
                      <select style={Object.assign({}, S.btnSm('transparent', 'var(--muted)', '1px solid var(--border)'), { cursor: 'pointer', fontSize: 11 })} value={closeReason} onChange={function(e) { e.stopPropagation(); setCloseReason(e.target.value) }} onClick={function(e) { e.stopPropagation() }}>
                        <option value="">Select reason...</option>
                        <option value="fixed">Fixed</option>
                        <option value="invalid">Invalid</option>
                        <option value="duplicate">Duplicate</option>
                        <option value="already_fixed">Already Fixed</option>
                        <option value="wont_fix">Won't Fix</option>
                        <option value="moved_to_feature">Moved to Feature</option>
                      </select>
                      {closeReason && <button style={S.btnSm('var(--red)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'closed', close_reason: closeReason }); setClosure(false); setCloseReason('') }}>Confirm</button>}
                      <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }} onClick={function(e) { e.stopPropagation(); setClosure(false); setCloseReason('') }}>Cancel</button>
                    </>
                  )}
                  <button style={S.btnSm('transparent', 'var(--accent)', '1px solid var(--accent)')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'open' }) }}>Re-open</button>
                </>
              )}
              {bug.status === 'closed' && (
                <>
                  <button style={S.btnSm('transparent', 'var(--accent)', '1px solid var(--accent)')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { status: 'open' }) }}>Re-open</button>
                  {bug.close_reason && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{bug.close_reason.replace(/_/g, ' ')}</span>}
                  {onVerify && bug.test_spec && !bug.verified_status && (
                    <button style={S.btnSm('transparent', 'var(--green)', '1px solid var(--green)')} onClick={function(e) { e.stopPropagation(); onVerify(bug.id) }}>PW Verify</button>
                  )}
                  {onVerify && bug.verified_status === 'pw_failed' && bug.test_spec && (
                    <button style={S.btnSm('transparent', '#e67700', '1px solid #e67700')} onClick={function(e) { e.stopPropagation(); onVerify(bug.id) }}>Re-verify</button>
                  )}
                  {bug.verified_status !== 'verified' && (
                    <button style={S.btnSm('transparent', 'var(--green)', '1px solid var(--green)')} onClick={function(e) { e.stopPropagation(); onAction(bug.id, { verified_status: 'verified' }) }}>{'\u2713'} Mark Verified</button>
                  )}
                </>
              )}
              {onDelete && <span style={{ marginLeft: 'auto' }} />}
              {onDelete && !confirmDelete && (
                <button style={S.btnSm('transparent', 'var(--red)', '1px solid var(--border)')} onClick={function(e) { e.stopPropagation(); setConfirmDelete(true) }}>Delete</button>
              )}
              {onDelete && confirmDelete && (
                <>
                  <button style={S.btnSm('var(--red)', '#fff', 'none')} onClick={function(e) { e.stopPropagation(); onDelete(bug.id); setConfirmDelete(false) }}>Confirm delete</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }} onClick={function(e) { e.stopPropagation(); setConfirmDelete(false) }}>Cancel</button>
                </>
              )}
            </div>
          )}

          {/* PW-QA-VERIFY-1: Verification results with inline screenshots */}
          {bug.verified_status && bug.verified_status !== 'pw_verifying' && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: bug.verified_status === 'verified' ? 'var(--green-light, #f0fdf4)' : 'var(--red-light, #fef2f2)' }} onClick={function(e) { e.stopPropagation() }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: bug.verified_status === 'verified' ? 'var(--green, hsl(142,71%,30%))' : 'var(--red, hsl(0,84%,40%))' }}>{bug.verified_status === 'verified' ? '\u2713 Playwright Verified' : '\u2717 Playwright Failed'}</span>
                </div>
                {bug.verified_at && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{new Date(bug.verified_at).toLocaleString()}</span>}
              </div>
              {bug.verification_results && bug.verification_results.map(function(r, i) {
                return <div key={i} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.screenshots && r.screenshots.length > 0 ? 8 : 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 3, background: r.status === 'pass' ? 'var(--green-light, #dcfce7)' : 'var(--red-light, #fee2e2)', color: r.status === 'pass' ? 'var(--green, hsl(142,71%,30%))' : 'var(--red, hsl(0,84%,40%))' }}>{r.status === 'pass' ? 'PASS' : 'FAIL'}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font)', fontWeight: 500, color: 'var(--foreground)' }}>{r.id.replace(/^bug_/, 'BUG-').slice(0, 12)}</span>
                    {r.duration_ms != null && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginLeft: 'auto' }}>{(r.duration_ms / 1000).toFixed(1)}s</span>}
                  </div>
                  {r.error && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red, hsl(0,84%,40%))', padding: '6px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 4, marginBottom: 6, marginTop: 6, wordBreak: 'break-word' as const, lineHeight: '1.4' }}>{r.error}</div>}
                  {r.screenshots && r.screenshots.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {r.screenshots.map(function(url, j) {
                        var label = url.split('/').pop()?.replace('.png', '').replace(/-/g, ' ') || 'screenshot'
                        return <div key={j} style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                            <img src={url} alt={label} style={{ maxWidth: 220, maxHeight: 160, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', display: 'block' }} />
                          </a>
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>{label}</span>
                        </div>
                      })}
                    </div>
                  )}
                </div>
              })}
            </div>
          )}
          {bug.verified_status === 'pw_verifying' && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: '#fff8e1' }} onClick={function(e) { e.stopPropagation() }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#e67700' }}>{'\u25CB'} Playwright running...</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Results will appear when complete</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BugPanel(props: BugPanelProps) {
  var isAdmin = props.isAdmin
  var apiBase = props.apiBase || ''
  var product = props.product || 'sm'
  var label = props.label || 'Report Bug'
  var offsetFab = props.offsetFab
  var onClose = props.onClose
  var session = props.session

  // PORTAL-PERMISSIONS-1: Send X-SM-Product so the API reads the correct
  // per-portal session cookie (e.g. sm_session_admin) instead of falling
  // back to sm_client which may be missing or stale.
  function apiFetch(url: string, opts?: RequestInit): Promise<Response> {
    var headers = Object.assign({}, (opts && opts.headers) || {}, { 'X-SM-Product': product }) as Record<string, string>
    return fetch(url, Object.assign({}, opts || {}, { credentials: 'include' as RequestCredentials, headers: headers }))
  }
  var visible = props.visible

  var _open = useState(false); var selfOpen = _open[0]; var setSelfOpen = _open[1]
  var open = visible !== undefined ? visible : selfOpen
  var setOpen = visible !== undefined ? function() {} : setSelfOpen

  var _bugs = useState<Bug[]>([]); var bugs = _bugs[0]; var setBugs = _bugs[1]
  var _loading = useState(false); var loading = _loading[0]; var setLoading = _loading[1]
  // WAFFLE-0: Threads tab removed — project_state merged into bugs. Source is
  // now a filter over one list (pm_state_id discriminates claude vs human).
  var _filterSource = useState('all'); var filterSource = _filterSource[0]; var setFilterSource = _filterSource[1]
  var _tab = useState('queue'); var tab = _tab[0]; var setTab = _tab[1]
  var _rFilter = useState('all'); var rFilter = _rFilter[0]; var setRFilter = _rFilter[1]
  var _expanded = useState<string | null>(null); var expanded = _expanded[0]; var setExpanded = _expanded[1]
  var _showForm = useState(false); var showForm = _showForm[0]; var setShowForm = _showForm[1]
  var _fTitle = useState(''); var fTitle = _fTitle[0]; var setFTitle = _fTitle[1]
  var _fDesc = useState(''); var fDesc = _fDesc[0]; var setFDesc = _fDesc[1]
  var _fType = useState('bug'); var fType = _fType[0]; var setFType = _fType[1]
  var _fProduct = useState(product); var fProduct = _fProduct[0]; var setFProduct = _fProduct[1]
  var _submitting = useState(false); var submitting = _submitting[0]; var setSubmitting = _submitting[1]
  // BUG-PANEL-STANDALONE-1: Dynamic product list from API, with static fallback
  var _products = useState<Record<string, string[]>>(PRODUCTS_FALLBACK); var products = _products[0]; var setProducts = _products[1]
  var _filterProduct = useState('all'); var filterProduct = _filterProduct[0]; var setFilterProduct = _filterProduct[1]
  var _filterType = useState('all'); var filterType = _filterType[0]; var setFilterType = _filterType[1]
  var _filterPriority = useState('all'); var filterPriority = _filterPriority[0]; var setFilterPriority = _filterPriority[1]
  var _filterPerson = useState('all'); var filterPerson = _filterPerson[0]; var setFilterPerson = _filterPerson[1]
  // WAFFLE-0: work board filters + vocab
  var _filterAssignee = useState('all'); var filterAssignee = _filterAssignee[0]; var setFilterAssignee = _filterAssignee[1]
  var _filterSubsystem = useState('all'); var filterSubsystem = _filterSubsystem[0]; var setFilterSubsystem = _filterSubsystem[1]
  var _assignees = useState<Array<{ id: string; name: string }>>([]); var assignees = _assignees[0]; var setAssignees = _assignees[1]
  // WAFFLE-FIX-1 (bug_w2o_peoplefilter): distinct reporter names from the
  // server (GET /api/bugs/assignees `reporters` key) — covers every submitter
  // ever, incl. client-portal reporters, not just the loaded page.
  var _reporters = useState<string[]>([]); var reporters = _reporters[0]; var setReporters = _reporters[1]
  // WAFFLE-FIX-1 (bug_w2o_copypass): golden-brown flash + one butter pat on
  // a bug turning verified. goldFlash holds the bug id briefly.
  var _goldFlash = useState<string | null>(null); var goldFlash = _goldFlash[0]; var setGoldFlash = _goldFlash[1]
  var goldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function triggerGold(bugId: string) {
    if (goldTimerRef.current) clearTimeout(goldTimerRef.current)
    setGoldFlash(bugId)
    goldTimerRef.current = setTimeout(function() { setGoldFlash(null) }, 1100)
  }
  // WAFFLE-FIX-1 (bug_wfx_mydayclick): id of a bug the user clicked in
  // My Day — resolved into the list (tab switch / targeted fetch / scroll).
  var _pendingFocus = useState<string | null>(null); var pendingFocus = _pendingFocus[0]; var setPendingFocus = _pendingFocus[1]
  // WAFFLE-FIX-1 (bug_w2o_copypass): butter pat in the My Day header when the
  // strip empties out during a session.
  var _patMyDay = useState(false); var patMyDay = _patMyDay[0]; var setPatMyDay = _patMyDay[1]
  var myDayHadWorkRef = useRef(false)
  var _subsystems = useState<string[]>([]); var subsystems = _subsystems[0]; var setSubsystems = _subsystems[1]
  var _sortBy = useState('newest'); var sortBy = _sortBy[0]; var setSortBy = _sortBy[1]
  // WAFFLE-2: server counts + pagination state
  var _counts = useState<BugCounts | null>(null); var counts = _counts[0]; var setCounts = _counts[1]
  // WAFFLE-FIX-1 regression fix (bug_w2f_tabrow): measured tab fit.
  // 'full' = 11px + real counts; 'compact' = 10px, tighter padding, real
  // counts; 'elide' = compact + counts over 99 render as 99+. Escalates one
  // stage per measurement pass (useLayoutEffect, pre-paint) only when a
  // button's content genuinely overflows its box; resets when the count
  // values change so wider layouts recover full numbers.
  var _tabFit = useState<'full' | 'compact' | 'elide'>('full'); var tabFit = _tabFit[0]; var setTabFit = _tabFit[1]
  var tabBarRef = useRef<HTMLDivElement>(null)
  var countsKey = counts ? [counts.queue, counts.mine, counts.closed, counts.verified, counts.deferred].join(',') : ''
  // WAFFLE-FIX-1 round 3 (bug_w2f_tabrow): measurement nonce. Round 2's
  // triggers called setTabFit('full') — a no-op when tabFit was already
  // 'full' (React bails out on same-value state), so the layout effect never
  // re-ran and the post-font re-measure never happened: confirmed live at
  // 320px after the v1.0.89 deploy (text still clipped at 11px). Every
  // trigger now also bumps measureTick, which is a layout-effect dep, so a
  // re-measure is guaranteed even from the 'full' state.
  var _measureTick = useState(0); var measureTick = _measureTick[0]; var setMeasureTick = _measureTick[1]
  function requestTabMeasure() {
    setTabFit('full')
    setMeasureTick(function(t) { return t + 1 })
  }
  useEffect(function() { requestTabMeasure() }, [countsKey])
  // WAFFLE-FIX-1 regression fix round 2 (bug_w2f_tabrow): the escalation was
  // measured exactly once, when counts arrived — typically BEFORE Geist Mono
  // finished loading. The fallback monospace measures narrower, the check
  // passed, the webfont then widened the text, and nothing ever re-measured:
  // confirmed live at 320px (textRectW 77 > clientW 75 on Verified, font
  // still 11px). Two re-measure triggers fix it: document.fonts.ready (the
  // font swap) and window resize (Aaron-style width changes / rotation).
  // Resetting to 'full' re-runs the pre-paint layout measurement, which
  // escalates again before anything is painted — no visible flash.
  useEffect(function() {
    var mounted = true
    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() { if (mounted) requestTabMeasure() })
      }
    } catch (_e) { /* FontFaceSet unsupported — resize trigger still covers us */ }
    var resizeTimer: ReturnType<typeof setTimeout> | null = null
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(function() { if (mounted) requestTabMeasure() }, 150)
    }
    window.addEventListener('resize', onResize)
    return function() {
      mounted = false
      if (resizeTimer) clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  useLayoutEffect(function() {
    if (tabFit === 'elide') return
    var el = tabBarRef.current
    if (!el) return
    var btns = el.querySelectorAll('button')
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].scrollWidth > btns[i].clientWidth + 1) {
        setTabFit(tabFit === 'full' ? 'compact' : 'elide')
        return
      }
    }
  }, [tabFit, measureTick, countsKey, tab, open])
  function tabCount(n: number): string {
    return tabFit === 'elide' && n > 99 ? '99+' : String(n)
  }
  var _total = useState(0); var total = _total[0]; var setTotal = _total[1]
  var _loadingMore = useState(false); var loadingMore = _loadingMore[0]; var setLoadingMore = _loadingMore[1]
  // WAFFLE-2: standalone manager views
  // WAFFLE-2 addendum: manager sections stack above the list with per-section
  // collapse persisted in localStorage (standalone runs in real browsers;
  // same try/catch pattern Layout uses for sm-theme/recentKey).
  // WAFFLE-FIX-1 (bug_w2f_slideover_sections): sections now render in the
  // slide-over too. Collapse state is panel-scoped ('-panel' suffix) so the
  // slide-over and standalone remember independently; the slide-over defaults
  // to all-collapsed (standalone default — expanded — unchanged).
  var sectionsStorageKey = 'waffle-sections-collapsed' + (props.standalone ? '' : '-panel')
  var _collapsed = useState<Record<string, boolean>>(function() {
    var fallback: Record<string, boolean> = props.standalone ? {} : { myday: true, rollup: true, delegation: true }
    try {
      var raw = localStorage.getItem(sectionsStorageKey)
      return raw ? JSON.parse(raw) : fallback
    } catch (_e) { return fallback }
  })
  var collapsed = _collapsed[0]; var setCollapsed = _collapsed[1]
  function toggleSection(key: string) {
    setCollapsed(function(prev) {
      var next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(sectionsStorageKey, JSON.stringify(next)) } catch (_e) { /* storage unavailable — state still works in-memory */ }
      return next
    })
  }
  var _myDay = useState<MyDayData | null>(null); var myDay = _myDay[0]; var setMyDay = _myDay[1]
  var _groupBy = useState('none'); var groupBy = _groupBy[0]; var setGroupBy = _groupBy[1]
  var _productCounts = useState<ProductCount[] | null>(null); var productCounts = _productCounts[0]; var setProductCounts = _productCounts[1]
  var _delegationBugs = useState<Bug[] | null>(null); var delegationBugs = _delegationBugs[0]; var setDelegationBugs = _delegationBugs[1]
  var _delegationLoading = useState(false); var delegationLoading = _delegationLoading[0]; var setDelegationLoading = _delegationLoading[1]
  // WAFFLE-2 triage tools: bulk selection in Delegation
  var _bulkSel = useState<Record<string, boolean>>({}); var bulkSel = _bulkSel[0]; var setBulkSel = _bulkSel[1]
  var _bulkTarget = useState(''); var bulkTarget = _bulkTarget[0]; var setBulkTarget = _bulkTarget[1]
  var _bulkSaving = useState(false); var bulkSaving = _bulkSaving[0]; var setBulkSaving = _bulkSaving[1]
  var _searchQuery = useState(''); var searchQuery = _searchQuery[0]; var setSearchQuery = _searchQuery[1]
  var _debouncedSearch = useState(''); var debouncedSearch = _debouncedSearch[0]; var setDebouncedSearch = _debouncedSearch[1]
  var searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  var _formAttachments = useState<Array<{ id: string; name: string; dataUrl: string; file?: File }>>([]); var formAttachments = _formAttachments[0]; var setFormAttachments = _formAttachments[1]
  var _previewModal = useState<string | null>(null); var previewModal = _previewModal[0]; var setPreviewModal = _previewModal[1]
  var _capturing = useState(false); var capturing = _capturing[0]; var setCapturing = _capturing[1]
  var fileInputRef = useRef<HTMLInputElement>(null)
  var attIdCounter = useRef(0)
  function addAttachment(name: string, dataUrl: string, file?: File) {
    attIdCounter.current++
    setFormAttachments(function(prev) { return prev.concat([{ id: 'att_' + attIdCounter.current + '_' + Date.now(), name: name, dataUrl: dataUrl, file: file }]) })
  }
  function removeAttachment(id: string) {
    setFormAttachments(function(prev) { return prev.filter(function(a) { return a.id !== id }) })
  }

  // ── WAFFLE-1: MCP key management (admin/triage only) ─────────────────────
  var _showKeys = useState(false); var showKeys = _showKeys[0]; var setShowKeys = _showKeys[1]
  var _mcpKeys = useState<Array<{ id: string; name: string; key_prefix: string; key_suffix: string; created_at?: string; last_used_at?: string | null }>>([])
  var mcpKeys = _mcpKeys[0]; var setMcpKeys = _mcpKeys[1]
  var _mintedKey = useState<{ name: string; key: string } | null>(null); var mintedKey = _mintedKey[0]; var setMintedKey = _mintedKey[1]
  var _keyName = useState(''); var keyName = _keyName[0]; var setKeyName = _keyName[1]
  var _keyBusy = useState(false); var keyBusy = _keyBusy[0]; var setKeyBusy = _keyBusy[1]
  var _keyCopied = useState(false); var keyCopied = _keyCopied[0]; var setKeyCopied = _keyCopied[1]

  function loadMcpKeys() {
    apiFetch(apiBase + '/api/bugs/mcp-keys')
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: Array<{ id: string; name: string; key_prefix: string; key_suffix: string; created_at?: string; last_used_at?: string | null }> }) {
        if (d.ok && d.data) setMcpKeys(d.data)
      })
      .catch(function() { /* keep current list */ })
  }

  function mintMcpKey() {
    if (keyBusy) return
    setKeyBusy(true)
    apiFetch(apiBase + '/api/bugs/mcp-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keyName.trim() ? { name: keyName.trim() } : {}),
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: { name: string; key: string } }) {
        if (d.ok && d.data) {
          setMintedKey({ name: d.data.name, key: d.data.key })
          setKeyName('')
          setKeyCopied(false)
          loadMcpKeys()
        }
      })
      .catch(function() { /* leave modal open */ })
      .then(function() { setKeyBusy(false) })
  }

  function revokeMcpKey(id: string) {
    if (!window.confirm('Revoke this MCP key? Anything using it stops working immediately.')) return
    apiFetch(apiBase + '/api/bugs/mcp-keys/' + id, { method: 'DELETE' })
      .then(function() { loadMcpKeys() })
      .catch(function() { /* ignore */ })
  }

  function copyMintedKey() {
    if (!mintedKey) return
    try {
      navigator.clipboard.writeText(mintedKey.key).then(function() { setKeyCopied(true) })
    } catch (_e) { /* clipboard unavailable */ }
  }


  // Deep link: focusBugId prop or ?bug=bug_xxx in URL
  var deepLinkBugId = useRef<string | null>(null)
  useEffect(function() {
    var bugId = props.focusBugId || null
    if (!bugId) {
      var params = new URLSearchParams(window.location.search)
      bugId = params.get('bug')
    }
    if (bugId) {
      setSelfOpen(true)
      setExpanded(bugId)
      deepLinkBugId.current = bugId
    }
  }, [open, props.focusBugId])

  // BUG-PANEL-STANDALONE-1: Fetch dynamic product list on mount
  useEffect(function() {
    apiFetch(apiBase + '/api/admin/bug-panel/products')
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: Record<string, string[]> }) {
        if (d.ok && d.data) setProducts(d.data)
      })
      .catch(function() { /* keep fallback */ })
  }, [apiBase])

  // Scroll to deep-linked bug once it's rendered
  useEffect(function() {
    if (deepLinkBugId.current && bugs.length > 0) {
      var id = deepLinkBugId.current
      deepLinkBugId.current = null
      setTimeout(function() {
        var el = document.querySelector('[data-bug-id="' + id + '"]')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [bugs])

  // WAFFLE-0: vocab fetches for work board filters.
  // Subsystems: any bugs-access level. Assignees: admin only (route 403s otherwise).
  useEffect(function() {
    if (!open) return
    apiFetch(apiBase + '/api/bugs/subsystems')
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: string[] }) { if (d.ok && Array.isArray(d.data)) setSubsystems(d.data) })
      .catch(function() {})
    if (isAdmin) {
      apiFetch(apiBase + '/api/bugs/assignees')
        .then(function(r) { return r.json() })
        .then(function(d: { ok: boolean; data?: Array<{ id: string; name: string }>; reporters?: string[] }) {
          if (d.ok && Array.isArray(d.data)) setAssignees(d.data)
          // WAFFLE-FIX-1 (bug_w2o_peoplefilter): sibling `reporters` key —
          // absent on older sm-api; People filter falls back to page-derived.
          if (d.ok && Array.isArray(d.reporters)) setReporters(d.reporters)
        })
        .catch(function() {})
    }
  }, [open, isAdmin, apiBase])

  useEffect(function() {
    if (!showForm) return
    var handler = function(e: ClipboardEvent) {
      var items = e.clipboardData && e.clipboardData.items
      if (!items) return
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          var blob = items[i].getAsFile()
          if (!blob) break
          var reader = new FileReader()
          reader.onload = function(ev) { addAttachment('pasted-image.png', ev.target?.result as string) }
          reader.readAsDataURL(blob)
          e.preventDefault()
          break
        }
      }
    }
    window.addEventListener('paste', handler)
    return function() { window.removeEventListener('paste', handler) }
  }, [showForm])

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(function() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(function() {
      setDebouncedSearch(searchQuery)
    }, 300)
    return function() { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery])

  function captureScreen() {
    setCapturing(true)
    var script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = function() {
      // Use ignoreElements to skip the bug panel — no hide/show flash
      // @ts-ignore — html2canvas loaded dynamically
      window.html2canvas(document.body, {
        useCORS: true, scale: 1, logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        ignoreElements: function(el: HTMLElement) {
          return el.hasAttribute('data-bug-overlay') || el.hasAttribute('data-bug-panel') || el.id === 'sm-bug-root'
        }
      }).then(function(canvas: HTMLCanvasElement) {
        addAttachment("screenshot.png", canvas.toDataURL('image/png'))
        setCapturing(false)
      }).catch(function() {
        setCapturing(false)
      })
    }
    script.onerror = function() { setCapturing(false) }
    document.head.appendChild(script)
  }

  // WAFFLE-2: server-side tabs + pagination. offset 0 (default) replaces the
  // list; offset > 0 appends (load-more). Counts arrive in the same response
  // and are true totals for the active filter set (tab-independent).
  var loadBugs = useCallback(function(nextOffset?: number) {
    var off = nextOffset || 0
    if (off === 0) setLoading(true); else setLoadingMore(true)
    var params: string[] = []
    if (filterProduct !== 'all') params.push('product=' + filterProduct)
    if (filterType !== 'all') params.push('type=' + filterType)
    if (filterPriority !== 'all') params.push('priority=' + filterPriority)
    if (filterAssignee !== 'all') params.push('assigned_to=' + encodeURIComponent(filterAssignee))
    if (filterSubsystem !== 'all') params.push('subsystem=' + encodeURIComponent(filterSubsystem))
    if (filterSource !== 'all') params.push('source=' + filterSource)
    if (debouncedSearch.trim()) params.push('q=' + encodeURIComponent(debouncedSearch.trim()))
    if (isAdmin) {
      params.push('tab=' + tab)
      params.push('sort=' + sortBy)
      if (filterPerson !== 'all') params.push('submitted_by_name=' + encodeURIComponent(filterPerson))
      params.push('limit=' + PAGE_SIZE)
      params.push('offset=' + off)
    } else {
      // Reporter view: own bugs only (small set) — keep the full fetch +
      // client-side pills, unchanged from pre-WAFFLE-2 behavior.
      params.push('limit=1000')
    }

    var url = apiBase + '/api/bugs?' + params.join('&')

    apiFetch(url, { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(d: { data?: Bug[]; counts?: BugCounts; total?: number }) {
        var items: Bug[] = Array.isArray(d.data) ? d.data : []
        if (off === 0) setBugs(items)
        else setBugs(function(prev) {
          var seen: Record<string, boolean> = {}
          prev.forEach(function(b) { seen[b.id] = true })
          return prev.concat(items.filter(function(b) { return !seen[b.id] }))
        })
        if (d.counts) setCounts(d.counts)
        if (typeof d.total === 'number') setTotal(d.total)
        setLoading(false); setLoadingMore(false)
      })
      .catch(function() { setLoading(false); setLoadingMore(false) })
  }, [apiBase, isAdmin, tab, sortBy, filterPerson, filterProduct, filterType, filterPriority, filterAssignee, filterSubsystem, filterSource, debouncedSearch])

  useEffect(function() {
    if (!open) return
    loadBugs()
  }, [open, filterProduct, filterType, filterPriority, filterAssignee, filterSubsystem, filterSource, debouncedSearch, loadBugs, isAdmin, apiBase])

  // ── WAFFLE-2: standalone manager view data ────────────────────────────────
  // WAFFLE-FIX-1 (bug_w2f_slideover_sections): sections (My Day / Products /
  // Delegation) render for admins in BOTH the slide-over and standalone —
  // managerSections gates them. managerViews (standalone-only) still gates
  // the group-by machinery, which stays a standalone affordance.
  var managerViews = Boolean(props.standalone && isAdmin)
  var managerSections = Boolean(isAdmin)

  // My Day: one cheap call on open — headline count stays live even collapsed
  function refreshMyDay() {
    apiFetch(apiBase + '/api/bugs/my-day')
      .then(function(r) { return r.json() })
      .then(function(d: { ok?: boolean; data?: MyDayData }) { if (d && d.data) setMyDay(d.data) })
      .catch(function() {})
  }
  useEffect(function() {
    if (!managerSections || !open) return
    refreshMyDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerSections, open, apiBase])

  // WAFFLE-FIX-1 (bug_w2o_copypass): inject the voice keyframes once
  useEffect(function() { ensureWaffleVoiceCss() }, [])

  // WAFFLE-FIX-1 (bug_w2o_copypass): one butter pat when the user's own
  // My Day work transitions to empty during a session.
  useEffect(function() {
    if (!myDay) { myDayHadWorkRef.current = false; return }
    var hasWork = myDay.overdue.length + myDay.due_today.length + myDay.in_progress_mine.length + myDay.newly_assigned.length > 0
    if (myDayHadWorkRef.current && !hasWork) {
      setPatMyDay(true)
      setTimeout(function() { setPatMyDay(false) }, 900)
    }
    myDayHadWorkRef.current = hasWork
  }, [myDay])

  // WAFFLE-FIX-1 (bug_wfx_mydayclick): resolve a pending focus once the list
  // settles — if the bug is outside the loaded slice, fetch it by id and
  // prepend, then scroll the card into view. fetchedFocusRef stops a re-fetch
  // loop if the row can't land (e.g. deleted between clicks).
  var fetchedFocusRef = useRef<string | null>(null)
  useEffect(function() {
    if (!pendingFocus || loading) return
    var id = pendingFocus
    var present = bugs.some(function(b) { return b.id === id })
    if (present) {
      requestAnimationFrame(function() {
        var el = document.querySelector('[data-bug-id="' + id + '"]')
        if (el && (el as HTMLElement).scrollIntoView) (el as HTMLElement).scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      })
      fetchedFocusRef.current = null
      setPendingFocus(null)
      return
    }
    if (fetchedFocusRef.current === id) { fetchedFocusRef.current = null; setPendingFocus(null); return }
    fetchedFocusRef.current = id
    apiFetch(apiBase + '/api/bugs/' + id, { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: Bug }) {
        if (d.ok && d.data) {
          setBugs(function(prev) { return prev.some(function(b) { return b.id === id }) ? prev : [d.data!].concat(prev) })
        } else { fetchedFocusRef.current = null; setPendingFocus(null) }
      })
      .catch(function() { fetchedFocusRef.current = null; setPendingFocus(null) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus, loading, bugs, apiBase])

  // Rollup cards: per-product server counts (rollup=1); fetch when expanded
  useEffect(function() {
    if (!managerSections || collapsed.rollup || !open || productCounts) return
    apiFetch(apiBase + '/api/bugs?tab=queue&rollup=1&limit=1')
      .then(function(r) { return r.json() })
      .then(function(d: { product_counts?: ProductCount[] }) { setProductCounts(Array.isArray(d.product_counts) ? d.product_counts : []) })
      .catch(function() { setProductCounts([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerSections, collapsed.rollup, open, apiBase, productCounts])

  // Delegation: full queue fetch — assignee grouping needs the whole set, not
  // a page (2000 cap = sm-api ceiling). NOT cheap, so only when expanded;
  // collapsed headline shows the count once loaded.
  useEffect(function() {
    if (!managerSections || collapsed.delegation || !open || delegationBugs) return
    setDelegationLoading(true)
    apiFetch(apiBase + '/api/bugs?tab=queue&limit=2000')
      .then(function(r) { return r.json() })
      .then(function(d: { data?: Bug[] }) { setDelegationBugs(Array.isArray(d.data) ? d.data : []); setDelegationLoading(false) })
      .catch(function() { setDelegationBugs([]); setDelegationLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerSections, collapsed.delegation, open, apiBase, delegationBugs])

  // Reset section caches on close so the next open refreshes data
  useEffect(function() {
    if (open) return
    setDelegationBugs(null)
    setProductCounts(null)
    setMyDay(null)
  }, [open])

  function reassignDelegated(bugId: string, contactId: string) {
    apiFetch(apiBase + '/api/bugs/' + bugId, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: contactId })
    }).then(function() {
      setDelegationBugs(function(prev) {
        if (!prev) return prev
        return prev.map(function(b) { return b.id === bugId ? Object.assign({}, b, { assigned_to: contactId || null }) : b })
      })
    })
  }

  // WAFFLE-2: bulk assign — sequential-chunked PATCHes, optimistic local update
  function bulkAssign() {
    var ids = Object.keys(bulkSel).filter(function(id) { return bulkSel[id] })
    if (ids.length === 0 || bulkSaving) return
    setBulkSaving(true)
    var chunks: string[][] = []
    for (var i = 0; i < ids.length; i += 8) chunks.push(ids.slice(i, i + 8))
    var run = Promise.resolve()
    chunks.forEach(function(chunk) {
      run = run.then(function() {
        return Promise.all(chunk.map(function(id) {
          return apiFetch(apiBase + '/api/bugs/' + id, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assigned_to: bulkTarget })
          })
        })).then(function() { return undefined })
      })
    })
    run.then(function() {
      setDelegationBugs(function(prev) {
        if (!prev) return prev
        return prev.map(function(b) { return bulkSel[b.id] ? Object.assign({}, b, { assigned_to: bulkTarget || null }) : b })
      })
      setBulkSel({}); setBulkSaving(false)
    }).catch(function() { setBulkSaving(false); alert('Some assignments failed — reopen the panel to refresh.') })
  }

  function toggleGroupSel(groupIds: string[], on: boolean) {
    setBulkSel(function(prev) {
      var next = { ...prev }
      groupIds.forEach(function(id) { next[id] = on })
      return next
    })
  }

  useEffect(function() {
    if (!expanded) return
    apiFetch(apiBase + '/api/bugs/' + expanded, { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: Bug }) {
        if (d.ok && d.data) {
          // WAFFLE-FIX-1 (bug_w2o_copypass): a bug we last saw pw_verifying
          // coming back verified is the golden-brown moment — merge the fresh
          // verified fields and flash.
          var prevLocal = bugs.find(function(b) { return b.id === expanded })
          if (expanded && prevLocal && prevLocal.verified_status === 'pw_verifying' && d.data.verified_status === 'verified') triggerGold(expanded)
          setBugs(function(prev) {
            return prev.map(function(b) {
              return b.id === expanded ? Object.assign({}, b, { comments: d.data!.comments, attachments: d.data!.attachments, verified_status: d.data!.verified_status, verification_run_id: d.data!.verification_run_id }) : b
            })
          })
          // PW-QA-VERIFY-1: Fetch verification results if bug has a run
          var runId = d.data.verification_run_id
          if (runId && d.data.verified_status && d.data.verified_status !== 'pw_verifying') {
            apiFetch(apiBase + '/api/admin/qa/runs/' + runId, { credentials: 'include' })
              .then(function(r2) { return r2.json() })
              .then(function(d2: { ok: boolean; data?: { results?: VerificationResult[] } }) {
                if (d2.ok && d2.data && d2.data.results) {
                  setBugs(function(prev2) {
                    return prev2.map(function(b2) {
                      return b2.id === expanded ? Object.assign({}, b2, { verification_results: d2.data!.results }) : b2
                    })
                  })
                }
              })
              .catch(function() {})
          }
        }
      })
      .catch(function() {})
  }, [expanded, apiBase])

  // BUG-PANEL-STANDALONE-1: Set browser tab title in standalone mode
  // WAFFLE-2: standalone tab title + grid-4x4 favicon (Bug Catcher -> Waffle)
  useEffect(function() {
    if (!props.standalone) return
    document.title = 'Waffle'
    try {
      var links = document.querySelectorAll('link[rel*="icon"]')
      if (links.length === 0) {
        var link = document.createElement('link')
        link.rel = 'icon'
        link.type = 'image/svg+xml'
        link.href = WAFFLE_FAVICON
        document.head.appendChild(link)
      } else {
        // Replace every icon variant (rel="icon", rel="shortcut icon") so no
        // stale-cached PNG wins over the Waffle mark
        links.forEach(function(el) {
          var l = el as HTMLLinkElement
          l.type = 'image/svg+xml'
          l.href = WAFFLE_FAVICON
        })
      }
    } catch (_e) { /* favicon swap is cosmetic — never block render */ }
  }, [props.standalone])

  // BUG-PANEL-STANDALONE-1: Apply theme in standalone mode (no Layout to do it)
  useEffect(function() {
    if (!props.standalone) return
    function applyTheme() {
      var stored: string | null = null
      try { stored = localStorage.getItem('sm-theme') } catch (_e) { /* noop */ }
      var isDark = stored ? stored === 'dark' : (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
    applyTheme()
    var mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    if (mq) mq.addEventListener('change', applyTheme)
    window.addEventListener('storage', applyTheme)
    return function() {
      if (mq) mq.removeEventListener('change', applyTheme)
      window.removeEventListener('storage', applyTheme)
    }
  }, [props.standalone])

  function handleAction(bugId: string, updates: Record<string, string>) {
    // WAFFLE-FIX-1 (bug_w2o_copypass): verified = golden brown. Flash the
    // card (optimistically marked) and let the moment land before the list
    // reload sweeps it to another tab.
    var turnedVerified = updates.verified_status === 'verified'
    if (turnedVerified) {
      triggerGold(bugId)
      setBugs(function(prev) { return prev.map(function(b) { return b.id === bugId ? Object.assign({}, b, updates) : b }) })
    }
    apiFetch(apiBase + '/api/bugs/' + bugId, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).then(function() {
      if (turnedVerified) { setTimeout(function() { loadBugs() }, 700) } else { loadBugs() }
      // Keep the My Day headline honest after actions (also lets the
      // strip-cleared butter pat fire).
      if (managerSections) refreshMyDay()
    })
  }

  function handleDelete(bugId: string) {
    apiFetch(apiBase + '/api/bugs/' + bugId, {
      method: 'DELETE', credentials: 'include'
    }).then(function(r) { return r.json() })
      .then(function(d: { ok: boolean }) {
        if (d.ok) { setExpanded(null); loadBugs() }
      })
  }

  function handleFire(bugId: string) {
    apiFetch(apiBase + '/api/bugs/' + bugId + '/fire', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(function(r) { return r.json() })
      .then(function(d: { ok: boolean }) {
        if (d.ok) loadBugs()
      })
  }

  function handleFireTerminal(bugId: string) {
    apiFetch(apiBase + '/api/bugs/' + bugId + '/fire', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'terminal' })
    }).then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: { fire_prompt?: string } }) {
        if (d.ok) {
          if (d.data && d.data.fire_prompt) navigator.clipboard.writeText(d.data.fire_prompt)
          loadBugs()
        }
      })
  }

  function handleVerify(bugId: string) {
    var bug = bugs.find(function(b) { return b.id === bugId })
    if (!bug || !bug.test_spec) return
    var spec = typeof bug.test_spec === 'string' ? JSON.parse(bug.test_spec) : bug.test_spec
    apiFetch(apiBase + '/api/admin/qa/trigger', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tests: [spec], trigger: 'bug-panel' })
    }).then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: { run_id: string } }) {
        if (d.ok) {
          setBugs(function(prev) {
            return prev.map(function(b) {
              return b.id === bugId ? Object.assign({}, b, { verified_status: 'pw_verifying', verification_run_id: d.data?.run_id }) : b
            })
          })
        }
      })
  }

  function handleComment(bugId: string, body: string, files?: Array<{ name: string; dataUrl: string; file?: File }>): Promise<void> {
    return apiFetch(apiBase + '/api/bugs/' + bugId + '/comments', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: body })
    }).then(function(r) { return r.json() })
    .then(function(commentRes: { ok: boolean; data?: { id: string } }) {
      var commentId = commentRes.ok && commentRes.data ? commentRes.data.id : null
      // Upload comment-level attachments if any
      if (files && files.length > 0 && commentId) {
        var uploads = files.map(function(att) {
          var fd = new FormData()
          if (att.file) {
            fd.append('file', att.file)
          } else if (att.dataUrl) {
            var byteString = atob(att.dataUrl.split(',')[1])
            var ab = new ArrayBuffer(byteString.length)
            var ia = new Uint8Array(ab)
            for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
            var mime = att.dataUrl.split(';')[0].split(':')[1] || 'image/png'
            fd.append('file', new Blob([ab], { type: mime }), att.name)
          }
          fd.append('comment_id', commentId!)
          return apiFetch(apiBase + '/api/bugs/' + bugId + '/attachments', {
            method: 'POST', credentials: 'include', body: fd
          })
        })
        return Promise.all(uploads).then(function() {})
      }
    })
    .then(function() {
      // Refresh bug to get updated comments and attachments
      return apiFetch(apiBase + '/api/bugs/' + bugId, { credentials: 'include' })
        .then(function(r) { return r.json() })
        .then(function(d: { ok: boolean; data?: Bug }) {
          if (d.ok && d.data) {
            setBugs(function(prev) {
              return prev.map(function(b) {
                return b.id === bugId ? Object.assign({}, b, { comments: d.data!.comments, attachments: d.data!.attachments }) : b
              })
            })
          }
        })
    })
  }

  function handleSubmit() {
    if (!fTitle.trim() || submitting) return
    setSubmitting(true)
    apiFetch(apiBase + '/api/bugs', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: fTitle.trim(), description: fDesc.trim(), type: fType, product: fProduct, page_url: window.location.pathname })
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; data?: { id?: string } }) {
        if (d.ok && d.data && d.data.id) {
          var bugId = d.data.id
          var uploads: Promise<Response>[] = []

          formAttachments.forEach(function(att) {
            var fd = new FormData()
            if (att.file) {
              fd.append('file', att.file)
            } else if (att.dataUrl) {
              var byteString = atob(att.dataUrl.split(',')[1])
              var ab = new ArrayBuffer(byteString.length)
              var ia = new Uint8Array(ab)
              for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
              var mime = att.dataUrl.split(';')[0].split(':')[1] || 'image/png'
              var blob = new Blob([ab], { type: mime })
              fd.append('file', blob, att.name)
            }
            uploads.push(apiFetch(apiBase + '/api/bugs/' + bugId + '/attachments', {
              method: 'POST', credentials: 'include', body: fd
            }))
          })

          Promise.all(uploads).then(function() {
            setFTitle(''); setFDesc(''); setFormAttachments([])
            if (fileInputRef.current) fileInputRef.current.value = ''
            setShowForm(false)
            loadBugs()
            setSubmitting(false)
          }).catch(function() {
            setShowForm(false); loadBugs(); setSubmitting(false)
          })
        } else {
          setSubmitting(false)
        }
      })
      .catch(function() { setSubmitting(false) })
  }

  function closePanel() {
    if (onClose) onClose()
    else setOpen(false)
  }

  if (!open) {
    if (visible !== undefined) return null
    return (
      <button style={Object.assign({}, S.fab, offsetFab ? S.fabOffset : {})} onClick={function() { setSelfOpen(true) }}>
        <BugIcon size={16} /> {label}
      </button>
    )
  }

  var isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  var isStandalone = props.standalone
  var items = bugs

  // ── WAFFLE-2: manager views render helpers (standalone admin only) ────────
  var showListChrome = true // WAFFLE-2 addendum: sections stack above the list; chrome always visible

  // WAFFLE-FIX-1 (bug_w2o_copypass): empty-state moments per WAFFLE-VOICE.
  // Only the named moments get a line; everything else stays plain.
  function listEmptyCopy(): string {
    if (!isAdmin) return 'No items.'
    var q = debouncedSearch.trim().toLowerCase()
    if (q === 'leggo') return "we don't do that here."
    if (q) return "That pocket's empty."
    if (filterAssignee === 'unassigned') return 'Every pocket claimed.'
    if (tab === 'queue') return 'Fresh out of batter.'
    return 'No items.'
  }

  function renderCard(bug: Bug) {
    return <BugCard key={bug.id} bug={bug} isAdmin={isAdmin} assignees={assignees} expanded={expanded === bug.id} flash={goldFlash === bug.id}
      onToggle={function() { setExpanded(expanded === bug.id ? null : bug.id) }}
      onAction={handleAction} onComment={handleComment} onDelete={isAdmin ? handleDelete : undefined} onFire={handleFire} onFireTerminal={handleFireTerminal} onVerify={isAdmin ? handleVerify : undefined} apiBase={apiBase} product={product} searchQuery={debouncedSearch} />
  }

  function groupLabelForAssignee(id: string): string {
    if (!id) return 'Unassigned'
    var m = assignees.find(function(a) { return a.id === id })
    return m ? m.name : id
  }

  // Group-by: client-side over the fetched page(s) — accepted v1 scope.
  function renderListBody(list: Bug[]) {
    if (!managerViews || groupBy === 'none') return list.map(renderCard)
    if (groupBy === 'overdue') {
      var today = new Date().toISOString().slice(0, 10)
      var overdue = list.filter(function(b) { return Boolean(b.due_date && b.due_date.slice(0, 10) < today) }).sort(function(a, b) { return (a.due_date || '').localeCompare(b.due_date || '') })
      var rest = list.filter(function(b) { return !(b.due_date && b.due_date.slice(0, 10) < today) })
      return (
        <>
          {overdue.length > 0 && <div style={S.groupHeader}><span style={{ color: 'var(--red)' }}>Overdue</span> <span style={S.groupCount}>{overdue.length}</span></div>}
          {overdue.map(renderCard)}
          <div style={S.groupHeader}>Everything else <span style={S.groupCount}>{rest.length}</span></div>
          {rest.map(renderCard)}
        </>
      )
    }
    var keyFn = groupBy === 'assignee'
      ? function(b: Bug) { return b.assigned_to || '' }
      : groupBy === 'product'
        ? function(b: Bug) { return b.product || '' }
        : function(b: Bug) { return b.subsystem || '' }
    var groups: Record<string, Bug[]> = {}
    var order: string[] = []
    list.forEach(function(b) {
      var k = keyFn(b)
      if (!groups[k]) { groups[k] = []; order.push(k) }
      groups[k].push(b)
    })
    // Empty key (Unassigned / no subsystem) first, then by count desc
    order.sort(function(a, b) {
      if (a === '' && b !== '') return -1
      if (b === '' && a !== '') return 1
      return groups[b].length - groups[a].length
    })
    return (
      <>
        {order.map(function(k) {
          var groupTitle = groupBy === 'assignee' ? groupLabelForAssignee(k) : (k || (groupBy === 'subsystem' ? '(no subsystem)' : '(no product)'))
          return (
            <React.Fragment key={k || '__none__'}>
              <div style={S.groupHeader}>{groupTitle} <span style={S.groupCount}>{groups[k].length}</span></div>
              {groups[k].map(renderCard)}
            </React.Fragment>
          )
        })}
      </>
    )
  }

  // WAFFLE-2 addendum: slim collapsible section header (chevron + headline)
  function sectionHeader(key: string, title: string, headline: string) {
    var isCollapsed = !!collapsed[key]
    return (
      <button onClick={function() { toggleSection(key) }} title={isCollapsed ? 'Expand' : 'Collapse'}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'var(--bg-subtle)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' as const }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: 'var(--foreground)' }}>{title}</span>
        {headline ? <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{'\u00b7'} {headline}</span> : null}
      </button>
    )
  }

  // WAFFLE-FIX-1 (bug_wfx_mydayclick): real focus-through — switch to the tab
  // the bug lives on, ensure it is present in the loaded list (targeted fetch
  // by id when outside the slice), then expand + scroll it into view. The
  // pendingFocus effect below does the ensure/scroll half after the list
  // settles.
  function tabForBug(b: Bug): string {
    if (b.status === 'deferred') return 'deferred'
    if (b.status === 'closed' || b.status === 'fixed') return (b as any).verified_status === 'verified' ? 'verified' : 'closed'
    return 'queue'
  }
  function focusBug(b: Bug) {
    var target = tabForBug(b)
    if (target !== tab) setTab(target)
    setExpanded(b.id)
    setPendingFocus(b.id)
  }

  function myDayRow(b: Bug, tag: string, tagColor: string) {
    return (
      <div key={tag + b.id} style={S.delRow}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' as const, color: tagColor, flexShrink: 0, width: 88 }}>{tag}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, color: 'var(--foreground)', cursor: 'pointer' }}
          onClick={function() { focusBug(b) }}>{b.title}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', flexShrink: 0 }}>{b.product}{b.due_date ? ' \u00b7 ' + b.due_date.slice(0, 10) : ''}</span>
      </div>
    )
  }

  // My Day strip (WAFFLE-1 route /api/bugs/my-day; UI = WAFFLE-2 item 4)
  var myDayOverdueN = myDay ? myDay.overdue.length : 0
  var myDayMineEmpty = !!myDay && myDay.overdue.length === 0 && myDay.due_today.length === 0 && myDay.in_progress_mine.length === 0 && myDay.newly_assigned.length === 0
  var myDaySection = managerSections ? (
    <div>
      {sectionHeader('myday', 'My Day', myDay ? (myDayMineEmpty && myDay.unassigned_on_my_products.length > 0 ? myDay.unassigned_on_my_products.length + ' in intake' : myDayOverdueN + ' overdue \u00b7 ' + myDay.due_today.length + ' due today') : '')}
      {!collapsed.myday && (
        <div style={{ maxHeight: 260, overflowY: 'auto' as const, borderBottom: '1px solid var(--border)' }}>
          {!myDay && <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted)' }}>Loading...</div>}
          {myDay && myDayOverdueN === 0 && myDay.due_today.length === 0 && myDay.in_progress_mine.length === 0 && myDay.newly_assigned.length === 0 && myDay.unassigned_on_my_products.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted)' }}>Nothing on the iron. Enjoy the syrup.{patMyDay && <ButterPat />}</div>
          )}
          {myDay && myDayMineEmpty && myDay.unassigned_on_my_products.length > 0 && (
            <div style={{ padding: '8px 16px 2px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 0.5, color: 'var(--muted)' }}>INTAKE {'\u2014'} UNASSIGNED ON YOUR PRODUCTS</div>
          )}
          {myDay && myDayMineEmpty && myDay.unassigned_on_my_products.map(function(b) { return myDayRow(b, 'intake', 'var(--accent)') })}
          {myDay && myDay.overdue.map(function(b) { return myDayRow(b, 'overdue', 'var(--red)') })}
          {myDay && myDay.due_today.map(function(b) { return myDayRow(b, 'due today', 'var(--amber, #b45309)') })}
          {myDay && myDay.in_progress_mine.map(function(b) { return myDayRow(b, 'in progress', 'var(--accent)') })}
          {myDay && myDay.newly_assigned.map(function(b) { return myDayRow(b, 'new for you', 'var(--accent)') })}
          {myDay && !myDayMineEmpty && myDay.unassigned_on_my_products.map(function(b) { return myDayRow(b, 'unassigned', 'var(--muted)') })}
        </div>
      )}
    </div>
  ) : null

  var rollupHeadline = counts ? counts.queue + ' open' : (productCounts ? productCounts.reduce(function(a, p) { return a + p.queue }, 0) + ' open' : '')
  var rollupView = managerSections ? (
    <div>
      {sectionHeader('rollup', 'Products', rollupHeadline)}
      {!collapsed.rollup && (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
      {productCounts === null && <div style={S.empty}>Loading...</div>}
      {productCounts !== null && productCounts.length === 0 && <div style={S.empty}>No items.</div>}
      {productCounts !== null && productCounts.length > 0 && (
        /* WAFFLE-FIX-1 (bug_wfx_density): compact rows — name · counts · age
           chip. ~34px per product (8+ per viewport) vs the old 4-line card
           grid. Click-to-filter and 30d+ age reddening kept. */
        <div>
          {productCounts.map(function(p) {
            var ageChip: React.ReactNode = null
            if (p.oldest_queue_at) {
              var days = Math.max(0, Math.floor((Date.now() - new Date(p.oldest_queue_at.replace(' ', 'T') + 'Z').getTime()) / 86400000))
              ageChip = <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', flexShrink: 0, padding: '1px 6px', borderRadius: 999, background: days >= 30 ? 'var(--red-light)' : 'var(--bg-subtle)', color: days >= 30 ? 'var(--red)' : 'var(--muted)' }}>{days}d</span>
            }
            return (
              <button key={p.product} title={'Filter list to ' + p.product} onClick={function() { setFilterProduct(p.product); setTab('queue') }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' as const, padding: '7px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.product}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>{p.queue}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.in_progress} in progress {'\u00b7'} {p.verified} verified {'\u00b7'} {p.deferred} deferred</span>
                {ageChip}
              </button>
            )
          })}
        </div>
      )}
      </div>
      )}
    </div>
  ) : null

  var delegationUnassignedN = delegationBugs ? delegationBugs.filter(function(b) { return !b.assigned_to }).length : null
  var delegationView = managerSections ? (
    <div>
      {sectionHeader('delegation', 'Delegation', delegationUnassignedN === null ? '' : delegationUnassignedN + ' unassigned')}
      {!collapsed.delegation && (function() {
        var selCount = Object.keys(bulkSel).filter(function(id) { return bulkSel[id] }).length
        return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        {/* WAFFLE-2 triage tools: bulk assign bar */}
        {selCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--blue-10, rgba(35,98,234,0.08))', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{selCount} selected</span>
            <select style={S.filterSelect} value={bulkTarget} onChange={function(e) { setBulkTarget(e.target.value) }}>
              <option value="">Assign to{'\u2026'}</option>
              {assignees.map(function(a) { return <option key={a.id} value={a.id}>{a.name}</option> })}
            </select>
            <button style={Object.assign({}, S.loadMore, { width: 'auto', margin: 0, padding: '5px 14px', opacity: bulkTarget && !bulkSaving ? 1 : 0.5 })} disabled={!bulkTarget || bulkSaving} onClick={bulkAssign}>
              {bulkSaving ? 'Assigning\u2026' : 'Apply'}
            </button>
            <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }} onClick={function() { setBulkSel({}) }}>Clear</button>
          </div>
        )}
      <div style={{ maxHeight: 320, overflowY: 'auto' as const }}>
      {(delegationBugs === null || delegationLoading) && <div style={S.empty}>Loading...</div>}
      {!delegationLoading && delegationBugs && delegationBugs.length === 0 && <div style={S.empty}>Queue is empty.</div>}
      {!delegationLoading && delegationBugs && delegationBugs.length > 0 && (function() {
        var groups: Record<string, Bug[]> = {}
        var order: string[] = []
        delegationBugs.forEach(function(b) {
          var k = b.assigned_to || ''
          if (!groups[k]) { groups[k] = []; order.push(k) }
          groups[k].push(b)
        })
        order.sort(function(a, b) {
          if (a === '' && b !== '') return -1
          if (b === '' && a !== '') return 1
          return groups[b].length - groups[a].length
        })
        return order.map(function(k) {
          var isUnassigned = k === ''
          return (
            <div key={k || '__unassigned__'} style={{ marginBottom: 12 }}>
              <div style={Object.assign({}, S.groupHeader, isUnassigned ? { color: 'var(--red)', fontSize: 12 } : {})}>
                {isUnassigned ? 'Unassigned' : groupLabelForAssignee(k)} <span style={S.groupCount}>{groups[k].length}</span>
                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                  onClick={function() {
                    var ids = groups[k].map(function(b) { return b.id })
                    var allOn = ids.every(function(id) { return bulkSel[id] })
                    toggleGroupSel(ids, !allOn)
                  }}>
                  {groups[k].every(function(b) { return bulkSel[b.id] }) ? 'deselect all' : 'select all'}
                </button>
              </div>
              {groups[k].map(function(b) {
                return (
                  <div key={b.id} style={S.delRow}>
                    <input type="checkbox" checked={!!bulkSel[b.id]} style={{ flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      onChange={function() { setBulkSel(function(prev) { return { ...prev, [b.id]: !prev[b.id] } }) }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, color: 'var(--foreground)' }}>{b.title}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', flexShrink: 0 }}>{b.product}</span>
                    <select
                      style={Object.assign({}, S.filterSelect, { flexShrink: 0 })}
                      value={b.assigned_to || ''}
                      onChange={function(e) { reassignDelegated(b.id, e.target.value) }}
                      title="Reassign"
                    >
                      <option value="">Unassigned</option>
                      {assignees.map(function(a) { return <option key={a.id} value={a.id}>{a.name}</option> })}
                    </select>
                  </div>
                )
              })}
            </div>
          )
        })
      })()}
      </div>
      </div>
        )
      })()}
    </div>
  ) : null

  var panelStyle = isStandalone
    ? Object.assign({}, S.panel, { position: 'relative' as const, width: '100%', maxWidth: 720, margin: '0 auto', height: '100vh', borderLeft: 'none', boxShadow: 'none', zIndex: 1 })
    : Object.assign({}, S.panel, isMobile ? S.panelMobile : {})

  return (
    <>
      {!isStandalone && <div data-bug-overlay="" style={S.overlay} onClick={closePanel} />}
      <div data-bug-panel="" style={panelStyle}>

        <div style={S.header}>
          {isAdmin && <span style={{ display: 'inline-flex', color: 'var(--accent)', marginRight: 7 }}><WaffleIcon size={15} /></span>}
          <span style={S.title}>{isAdmin ? 'Waffle' : label}</span>
          <kbd style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle,var(--bg))', color: 'var(--muted)', lineHeight: 1.4, marginLeft: 6, fontFamily: 'var(--font-mono,monospace)' }}>{typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318B' : 'Ctrl+B'}</kbd>
          <span style={{ flex: 1 }} />
          {isAdmin && (
            <button
              style={isStandalone ? Object.assign({}, S.closeBtn, { width: 'auto', gap: 5, padding: '0 9px', fontSize: 11, fontWeight: 600 }) : S.closeBtn}
              title="Waffle MCP keys"
              onClick={function() { setShowKeys(true); setMintedKey(null); loadMcpKeys() }}
            ><KeyIcon />{isStandalone && <span>MCP Keys</span>}</button>
          )}
          {!isStandalone && <button style={S.closeBtn} title="Open in new tab" onClick={function() {
            var url = 'https://admin.sprintmode.ai/bugs?product=' + encodeURIComponent(product)
            window.open(url, '_blank')
            closePanel()
          }}><PopoutIcon /></button>}
          {!isStandalone && <button style={S.closeBtn} onClick={closePanel}><CloseIcon /></button>}
        </div>

        {showKeys && (
          <div onClick={function() { if (!mintedKey) setShowKeys(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={function(e) { e.stopPropagation() }}
              style={{ background: 'var(--bg-card,var(--bg))', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 460, padding: '20px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Waffle MCP Keys</span>
                <span style={{ flex: 1 }} />
                <button style={S.closeBtn} onClick={function() { setShowKeys(false); setMintedKey(null) }}><CloseIcon /></button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Personal keys for the Waffle MCP server (VS Code / Claude Code). Keys act as you: items you create or comment on carry your name.
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Server URL (claude.ai and Claude Desktop connect here with OAuth — no key needed; the connection appears below as a revocable key):
              </div>
              <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, background: 'var(--bg-subtle,var(--bg))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--foreground)', marginBottom: 14, userSelect: 'all' }}>
                https://waffle.sprintmode.ai/mcp
              </div>
              {mintedKey ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>{mintedKey.name}</div>
                  <div style={{ fontSize: 11, color: 'hsl(0,84%,40%)', fontWeight: 600, marginBottom: 8 }}>
                    Copy this key now — it is shown only once.
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, background: 'var(--bg-subtle,var(--bg))', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', color: 'var(--foreground)', marginBottom: 10 }}>
                    {mintedKey.key}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={S.submitBtn} onClick={copyMintedKey}>{keyCopied ? 'Copied' : 'Copy key'}</button>
                    <button style={S.cancelBtn} onClick={function() { setMintedKey(null) }}>Done</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
                    {mcpKeys.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>No active keys.</div>}
                    {mcpKeys.map(function(k) {
                      return (
                        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</div>
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono,monospace)', color: 'var(--muted)' }}>
                              {k.key_prefix + '\u2022\u2022\u2022\u2022' + k.key_suffix}
                              {k.last_used_at ? ' \u00b7 used ' + String(k.last_used_at).slice(0, 10) : ' \u00b7 never used'}
                            </div>
                          </div>
                          <button style={Object.assign({}, S.cancelBtn, { fontSize: 11, padding: '4px 10px' })} onClick={function() { revokeMcpKey(k.id) }}>Revoke</button>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={{ flex: 1, fontSize: 12, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg,transparent)', color: 'var(--foreground)' }}
                      placeholder="Key name (optional)"
                      value={keyName}
                      onChange={function(e) { setKeyName(e.target.value) }}
                    />
                    <button style={S.submitBtn} onClick={mintMcpKey} disabled={keyBusy}>{keyBusy ? 'Minting\u2026' : 'New key'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {myDaySection}
        {rollupView}
        {delegationView}

        {!isAdmin && (
          <div style={S.rpills}>
            {REPORTER_FILTERS.map(function(f) {
              return <button key={f.id} style={S.rpill(rFilter === f.id)} onClick={function() { setRFilter(f.id) }}>{f.label}</button>
            })}
          </div>
        )}

        {showListChrome && (
        <div style={S.filterBar}>
            <select style={S.filterSelect} value={filterProduct} onChange={function(e) { setFilterProduct(e.target.value) }}>
              <option value="all">Portals</option>
              {Object.keys(products).map(function(group) {
                return products[group].map(function(p) { return <option key={p} value={p}>{p}</option> })
              })}
            </select>
            <select style={S.filterSelect} value={filterType} onChange={function(e) { setFilterType(e.target.value) }}>
              <option value="all">Types</option>
              {TYPES.map(function(t) { return <option key={t} value={t}>{t}</option> })}
            </select>
            {isAdmin && (
              <select style={S.filterSelect} value={filterSource} onChange={function(e) { setFilterSource(e.target.value) }}>
                <option value="all">All Sources</option>
                <option value="human">Human</option>
                <option value="claude">Claude</option>
              </select>
            )}
            <select style={S.filterSelect} value={filterPriority} onChange={function(e) { setFilterPriority(e.target.value) }}>
              <option value="all">Priorities</option>
              <option value="critical">P0 Critical</option>
              <option value="high">P1 High</option>
              <option value="normal">P2 Normal</option>
              <option value="low">P3 Low</option>
            </select>
            {isAdmin && (
              <select style={S.filterSelect} value={filterPerson} onChange={function(e) { setFilterPerson(e.target.value) }}>
                <option value="all">People</option>
                {/* WAFFLE-FIX-1 (bug_w2o_peoplefilter): server-side distinct
                    reporters (all-time, incl. client-portal submitters).
                    Page-derived fallback only for older sm-api responses. */}
                {(reporters.length > 0
                  ? reporters
                  : Array.from(new Set(bugs.map(function(b) { return b.submitted_by_name }).filter(Boolean))).sort() as string[]
                ).map(function(name) {
                  return <option key={name} value={name}>{name}</option>
                })}
              </select>
            )}
            {isAdmin && (
              <select style={S.filterSelect} value={filterAssignee} onChange={function(e) { setFilterAssignee(e.target.value) }}>
                <option value="all">Assignee</option>
                <option value="unassigned">Unassigned</option>
                {assignees.map(function(a) { return <option key={a.id} value={a.id}>{a.name}</option> })}
              </select>
            )}
            {isAdmin && (
              <select style={S.filterSelect} value={filterSubsystem} onChange={function(e) { setFilterSubsystem(e.target.value) }}>
                <option value="all">Subsystems</option>
                {/* WAFFLE-2 decision 4: union of live DISTINCT values + seed vocabulary */}
                {Array.from(new Set(SUBSYSTEM_SUGGESTIONS.concat(subsystems))).sort().map(function(ss) { return <option key={ss} value={ss}>{ss}</option> })}
              </select>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 120px', minWidth: 100 }}>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={function(e) { setSearchQuery(e.target.value) }}
                style={Object.assign({}, S.filterSelect, { width: '100%', paddingRight: searchQuery ? 24 : 8, boxSizing: 'border-box' as const })}
              />
              {searchQuery && (
                <button
                  onClick={function() { setSearchQuery('') }}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--muted)', fontWeight: 700, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Clear search"
                >×</button>
              )}
            </div>
            {/* WAFFLE-FIX-1 (bug_w2o_groupby_dup): Group and Sort sit together
                at the row's end, each with its own label. Group's default is
                "No grouping" — it no longer masquerades as a second "Newest"
                dropdown. One wrap-friendly pass covers 480px and 720px. */}
            {managerViews && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Group:</span>
                <select style={S.filterSelect} value={groupBy} onChange={function(e) { setGroupBy(e.target.value) }} title="Group the list">
                  <option value="none">No grouping</option>
                  <option value="assignee">By Assignee</option>
                  <option value="product">By Product</option>
                  <option value="subsystem">By Subsystem</option>
                  <option value="overdue">Overdue First</option>
                </select>
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: managerViews ? 0 : 'auto' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Sort:</span>
              <select style={S.filterSelect} value={sortBy} onChange={function(e) { setSortBy(e.target.value) }}>
                <option value="newest">Newest</option>
                <option value="priority">Priority</option>
                <option value="oldest">Oldest</option>
              </select>
            </span>
          </div>
        )}

        {showListChrome && isAdmin && (
          <div style={S.tabBar} ref={tabBarRef}>
            {ADMIN_TABS.map(function(t) {
              // WAFFLE-2: hide My Tasks when the session has no contact_id
              if ((t as any).mine && !(session && session.contact_id)) return null
              // WAFFLE-2: true totals from the server (same response as the
              // list). Fallback: client count over the fetched slice for
              // older sm-api responses without counts.
              var count = counts ? (counts as any)[t.id] : bugs.filter(function(b) {
                if (t.statuses.indexOf(b.status) === -1) return false
                if ((t as any).mine && b.assigned_to !== (session && session.contact_id)) return false
                if ((t as any).verified && (b as any).verified_status !== 'verified') return false
                if ((t as any).excludeVerified && (b as any).verified_status === 'verified') return false
                return true
              }).length
              return <button key={t.id} style={S.tabBtn(tab === t.id, tabFit !== 'full')} onClick={function() { setTab(t.id); setExpanded(null) }}>{t.label} {tabCount(count)}</button>
            })}
          </div>
        )}

        {showListChrome && (
        <div style={S.list}>
          {loading && <ToastSkeleton />}
          {!loading && items.length === 0 && <div style={S.empty}>{listEmptyCopy()}</div>}
          {!loading && renderListBody(bugs.filter(function(b) {
            // Status filter: admin uses tab, reporter uses pill
            if (isAdmin) {
              // WAFFLE-2: with a current sm-api the server already applied the
              // tab constraint; this re-filter is a no-op there and a correct
              // fallback against older API responses.
              var at = ADMIN_TABS.find(function(t) { return t.id === tab }) as any
              if (at && at.statuses.indexOf(b.status) === -1) return false
              if (at && at.mine && b.assigned_to !== (session && session.contact_id)) return false
              // Verified tab: only show bugs with verified_status = 'verified'
              if (at && at.verified && (b as any).verified_status !== 'verified') return false
              // Closed tab: exclude verified bugs so they only appear in Verified tab
              if (tab === 'closed' && (b as any).verified_status === 'verified') return false
            } else if (rFilter !== 'all') {
              var rf = REPORTER_FILTERS.find(function(f) { return f.id === rFilter })
              if (rf && rf.statuses && rf.statuses.indexOf(b.status) === -1) return false
            }
            // People filter (admin only)
            if (isAdmin && filterPerson !== 'all' && b.submitted_by_name !== filterPerson) return false
            return true
          }).slice().sort(function(a, b) {
            if (sortBy === 'priority') {
              return ((PRIORITY_META[a.priority || ''] || PRIORITY_META['normal']).sort) - ((PRIORITY_META[b.priority || ''] || PRIORITY_META['normal']).sort)
            }
            if (sortBy === 'oldest') return (a.created_at || '').localeCompare(b.created_at || '')
            return (b.created_at || '').localeCompare(a.created_at || '')
          }))}
          {/* WAFFLE-2: load-more pagination (admin, server counts present) */}
          {!loading && isAdmin && counts !== null && bugs.length < total && (
            <button style={S.loadMore} disabled={loadingMore} onClick={function() { loadBugs(bugs.length) }}>
              {/* WAFFLE-FIX-1 (bug_w2o_copypass): same button, better label —
                  explains the name every time someone paginates. */}
              {loadingMore ? 'Loading...' : 'Pour more batter \u2014 ' + bugs.length + ' of ' + total}
            </button>
          )}
        </div>
        )}

        {showListChrome && (showForm ? (
          <div style={S.formArea}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select style={S.formSelect} value={fType} onChange={function(e) { setFType(e.target.value) }}>
                {TYPES.map(function(t) { return <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option> })}
              </select>
              <select style={S.formSelect} value={fProduct} onChange={function(e) { setFProduct(e.target.value) }}>
                {Object.keys(products).map(function(group) {
                  return products[group].map(function(p) { return <option key={p} value={p}>{p}</option> })
                })}
              </select>
            </div>
            <input style={S.formInput} placeholder="Bug title" value={fTitle}
              onChange={function(e) { setFTitle(e.target.value) }}
              onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }} autoFocus />
            <textarea style={S.formTextarea} rows={2} placeholder="Description" value={fDesc}
              onChange={function(e) { setFDesc(e.target.value) }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}
              onDragOver={function(e) { e.preventDefault(); e.stopPropagation() }}
              onDrop={function(e) {
                e.preventDefault(); e.stopPropagation()
                var files = e.dataTransfer.files
                for (var i = 0; i < files.length; i++) {
                  var f = files[i]
                  if (f.type.startsWith('image/')) {
                    var r = new FileReader()
                    r.onload = function(ev) { addAttachment(f.name, ev.target?.result as string, f) }
                    r.readAsDataURL(f)
                  } else {
                    addAttachment(f.name, '', f)
                  }
                }
              }}>
              <div style={S.screenshotZone}>Drop, Paste, or Cmd+V</div>
              <button style={S.captureBtn} onClick={function(e) { e.stopPropagation(); captureScreen() }} disabled={capturing}>
                <CameraIcon /> {capturing ? '...' : 'Capture'}
              </button>
              <button style={S.fileBtn} onClick={function() { if (fileInputRef.current) fileInputRef.current.click() }}><UploadIcon /> File</button>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                onChange={function(e) {
                  if (!e.target.files) return
                  for (var i = 0; i < e.target.files.length; i++) {
                    var f = e.target.files[i]
                    if (f.type.startsWith('image/')) {
                      var r = new FileReader()
                      r.onload = (function(file) { return function(ev) { addAttachment(file.name, ev.target?.result as string, file) } })(f)
                      r.readAsDataURL(f)
                    } else {
                      addAttachment(f.name, '', f)
                    }
                  }
                  e.target.value = ''
                }} />
            </div>
            {formAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {formAttachments.map(function(att) {
                  return <div key={att.id} style={{ position: 'relative', display: 'inline-block' }}>
                    {att.dataUrl ? (
                      <img src={att.dataUrl} alt={att.name} onClick={function() { setPreviewModal(att.id) }}
                        style={{ width: 64, height: 48, borderRadius: 4, border: '1px solid var(--border)', objectFit: 'cover', cursor: 'pointer', display: 'block' }} />
                    ) : (
                      <div style={{ width: 64, height: 48, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textAlign: 'center', padding: 2, overflow: 'hidden' }}>
                        {att.name.length > 12 ? att.name.slice(0, 10) + '..' : att.name}
                      </div>
                    )}
                    <button onClick={function() { removeAttachment(att.id) }}
                      style={{ position: 'absolute', top: -5, right: -5, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 9, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                  </div>
                })}
              </div>
            )}
            {previewModal && (function() {
              var att = formAttachments.find(function(a) { return a.id === previewModal })
              if (!att || !att.dataUrl) { setPreviewModal(null); return null }
              return <div onClick={function() { setPreviewModal(null) }}
                style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 24 }}>
                <img src={att.dataUrl} alt={att.name} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} />
              </div>
            })()}
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.submitBtn} onClick={handleSubmit} disabled={submitting || !fTitle.trim()}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button style={S.cancelBtn} onClick={function() { setShowForm(false); setFTitle(''); setFDesc(''); setFormAttachments([]) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0 }}>
            <button style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}
              onClick={function() { setShowForm(true) }}>
              + Report Bug or Feature
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

export function BugPanelHeaderButton({ onClick }: BugPanelHeaderButtonProps) {
  var isMac = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1
  return React.createElement('button', {
    onClick: onClick,
    'aria-label': 'Report bug',
    title: isMac ? 'Waffle (\u2318B)' : 'Waffle (Ctrl+B)',
    style: {
      width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 7,
      background: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s',
      flexShrink: 0, padding: 0, color: 'var(--foreground)'
    } as CSSProperties
  }, React.createElement(WaffleIcon, { size: 16 }))
}
