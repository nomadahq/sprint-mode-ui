// Fixture for bin/sm-portal-permkeys.mjs tests (FEAT-3170 square 1a).
// Same shape as App.jsx but every non-exempt route declares a permKey --
// used to assert the runner stays green when coverage is complete.

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
        <Route
          path="/internal-tools"
          element={
            <PageGate permKey="internal_tools.view">
              <InternalTools />
            </PageGate>
          }
        />
        <Route
          path="/reports/legacy"
          element={
            <PageGate permKey="reports.legacy">
              <LegacyReports />
            </PageGate>
          }
        />
      </Route>
    </Routes>
  )
}
