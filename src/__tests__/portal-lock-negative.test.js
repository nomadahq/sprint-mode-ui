// @vitest-environment node
//
// Negative tests (TASK-3198, scope item 3): one per repo-side check, proving
// sm-portal-lock reports a deviation on the exact deviation it names, plus
// one proving an expired override does not rescue a deviation.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runChecks } from '../../bin/sm-portal-lock.mjs'
import { appendToFile, cleanup, cloneFixture, findResult, loadStandard, readJson, writeJson, writeOverride } from './portal-lock-helpers.js'

const standard = loadStandard()

describe('sm-portal-lock reports a deviation for each repo-side violation', () => {
  let dir

  beforeEach(() => {
    dir = cloneFixture()
  })

  afterEach(() => {
    cleanup(dir)
  })

  it('check 1: sm-ui pinned with a caret range', () => {
    const pkgPath = join(dir, 'package.json')
    const pkg = readJson(pkgPath)
    pkg.dependencies['@sprint-mode/sm-ui'] = '^1.2.0'
    writeJson(pkgPath, pkg)
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'sm-ui-pinned-exact').status).toBe('deviation')
  })

  it('check 2: sm-ui pin does not match the newest published tag', () => {
    const results = runChecks(dir, standard, { newestTag: '1.9.9' })
    const r = findResult(results, 'sm-ui-pin-matches-newest-tag')
    expect(r.status).toBe('deviation')
    expect(r.a_warns_only).toBe(true)
  })

  it('check 3: package-lock.json is out of sync with package.json', () => {
    const lockPath = join(dir, 'package-lock.json')
    const lock = readJson(lockPath)
    lock.packages['node_modules/@sprint-mode/sm-ui'].version = '1.1.0'
    writeJson(lockPath, lock)
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'package-lock-in-sync').status).toBe('deviation')
  })

  it('check 4: workflow installs with npm install instead of npm ci', () => {
    const ciPath = join(dir, '.github', 'workflows', 'ci.yml')
    appendToFile(ciPath, '\n  legacy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm install\n')
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'workflow-uses-npm-ci').status).toBe('deviation')
  })

  it('check 6: AGENTS.md is missing the sm-workflow managed block', () => {
    const agentsPath = join(dir, 'AGENTS.md')
    writeFileSync(agentsPath, '# Plain AGENTS.md with no managed block\n')
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'kit-files-present').status).toBe('deviation')
  })

  it('check 7: portal.json template_version is below the standard minimum', () => {
    const portalPath = join(dir, 'portal.json')
    const portal = readJson(portalPath)
    portal.template_version = '0.5.0'
    writeJson(portalPath, portal)
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'portal-json-present').status).toBe('deviation')
  })

  it('check 8: app defines a local Layout component', () => {
    appendToFile(
      join(dir, 'pages', 'LocalLayout.jsx'),
      "export function Layout() { return null }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'no-local-shell-components').status).toBe('deviation')
  })

  it('check 9: a local /auth/magic call bypasses sm-ui', () => {
    appendToFile(
      join(dir, 'pages', 'LocalMagic.jsx'),
      "export function sendMagicLink(email) { return fetch('/auth/magic', { method: 'POST', body: email }) }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'login-uses-sm-ui').status).toBe('deviation')
  })

  it('check 10: a local role-list constant is declared', () => {
    appendToFile(
      join(dir, 'pages', 'LocalRoles.jsx'),
      "export const BUILT_IN_ROLES = ['owner', 'viewer']\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'no-local-role-list').status).toBe('deviation')
  })

  it('check 11: <html> has no data-product attribute', () => {
    const htmlPath = join(dir, 'index.html')
    const raw = readFileSync(htmlPath, 'utf8')
    writeFileSync(htmlPath, raw.replace(' data-product="acme-widgets"', ''))
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'data-product-on-html').status).toBe('deviation')
  })

  it('check 12: the brand override block is missing a required variable', () => {
    const htmlPath = join(dir, 'index.html')
    const raw = readFileSync(htmlPath, 'utf8')
    writeFileSync(htmlPath, raw.replace(/--accent-soft:[^;]+;\s*/, ''))
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'brand-override-block-present').status).toBe('deviation')
  })

  it('check 13: a hardcoded hex color appears outside the override block', () => {
    appendToFile(
      join(dir, 'pages', 'HardcodedColor.jsx'),
      "export function Banner() { return <div style={{ color: '#ff00aa' }}>Sale</div> }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'no-hardcoded-brand-values').status).toBe('deviation')
  })

  it('check 26: view-as is enabled without an explicit viewAsApi', () => {
    appendToFile(
      join(dir, 'pages', 'LegacyViewAs.jsx'),
      "import { Layout } from '@sprint-mode/sm-ui'\nexport function Shell() { return <Layout viewAsEnabled={true} /> }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'view-as-feed-declared').status).toBe('deviation')
  })

  it('check 27: the page gate reads data.data instead of { ok, user }', () => {
    appendToFile(
      join(dir, 'pages', 'BadGate.jsx'),
      "export async function checkAuth() { const res = await fetch('/auth/me'); const data = await res.json(); return data.data.user }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'auth-me-shape-correct').status).toBe('deviation')
  })

  it('check 29: a browser-side call reaches a non-spine auth host', () => {
    appendToFile(
      join(dir, 'pages', 'RogueAuth.jsx'),
      "export function login() { return fetch('https://evil-auth.example.com/auth/login') }\n",
    )
    const results = runChecks(dir, standard, {})
    expect(findResult(results, 'no-non-spine-auth-calls').status).toBe('deviation')
  })

  it('an expired override does not rescue a deviation', () => {
    const pkgPath = join(dir, 'package.json')
    const pkg = readJson(pkgPath)
    pkg.dependencies['@sprint-mode/sm-ui'] = '^1.2.0'
    writeJson(pkgPath, pkg)
    writeOverride(dir, '2026-01-01-sm-ui-pinned-exact.md', {
      check: 'sm-ui-pinned-exact',
      reason: 'temporary range pending a vendor patch',
      approved_by: 'Aaron Hall',
      approved_on: '2026-01-01',
      expires: '2026-02-01',
    })
    const results = runChecks(dir, standard, { now: new Date('2026-09-05') })
    expect(findResult(results, 'sm-ui-pinned-exact').status).toBe('deviation')
  })

  it('a valid, unexpired override turns a deviation into an exception', () => {
    const pkgPath = join(dir, 'package.json')
    const pkg = readJson(pkgPath)
    pkg.dependencies['@sprint-mode/sm-ui'] = '^1.2.0'
    writeJson(pkgPath, pkg)
    writeOverride(dir, '2026-09-01-sm-ui-pinned-exact.md', {
      check: 'sm-ui-pinned-exact',
      reason: 'temporary range pending a vendor patch',
      approved_by: 'Aaron Hall',
      approved_on: '2026-09-01',
      expires: '2026-12-01',
    })
    const results = runChecks(dir, standard, { now: new Date('2026-09-05') })
    const r = findResult(results, 'sm-ui-pinned-exact')
    expect(r.status).toBe('exception')
    expect(r.override.approved_by).toBe('Aaron Hall')
  })
})
