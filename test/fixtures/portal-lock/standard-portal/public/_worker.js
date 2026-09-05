// Minimal Cloudflare Pages Functions passthrough exercising the /auth/me
// shape the spine returns: { ok, user }. PORTAL-LOCK check 27 flags a gate
// that reads a doubly-nested envelope instead; check 29 flags any auth call
// that is not to the spine (api.sprintmode.ai) or the portal's own /api/sm
// proxy.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/gate') {
      const res = await fetch('https://api.sprintmode.ai/auth/me', {
        headers: request.headers,
      })
      const data = await res.json()
      if (!data.ok || !data.user) {
        return new Response('Unauthorized', { status: 401 })
      }
      return new Response(JSON.stringify({ ok: true, user: data.user }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return env.ASSETS.fetch(request)
  },
}
