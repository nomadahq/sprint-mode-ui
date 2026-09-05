// Page gate in front of /app: reads the /auth/me shape the spine returns
// ({ ok, user }) through this portal's own /api proxy. PORTAL-LOCK check 27
// flags a gate that reads a nested envelope instead; check 29 flags an auth
// call to any host other than the spine or the portal's own /api/sm proxy.
export async function onRequest(context) {
  const url = new URL(context.request.url)
  if (!url.pathname.startsWith('/app')) return context.next()
  const res = await fetch(new URL('/api/auth/me', url.origin), {
    headers: { Cookie: context.request.headers.get('Cookie') || '' },
  })
  const data = await res.json().catch(() => null)
  if (data && data.ok && data.user) return context.next()
  return Response.redirect(new URL('/auth/login', url.origin).toString(), 302)
}
