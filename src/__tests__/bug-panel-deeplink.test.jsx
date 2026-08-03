import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BugPanel } from '../BugPanel.tsx'

// WAFFLE-FIX-1B (BUG-1151): deep-link focus must surface an item that is NOT
// in the default list slice (e.g. status fixed while the queue shows open).
// These reproduce Aaron's CiC failures 4R/5R before fixing them.

var EMPTY_MY_DAY = {
  overdue: [], due_today: [], in_progress_mine: [],
  newly_assigned: [], recent_activity: [], unassigned_on_my_products: [],
}

var QUEUE = [
  { id: 'bug_row1', title: 'Newest queue row', status: 'open', product: 'waffle', created_at: '2026-08-01T10:00:00Z' },
  { id: 'bug_row2', title: 'Second queue row', status: 'open', product: 'waffle', created_at: '2026-07-31T10:00:00Z' },
]

var OFFLIST = {
  id: 'bug_offlist', display_number: 1151, type: 'bug', display_id: 'BUG-1151',
  title: 'Cmd+K search finds items but clicking a result does not open it',
  status: 'fixed', product: 'waffle', created_at: '2026-07-20T10:00:00Z',
}

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(function(url) {
    var u = String(url)
    var body
    if (u.indexOf('/api/bugs/taxonomy') !== -1) {
      body = { ok: true, data: { products: ['waffle'], subsystems: ['shell'] } }
    } else if (u.indexOf('/api/bugs/my-day') !== -1) {
      body = { ok: true, data: EMPTY_MY_DAY }
    } else if (u.indexOf('/api/bugs/subsystems') !== -1) {
      body = { ok: true, data: [] }
    } else if (u.indexOf('/api/bugs/assignees') !== -1) {
      body = { ok: true, data: [], reporters: [] }
    } else if (u.indexOf('/api/bugs/squares') !== -1) {
      body = { ok: true, data: [{ id: 'sq_a', name: 'Alpha Square' }] }
    } else if (u.indexOf('/api/bugs/tags') !== -1) {
      body = { ok: true, data: ['flaky'] }
    } else if (u.indexOf('/api/bugs/bug_offlist') !== -1) {
      // Single-item detail fetch — the ensure path
      body = { ok: true, data: OFFLIST }
    } else if (u.indexOf('/api/bugs?') !== -1) {
      body = { ok: true, data: QUEUE, total: QUEUE.length }
    } else {
      body = { ok: true, data: [] }
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve(body) } })
  })
}

beforeEach(function() {
  window.matchMedia = function() {
    return { matches: false, addEventListener: function() {}, removeEventListener: function() {} }
  }
  window.history.replaceState({}, '', '/')
})

afterEach(function() { vi.restoreAllMocks() })

describe('deep-link focus (BUG-1151)', function() {
  it('surfaces an off-list item when focusBugId is set at mount (legacy ?bug= path)', async function() {
    mockApi()
    render(
      <BugPanel standalone visible isAdmin apiBase="" product="waffle" focusBugId="bug_offlist" />,
    )
    await waitFor(function() {
      expect(screen.getAllByText(/Cmd\+K search finds items/).length).toBeGreaterThan(0)
    }, { timeout: 4000 })
  })

  it('surfaces an off-list item when focusBugId arrives after mount (Cmd+K path)', async function() {
    mockApi()
    var view = render(
      <BugPanel standalone visible isAdmin apiBase="" product="waffle" focusBugId={null} />,
    )
    // The queue settles first
    await waitFor(function() {
      expect(screen.getAllByText('Newest queue row').length).toBeGreaterThan(0)
    }, { timeout: 4000 })
    // Then the palette navigation resolves the display key to the id
    view.rerender(
      <BugPanel standalone visible isAdmin apiBase="" product="waffle" focusBugId="bug_offlist" />,
    )
    await waitFor(function() {
      expect(screen.getAllByText(/Cmd\+K search finds items/).length).toBeGreaterThan(0)
    }, { timeout: 4000 })
  })
})

describe('?square= URL init (checkpoint 6)', function() {
  it('renders the board when the URL carries ?square=', async function() {
    mockApi()
    window.history.replaceState({}, '', '/?square=sq_a')
    render(<BugPanel standalone visible isAdmin apiBase="" product="waffle" />)
    await waitFor(function() {
      expect(screen.getAllByText('Newest queue row').length).toBeGreaterThan(0)
    }, { timeout: 4000 })
  })
})
