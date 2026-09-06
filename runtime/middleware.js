// runtime/middleware.js
// FEAT-3170 square 1a: the per-portal app page gate as one framework
// artifact, imported by every portal repo instead of copied into it
// (Aaron ruling bc_c3e28774, D1/D3; design bc_cf23c209 section 1).
//
// Ported from sm-portal-template functions/_middleware.js (main 38b1e09f):
// an unauthenticated request for the app prefix (default "/app" or
// "/app/*") is redirected to the login path before the client-only app
// shell ever renders, rather than letting the client flash the shell and
// then bounce. appPrefix also accepts an array of prefixes (TASK-3248) for
// portals gating more than one section behind the same session check.
// Reads the "me" endpoint through the PORTAL'S OWN /api proxy
// (runtime/api-proxy.js) so the request carries the same X-SM-Product /
// X-SM-Platform headers sm-api needs to resolve the per-portal session
// cookie -- calling sm-api directly here would skip that and 401 a valid
// session.
//
// Byte-for-byte equivalent to the template file for headers sent and
// status/redirect behavior returned; only the packaging (one artifact,
// configurable paths) changes.
//
// Plain ESM JavaScript. No React, no sm-ui component imports. Runs equally
// under Node (tests) and the Cloudflare Pages Functions / Workers runtime
// (fetch, Request, Response, URL are all runtime globals there).

/**
 * @typedef {Object} AppGateOptions
 * @property {string|string[]} [appPrefix]  Path prefix (or list of prefixes) that
 *   requires a session. The gate applies when the pathname equals a prefix or
 *   starts with prefix + "/". Default "/app".
 * @property {string} [loginPath]  Redirect target when unauthenticated. Default "/auth/login".
 * @property {string} [meApiPath]  Path (relative to this portal's own origin) to
 *   read the session from. Default "/api/auth/me".
 */

/**
 * @param {string} pathname
 * @param {string[]} prefixes
 * @returns {boolean}
 */
function matchesAppPrefix(pathname, prefixes) {
  return prefixes.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix + '/')
  })
}

/**
 * Build a Cloudflare Pages Functions onRequest handler that gates a
 * client-only authenticated app behind a session check.
 *
 * @param {AppGateOptions} [options]
 * @returns {(context: any) => Promise<Response>}
 */
export function createAppGate(options) {
  var opts = options || {}
  var appPrefix = opts.appPrefix || '/app'
  var appPrefixes = Array.isArray(appPrefix) ? appPrefix : [appPrefix]
  var loginPath = opts.loginPath || '/auth/login'
  var meApiPath = opts.meApiPath || '/api/auth/me'

  return async function onRequest(context) {
    var request = context.request
    var url = new URL(request.url)

    if (!matchesAppPrefix(url.pathname, appPrefixes)) {
      return context.next()
    }

    try {
      var meUrl = new URL(meApiPath, url.origin)
      var meResp = await fetch(meUrl.toString(), {
        headers: { Cookie: request.headers.get('Cookie') || '' },
      })
      var meData = await meResp.json().catch(function () { return null })
      if (meData && meData.ok && meData.user) {
        return context.next()
      }
    } catch (_err) {
      // Treat a gate-check failure as unauthenticated -- fail closed, not open.
    }

    var redirectTo = new URL(loginPath, url.origin)
    redirectTo.searchParams.set('redirect', url.pathname + url.search)
    return Response.redirect(redirectTo.toString(), 302)
  }
}
