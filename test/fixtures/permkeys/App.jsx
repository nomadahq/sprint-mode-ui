// Fixture for bin/sm-portal-permkeys.mjs tests (FEAT-3170 square 1a).
// One covered route (permKey), one exempt built-in route (/auth/login), one
// redirect-only route (<Navigate>), one allowlisted route (needs
// .permkey-allowlist.json), and one route that should FAIL the check.

import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, PageGate } from '@sprint-mode/sm-ui'

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<AuthLoginPage />} />
      <Route path="/old-path" element={<Navigate to="/new-path" />} />
      <Route element={<Layout />}>
        <Route
          path="/dashboard"
          element={
            <PageGate permKey="dashboard.view">
              <Dashboard />
            </PageGate>
          }
        />
        <Route path="/internal-tools" element={<InternalTools />} />
        <Route path="/reports/legacy" element={<LegacyReports />} />
      </Route>
    </Routes>
  )
}
