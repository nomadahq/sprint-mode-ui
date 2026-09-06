// @vitest-environment node
//
// FEAT-3170 square 1a: unit tests for the shared app-gate middleware
// (runtime/middleware.js), ported byte-for-byte-equivalent from
// sm-portal-template's functions/_middleware.js. Synthetic Request/context
// objects with a stubbed global fetch -- no network, no DOM.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppGate } from '../../runtime/middleware.js'

function makeContext(url, options = {}) {
  const request = new Request(url, options)
  const next = vi.fn(async () => new Response('next-called', { status: 200 }))
  return { request, next }
}

describe('createAppGate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes requests outside the app prefix straight through without checking auth', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/marketing')

    const res = await gate(ctx)

    expect(ctx.next).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await res.text()).toBe('next-called')
  })

  it('reads /api/auth/me through the same origin, forwarding the Cookie header', async () => {
    const fetchSpy = vi.fn(async (url, opts) => {
      expect(String(url)).toBe('https://acme-portal.example.com/api/auth/me')
      expect(opts.headers.Cookie).toBe('sid=abc')
      return new Response(JSON.stringify({ ok: true, user: { id: 1 } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchSpy)
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/app', { headers: { Cookie: 'sid=abc' } })

    await gate(ctx)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('passes an authenticated /app request through to context.next()', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, user: { id: 1 } }), { status: 200 })),
    )
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/app/settings')

    const res = await gate(ctx)

    expect(ctx.next).toHaveBeenCalledTimes(1)
    expect(await res.text()).toBe('next-called')
  })

  it('redirects an unauthenticated /app request to login with a redirect param', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })),
    )
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/app/dashboard?x=1')

    const res = await gate(ctx)

    expect(ctx.next).not.toHaveBeenCalled()
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://acme-portal.example.com/auth/login?redirect=%2Fapp%2Fdashboard%3Fx%3D1')
  })

  it('treats a malformed /auth/me JSON body as unauthenticated (fails closed)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 })),
    )
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/app')

    const res = await gate(ctx)

    expect(ctx.next).not.toHaveBeenCalled()
    expect(res.status).toBe(302)
  })

  it('fails closed (redirects) when the auth check itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const gate = createAppGate()
    const ctx = makeContext('https://acme-portal.example.com/app')

    const res = await gate(ctx)

    expect(ctx.next).not.toHaveBeenCalled()
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://acme-portal.example.com/auth/login?redirect=%2Fapp')
  })

  it('gates on any prefix in an appPrefix array, passing non-matching paths through', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, user: { id: 1 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const gate = createAppGate({ appPrefix: ['/app', '/admin'] })

    const appCtx = makeContext('https://acme-portal.example.com/app/settings')
    await gate(appCtx)
    expect(appCtx.next).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const adminCtx = makeContext('https://acme-portal.example.com/admin/users')
    await gate(adminCtx)
    expect(adminCtx.next).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    const marketingFetchSpy = vi.fn()
    vi.stubGlobal('fetch', marketingFetchSpy)
    const marketingCtx = makeContext('https://acme-portal.example.com/marketing')
    const res = await gate(marketingCtx)
    expect(marketingCtx.next).toHaveBeenCalledTimes(1)
    expect(marketingFetchSpy).not.toHaveBeenCalled()
    expect(await res.text()).toBe('next-called')
  })

  it('honors custom appPrefix / loginPath / meApiPath options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        expect(String(url)).toBe('https://acme-portal.example.com/api/session')
        return new Response(JSON.stringify({ ok: false }), { status: 200 })
      }),
    )
    const gate = createAppGate({ appPrefix: '/dashboard', loginPath: '/login', meApiPath: '/api/session' })
    const ctx = makeContext('https://acme-portal.example.com/dashboard/x')

    const res = await gate(ctx)

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://acme-portal.example.com/login?redirect=%2Fdashboard%2Fx')
  })
})
