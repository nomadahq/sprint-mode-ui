import { readFileSync, writeFileSync } from 'node:fs'
// @vitest-environment node
//
// Positive tests (TASK-3198, scope item 3): the sm-portal-lock runner stays
// green on the fixture, and stays green after routine, allowed changes.

import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runChecks } from '../../bin/sm-portal-lock.mjs'
import { appendToFile, cleanup, cloneFixture, loadStandard, readJson, writeJson } from './portal-lock-helpers.js'

const standard = loadStandard()

function allRepoChecksPass(results) {
  return results.every((r) => r.status === 'pass')
}

describe('sm-portal-lock stays green on the standard fixture', () => {
  let dir

  beforeEach(() => {
    dir = cloneFixture()
  })

  afterEach(() => {
    cleanup(dir)
  })

  it('reports every repo-side check as pass on the untouched fixture', () => {
    const results = runChecks(dir, standard, { newestTag: '1.2.0' })
    expect(results).toHaveLength(15) // ids 1,2,3,4,6,7,8,9,10,11,12,13,26,27,29
    for (const r of results) {
      expect(r.status).toBe('pass')
    }
  })

  it('stays green after adding a page with a new permKey', () => {
    const newPage = join(dir, 'pages', 'Settings.jsx')
    appendToFile(
      newPage,
      `import React from 'react'
import { PageGate } from '@sprint-mode/sm-ui'

export function SettingsPage() {
  return (
    <PageGate permKey="settings.view">
      <div>Settings</div>
    </PageGate>
  )
}
`,
    )
    const results = runChecks(dir, standard, { newestTag: '1.2.0' })
    expect(allRepoChecksPass(results)).toBe(true)
  })

  it('stays green after adding a role definition file (not a forbidden constant)', () => {
    const rolesPath = join(dir, 'config', 'customer-roles.json')
    writeJson(rolesPath, { customer_roles: ['owner', 'billing_admin', 'viewer', 'support_agent'] })
    const results = runChecks(dir, standard, { newestTag: '1.2.0' })
    expect(allRepoChecksPass(results)).toBe(true)
  })

  it('stays green after adding a member through a stubbed joinPortal call', () => {
    const stubPath = join(dir, 'stubs', 'portal_members.json')
    const stub = readJson(stubPath)
    stub.members.push({ email: 'bob@acme.example', role: 'viewer', status: 'active' })
    writeJson(stubPath, stub)
    const results = runChecks(dir, standard, { newestTag: '1.2.0' })
    expect(allRepoChecksPass(results)).toBe(true)
  })

  it('stays green after bumping the sm-ui pin to the value passed as --newest-tag', () => {
    const newVersion = '1.3.0'
    const pkgPath = join(dir, 'package.json')
    const pkg = readJson(pkgPath)
    pkg.dependencies['@sprint-mode/sm-ui'] = newVersion
    writeJson(pkgPath, pkg)

    const lockPath = join(dir, 'package-lock.json')
    const lock = readJson(lockPath)
    lock.packages[''].dependencies['@sprint-mode/sm-ui'] = newVersion
    lock.packages['node_modules/@sprint-mode/sm-ui'].version = newVersion
    writeJson(lockPath, lock)

    const results = runChecks(dir, standard, { newestTag: newVersion })
    const pin = results.find((r) => r.key === 'sm-ui-pinned-exact')
    const pinMatch = results.find((r) => r.key === 'sm-ui-pin-matches-newest-tag')
    expect(pin.status).toBe('pass')
    expect(pin.found).toBe(newVersion)
    expect(pinMatch.status).toBe('pass')
    expect(allRepoChecksPass(results)).toBe(true)
  })

  it('stays green when the dark-theme tint rule carries a hex value', () => {
    const htmlPath = join(dir, 'index.html')
    const raw = readFileSync(htmlPath, 'utf8')
    writeFileSync(htmlPath, raw.replace('--accent-tint: rgba(75, 42, 173, 0.18);', '--accent-tint: #2a1a5e;'))
    const results = runChecks(dir, standard, { newestTag: '1.2.0' })
    expect(findResult(results, 'no-hardcoded-brand-values').status).toBe('pass')
  })

})
