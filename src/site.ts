// @sprintmode/ui/site -- public marketing-site shell.
// FEAT-2997.
//
// SEPARATE PACKAGE ENTRY on purpose: this barrel and everything it reaches import
// ONLY React. Nothing here touches Layout.tsx, api.ts, auth.ts, or any session
// code, so a marketing site importing from '@sprintmode/ui/site' builds a chunk
// with zero session code (a marketing site must not pull the auth bundle).
//
//   import { SiteHeader, usePageTitle, siteThemeSnippet } from '@sprintmode/ui/site'
//   import '@sprintmode/ui/css'   // design tokens (required for the shell look)

export { SiteHeader, default as SiteHeaderDefault } from './SiteHeader.tsx'
export type { SiteHeaderProps, SiteHeaderNavLink, SiteHeaderConfig } from './SiteHeader.tsx'

export {
  siteThemeSnippet,
  applySiteTheme,
  formatPageTitle,
  setPageTitle,
  usePageTitle,
} from './site-helpers.ts'
