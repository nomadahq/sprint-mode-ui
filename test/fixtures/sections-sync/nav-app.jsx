// Fixture for bin/sm-portal-sections-sync.mjs tests (FEAT-3170 square 1a).
// A nav-object list plus a JSX PageGate declaration, matching the two
// extraction shapes the bin supports.

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', permKey: 'dashboard.view' },
  { to: '/billing', label: 'Billing', permKey: 'billing-invoices' },
]

export function App() {
  return (
    <PageGate permKey="settings.advanced">
      <Settings />
    </PageGate>
  )
}
