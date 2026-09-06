export interface AppGateOptions {
  /**
   * Path prefix (or list of prefixes) that requires a session. The gate
   * applies when the pathname equals a prefix or starts with prefix + "/".
   * Default "/app".
   */
  appPrefix?: string | string[]
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
