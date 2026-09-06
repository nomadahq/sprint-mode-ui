// @vitest-environment node
//
// FEAT-3170 square 1a: unit tests for the shared API passthrough
// (runtime/api-proxy.js), ported byte-for-byte-equivalent from
// sm-portal-template's functions/api/[[catchall]].js. Synthetic
// Request/context objects with a stubbed global fetch -- no network, no DOM.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiProxy } from '../../runtime/api-proxy.js'

function makeContext(url, options = {}, env = {}) {
  const request = new Request(url, options)
  return { request, env }
}

describe('createApiProxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('answers an OPTIONS preflight directly, without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/whatever', { method: 'OPTIONS' })

    const res = await proxy(ctx)

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://acme-portal.example.com')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PATCH, DELETE, OPTIONS')
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('strips /api from /api/auth/* and sets X-SM-Product / X-SM-Platform from the portal', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/auth/me', { headers: { Cookie: 'sid=1' } })

    const res = await proxy(ctx)

    expect(captured.url).toBe('https://api.sprintmode.ai/auth/me')
    expect(captured.headers.get('X-SM-Product')).toBe('acme')
    expect(captured.headers.get('X-SM-Platform')).toBe('acme-portal/1.0')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://acme-portal.example.com')
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('keeps non-auth /api/* paths as-is against SM_API_URL from env', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/portals/acme?x=1', {}, { SM_API_URL: 'https://staging.sprintmode.ai' })

    await proxy(ctx)

    expect(captured.url).toBe('https://staging.sprintmode.ai/api/portals/acme?x=1')
  })

  it('forwards CF-Access-Client-Id/Secret from env only when present', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/x', {}, { SM_API_CLIENT_ID: 'cid', SM_API_CLIENT_SECRET: 'csecret' })

    await proxy(ctx)

    expect(captured.headers.get('CF-Access-Client-Id')).toBe('cid')
    expect(captured.headers.get('CF-Access-Client-Secret')).toBe('csecret')

    // Second call with no env creds: headers must not be set at all.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    await proxy(makeContext('https://acme-portal.example.com/api/x'))
    expect(captured.headers.has('CF-Access-Client-Id')).toBe(false)
    expect(captured.headers.has('CF-Access-Client-Secret')).toBe(false)
  })

  it('sets X-SM-Host to the request URL hostname, lowercased and without a port', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://Acme-Portal.EXAMPLE.com:8443/api/x')

    await proxy(ctx)

    expect(captured.headers.get('X-SM-Host')).toBe('acme-portal.example.com')
  })

  it('sets X-SM-Host correctly for a *.sprintmode.ai portal host', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme.sprintmode.ai/api/x')

    await proxy(ctx)

    expect(captured.headers.get('X-SM-Host')).toBe('acme.sprintmode.ai')
  })

  it('overwrites a client-supplied X-SM-Host rather than trusting it', async () => {
    let captured
    vi.stubGlobal(
      'fetch',
      vi.fn(async (req) => {
        captured = req
        return new Response('{}', { status: 200 })
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/x', {
      headers: { 'X-SM-Host': 'attacker.example.com' },
    })

    await proxy(ctx)

    expect(captured.headers.get('X-SM-Host')).toBe('acme-portal.example.com')
  })

  it('passes 3xx responses through with no body and the original headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'https://api.sprintmode.ai/somewhere' } })),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/x')

    const res = await proxy(ctx)

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://api.sprintmode.ai/somewhere')
  })

  it('returns a 502 JSON error when the upstream fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom')
      }),
    )
    const proxy = createApiProxy({ slug: 'acme' })
    const ctx = makeContext('https://acme-portal.example.com/api/x')

    const res = await proxy(ctx)

    expect(res.status).toBe(502)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(await res.json()).toEqual({ ok: false, error: 'Proxy error' })
  })
})
