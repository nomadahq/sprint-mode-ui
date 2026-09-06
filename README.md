# @sprintmode/ui

Shared platform package for all Sprint Mode products. React components, CSS design tokens, worker auth helpers, and a login page with SSO + magic link.

## Install

```bash
npm install @sprintmode/ui --registry=https://npm.pkg.github.com
```

## Usage

### Components

```javascript
import { Layout, Card, CardBody, Button, StatCard, Stats, Tabs, PageHeader, Table, Badge, Pill, Progress, Empty, Spinner, ScoreRing } from '@sprintmode/ui'
```

### CSS

Import all three CSS files in your entry point:

```javascript
import '@sprintmode/ui/css'              // Design tokens, reset, variables
import '@sprintmode/ui/css/shell'        // Sidebar, layout, mobile
import '@sprintmode/ui/css/components'   // Card, button, table, etc.
```

### Icons

```javascript
import { IconCode, IconUsers, IconDollar, LogoStudios, ProductIcon } from '@sprintmode/ui'

// System icon
<IconCode width={20} height={20} />

// Product logo
<LogoStudios />

// Tinted product badge
<ProductIcon product="studios" size={40} />
```

### Layout Shell

```javascript
import { Layout } from '@sprintmode/ui'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Layout reads session from /api/auth/me, renders sidebar from session.products
<BrowserRouter>
  <Routes>
    <Route element={<Layout />}>
      <Route path="/client" element={<Dashboard />} />
    </Route>
  </Routes>
</BrowserRouter>
```

Extend sidebar nav by passing `navConfig`:

```javascript
<Layout navConfig={{
  myproduct: {
    label: 'My Product',
    items: [
      { to: '/client/myproduct', label: 'Home', icon: 'grid', exact: true },
      { to: '/client/myproduct/settings', label: 'Settings', icon: 'gear' },
    ]
  }
}} />
```

### One door shape

TASK-3229 (D2 ruling): on every host the browser should reach the spine only
through the portal's own `/api` proxy, never `api.sprintmode.ai` directly.
`Layout`, `Login`, and `PortalConfigProvider` are opt-in and default-preserving
for this: pass no new prop and a portal keeps the v1.2.3 direct-to-sm-api
behavior. A portal that has its own proxy passes three props:

```javascript
<Login authBase="/api" ... />
<Layout authBase="/api" apiBase="" ... />
<PortalConfigProvider apiBase="" ... />
```

- `authBase` — the prefix in front of the spine's `/auth/*` routes (for
  example `/api` on a portal whose proxy maps `/api/auth/*` to `/auth/*`).
  `Layout` threads it to the user-menu identity reads (`AccountSwitcher`) and
  uses it as the view-as base when `viewAsAuthBase` is not set.
- `apiBase` — the prefix in front of `/api/*` routes. `""` means the portal's
  own origin (proxy). `Layout` threads it to the linked-accounts read;
  `PortalConfigProvider` uses it for the portal-config read.

### Login Page

```javascript
import { Login } from '@sprintmode/ui'

// Renders Google SSO + Microsoft SSO + magic link fallback
<Login productName="Mode" logoSrc="/logo-mode-horizontal.png" />
```

### Marketing-site header (SiteHeader)

`SiteHeader` is the Portal Manager shell for **logged-out public marketing
sites** (sm-capital, sm-website). Import it from the `/site` entry so your bundle
gets a chunk with **no session code** — a marketing site must not pull the auth
bundle. Everything but the props resolves from `portal_configs` through the
public portal config endpoint, keyed on the `subdomain`.

```jsx
import { SiteHeader, usePageTitle } from '@sprintmode/ui/site'
import '@sprintmode/ui/css'   // design tokens (required for the shell look)

function App() {
  usePageTitle('Methodology', 'Capital')   // sets "Methodology — Capital"
  return (
    <SiteHeader
      subdomain="capital"                          // resolves name, brand, logo
      navLinks={[
        { label: 'Methodology', href: '/methodology' },
        { label: 'Alpha', href: '/alpha' },
        { label: 'Terms', href: '/terms' },
      ]}
      signInHref="https://capital.sprintmode.ai"
    />
  )
}
```

The theme pill (Auto/Light/Dark) uses the **same `sm-theme` storage key and
`data-theme` convention as `useTheme`**, so a theme chosen on the marketing site
is honored on the portal and back.

**No-FOUC snippet** — inline the resolved theme before first paint, in `<head>`
BEFORE any stylesheet. `siteThemeSnippet` is the exact script string:

```jsx
import { siteThemeSnippet } from '@sprintmode/ui/site'
<script dangerouslySetInnerHTML={{ __html: siteThemeSnippet }} />
```

Plain HTML (Vite `index.html`):

```html
<head>
  <script>(function(){try{var t=localStorage.getItem('sm-theme');var d=(t==='dark'||t==='light')?t:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',d);}catch(e){}})();</script>
  <!-- stylesheets after the snippet -->
</head>
```

For an SSR/prerender entry that cannot inline a script, call `applySiteTheme()`.

### Worker Auth Helpers

For Cloudflare Workers (server-side only):

```javascript
import { verifyJWT, signJWT, requireAuth, generateToken, generateId } from '@sprintmode/ui/auth'

// In a Worker fetch handler:
var session = await requireAuth(request, env)
if (!session) return new Response('Unauthorized', { status: 401 })
```

### Product Theming

Override `--accent` in your CSS to theme all components:

```css
:root {
  --accent:       #f4930a;      /* Mode orange */
  --accent-hover: #d97f06;
  --accent-10:    rgba(244, 147, 10, 0.1);
  --accent-20:    rgba(244, 147, 10, 0.2);
  --accent-tint:  #fdf4e6;
}
```

## Portal standard and sm-portal-lock

`portal-standard.json` (exported as `@sprint-mode/sm-ui/portal-standard`) is the
executable PORTAL-LOCK standard for the fleet (FEAT-3170 section G, checks 1-29):
required sm-ui exports, the known `data-product` slugs, required files, the
`npm ci` workflow rule, required `portal_configs` fields, deploy shape, public-route
behavior, the `/auth/me` shape, and the 29 approved checks themselves (id, key,
title, gates, source, and whether a deviation only warns under Autopilot).
`portal-standard.schema.json` describes its shape.

`sm-portal-lock` (the package's one bin) runs the **repo-side** checks -- the
ones whose `source` is `repo` -- against a portal checkout. The production-side
checks (Cloudflare Pages, D1, R2, a live production fetch) are out of scope for
this bin; they run elsewhere and read the same standard file.

### Usage

```bash
npx sm-portal-lock --path /path/to/portal-checkout
npx sm-portal-lock --path . --newest-tag 1.3.0   # also runs check 2
npx sm-portal-lock --json                        # machine-readable output
```

Each check reports one of `pass`, `deviation`, `exception`, or `unknown`, with
`found`, `expected`, and `fix_where`. Check 2 (the sm-ui pin against the newest
published tag) reports `unknown` unless `--newest-tag` is given.

### Exit codes

`sm-portal-lock` exits `1` if any check is a `deviation` that is **not** marked
`a_warns_only` in `portal-standard.json` (checks 2, 14 and 29, per the approved
lines). It exits `0` otherwise: every check passed, or the only deviations left
are warn-only, exceptions, or unknown.

### Overrides

A deviation can be waived with a dated, approved override file under
`docs/portal-lock/overrides/` in the checked-out portal repo, named for the
check and the date, with YAML-ish frontmatter:

```markdown
---
check: sm-ui-pin-matches-newest-tag
reason: pinned pending a security review of 1.3.0
approved_by: Aaron Hall
approved_on: 2026-09-01
expires: 2026-12-01
---

Free-form notes on why this is temporary and how it gets resolved.
```

`check` names the check's `key` (kebab-case, from `portal-standard.json`). All
five frontmatter fields -- `check`, `reason`, `approved_by`, `approved_on`,
`expires` -- are required. A valid, unexpired override turns that check's
`deviation` into an `exception`. A missing field or a past `expires` date
leaves the check a `deviation` -- the override is ignored, not silently trusted.

## Per-portal worker runtime

`@sprint-mode/sm-ui/runtime` ships the per-portal Cloudflare Pages Functions
worker as one framework artifact (FEAT-3170 square 1a): the app page gate and
the API passthrough that every portal repo previously carried as its own
copy of `functions/_middleware.js` and `functions/api/[[catchall]].js`. A
portal imports these instead of hand-rolling them; a framework fix reaches
every portal through an sm-ui version bump instead of a per-repo patch.
Plain ESM JavaScript -- no React, no sm-ui component imports -- so it runs
unchanged in the Cloudflare Pages Functions / Workers runtime.

```javascript
// functions/_middleware.js
import { createAppGate } from '@sprint-mode/sm-ui/runtime'
export const onRequest = createAppGate()
```

```javascript
// functions/api/[[catchall]].js
import portal from '../../portal.json'
import { createApiProxy } from '@sprint-mode/sm-ui/runtime'
export const onRequest = createApiProxy(portal)
```

`createAppGate(options)` redirects an unauthenticated request for the app
prefix (default `/app`, `/app/*`) to the login path (default `/auth/login`),
reading the session from `meApiPath` (default `/api/auth/me`) through the
portal's own `/api` proxy -- never sm-api directly, or the request loses the
`X-SM-Product` / `X-SM-Platform` headers sm-api needs to resolve the session.
A gate-check failure (network error, malformed response) fails closed:
treated as unauthenticated, never as authenticated.

`createApiProxy(portal)` proxies `/api/*` to the sm-api spine (`SM_API_URL`
env var, default `https://api.sprintmode.ai`), stripping the `/api` prefix
for `/api/auth/*` routes, setting `X-SM-Product` / `X-SM-Platform` from
`portal.slug`, forwarding `CF-Access-Client-Id` / `CF-Access-Client-Secret`
from env when present, answering `OPTIONS` preflight itself, passing 3xx
responses through untouched, and returning a `502` JSON error if the
upstream fetch fails.

## Portal sections sync and permKey coverage bins

Two more bins port the sm-signal-lineage scripts (previously copied
byte-for-byte into sm-signal, sm-waffle, switchpoint-dash, the sm-portal
template, and the sm-api scaffold generator) into this package, so a portal
repo calls the shared bin instead of carrying its own copy:

```bash
npx sm-portal-permkeys --app pages/app/+Page.tsx
npx sm-portal-sections-sync --portal <slug> --app pages/app/+Page.tsx
```

`sm-portal-permkeys` fails the build (exit `1`) when a routed,
element-rendering, non-user-space page has no `permKey` declaration --
built-in exemptions (auth, user-space, legal, onboarding, catchalls,
`<Navigate>` redirects) plus a repo-local `.permkey-allowlist.json` (an array
of exact paths or `"prefix/*"` patterns) cover the rest. Accepts multiple
`--app <file>` flags.

`sm-portal-sections-sync` extracts `permKey` declarations (nav-object
`permKey: '...'` entries and JSX `permKey="..."` attributes) from the app
file and `POST`s them to `/api/admin/portals/:subdomain/sections/sync` with
`X-SM-Key` auth, printing the added/updated/unchanged/orphaned diff. Flags
`--portal`, `--app`, `--api`, `--key` fall back to `PORTAL_SUBDOMAIN`,
`PORTAL_APP_FILE`, `SM_API_URL`, `SM_API_KEY` respectively. It exits `0`
always -- a sync failure never blocks portal CI -- except when a required
flag (or env fallback) is missing, or the app file does not exist.

## Architecture

This package is the frontend contract of the SM platform. Products import it — they never rebuild components, auth, or design tokens. See `_jockey/SM_PLATFORM_PRINCIPLES.md`.
