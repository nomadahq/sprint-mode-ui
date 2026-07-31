import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BugPanel, parseTaxonomy } from '../BugPanel.tsx'

// GET /api/bugs/taxonomy as sm-api serves it today: both lists flat.
var FLAT = { ok: true, data: { products: ['alpha', 'beta'], subsystems: ['engine', 'shell'] } }
// The per-product shape the panel also accepts, so subsystem options can
// narrow to the selected product without another sm-ui release.
var KEYED = { ok: true, data: { products: ['alpha', 'beta'], subsystems: { alpha: ['engine'], beta: ['shell', 'router'] } } }

var EMPTY_MY_DAY = {
  overdue: [], due_today: [], in_progress_mine: [],
  newly_assigned: [], recent_activity: [], unassigned_on_my_products: [],
}

function makeBug(over) {
  return Object.assign({
    id: 'bug_1', title: 'Rendering falls over', status: 'open',
    product: 'beta', created_at: '2026-07-30T10:00:00Z',
  }, over || {})
}

function mockApi(opts) {
  var o = opts || {}
  return vi.spyOn(globalThis, 'fetch').mockImplementation(function(url) {
    var u = String(url)
    var body
    if (u.indexOf('/api/bugs/taxonomy') !== -1) {
      if (o.taxonomyRejects) return Promise.reject(new Error('network down'))
      body = Object.prototype.hasOwnProperty.call(o, 'taxonomy') ? o.taxonomy : FLAT
    } else if (u.indexOf('/api/bugs/my-day') !== -1) {
      body = { ok: true, data: EMPTY_MY_DAY }
    } else if (u.indexOf('/api/bugs/subsystems') !== -1) {
      body = { ok: true, data: [] }
    } else if (u.indexOf('/api/bugs/assignees') !== -1) {
      body = { ok: true, data: [], reporters: [] }
    } else if (u.indexOf('/api/bugs') !== -1) {
      body = { ok: true, data: o.bugs || [] }
    } else {
      body = { ok: true, data: [] }
    }
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve(body) } })
  })
}

function optionValues(select) {
  return Array.prototype.map.call(select.querySelectorAll('option'), function(o) { return o.value })
}

beforeEach(function() {
  // jsdom ships no matchMedia; the panel reads it for theme + reduced motion.
  window.matchMedia = function() {
    return { matches: false, addEventListener: function() {}, removeEventListener: function() {} }
  }
})

afterEach(function() { vi.restoreAllMocks() })

// ── parseTaxonomy ────────────────────────────────────────────────────────────

describe('parseTaxonomy', function() {
  it('reads products from a flat response', function() {
    expect(parseTaxonomy(FLAT).products).toEqual(['alpha', 'beta'])
  })

  it('serves the flat subsystem list for every product', function() {
    var t = parseTaxonomy(FLAT)
    expect(t.subsystemsFor('alpha')).toEqual(['engine', 'shell'])
    expect(t.subsystemsFor('beta')).toEqual(['engine', 'shell'])
  })

  it('narrows subsystems per product when the response is keyed', function() {
    var t = parseTaxonomy(KEYED)
    expect(t.subsystemsFor('alpha')).toEqual(['engine'])
    expect(t.subsystemsFor('beta')).toEqual(['shell', 'router'])
  })

  it('returns no subsystems for a product missing from a keyed response', function() {
    expect(parseTaxonomy(KEYED).subsystemsFor('gamma')).toEqual([])
  })

  it('accepts a response with no subsystems key', function() {
    var t = parseTaxonomy({ ok: true, data: { products: ['alpha'] } })
    expect(t.products).toEqual(['alpha'])
    expect(t.subsystemsFor('alpha')).toEqual([])
  })

  it('rejects shapes it cannot trust', function() {
    expect(parseTaxonomy(undefined)).toBeNull()
    expect(parseTaxonomy(null)).toBeNull()
    expect(parseTaxonomy('nope')).toBeNull()
    expect(parseTaxonomy({})).toBeNull()
    expect(parseTaxonomy({ ok: true })).toBeNull()
    expect(parseTaxonomy({ ok: true, data: {} })).toBeNull()
    expect(parseTaxonomy({ ok: true, data: { products: 'alpha' } })).toBeNull()
    expect(parseTaxonomy({ ok: true, data: { products: [] } })).toBeNull()
    expect(parseTaxonomy({ ok: true, data: { products: ['alpha', 7] } })).toBeNull()
    expect(parseTaxonomy({ ok: false, error: 'No bugs access' })).toBeNull()
  })

  it('ignores a subsystems value that is neither a list nor a map', function() {
    var t = parseTaxonomy({ ok: true, data: { products: ['alpha'], subsystems: 'engine' } })
    expect(t.products).toEqual(['alpha'])
    expect(t.subsystemsFor('alpha')).toEqual([])
  })
})

// ── product field ────────────────────────────────────────────────────────────

describe('BugPanel product field', function() {
  it('renders a dropdown of the products the taxonomy returned', async function() {
    mockApi({})
    render(<BugPanel standalone visible isAdmin apiBase="" product="alpha" />)
    await userEvent.click(await screen.findByText('+ New item'))

    var select = await screen.findByLabelText('Product')
    expect(select.tagName).toBe('SELECT')
    expect(optionValues(select)).toEqual(['alpha', 'beta'])
  })

  it('carries no product vocabulary of its own', async function() {
    mockApi({})
    render(<BugPanel standalone visible isAdmin apiBase="" product="alpha" />)
    await userEvent.click(await screen.findByText('+ New item'))
    await screen.findByLabelText('Product')

    // 'admin' and 'studios' were in the component's old hardcoded list; with a
    // taxonomy that omits them, nothing may put them back on screen.
    expect(screen.queryByRole('option', { name: 'admin' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'studios' })).toBeNull()
  })

  it('keeps a current value the taxonomy does not list, and can submit it', async function() {
    mockApi({})
    render(<BugPanel standalone visible isAdmin apiBase="" product="offlist_product" />)
    await userEvent.click(await screen.findByText('+ New item'))

    var select = await screen.findByLabelText('Product')
    expect(optionValues(select)).toContain('offlist_product')
    expect(select.value).toBe('offlist_product')
  })

  it('falls back to a text input when the taxonomy fetch fails', async function() {
    mockApi({ taxonomyRejects: true })
    render(<BugPanel standalone visible isAdmin apiBase="" product="alpha" />)
    await userEvent.click(await screen.findByText('+ New item'))

    var field = await screen.findByLabelText('Product')
    expect(field.tagName).toBe('INPUT')
    expect(field.value).toBe('alpha')
  })

  it('falls back to a text input when the taxonomy shape is unexpected', async function() {
    mockApi({ taxonomy: { ok: true, data: { products: 'alpha' } } })
    render(<BugPanel standalone visible isAdmin apiBase="" product="alpha" />)
    await userEvent.click(await screen.findByText('+ New item'))

    var field = await screen.findByLabelText('Product')
    expect(field.tagName).toBe('INPUT')
  })

  it('sends the chosen product when the item is created', async function() {
    var fetchMock = mockApi({})
    render(<BugPanel standalone visible isAdmin apiBase="" product="alpha" />)
    await userEvent.click(await screen.findByText('+ New item'))

    await userEvent.selectOptions(await screen.findByLabelText('Product'), 'beta')
    await userEvent.type(screen.getByPlaceholderText('Bug title'), 'Something broke')
    await userEvent.click(screen.getByText('Submit'))

    await waitFor(function() {
      var posted = fetchMock.mock.calls.find(function(c) {
        return c[1] && c[1].method === 'POST' && String(c[0]).indexOf('/api/bugs') !== -1
      })
      expect(posted).toBeTruthy()
      expect(JSON.parse(posted[1].body).product).toBe('beta')
    })
  })
})

// ── subsystem field ──────────────────────────────────────────────────────────

describe('BugPanel subsystem field', function() {
  async function openCard(opts) {
    mockApi(opts)
    render(<BugPanel standalone visible isAdmin apiBase="" product="beta" />)
    await waitFor(function() { expect(document.querySelector('[data-bug-id="bug_1"]')).toBeTruthy() })
    await userEvent.click(document.querySelector('[data-bug-id="bug_1"]'))
  }

  it('renders a dropdown filtered to the item\'s product', async function() {
    await openCard({ taxonomy: KEYED, bugs: [makeBug({ product: 'beta' })] })

    var select = await screen.findByLabelText('Subsystem')
    expect(select.tagName).toBe('SELECT')
    // beta's list only — 'engine' belongs to alpha.
    expect(optionValues(select)).toEqual(['', 'shell', 'router'])
  })

  it('offers every subsystem when the taxonomy is flat', async function() {
    await openCard({ taxonomy: FLAT, bugs: [makeBug({ product: 'beta' })] })

    var select = await screen.findByLabelText('Subsystem')
    expect(optionValues(select)).toEqual(['', 'engine', 'shell'])
  })

  it('shows an existing off-list value as the selected option', async function() {
    await openCard({ taxonomy: KEYED, bugs: [makeBug({ product: 'beta', subsystem: 'legacy_area' })] })

    var select = await screen.findByLabelText('Subsystem')
    expect(optionValues(select)).toContain('legacy_area')
    expect(select.value).toBe('legacy_area')
  })

  it('keeps an existing on-list value selected', async function() {
    await openCard({ taxonomy: KEYED, bugs: [makeBug({ product: 'beta', subsystem: 'router' })] })

    expect((await screen.findByLabelText('Subsystem')).value).toBe('router')
  })

  it('submits the chosen subsystem', async function() {
    var fetchMock = mockApi({ taxonomy: KEYED, bugs: [makeBug({ product: 'beta' })] })
    render(<BugPanel standalone visible isAdmin apiBase="" product="beta" />)
    await waitFor(function() { expect(document.querySelector('[data-bug-id="bug_1"]')).toBeTruthy() })
    await userEvent.click(document.querySelector('[data-bug-id="bug_1"]'))

    await userEvent.selectOptions(await screen.findByLabelText('Subsystem'), 'router')

    await waitFor(function() {
      var patched = fetchMock.mock.calls.find(function(c) {
        return c[1] && c[1].body && String(c[1].body).indexOf('"subsystem":"router"') !== -1
      })
      expect(patched).toBeTruthy()
    })
  })

  it('falls back to a text input when the taxonomy fetch fails', async function() {
    await openCard({ taxonomyRejects: true, bugs: [makeBug({ subsystem: 'bookkeeper' })] })

    var field = await screen.findByLabelText('Subsystem')
    expect(field.tagName).toBe('INPUT')
    expect(field.value).toBe('bookkeeper')
  })

  it('falls back to a text input rather than an empty dropdown', async function() {
    // Keyed taxonomy that knows nothing about this item's product.
    await openCard({ taxonomy: KEYED, bugs: [makeBug({ product: 'gamma' })] })

    expect((await screen.findByLabelText('Subsystem')).tagName).toBe('INPUT')
  })
})
