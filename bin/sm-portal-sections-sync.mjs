#!/usr/bin/env node
// bin/sm-portal-sections-sync.mjs
// FEAT-3170 square 1a: PORTAL-MANIFEST-SYNC runner shipped as one sm-ui bin
// instead of a per-portal copy (Aaron ruling bc_c3e28774, D1/D3; design
// bc_cf23c209 section 1). Ported from the sm-signal lineage
// (scripts/sync-portal-sections.cjs, identical copies in sm-signal,
// sm-waffle, switchpoint-dash and the sm-api generator).
//
// Extracts permKey definitions from a portal's nav config and POSTs them to
// the /api/admin/portals/:subdomain/sections/sync endpoint.
//
// Usage (from the portal repo's CI workflow):
//   npx sm-portal-sections-sync \
//     --portal <subdomain> \
//     --app <path-to-App-file> \
//     --api <SM_API_URL> \
//     --key <SM_API_KEY>
//
// The script:
//   1. Reads the portal's App.tsx/App.jsx (or nav-config.ts, or Vike's
//      pages/app/+Page.tsx).
//   2. Extracts all permKey values with label and parent context.
//   3. POSTs to the sync endpoint with X-SM-Key auth.
//   4. Prints the diff summary to stdout.
//   5. Exits 0 always -- orphans are informational, not blocking.
//
// Environment variables (alternative to flags):
//   PORTAL_SUBDOMAIN, PORTAL_APP_FILE, SM_API_URL, SM_API_KEY
//
// No runtime dependencies: Node 20 built-ins only (fetch is a Node 20
// built-in, replacing the original's manual http/https request helper --
// same endpoint, headers, and response handling).

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// --- argument parsing -------------------------------------------------------

export function getArg(args, flag, envKey) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  if (envKey && process.env[envKey]) return process.env[envKey]
  return null
}

// --- nav extraction ----------------------------------------------------------
// Regex-based extraction. Looks for permKey: '<value>' or permKey: "<value>"
// patterns in the source file and associates them with the nearest preceding
// label: '<value>' within the same nav item object (within 300 chars).
//
// This approach is intentionally simple -- it doesn't AST-parse
// TypeScript/JSX. It works because the nav config files follow a consistent
// pattern:
//   { to: '/path', label: 'My Page', permKey: 'my.page' }
// or (for admin nav-config.ts):
//   { to: '/path', label: 'My Page', icon: 'IconFoo', permKey: 'my.page' }
//
// Also extracts JSX permKey="..." attributes (PageGate declarations on
// routed pages). Nav-object entries above carry real labels and are kept in
// preference; PageGate-only keys get a label derived from the key suffix
// (title-cased) so pages without a nav item (billing, usage) still register
// in portal_sections.

export function extractPermKeys(source) {
  const sections = []

  const permKeyRe = /permKey:\s*['"`]([^'"`]+)['"`]/g

  let match
  while ((match = permKeyRe.exec(source)) !== null) {
    const permKey = match[1]
    // Normalise: hyphens to underscores (defensive, PP-1 should have done this)
    const section_key = permKey.replace(/-/g, '_')

    // Look back up to 300 chars for a label: field in the same object
    const lookback = source.slice(Math.max(0, match.index - 300), match.index)
    const labelMatch = [...lookback.matchAll(/label:\s*['"`]([^'"`]+)['"`]/g)].pop()
    const label = labelMatch ? labelMatch[1] : section_key

    sections.push({ section_key, label })
  }

  const jsxPermKeyRe = /permKey=\{?["'`]([^"'`]+)["'`]\}?/g
  while ((match = jsxPermKeyRe.exec(source)) !== null) {
    const permKey = match[1]
    const section_key = permKey.replace(/-/g, '_')
    const suffix = section_key.includes('.') ? section_key.slice(section_key.lastIndexOf('.') + 1) : section_key
    const label = suffix
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
    sections.push({ section_key, label })
  }

  // Deduplicate by section_key (keep first occurrence = first nav item that uses it)
  const seen = new Set()
  return sections.filter((s) => {
    if (seen.has(s.section_key)) return false
    seen.add(s.section_key)
    return true
  })
}

// --- runner ------------------------------------------------------------------

export async function run(argv, opts = {}) {
  const args = argv
  const log = opts.log || console.log
  const error = opts.error || console.error
  const fetchImpl = opts.fetch || fetch

  const PORTAL = getArg(args, '--portal', 'PORTAL_SUBDOMAIN')
  const APP_FILE = getArg(args, '--app', 'PORTAL_APP_FILE')
  const API_URL = getArg(args, '--api', 'SM_API_URL') || 'https://api.sprintmode.ai'
  const API_KEY = getArg(args, '--key', 'SM_API_KEY')

  if (!PORTAL) {
    error('ERROR: --portal (or PORTAL_SUBDOMAIN) is required')
    return 1
  }
  if (!APP_FILE) {
    error('ERROR: --app (or PORTAL_APP_FILE) is required')
    return 1
  }
  if (!API_KEY) {
    error('ERROR: --key (or SM_API_KEY) is required')
    return 1
  }

  const resolvedFile = resolve(APP_FILE)
  if (!existsSync(resolvedFile)) {
    error(`ERROR: App file not found: ${resolvedFile}`)
    return 1
  }

  const source = readFileSync(resolvedFile, 'utf8')
  const sections = extractPermKeys(source)

  if (sections.length === 0) {
    log(`[sync-portal-sections] ${PORTAL}: no permKeys found in ${APP_FILE} -- skipping sync`)
    return 0
  }

  log(`[sync-portal-sections] ${PORTAL}: extracted ${sections.length} permKey(s) from ${APP_FILE}`)

  const endpoint = `${API_URL}/api/admin/portals/${PORTAL}/sections/sync`
  const body = JSON.stringify({ sections })

  let res
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SM-Key': API_KEY },
      body,
    })
  } catch (err) {
    error(`[sync-portal-sections] ${PORTAL}: request failed -- ${err.message}`)
    // Exit 0 -- sync failure is never blocking for portal CI
    return 0
  }

  if (res.status !== 200) {
    const text = await res.text().catch(() => '')
    error(`[sync-portal-sections] ${PORTAL}: sync endpoint returned HTTP ${res.status} -- ${text}`)
    return 0
  }

  let result
  try {
    result = await res.json()
  } catch {
    error(`[sync-portal-sections] ${PORTAL}: could not parse response`)
    return 0
  }

  if (!result.ok) {
    error(`[sync-portal-sections] ${PORTAL}: sync error -- ${result.error}`)
    return 0
  }

  const { added, updated, unchanged, orphaned } = result.data

  log(`[sync-portal-sections] ${PORTAL}: sync complete`)
  if (added.length) log(`  ADDED     (${added.length}): ${added.join(', ')}`)
  if (updated.length) log(`  UPDATED   (${updated.length}): ${updated.join(', ')}`)
  if (unchanged.length) log(`  UNCHANGED (${unchanged.length}): ${unchanged.join(', ')}`)
  if (orphaned.length) {
    log(`  ORPHANED  (${orphaned.length}): ${orphaned.join(', ')}`)
    log('  NOTE: Orphaned rows were NOT deleted. Review and remove manually via Portal Manager if stale.')
  }

  return 0
}

// --- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  run(process.argv.slice(2)).then((code) => process.exit(code))
}
