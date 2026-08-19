// @sprintmode/ui — Main export barrel
// Components, Layout, Icons, Login, and API helpers

// Components
export {
  Card,
  CardBody,
  Pill,
  Badge,
  Button,
  StatCard,
  Stats,
  Progress,
  Tabs,
  PageHeader,
  Table,
  Empty,
  Spinner,
  ScoreRing,
  Explainer,
  DataTable,
  MultiSelect,
} from './components.tsx'

// Layout shell with session context + view-as system + cmd+k + theme
export { default as Layout, useSession, ViewAsContext, useViewAs, useViewAsTeam, CmdK, useTheme, PortalSwitcher, useDeployRefresh } from './Layout.tsx'
export type { LayoutProps } from './Layout.tsx'

// Login page
export { default as Login } from './Login.tsx'
export type { LoginProps } from './Login.tsx'

// API Documentation page
export { default as ApiDocs } from './ApiDocs.tsx'

// Icons (kept as .jsx — auto-generated SVG, not converted)
export * from './Icons.jsx'

// Client-side API helpers
export {
  getSession as fetchSession,
  clearSession,
  api,
  formatCurrency,
  formatDate,
  formatRelative,
  escapeHtml,
} from './api.ts'

// NOTE: Worker-side auth helpers are at '@sprintmode/ui/auth'
// import { verifyJWT, signJWT, requireAuth, generateToken } from '@sprintmode/ui/auth'

// NOTE: CSS imports are at '@sprintmode/ui/css'
// import '@sprintmode/ui/css'

// NotificationBell (dropdown) removed — replaced by NotificationBellNav (click-to-navigate)
export { NotificationBellNav } from './NotificationBellNav.tsx'
export { ProfileCard } from './ProfileCard.tsx'
export { usePortalConfig, PortalConfigProvider } from './usePortalConfig.tsx'

export { UpdateAttachments } from './UpdateAttachments.tsx'
export { PortalUpdates } from './PortalUpdates.tsx'
export { PortalUpdatesV2 } from './PortalUpdatesV2.tsx'


export { AvatarUpload } from './AvatarUpload.tsx'

export { PortalSupportWidget } from './PortalSupportWidget.tsx'

export { NotificationPrefs } from './NotificationPrefs.tsx'

export { InboxRow } from './InboxRow.tsx'
export type { InboxItem, CategoryPill } from './InboxRow.tsx'

// Account Switcher — pass as userMenuExtra to Layout
export { AccountSwitcher } from './AccountSwitcher.tsx'
export type { AccountSwitcherProps } from './AccountSwitcher.tsx'

// No-access redirect screen — replaces emoji lock pages
export { NoAccessScreen } from './NoAccessScreen.tsx'
export type { NoAccessScreenProps } from './NoAccessScreen.tsx'

// Page-level permission gate — PORTAL-RBAC-SHELLS. Wrap every element-rendering,
// non-user-space routed page. canViewSection/parsePerms are the shared decision
// path (Layout nav, Layout route guard, and PageGate all resolve through them).
export { PageGate, canViewPage, SectionDeniedPanel } from './PageGate.tsx'
export type { PageGateProps } from './PageGate.tsx'
// ROLE-VIEW-CONTRACT-1: admin empty state + role-type helper
export { AdminEmptyState } from './AdminEmptyState.tsx'
export type { AdminEmptyStateProps } from './AdminEmptyState.tsx'
export { getActiveRoleType } from './api.js'
export { canViewSection, parsePerms } from './Layout.tsx'
export type { Permissions } from './Layout.tsx'

// Document detail — universal 5-section document viewer
export { DocumentDetail, TermCards, PipelineBar } from './DocumentDetail.jsx'

// Universal file viewer — PDF, images, Excel, Word with CDN-loaded renderers
export { FileViewer, isViewableFile } from './FileViewer.jsx'

// Proposal viewer — continuous scroll viewer for client portals (studios, mode, signal)
export { ProposalViewer } from './ProposalViewer.tsx'
export type { ProposalViewerProps, ProposalViewerSection, ProposalViewerComment } from './ProposalViewer.tsx'
