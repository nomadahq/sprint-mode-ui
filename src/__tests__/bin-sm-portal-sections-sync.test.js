// @vitest-environment node
//
// FEAT-3170 square 1a: tests for bin/sm-portal-sections-sync.mjs, the
// sm-signal-lineage sections-sync script shipped as an sm-ui bin instead of
// a per-portal copy. Covers extraction against a fixture App file and the
// exit-0-always contract (with a stubbed fetch, no network).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { extractPermKeys, getArg, run } from '../../bin/sm-portal-sections-sync.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FIXTURE = join(HERE, '..', '..', 'test', 'fixtures', 'sections-sync', 'nav-app.jsx')

function collector() {
  const lines = []
  return { fn: (...args) => lines.push(args.join(' ')), lines }
}

describe('getArg', () => {
  it('prefers the flag value over the env fallback', () => {
    process.env.TEST_ARG_ENV = 'from-env'
    expect(getArg(['--x', 'from-flag'], '--x', 'TEST_ARG_ENV')).toBe('from-flag')
    delete process.env.TEST_ARG_ENV
  })

  it('falls back to the env var when the flag is absent', () => {
    process.env.TEST_ARG_ENV = 'from-env'
    expect(getArg([], '--x', 'TEST_ARG_ENV')).toBe('from-env')
    delete process.env.TEST_ARG_ENV
  })

  it('returns null when neither is set', () => {
    expect(getArg([], '--x', 'TEST_ARG_ENV_UNSET')).toBeNull()
  })
})

describe('extractPermKeys', () => {
  it('extracts nav-object permKeys with their label, and JSX permKey attributes', () => {
    const source = readFileSync(FIXTURE, 'utf8')
    const sections = extractPermKeys(source)
    expect(sections).toEqual([
      { section_key: 'dashboard.view', label: 'Dashboard' },
      { section_key: 'billing_invoices', label: 'Billing' },
      { section_key: 'settings.advanced', label: 'Advanced' },
    ])
  })

  it('deduplicates by section_key, keeping the first occurrence', () => {
    const source = `
      { label: 'First', permKey: 'a.b' }
      { label: 'Second', permKey: 'a.b' }
    `
    expect(extractPermKeys(source)).toEqual([{ section_key: 'a.b', label: 'First' }])
  })

  it('returns an empty list when no permKeys are present', () => {
    expect(extractPermKeys('export function App() { return null }')).toEqual([])
  })
})

describe('run', () => {
  it('exits 1 when --portal is missing', async () => {
    const err = collector()
    const code = await run(['--app', FIXTURE, '--key', 'k'], { error: err.fn })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/--portal/)
  })

  it('exits 1 when --app is missing', async () => {
    const err = collector()
    const code = await run(['--portal', 'acme', '--key', 'k'], { error: err.fn })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/--app/)
  })

  it('exits 1 when --key is missing', async () => {
    const err = collector()
    const code = await run(['--portal', 'acme', '--app', FIXTURE], { error: err.fn })
    expect(code).toBe(1)
    expect(err.lines.join('\n')).toMatch(/--key/)
  })

  it('exits 0 and skips the POST when the app file has no permKeys', async () => {
    const log = collector()
    const fetchSpy = vi.fn()
    const code = await run(
      ['--portal', 'acme', '--app', join(HERE, '..', '..', 'package.json'), '--key', 'k'],
      { log: log.fn, fetch: fetchSpy },
    )
    expect(code).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(log.lines.join('\n')).toMatch(/skipping sync/)
  })

  it('POSTs extracted sections with X-SM-Key and prints the diff summary', async () => {
    const log = collector()
    const fetchSpy = vi.fn(async (endpoint, opts) => {
      expect(endpoint).toBe('https://api.sprintmode.ai/api/admin/portals/acme/sections/sync')
      expect(opts.method).toBe('POST')
      expect(opts.headers['X-SM-Key']).toBe('k')
      const body = JSON.parse(opts.body)
      expect(body.sections).toEqual([
        { section_key: 'dashboard.view', label: 'Dashboard' },
        { section_key: 'billing_invoices', label: 'Billing' },
        { section_key: 'settings.advanced', label: 'Advanced' },
      ])
      return new Response(
        JSON.stringify({ ok: true, data: { added: ['a.b'], updated: [], unchanged: ['c.d'], orphaned: [] } }),
        { status: 200 },
      )
    })

    const code = await run(['--portal', 'acme', '--app', FIXTURE, '--key', 'k'], { log: log.fn, fetch: fetchSpy })

    expect(code).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(log.lines.join('\n')).toMatch(/ADDED\s+\(1\): a\.b/)
    expect(log.lines.join('\n')).toMatch(/UNCHANGED\s+\(1\): c\.d/)
  })

  it('exits 0 (never blocking) when the request throws', async () => {
    const err = collector()
    const fetchSpy = vi.fn(async () => {
      throw new Error('network down')
    })
    const code = await run(['--portal', 'acme', '--app', FIXTURE, '--key', 'k'], { error: err.fn, fetch: fetchSpy })
    expect(code).toBe(0)
    expect(err.lines.join('\n')).toMatch(/request failed/)
  })

  it('exits 0 (never blocking) on a non-200 response', async () => {
    const err = collector()
    const fetchSpy = vi.fn(async () => new Response('server error', { status: 500 }))
    const code = await run(['--portal', 'acme', '--app', FIXTURE, '--key', 'k'], { error: err.fn, fetch: fetchSpy })
    expect(code).toBe(0)
    expect(err.lines.join('\n')).toMatch(/HTTP 500/)
  })
})
