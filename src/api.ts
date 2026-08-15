export interface SessionData {
  ok: boolean
  contact_id?: string
  email?: string
  name?: string
  company_name?: string
  company_id?: string
  role?: string
  portal_role?: string
  photo?: string
  products?: string[]
  permissions?: string | Record<string, unknown>
  is_sm_team?: boolean
  // UX-1940/UX-1941 (Identity Core L8): role-picker data from /auth/me.
  my_roles?: {
    role: string
    display_name: string
    role_type?: string | null
    is_default: boolean
    is_active: boolean
  }[]
  acting_role?: { portal: string; role: string }
  role_display_name?: string
  title?: string | null
  user_id?: string
  emails?: { email: string; is_primary: boolean; email_type?: string; last_sign_in_at?: string | null }[]
  viewing_as?: {
    contact_id?: string
    email?: string
    name?: string
    company_id?: string
    company_name?: string
    portal_role?: string
    products?: string[]
  }
  portals?: Record<string, {
    access: boolean
    view_as?: string | false
    name?: string
    portal_type?: string
    brand_color?: string | null
    brand_tint?: string | null
    icon_key?: string | null
    logo_mark_url?: string | null
    custom_domain?: string | null
  }>
  [key: string]: unknown
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface ApiOptions {
  method?: string
  body?: unknown
}

var SESSION_CACHE: SessionData | null = null

/** Sentinel returned by getSession when the user is authenticated but their
 *  role does not have login access to this portal (403 + reason: 'not_authorized'). */
export var ACCESS_DENIED: SessionData = { ok: false, _accessDenied: true } as any

export async function getSession(): Promise<SessionData | null> {
  if (SESSION_CACHE) return SESSION_CACHE
  try {
    var res = await fetch('/api/auth/me', { credentials: 'include' })
    var data: SessionData = await res.json()
    if (data && data.ok) {
      SESSION_CACHE = data
      return data
    }
    // Portal _worker.js may return 403 when the user's role lacks access.
    // Different portals use different shapes (reason:'not_authorized',
    // reason:'team_only', error:'Admin access required'), so treat any
    // 403 with ok:false as an access denial. The session-level check in
    // Layout (portals[sub].access) is the primary gate — this is the
    // fallback for portals that block at the proxy layer.
    if (res.status === 403) {
      return ACCESS_DENIED
    }
  } catch (_e) { /* fall through */ }
  return null
}

export function clearSession(): void {
  SESSION_CACHE = null
}

export async function api(path: string, opts?: ApiOptions): Promise<ApiResponse> {
  var options = opts || {}
  var config: RequestInit = {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {},
  }
  if (options.body) {
    ;(config.headers as Record<string, string>)['Content-Type'] = 'application/json'
    config.body = JSON.stringify(options.body)
  }
  try {
    var res = await fetch(path, config)
    return await res.json()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return '$0'
  var dollars = typeof cents === 'number' && cents > 100 ? cents / 100 : cents
  return '$' + Number(dollars).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function formatDate(str: string | null | undefined): string {
  if (!str) return '--'
  try {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (_e) { return str }
}

export function formatRelative(str: string | null | undefined): string {
  if (!str) return ''
  try {
    var diff = Date.now() - new Date(str).getTime()
    var mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return mins + 'm ago'
    var hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    var days = Math.floor(hrs / 24)
    return days + 'd ago'
  } catch (_e) { return str }
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
