// runtime/api-proxy.js
// FEAT-3170 square 1a: the per-portal API passthrough as one framework
// artifact, imported by every portal repo instead of copied into it
// (Aaron ruling bc_c3e28774, D1/D3; design bc_cf23c209 section 1).
//
// Ported from sm-portal-template functions/api/[[catchall]].js (main
// 38b1e09f): generic passthrough to the sm-api spine. Every request gets
// X-SM-Product and X-SM-Platform from portal.json so sm-api resolves the
// right per-portal session cookie and access grant.
//
//   /api/auth/*  --> SM API at /auth/*  (strip /api prefix)
//   /api/*       --> SM API at /api/*   (everything else, path kept as-is)
//
// Byte-for-byte equivalent to the template file for outgoing headers, CORS
// response, redirect passthrough, and the 502 JSON error shape; only the
// packaging (one artifact, portal object passed in) changes.
//
// Plain ESM JavaScript. No React, no sm-ui component imports. Runs equally
// under Node (tests) and the Cloudflare Pages Functions / Workers runtime.

/**
 * @typedef {Object} Portal
 * @property {string} slug  The portal's data-product slug (from portal.json).
 */

/**
 * Build a Cloudflare Pages Functions onRequest handler that proxies /api/*
 * to the sm-api spine for this portal.
 *
 * @param {Portal} portal  This portal's portal.json (only .slug is read).
 * @returns {(context: any) => Promise<Response>}
 */
export function createApiProxy(portal) {
  return async function onRequest(context) {
    var SM_API = context.env.SM_API_URL || 'https://api.sprintmode.ai'
    var request = context.request
    var url = new URL(request.url)
    var path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // /api/auth/me is the page gate's own read (runtime/middleware.js) and
    // the client's session fetch both hit this path -- proxied like every
    // other /api/auth/* route below, no special casing needed here since
    // access-denial is a plain sm-api 401/403 the client already handles.
    var target
    if (path.startsWith('/api/auth')) {
      target = SM_API + path.replace(/^\/api/, '') + url.search
    } else {
      target = SM_API + path + url.search
    }

    var proxyHeaders = new Headers(request.headers)
    if (context.env.SM_API_CLIENT_ID) proxyHeaders.set('CF-Access-Client-Id', context.env.SM_API_CLIENT_ID)
    if (context.env.SM_API_CLIENT_SECRET) proxyHeaders.set('CF-Access-Client-Secret', context.env.SM_API_CLIENT_SECRET)
    proxyHeaders.set('X-SM-Platform', portal.slug + '-portal/1.0')
    proxyHeaders.set('X-SM-Product', portal.slug)

    var proxied = new Request(target, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    })

    try {
      var response = await fetch(proxied)

      if (response.status >= 300 && response.status < 400) {
        return new Response(null, { status: response.status, headers: response.headers })
      }

      var headers = new Headers(response.headers)
      headers.set('Access-Control-Allow-Origin', url.origin)
      headers.set('Access-Control-Allow-Credentials', 'true')
      return new Response(response.body, { status: response.status, headers: headers })
    } catch (_err) {
      return new Response(JSON.stringify({ ok: false, error: 'Proxy error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
