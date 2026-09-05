// @vitest-environment node
//
// FEAT-3170 square 1a: tests for bin/sm-portal-permkeys.mjs, the
// sm-signal-lineage PORTAL-RBAC-SHELLS coverage check shipped as an sm-ui
// bin instead of a per-portal copy. Fixture App files with permKeys; asserts
// the extracted route list and the exit codes.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { allowlistMatch, checkPermKeyCoverage, extractRoutes, loadRepoAllowlist, run } from '../../bin/sm-portal-permkeys.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FIXTURE_DIR = join(HERE, '..', '..', 'test', 'fixtures', 'permkeys')
const APP_FIXTURE = join(FIXTURE_DIR, 'App.jsx')
const APP_COVERED_FIXTURE = join(FIXTURE_DIR, 'App-covered.jsx')
const WITH_ALLOWLIST_DIR = join(FIXTURE_DIR, 'with-allowlist')

function collector() {
  const lines = []
  return { fn: (...args) => lines.push(args.join(' ')), lines }
}

describe('extractRoutes', () => {
  it('extracts every <Route path=...>, including the wrapper Route around the Layout child set', () => {
    const source = readFileSync(APP_FIXTURE, 'utf8')
    const routes = extractRoutes(source)
    const paths = routes.map((r) => r.path)
    // The layout-wrapping <Route element={<Layout />}> has no path= of its
    // own; the brace-aware scanner (ported as-is from check-page-permkeys.cjs)
    // captures the whole nested block as its chunk and the path= regex then
    // matches the FIRST child's path inside that chunk -- a known quirk of
    // the original extraction, reproduced faithfully here.
    expect(paths).toEqual(['/auth/login', '/old-path', '/dashboard', '/dashboard', '/internal-tools', '/reports/legacy'])
  })
})

describe('allowlistMatch', () => {
  it('matches an exact path', () => {
    expect(allowlistMatch('/reports/legacy', ['/reports/legacy'])).toBe(true)
    expect(allowlistMatch('/reports/other', ['/reports/legacy'])).toBe(false)
  })

  it('matches a prefix/* pattern', () => {
    expect(allowlistMatch('/reports/legacy', ['/reports/*'])).toBe(true)
    expect(allowlistMatch('/reports', ['/reports/*'])).toBe(true)
    expect(allowlistMatch('/other', ['/reports/*'])).toBe(false)
  })
})

describe('loadRepoAllowlist', () => {
  it('returns an empty array when no .permkey-allowlist.json exists', () => {
    expect(loadRepoAllowlist(FIXTURE_DIR)).toEqual([])
  })

  it('reads the allowlist array when present', () => {
    expect(loadRepoAllowlist(WITH_ALLOWLIST_DIR)).toEqual(['/reports/legacy'])
  })
})

describe('checkPermKeyCoverage', () => {
  it('exempts built-in patterns and redirects, flags an uncovered route', () => {
    const source = readFileSync(APP_FIXTURE, 'utf8')
    const { checked, failures } = checkPermKeyCoverage([{ file: 'App.jsx', source }], [])
    // 6, not 5: the Layout-wrapper Route's chunk swallows the whole nested
    // block, contains a "path=" match, AND happens to contain the nested
    // permKey too -- so it counts as an extra, separately-passing check
    // (see the extractRoutes note above).
    expect(checked).toBe(6)
    expect(failures).toEqual([
      { file: 'App.jsx', path: '/internal-tools' },
      { file: 'App.jsx', path: '/reports/legacy' },
    ])
  })

  it('honors a repo allowlist entry', () => {
    const source = readFileSync(APP_FIXTURE, 'utf8')
    const { failures } = checkPermKeyCoverage([{ file: 'App.jsx', source }], ['/reports/legacy'])
    expect(failures).toEqual([{ file: 'App.jsx', path: '/internal-tools' }])
  })

  it('passes with no failures when every route is covered', () => {
    const source = readFileSync(APP_COVERED_FIXTURE, 'utf8')
    const { checked, failures } = checkPermKeyCoverage([{ file: 'App-covered.jsx', source }], [])
    expect(checked).toBe(6)
    expect(failures).toEqual([])
  })
})

describe('run (CLI)', () => {
  it('exits 1 when no --app flag is given', () => {
    const err = collector()
    const code = run([], { error: err.fn })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/--app/)
  })

  it('exits 1 when the app file does not exist', () => {
    const err = collector()
    const code = run(['--app', join(FIXTURE_DIR, 'does-not-exist.jsx')], { error: err.fn, cwd: FIXTURE_DIR })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/not found/)
  })

  it('exits 1 and lists offending routes when coverage is incomplete (no allowlist)', () => {
    const err = collector()
    const code = run(['--app', APP_FIXTURE], { error: err.fn, cwd: FIXTURE_DIR })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/2 routed page\(s\)/)
    expect(err.lines.join('\n')).toMatch(/\/internal-tools/)
    expect(err.lines.join('\n')).toMatch(/\/reports\/legacy/)
  })

  it('exits 1 for the still-uncovered route even with the allowlist applied', () => {
    const err = collector()
    const code = run(['--app', APP_FIXTURE], { error: err.fn, cwd: WITH_ALLOWLIST_DIR })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/1 routed page\(s\)/)
    expect(err.lines.join('\n')).toMatch(/\/internal-tools/)
    expect(err.lines.join('\n')).not.toMatch(/\/reports\/legacy/)
  })

  it('exits 0 when every route is covered or exempt', () => {
    const log = collector()
    const code = run(['--app', APP_COVERED_FIXTURE], { log: log.fn, cwd: FIXTURE_DIR })
    expect(code).toBe(0)
    expect(log.lines.join('\n')).toMatch(/OK -- 6 route\(s\) checked/)
  })

  it('supports multiple --app flags', () => {
    const log = collector()
    const code = run(['--app', APP_COVERED_FIXTURE, '--app', APP_COVERED_FIXTURE], { log: log.fn, cwd: FIXTURE_DIR })
    expect(code).toBe(0)
    expect(log.lines.join('\n')).toMatch(/OK -- 12 route\(s\) checked/)
  })
})
