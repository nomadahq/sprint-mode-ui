// @sprintmode/ui/auth — Worker-side auth helpers
// These run in Cloudflare Workers (server-side), not in the browser.

export interface WorkerEnv {
  JWT_SECRET: string
  SM_API_URL?: string
  SM_API_CLIENT_ID?: string
  SM_API_CLIENT_SECRET?: string
  [key: string]: string | undefined
}

export interface SmApiClientOptions {
  baseUrl?: string
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface SmApiClient {
  get(path: string, extraHeaders?: Record<string, string>): Promise<unknown>
  post(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>
  patch(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>
  put(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>
  del(path: string, extraHeaders?: Record<string, string>): Promise<unknown>
  withCookie(cookieStr: string): {
    get(path: string): Promise<unknown>
    post(path: string, body?: unknown): Promise<unknown>
    patch(path: string, body?: unknown): Promise<unknown>
    put(path: string, body?: unknown): Promise<unknown>
    del(path: string): Promise<unknown>
  }
}

export async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  var header = { alg: 'HS256', typ: 'JWT' }
  var enc = new TextEncoder()
  var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  var h = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  var p = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  var data = h + '.' + p
  var sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  var s = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sig)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return data + '.' + s
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    var parts = token.split('.')
    if (parts.length !== 3) return null
    var enc = new TextEncoder()
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    function pad(s: string) { return s + '==='.slice((s.length + 3) % 4) }
    var sig = Uint8Array.from(atob(pad(parts[2].replace(/-/g, '+').replace(/_/g, '/'))), function(c) { return c.charCodeAt(0) })
    var valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(parts[0] + '.' + parts[1]))
    if (!valid) return null
    var payload = JSON.parse(atob(pad(parts[1].replace(/-/g, '+').replace(/_/g, '/')))) as Record<string, unknown>
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch (_e) { return null }
}

export function getSession(request: Request, product?: string | null): string | null {
  var cookie = request.headers.get('Cookie') || ''
  // FLIP-HOTFIX-1: per-door cookie first. Post LOGIN_DOOR_CUTOVER (FEAT-1915)
  // a login sets ONLY the target door's sm_session_{product} cookie — reading
  // sm_client alone redirect-looped every fresh session on portals gated by
  // this helper. The door slug is the caller's `product` when given, else the
  // portal subdomain (slug == subdomain for every *.sprintmode.ai door,
  // matching sm-api's getProductCookieName convention).
  var slug = product || null
  if (!slug) {
    try {
      var host = new URL(request.url).hostname
      if (host.endsWith('.sprintmode.ai')) slug = host.split('.')[0]
    } catch (_e) { /* no derivable host — legacy fallback below */ }
  }
  if (slug && /^[a-z0-9-]+$/i.test(slug)) {
    var doorMatch = cookie.match(new RegExp('(?:^|;\\s*)sm_session_' + slug + '=([^;]+)'))
    if (doorMatch) return doorMatch[1]
  }
  // Legacy shared cookie — surviving pre-flip slim sessions.
  var match = cookie.match(/sm_client=([^;]+)/)
  return match ? match[1] : null
}

export async function requireAuth(request: Request, env: WorkerEnv, product?: string | null): Promise<Record<string, unknown> | null> {
  var token = getSession(request, product)
  if (!token) return null
  return await verifyJWT(token, env.JWT_SECRET)
}

export function generateToken(): string {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  var token = ''
  var bytes = crypto.getRandomValues(new Uint8Array(48))
  for (var i = 0; i < 48; i++) token += chars[bytes[i] % chars.length]
  return token
}

export function generateId(prefix: string): string {
  var hex = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function(b) { return b.toString(16).padStart(2, '0') }).join('')
  return prefix + '_' + hex
}

var SM_UI_VERSION = '0.1.0'
var SM_API_DEFAULT = 'https://api.sprintmode.ai'

export function createSmApiClient(env: WorkerEnv, opts?: SmApiClientOptions): SmApiClient {
  var baseUrl = (opts && opts.baseUrl) || env.SM_API_URL || SM_API_DEFAULT

  async function request(method: HttpMethod, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown> {
    var headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SM-Platform': 'sm-ui/' + SM_UI_VERSION,
      'CF-Access-Client-Id': env.SM_API_CLIENT_ID || '',
      'CF-Access-Client-Secret': env.SM_API_CLIENT_SECRET || ''
    }
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k] })
    }
    var fetchOpts: RequestInit = { method: method, headers: headers }
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body)
    var resp = await fetch(baseUrl + path, fetchOpts)
    if (!resp.ok) {
      var text = await resp.text()
      var parsed: Record<string, unknown>
      try { parsed = JSON.parse(text) } catch (_e) { parsed = { ok: false, error: text } }
      parsed['_status'] = resp.status
      return parsed
    }
    return resp.json()
  }

  return {
    get: function(path, extraHeaders) { return request('GET', path, null, extraHeaders) },
    post: function(path, body, extraHeaders) { return request('POST', path, body, extraHeaders) },
    patch: function(path, body, extraHeaders) { return request('PATCH', path, body, extraHeaders) },
    put: function(path, body, extraHeaders) { return request('PUT', path, body, extraHeaders) },
    del: function(path, extraHeaders) { return request('DELETE', path, null, extraHeaders) },
    withCookie: function(cookieStr) {
      return {
        get: function(path) { return request('GET', path, null, { 'Cookie': cookieStr }) },
        post: function(path, body) { return request('POST', path, body, { 'Cookie': cookieStr }) },
        patch: function(path, body) { return request('PATCH', path, body, { 'Cookie': cookieStr }) },
        put: function(path, body) { return request('PUT', path, body, { 'Cookie': cookieStr }) },
        del: function(path) { return request('DELETE', path, null, { 'Cookie': cookieStr }) }
      }
    }
  }
}
