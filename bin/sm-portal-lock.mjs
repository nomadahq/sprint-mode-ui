#!/usr/bin/env node
// bin/sm-portal-lock.mjs
//
// PORTAL-LOCK repo-side check runner (TASK-3198, FEAT-3170 section G).
//
// Runs the checks from portal-standard.json whose "source" is "repo" against
// a portal checkout: package.json/package-lock.json pinning, the CI workflow,
// kit files, portal.json, and a handful of static source-code scans (no local
// shell components, login wiring, role lists, brand tokens, the auth/me
// shape, and non-spine auth calls). Check 2 additionally needs --newest-tag.
//
// The production-side gatherers (Cloudflare Pages, D1, R2, a live production
// fetch) are out of scope here -- they live in sm-api (square 9) and read the
// same standard file, filtering to their own "source" values.
//
// No runtime dependencies: Node 20 built-ins only.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(__dirname, '..')

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs']
const WALK_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])
const SHELL_COMPONENT_NAMES = [
  'ProfileCard',
  'Layout',
  'Login',
  'AccountSwitcher',
  'PortalPicker',
  'NotificationBellNav',
  'PageGate',
  'PortalSupportWidget',
]
const OVERRIDE_REQUIRED_FIELDS = ['check', 'reason', 'approved_by', 'approved_on', 'expires']

// --- small file-system helpers ---------------------------------------------

function readSafe(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function readJson(path) {
  const raw = readSafe(path)
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function walk(root) {
  const results = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (WALK_EXCLUDES.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) results.push(full)
    }
  }
  return results
}

function walkSourceFiles(root) {
  return walk(root).filter((f) => SOURCE_EXTENSIONS.includes(extname(f)))
}

function walkHtmlFiles(root) {
  return walk(root).filter((f) => extname(f) === '.html')
}

function walkCssFiles(root) {
  return walk(root).filter((f) => extname(f) === '.css')
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- standard / own package.json loading ------------------------------------

function loadStandard() {
  const raw = readFileSync(join(PACKAGE_ROOT, 'portal-standard.json'), 'utf8')
  return JSON.parse(raw)
}

function loadOwnPackageJson() {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
}

// standard_version is stamped into portal-standard.json at publish time, but
// the publish workflow bumps package.json's version in the runner -- so the
// live source of truth at runtime is this bin's own package.json, not the
// possibly-stale static field.
function resolveStandardVersion(standard) {
  const ownPkg = loadOwnPackageJson()
  return { runtime: ownPkg.version, static: standard.standard_version }
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

// --- overrides ---------------------------------------------------------------

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!m) return null
  const data = {}
  for (const line of m[1].split('\n')) {
    const lm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!lm) continue
    let value = lm[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    data[lm[1]] = value
  }
  return data
}

function loadOverrides(checkoutPath) {
  const dir = join(checkoutPath, 'docs', 'portal-lock', 'overrides')
  const overrides = new Map()
  if (!existsSync(dir)) return overrides
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const raw = readSafe(join(dir, file))
    if (raw == null) continue
    const fm = parseFrontmatter(raw)
    if (!fm || !fm.check) continue
    overrides.set(String(fm.check), { ...fm, file })
  }
  return overrides
}

function overrideValidity(entry, now) {
  if (!entry) return { valid: false, reason: 'no override on file' }
  for (const field of OVERRIDE_REQUIRED_FIELDS) {
    if (!entry[field]) return { valid: false, reason: `override missing field: ${field}` }
  }
  const expires = new Date(entry.expires)
  if (Number.isNaN(expires.getTime())) return { valid: false, reason: 'override expires date is unparsable' }
  if (expires.getTime() < now.getTime()) return { valid: false, reason: `override expired ${entry.expires}` }
  return { valid: true }
}

function applyOverride(check, result, overrides, now) {
  if (result.status !== 'deviation') return result
  const entry = overrides.get(check.key) || overrides.get(String(check.id))
  const validity = overrideValidity(entry, now)
  if (validity.valid) {
    return {
      ...result,
      status: 'exception',
      override: {
        file: entry.file,
        reason: entry.reason,
        approved_by: entry.approved_by,
        approved_on: entry.approved_on,
        expires: entry.expires,
      },
    }
  }
  if (entry) {
    return { ...result, note: validity.reason }
  }
  return result
}

// --- individual repo-side checks --------------------------------------------
// Each returns { status: 'pass' | 'deviation' | 'unknown', found, expected, fix_where }

function checkSmUiPinnedExact(root) {
  const fixWhere = 'package.json dependencies["@sprint-mode/sm-ui"]'
  const pkg = readJson(join(root, 'package.json'))
  if (!pkg) {
    return { status: 'deviation', found: 'missing or unparsable package.json', expected: 'an exact version pin', fix_where: fixWhere }
  }
  let found = null
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkg[section] && pkg[section]['@sprint-mode/sm-ui']) {
      found = pkg[section]['@sprint-mode/sm-ui']
      break
    }
  }
  if (!found) {
    return { status: 'deviation', found: 'not declared', expected: 'an exact version, e.g. 1.2.0', fix_where: fixWhere }
  }
  const exact = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(found)
  if (!exact) {
    return { status: 'deviation', found, expected: 'an exact version with no ^, ~, github:, or latest', fix_where: fixWhere }
  }
  return { status: 'pass', found, expected: 'an exact version', fix_where: fixWhere }
}

function checkSmUiPinMatchesNewestTag(root, standard, ctx) {
  const fixWhere = 'package.json dependencies["@sprint-mode/sm-ui"], or a declared override under docs/portal-lock/overrides/'
  if (!ctx.newestTag) {
    return { status: 'unknown', found: ctx.pin.found, expected: '--newest-tag not provided', fix_where: fixWhere }
  }
  if (ctx.pin.found === ctx.newestTag) {
    return { status: 'pass', found: ctx.pin.found, expected: ctx.newestTag, fix_where: fixWhere }
  }
  return { status: 'deviation', found: ctx.pin.found, expected: ctx.newestTag, fix_where: fixWhere }
}

function checkPackageLockInSync(root, standard, ctx) {
  // A full "npm ci passes" run needs registry access; this is a deterministic,
  // offline proxy: the committed lockfile must exist and must pin
  // @sprint-mode/sm-ui at the same version as package.json.
  const fixWhere = 'package-lock.json (regenerate with npm install, then commit)'
  const lockPath = join(root, 'package-lock.json')
  if (!existsSync(lockPath)) {
    return { status: 'deviation', found: 'missing', expected: 'package-lock.json committed', fix_where: fixWhere }
  }
  const lock = readJson(lockPath)
  if (!lock) {
    return { status: 'deviation', found: 'unparsable package-lock.json', expected: 'a valid JSON lockfile', fix_where: fixWhere }
  }
  const pin = ctx.pin.found
  if (!pin || pin === 'not declared') {
    return { status: 'unknown', found: 'no @sprint-mode/sm-ui pin to compare against', expected: 'a declared dependency', fix_where: fixWhere }
  }
  let lockVersion = null
  if (lock.packages && lock.packages['node_modules/@sprint-mode/sm-ui']) {
    lockVersion = lock.packages['node_modules/@sprint-mode/sm-ui'].version
  } else if (lock.dependencies && lock.dependencies['@sprint-mode/sm-ui']) {
    lockVersion = lock.dependencies['@sprint-mode/sm-ui'].version
  }
  if (!lockVersion) {
    return { status: 'deviation', found: 'lockfile has no @sprint-mode/sm-ui entry', expected: `locked at ${pin}`, fix_where: fixWhere }
  }
  if (lockVersion !== pin) {
    return { status: 'deviation', found: `lockfile pins ${lockVersion}`, expected: `locked at ${pin}`, fix_where: fixWhere }
  }
  return { status: 'pass', found: `lockfile pins ${lockVersion}`, expected: `locked at ${pin}`, fix_where: fixWhere }
}

function checkWorkflowUsesNpmCi(root) {
  const fixWhere = '.github/workflows/*.yml (replace npm install with npm ci)'
  const wfDir = join(root, '.github', 'workflows')
  if (!existsSync(wfDir)) {
    return { status: 'deviation', found: 'no .github/workflows directory', expected: 'a CI workflow that runs npm ci', fix_where: fixWhere }
  }
  const files = readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  let sawCi = false
  const installOffenders = []
  for (const file of files) {
    const raw = readSafe(join(wfDir, file)) || ''
    raw.split('\n').forEach((line, idx) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) return
      if (/\bnpm\s+ci\b/.test(trimmed)) sawCi = true
      if (/\bnpm\s+install\b/.test(trimmed)) installOffenders.push(`${file}:${idx + 1}`)
    })
  }
  if (installOffenders.length) {
    return { status: 'deviation', found: `npm install at ${installOffenders.join(', ')}`, expected: 'npm ci only', fix_where: fixWhere }
  }
  if (!sawCi) {
    return { status: 'deviation', found: 'no npm ci step found', expected: 'a workflow step running npm ci', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'npm ci found, no npm install', expected: 'npm ci only', fix_where: fixWhere }
}

function checkKitFilesPresent(root) {
  const fixWhere = '.github/CODEOWNERS, .sm-workflow.conf, AGENTS.md, .github/workflows/*.yml'
  const missing = []
  if (!existsSync(join(root, '.github', 'CODEOWNERS'))) missing.push('.github/CODEOWNERS')

  const conf = readSafe(join(root, '.sm-workflow.conf'))
  if (conf == null) missing.push('.sm-workflow.conf')
  else if (!/^version=\d+\.\d+\.\d+\s*$/m.test(conf)) missing.push('.sm-workflow.conf (no version=X.Y.Z line)')

  const agents = readSafe(join(root, 'AGENTS.md'))
  if (agents == null) missing.push('AGENTS.md')
  else if (!agents.includes('sm-workflow:begin') || !agents.includes('sm-workflow:end')) {
    missing.push('AGENTS.md (no sm-workflow managed block)')
  }

  let hasCiGate = false
  const wfDir = join(root, '.github', 'workflows')
  if (existsSync(wfDir)) {
    for (const file of readdirSync(wfDir)) {
      const raw = readSafe(join(wfDir, file)) || ''
      if (/^\s*ci-gate:/m.test(raw) || /\bname:\s*ci-gate\b/.test(raw)) {
        hasCiGate = true
        break
      }
    }
  }
  if (!hasCiGate) missing.push('a ci-gate job in .github/workflows/*.yml')

  if (missing.length) {
    return { status: 'deviation', found: `missing: ${missing.join('; ')}`, expected: 'CODEOWNERS, a versioned .sm-workflow.conf, AGENTS.md with the sm-workflow block, and a ci-gate job', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'CODEOWNERS, .sm-workflow.conf, AGENTS.md, and a ci-gate job all present', expected: 'same', fix_where: fixWhere }
}

function checkPortalJsonPresent(root, standard) {
  const fixWhere = 'portal.json'
  const schema = standard.portal_json_schema || {}
  const requiredFields = schema.required_fields || ['template', 'template_version', 'type']
  const minVersion = schema.min_template_version || '0.0.0'
  const portal = readJson(join(root, 'portal.json'))
  if (!portal) {
    return { status: 'deviation', found: 'missing or unparsable portal.json', expected: `fields: ${requiredFields.join(', ')}`, fix_where: fixWhere }
  }
  const missing = requiredFields.filter((f) => !(f in portal) || portal[f] === '' || portal[f] == null)
  if (missing.length) {
    return { status: 'deviation', found: `portal.json missing: ${missing.join(', ')}`, expected: `fields: ${requiredFields.join(', ')}`, fix_where: fixWhere }
  }
  if (compareVersions(portal.template_version, minVersion) < 0) {
    return { status: 'deviation', found: `template_version ${portal.template_version}`, expected: `>= ${minVersion}`, fix_where: fixWhere }
  }
  return { status: 'pass', found: `template "${portal.template}" v${portal.template_version} (${portal.type})`, expected: `fields present, version >= ${minVersion}`, fix_where: fixWhere }
}

function checkNoLocalShellComponents(root) {
  const fixWhere = "app source -- import Layout (etc.) from '@sprint-mode/sm-ui' instead of redefining it"
  const files = walkSourceFiles(root)
  let sawLayoutImport = false
  const localDefs = []
  const defPattern = new RegExp(
    `\\b(?:function|class)\\s+(${SHELL_COMPONENT_NAMES.join('|')})\\b|\\bconst\\s+(${SHELL_COMPONENT_NAMES.join('|')})\\s*=`,
    'g',
  )
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    if (/import\s*\{[^}]*\bLayout\b[^}]*\}\s*from\s*['"]@sprint-mode\/sm-ui['"]/.test(raw)) sawLayoutImport = true

    let match
    defPattern.lastIndex = 0
    while ((match = defPattern.exec(raw))) {
      const name = match[1] || match[2]
      const lineStart = raw.lastIndexOf('\n', match.index) + 1
      const lineEndIdx = raw.indexOf('\n', match.index)
      const line = raw.slice(lineStart, lineEndIdx === -1 ? raw.length : lineEndIdx)
      if (/\bimport\b/.test(line) || /\bexport\s*\{/.test(line)) continue
      localDefs.push(`${relative(root, file)}: ${name}`)
    }
  }
  if (!sawLayoutImport) {
    return { status: 'deviation', found: 'no import of Layout from @sprint-mode/sm-ui', expected: "import { Layout } from '@sprint-mode/sm-ui'", fix_where: fixWhere }
  }
  if (localDefs.length) {
    return { status: 'deviation', found: `local component definitions: ${localDefs.join(', ')}`, expected: 'no local component shadows an sm-ui shell component', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'Layout imported from sm-ui; no local shell component definitions', expected: 'same', fix_where: fixWhere }
}

function checkLoginUsesSmUi(root) {
  const fixWhere = 'the /auth/login route/page component'
  const files = walkSourceFiles(root).concat(walkHtmlFiles(root))
  let sawLoginWithPortal = false
  const magicOffenders = []
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    if (/<Login\b[^>]*\bportal=/.test(raw)) sawLoginWithPortal = true
    if (/['"`]\/auth\/(?:magic|verify-code)['"`]/.test(raw) && !/@sprint-mode\/sm-ui/.test(raw)) {
      magicOffenders.push(relative(root, file))
    }
  }
  if (magicOffenders.length) {
    return { status: 'deviation', found: `local /auth/magic or /auth/verify-code call in ${magicOffenders.join(', ')}`, expected: 'no /auth/magic or /auth/verify-code call outside sm-ui', fix_where: fixWhere }
  }
  if (!sawLoginWithPortal) {
    return { status: 'deviation', found: 'no <Login ... portal=...> usage found', expected: '<Login portal="<slug>" ...> from @sprint-mode/sm-ui', fix_where: fixWhere }
  }
  return { status: 'pass', found: '<Login portal=...> found; no local /auth/magic or /auth/verify-code call', expected: 'same', fix_where: fixWhere }
}

function checkNoLocalRoleList(root) {
  const fixWhere = 'app source -- remove the local role list; read roles from the session and portal-roles'
  const files = walkSourceFiles(root)
  const offenders = []
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    if (/\bSM_TEAM_ROLES\b/.test(raw) || /\bBUILT_IN_ROLES\b/.test(raw) || /const\s+\w*ROLES\w*\s*=\s*\[/i.test(raw)) {
      offenders.push(relative(root, file))
    }
  }
  if (offenders.length) {
    return { status: 'deviation', found: `local role list in ${offenders.join(', ')}`, expected: 'no local role-list constant', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'no local role-list constant found', expected: 'same', fix_where: fixWhere }
}

function checkDataProductOnHtml(root) {
  const fixWhere = 'index.html <html data-product="<slug>">'
  for (const file of walkHtmlFiles(root)) {
    const raw = readSafe(file)
    if (raw == null) continue
    const m = raw.match(/<html\b[^>]*\bdata-product=["']([^"']+)["']/)
    if (m) {
      return { status: 'pass', found: `data-product="${m[1]}" in ${relative(root, file)}`, expected: 'data-product=<slug> on <html>', fix_where: fixWhere, _slug: m[1] }
    }
  }
  return { status: 'deviation', found: 'no data-product attribute on <html> in any HTML file', expected: 'data-product=<slug> on <html>', fix_where: fixWhere }
}

function checkBrandOverrideBlock(root, standard, ctx) {
  const fixWhere = 'index.html or a global CSS file -- add html[data-product="<slug>"] { ...six accent variables... } plus html[data-product="<slug>"][data-theme="dark"] { --accent-tint: ... }'
  const slug = ctx.dataProductSlug
  const requiredVars = standard.brand_override_variables || []
  if (!slug) {
    return { status: 'unknown', found: 'no data-product slug found (see check 11)', expected: 'a resolvable slug', fix_where: fixWhere }
  }
  if (standard.data_product_slugs.includes(slug)) {
    return { status: 'pass', found: `slug "${slug}" is a known sm-ui product; no override required`, expected: 'n/a', fix_where: fixWhere }
  }
  const files = walkHtmlFiles(root).concat(walkCssFiles(root))
  const blockPattern = new RegExp(`html\\[data-product=["']${escapeRegExp(slug)}["']\\]\\s*\\{([^}]*)\\}`)
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    const m = raw.match(blockPattern)
    if (m) {
      const missingVars = requiredVars.filter((v) => !m[1].includes(v))
      if (missingVars.length) {
        return { status: 'deviation', found: `override block missing: ${missingVars.join(', ')}`, expected: `all of: ${requiredVars.join(', ')}`, fix_where: fixWhere }
      }
      const darkPattern = new RegExp(`html\\[data-product=["']${escapeRegExp(slug)}["']\\]\\[data-theme=["']dark["']\\]\\s*\\{([^}]*)\\}`)
      const dark = raw.match(darkPattern)
      if (!dark || !dark[1].includes('--accent-tint')) {
        return { status: 'deviation', found: 'override block present but no dark-theme tint rule', expected: 'html[data-product="<slug>"][data-theme="dark"] redefining --accent-tint', fix_where: fixWhere }
      }
      return { status: 'pass', found: `override block for "${slug}" carries the six accent variables and the dark tint rule`, expected: 'same', fix_where: fixWhere }
    }
  }
  return { status: 'deviation', found: `no html[data-product="${slug}"] override block found`, expected: `a block with: ${requiredVars.join(', ')}`, fix_where: fixWhere }
}

function checkNoHardcodedBrandValues(root) {
  const fixWhere = "the portal's own CSS/JSX -- use design tokens instead of literal hex colors or font-family"
  const files = walkCssFiles(root).concat(walkSourceFiles(root))
  const offenders = []
  for (const file of files) {
    let raw = readSafe(file)
    if (raw == null) continue
    // Allowlist: the brand override block.
    raw = raw.replace(/html\[data-product=["'][^"']+["']\]\s*\{[^}]*\}/g, '')
    raw.split('\n').forEach((line, idx) => {
      // Allowlist: SVG fill attributes/declarations.
      if (/\bfill\s*[:=]\s*["']?#[0-9a-fA-F]{3,8}/i.test(line)) return
      const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g)
      if (hexMatches) offenders.push(`${relative(root, file)}:${idx + 1} hex ${hexMatches.join(',')}`)
      const ffMatch = line.match(/font-family\s*:\s*([^;]+);?/)
      if (ffMatch && !/var\(--/.test(ffMatch[1])) {
        offenders.push(`${relative(root, file)}:${idx + 1} font-family ${ffMatch[1].trim()}`)
      }
    })
  }
  if (offenders.length) {
    return { status: 'deviation', found: offenders.join(' | '), expected: 'no hardcoded hex color or literal font-family where a token exists', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'no hardcoded hex colors or font-family literals found', expected: 'same', fix_where: fixWhere }
}

function checkViewAsFeedDeclared(root) {
  // TASK-2037 retired Layout's built-in view-as fallback feed: a portal that
  // enables view-as now must pass its own viewAsApi, or it silently gets none.
  const fixWhere = 'the <Layout ...> usage -- pass an explicit viewAsApi, or drop viewAsEnabled/viewAsAnyRole'
  const files = walkSourceFiles(root)
  const offenders = []
  let usesViewAs = false
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    const layoutTags = raw.match(/<Layout\b[^>]*\/?>/gs) || []
    for (const tag of layoutTags) {
      const enablesViewAs = /\bviewAsEnabled=\{?\s*true\s*\}?/.test(tag) || /\bviewAsAnyRole=\{?\s*true\s*\}?/.test(tag)
      const hasApi = /\bviewAsApi=/.test(tag)
      if (enablesViewAs) usesViewAs = true
      if (enablesViewAs && !hasApi) offenders.push(`${relative(root, file)}: <Layout> enables view-as without viewAsApi`)
    }
  }
  if (offenders.length) {
    return { status: 'deviation', found: offenders.join(' | '), expected: 'an explicit viewAsApi wherever view-as is enabled', fix_where: fixWhere }
  }
  return {
    status: 'pass',
    found: usesViewAs ? 'view-as enabled with an explicit viewAsApi' : 'view-as not enabled',
    expected: 'same',
    fix_where: fixWhere,
  }
}

function checkAuthMeShape(root) {
  const fixWhere = 'the page gate / auth check reading /auth/me -- read { ok, user } directly, not data.data'
  const files = walkSourceFiles(root)
  const authMeFiles = []
  const offenders = []
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null || !/\/auth\/me\b/.test(raw)) continue
    authMeFiles.push(file)
    if (/\bdata\.data\b/.test(raw)) offenders.push(relative(root, file))
  }
  if (offenders.length) {
    return { status: 'deviation', found: `data.data pattern in ${offenders.join(', ')}`, expected: 'read { ok, user } directly', fix_where: fixWhere }
  }
  if (authMeFiles.length === 0) {
    return { status: 'pass', found: 'no local /auth/me handling (delegated to sm-ui PageGate/Layout)', expected: 'same', fix_where: fixWhere }
  }
  return {
    status: 'pass',
    found: `/auth/me read in ${authMeFiles.map((f) => relative(root, f)).join(', ')}; no data.data pattern`,
    expected: 'same',
    fix_where: fixWhere,
  }
}

function checkNoNonSpineAuthCalls(root) {
  const fixWhere = "client-side fetch/axios calls -- route auth calls through api.sprintmode.ai or the portal's own /api/sm proxy"
  const files = walkSourceFiles(root)
  const offenders = []
  for (const file of files) {
    const raw = readSafe(file)
    if (raw == null) continue
    const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+)[^"'`\s]*/g
    let m
    while ((m = urlPattern.exec(raw))) {
      const full = m[0]
      const host = m[1]
      if (!/auth/i.test(full)) continue
      if (host === 'api.sprintmode.ai') continue
      offenders.push(`${relative(root, file)}: ${full}`)
    }
  }
  if (offenders.length) {
    return { status: 'deviation', found: offenders.join(' | '), expected: 'auth calls only to api.sprintmode.ai or /api/sm', fix_where: fixWhere }
  }
  return { status: 'pass', found: 'no non-spine auth host calls found', expected: 'same', fix_where: fixWhere }
}

// --- runner ------------------------------------------------------------------

// Check 26: the Pages Functions passthrough (functions/**) sets X-SM-Product
// to the slug, and the portal does not ship an advanced-mode _worker.js at
// the root or under public/ (the standard template uses functions/).
function checkFunctionsPassthrough(root, standard, ctx) {
  const fixWhere = 'functions/api/[[catchall]].js -- set X-SM-Product from portal.json; delete any _worker.js'
  const workers = ['_worker.js', join('public', '_worker.js')].filter((f) => existsSync(join(root, f)))
  if (workers.length) {
    return { status: 'deviation', found: `${workers.join(', ')} present`, expected: 'no root or public _worker.js; use functions/', fix_where: fixWhere }
  }
  const fnDir = join(root, 'functions')
  if (!existsSync(fnDir)) {
    return { status: 'deviation', found: 'no functions/ directory', expected: 'functions/ passthrough setting X-SM-Product', fix_where: fixWhere }
  }
  const files = walk(fnDir).filter((f) => SOURCE_EXTENSIONS.includes(extname(f)))
  const setters = files.filter((f) => /X-SM-Product/.test(readSafe(f) || ''))
  if (!setters.length) {
    return { status: 'deviation', found: 'no functions/ file sets X-SM-Product', expected: 'functions/ passthrough sets X-SM-Product to the slug', fix_where: fixWhere }
  }
  const slug = ctx.dataProductSlug
  const named = setters.filter((f) => {
    const raw = readSafe(f) || ''
    return /portal\.json/.test(raw) || (slug && raw.includes(slug))
  })
  if (!named.length) {
    return { status: 'deviation', found: `X-SM-Product set in ${setters.map((f) => relative(root, f)).join(', ')} but not from portal.json or the slug`, expected: 'X-SM-Product equals the portal slug (read from portal.json)', fix_where: fixWhere }
  }
  return { status: 'pass', found: `X-SM-Product set in ${named.map((f) => relative(root, f)).join(', ')}; no _worker.js`, expected: 'same', fix_where: fixWhere }
}

const CHECK_IMPLS = {
  'sm-ui-pinned-exact': (root, standard, ctx) => ctx.pin,
  'sm-ui-pin-matches-newest-tag': checkSmUiPinMatchesNewestTag,
  'package-lock-in-sync': checkPackageLockInSync,
  'workflow-uses-npm-ci': checkWorkflowUsesNpmCi,
  'kit-adopted': checkKitFilesPresent, // N/S gate: kept for the audit; not run by this bin
  'portal-json-present': checkPortalJsonPresent,
  'no-local-shell-components': checkNoLocalShellComponents,
  'login-uses-sm-ui': checkLoginUsesSmUi,
  'no-local-role-list': checkNoLocalRoleList,
  'data-product-on-html': (root, standard, ctx) => ctx.htmlSlugResult,
  'brand-override-block-present': checkBrandOverrideBlock,
  'no-hardcoded-brand-values': checkNoHardcodedBrandValues,
  'view-as-feed-declared': checkViewAsFeedDeclared,
  'auth-me-shape-correct': checkAuthMeShape,
  'no-non-spine-auth-calls': checkNoNonSpineAuthCalls,
  'functions-passthrough-product-header': checkFunctionsPassthrough,
}

export function runChecks(root, standard, opts = {}) {
  const now = opts.now || new Date()
  const overrides = loadOverrides(root)
  const pin = checkSmUiPinnedExact(root)
  const htmlSlugResult = checkDataProductOnHtml(root)
  const ctx = { pin, htmlSlugResult, newestTag: opts.newestTag || null, dataProductSlug: htmlSlugResult._slug }

  const repoChecks = standard.checks.filter((c) => c.source === 'repo' && c.gates.includes('A'))
  const results = []
  for (const check of repoChecks) {
    const impl = CHECK_IMPLS[check.key]
    const raw = impl ? impl(root, standard, ctx) : { status: 'unknown', found: 'not implemented by sm-portal-lock', expected: 'n/a', fix_where: 'n/a' }
    const { _slug, ...cleanRaw } = raw || {}
    const finalResult = applyOverride(check, cleanRaw, overrides, now)
    results.push({
      id: check.id,
      key: check.key,
      title: check.title,
      gates: check.gates,
      a_warns_only: check.a_warns_only,
      ...finalResult,
    })
  }
  return results
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { path: process.cwd(), json: false, newestTag: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--path') args.path = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--newest-tag') args.newestTag = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function truncate(str, max) {
  const s = String(str).replace(/\s+/g, ' ')
  return s.length > max ? `${s.slice(0, max - 3)}...` : s
}

function printTable(results) {
  const columns = [
    { key: 'id', label: 'id', width: 3 },
    { key: 'key', label: 'key', width: 30 },
    { key: 'status', label: 'status', width: 10 },
    { key: 'found', label: 'found', width: 40 },
    { key: 'expected', label: 'expected', width: 30 },
    { key: 'fix_where', label: 'fix_where', width: 40 },
  ]
  const header = columns.map((c) => truncate(c.label, c.width).padEnd(c.width)).join(' | ')
  console.log(header)
  console.log(columns.map((c) => '-'.repeat(c.width)).join('-|-'))
  for (const r of results) {
    console.log(columns.map((c) => truncate(r[c.key], c.width).padEnd(c.width)).join(' | '))
  }
}

function printHelp() {
  console.log(`sm-portal-lock -- PORTAL-LOCK repo-side check runner

Usage:
  sm-portal-lock [--path <checkout>] [--newest-tag <version>] [--json]

Options:
  --path <dir>          Portal checkout to check (default: cwd)
  --newest-tag <ver>    Newest published @sprint-mode/sm-ui tag, for check 2
  --json                Emit machine-readable JSON instead of a table
  --help                Show this message

Exit code is 1 if any repo-side check is a deviation that is not marked
a_warns_only in portal-standard.json; 0 otherwise (pass, exception, unknown,
or a warn-only deviation).

Overrides live at docs/portal-lock/overrides/*.md in the checkout, each with
frontmatter: check, reason, approved_by, approved_on, expires. A valid,
unexpired override turns a deviation into an exception; a missing field or a
past expires date leaves it a deviation.`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }
  const root = resolve(args.path)
  const standard = loadStandard()
  const versionInfo = resolveStandardVersion(standard)
  const results = runChecks(root, standard, { newestTag: args.newestTag })

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          standard_version: versionInfo.runtime,
          standard_version_file: versionInfo.static,
          path: root,
          results,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`PORTAL-LOCK standard v${versionInfo.runtime} -- checking ${root}`)
    printTable(results)
  }

  const failing = results.some((r) => r.status === 'deviation' && !r.a_warns_only)
  process.exit(failing ? 1 : 0)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  main()
}
