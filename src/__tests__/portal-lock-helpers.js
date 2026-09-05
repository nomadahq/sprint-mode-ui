// Shared helpers for the PORTAL-LOCK test suites (TASK-3198).
// Not itself a test file -- vitest only collects src/__tests__/**/*.test.js.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const FIXTURE_ROOT = join(HERE, '..', '..', 'test', 'fixtures', 'portal-lock', 'standard-portal')
export const BIN_PATH = join(HERE, '..', '..', 'bin', 'sm-portal-lock.mjs')
export const STANDARD_PATH = join(HERE, '..', '..', 'portal-standard.json')

export function loadStandard() {
  return JSON.parse(readFileSync(STANDARD_PATH, 'utf8'))
}

export function cloneFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'portal-lock-'))
  cpSync(FIXTURE_ROOT, dir, { recursive: true })
  return dir
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true })
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function writeJson(path, obj) {
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`)
}

export function appendToFile(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  let existing = ''
  try {
    existing = readFileSync(path, 'utf8')
  } catch {
    existing = ''
  }
  writeFileSync(path, existing + content)
}

export function writeOverride(dir, filename, frontmatter, body = 'Recorded for TASK-3198 fixture coverage.') {
  const overridesDir = join(dir, 'docs', 'portal-lock', 'overrides')
  mkdirSync(overridesDir, { recursive: true })
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  writeFileSync(join(overridesDir, filename), `---\n${fm}\n---\n\n${body}\n`)
}

export function findResult(results, key) {
  const found = results.find((r) => r.key === key)
  if (!found) throw new Error(`no result for check "${key}"`)
  return found
}
