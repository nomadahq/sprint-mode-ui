export interface Portal {
  /** The portal's data-product slug (from portal.json). */
  slug: string
  [key: string]: unknown
}

/**
 * Build a Cloudflare Pages Functions onRequest handler that proxies /api/*
 * to the sm-api spine for this portal.
 */
export function createApiProxy(portal: Portal): (context: any) => Promise<Response>
