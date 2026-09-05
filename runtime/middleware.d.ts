export interface AppGateOptions {
  /** Path prefix that requires a session. Default "/app". */
  appPrefix?: string
  /** Redirect target when unauthenticated. Default "/auth/login". */
  loginPath?: string
  /** Path (relative to this portal's own origin) to read the session from. Default "/api/auth/me". */
  meApiPath?: string
}

/**
 * Build a Cloudflare Pages Functions onRequest handler that gates a
 * client-only authenticated app behind a session check.
 */
export function createAppGate(options?: AppGateOptions): (context: any) => Promise<Response>
