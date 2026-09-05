#!/usr/bin/env node
// bin/sm-portal-permkeys.mjs
// FEAT-3170 square 1a: PORTAL-RBAC-SHELLS build-time coverage check shipped
// as one sm-ui bin instead of a per-portal copy (Aaron ruling bc_c3e28774,
// D1/D3; design bc_cf23c209 section 1). Ported from the sm-signal lineage
// (scripts/check-page-permkeys.cjs, identical copies in sm-signal,
// sm-waffle, switchpoint-dash and the sm-api generator).
//
// Fails the build when a routed, element-rendering, non-user-space page
// ships without a permKey declaration (PageGate adoption per
// PORTAL-RBAC-SPEC-1 B1).
//
// Usage:
//   npx sm-portal-permkeys --app <path-to-App-file> [--app <another>]
//
// A route is EXEMPT (declared-by-construction, per the approved B1
// allowlist) when any of these hold:
//   - its path matches a built-in exempt pattern (auth, user-space, legal,
//     public/token pages, onboarding, catchalls)
//   - its element is a redirect (<Navigate ...>)
//   - its path is listed in .permkey-allowlist.json at the repo root
//     (JSON array of exact paths or "prefix/*" patterns), for
//     portal-specific exemptions the built-ins don't cover
// Every other route must contain a permKey declaration (PageGate's
// permKey="..." attribute, or a nav-object permKey: '...' inside the
// element).
//
// Exit 1 with the offending paths listed; exit 0 when covered.
//
// No runtime dependencies: Node 20 built-ins only.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Built-in exemption patterns (B1 allowlist categories)
export const EXEMPT_PATTERNS = [
  /^\/auth(\/|$)/, // login, link-account, signup
  /^\/user(\/|$)/, // user-space: profile, updates, notifications
  /^\/legal(\/|$)/, // public legal pages
  /^\/onboarding$/, // pre-portal onboarding flows
  /^\/it(\/|$)/, // pre-shell special-audience pages (signal /it/connect)
  /^\/invest\/:/, // public token pages
  /^\/connect\/guide$/, // public connect guide
  /^\/unsubscribe$/, // public email pages
  /^\/email-preferences$/,
  /^\/?\*$/, // catchalls: * and /*
  /^\/client(\/|$)/, // legacy /client/* redirect trees
]

// Paths whose element is user-space rendered at a bare path (portal-specific);
// extend via .permkey-allowlist.json rather than editing this file.
export function loadRepoAllowlist(cwd = process.cwd()) {
  const p = resolve(cwd, '.permkey-allowlist.json')
  if (!existsSync(p)) return []
  try {
    const arr = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    throw new Error(`could not parse .permkey-allowlist.json -- ${e.message}`)
  }
}

export function allowlistMatch(routePath, allowlist) {
  for (const entry of allowlist) {
    if (typeof entry !== 'string') continue
    if (entry.endsWith('/*')) {
      const prefix = entry.slice(0, -2)
      if (routePath === prefix || routePath.startsWith(prefix + '/')) return true
    } else if (entry === routePath) {
      return true
    }
  }
  return false
}

// Capture each <Route ...> through the Route's OWN closing "/>" -- not the
// first "/>" in the chunk, which may belong to a nested child element inside
// an element={...} expression (e.g. wrap('/x', <Page />, { permKey: 'k' })
// puts the declaration AFTER the child's "/>"). We scan brace-aware: JSX
// expression braces are counted (quoted strings skipped), and the Route tag
// ends at the first "/>" (self-closing) or ">" (open tag) found at brace
// depth zero. Open-tag Routes extend to their "</Route>".
export function extractRoutes(source) {
  const out = []
  const routeRe = /<Route\b/g
  let m
  while ((m = routeRe.exec(source)) !== null) {
    const start = m.index
    let i = start + 6
    let depth = 0
    let end = -1
    let selfClosing = true
    while (i < source.length) {
      const ch = source[i]
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch
        i++
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') i++
          i++
        }
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
      } else if (depth === 0 && ch === '/' && source[i + 1] === '>') {
        end = i + 2
        break
      } else if (depth === 0 && ch === '>') {
        selfClosing = false
        const close = source.indexOf('</Route>', i)
        end = close === -1 ? Math.min(source.length, i + 600) : close + 8
        break
      }
      i++
    }
    if (end === -1) end = Math.min(source.length, start + 600)
    const chunk = source.slice(start, end)
    if (!selfClosing && chunk.indexOf('path=', 0) === -1) continue
    const pathMatch = chunk.match(/path=["'{]+([^"'}]+)["'}]/)
    if (!pathMatch) continue // pathless layout routes gate nothing themselves
    out.push({ path: pathMatch[1], chunk })
  }
  return out
}

/**
 * Check a set of App source strings for permKey coverage.
 * @param {Array<{file: string, source: string}>} files
 * @param {string[]} repoAllowlist
 * @returns {{ checked: number, failures: Array<{file: string, path: string}> }}
 */
export function checkPermKeyCoverage(files, repoAllowlist) {
  const failures = []
  let checked = 0

  for (const { file, source } of files) {
    const routes = extractRoutes(source)
    for (const r of routes) {
      checked++
      // Nested <Routes> use relative paths ("user/profile"); normalize so the
      // exempt patterns and allowlist match both forms.
      const routePath = r.path.startsWith('/') ? r.path : '/' + r.path
      if (EXEMPT_PATTERNS.some((re) => re.test(routePath))) continue
      if (allowlistMatch(routePath, repoAllowlist) || allowlistMatch(r.path, repoAllowlist)) continue
      if (r.chunk.includes('<Navigate')) continue // redirect-only
      if (r.chunk.includes('permKey')) continue // PageGate attr or nav-object key
      failures.push({ file, path: r.path })
    }
  }

  return { checked, failures }
}

// --- CLI ---------------------------------------------------------------------

export function run(argv, opts = {}) {
  const args = argv
  const log = opts.log || console.log
  const error = opts.error || console.error
  const cwd = opts.cwd || process.cwd()

  const appFiles = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app' && args[i + 1]) appFiles.push(args[++i])
  }
  if (appFiles.length === 0) {
    error('ERROR: at least one --app <file> is required')
    return 1
  }

  let repoAllowlist
  try {
    repoAllowlist = loadRepoAllowlist(cwd)
  } catch (e) {
    error(`ERROR: ${e.message}`)
    return 1
  }

  const files = []
  for (const file of appFiles) {
    const resolved = resolve(file)
    if (!existsSync(resolved)) {
      error(`ERROR: App file not found: ${resolved}`)
      return 1
    }
    files.push({ file, source: readFileSync(resolved, 'utf8') })
  }

  const { checked, failures } = checkPermKeyCoverage(files, repoAllowlist)

  if (failures.length > 0) {
    error(`[check-page-permkeys] FAIL -- ${failures.length} routed page(s) without a permKey:`)
    for (const f of failures) error(`  ${f.path}  (${f.file})`)
    error(
      'Every element-rendering, non-user-space route must declare a permKey ' +
        '(wrap the element in <PageGate permKey="{portal}.{page}">) or be listed ' +
        'in .permkey-allowlist.json with a reason in the PR.',
    )
    return 1
  }
  log(`[check-page-permkeys] OK -- ${checked} route(s) checked, all covered or exempt.`)
  return 0
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  process.exit(run(process.argv.slice(2)))
}
