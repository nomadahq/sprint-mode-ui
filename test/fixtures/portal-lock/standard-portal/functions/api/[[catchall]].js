// Pages Functions passthrough to the sm-api spine. Every request carries
// X-SM-Product from portal.json so sm-api resolves this portal's session.
import portal from '../../portal.json'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const target = 'https://api.sprintmode.ai' + url.pathname.replace(/^\/api\/auth/, '/auth') + url.search
  const headers = new Headers(context.request.headers)
  headers.set('X-SM-Product', portal.slug)
  headers.set('X-SM-Platform', portal.slug + '-portal/1.0')
  return fetch(new Request(target, { method: context.request.method, headers, body: context.request.body }))
}
