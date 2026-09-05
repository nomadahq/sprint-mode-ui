import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout, Login, PageGate } from '@sprint-mode/sm-ui'

function Dashboard() {
  return <div>Dashboard</div>
}

export function AuthLoginPage() {
  // Check 9: renders sm-ui Login with portal=<slug>; no local login form.
  return <Login productName="Acme Widgets" portal="acme-widgets" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<AuthLoginPage />} />
        <Route element={<Layout />}>
          <Route
            path="/client"
            element={
              <PageGate permKey="dashboard.view">
                <Dashboard />
              </PageGate>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
