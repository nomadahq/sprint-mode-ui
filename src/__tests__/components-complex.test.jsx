import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  Tabs, PageHeader, Table, ScoreRing, Explainer,
} from '../components.tsx'

// ── Tabs ──────────────────────────────────────────────────────────────────────

describe('Tabs', function() {
  var tabs = [
    { key: 'a', label: 'Alpha' },
    { key: 'b', label: 'Beta' },
    { key: 'c', label: 'Gamma' },
  ]

  it('renders all tab labels', function() {
    render(<Tabs tabs={tabs} active="a" onChange={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('marks active tab with active class', function() {
    render(<Tabs tabs={tabs} active="b" onChange={vi.fn()} />)
    var buttons = screen.getAllByRole('tab')
    expect(buttons[1]).toHaveClass('active')
    expect(buttons[0]).not.toHaveClass('active')
  })

  it('calls onChange with correct key on click', async function() {
    var fn = vi.fn()
    render(<Tabs tabs={tabs} active="a" onChange={fn} />)
    await userEvent.click(screen.getByText('Beta'))
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('exposes tab semantics and selected state', function() {
    render(<Tabs tabs={tabs} active="a" onChange={vi.fn()} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('type', 'button')
  })

  it('uses roving focus and keyboard navigation', async function() {
    var fn = vi.fn()
    render(<Tabs tabs={tabs} active="a" onChange={fn} />)
    var alpha = screen.getByRole('tab', { name: 'Alpha' })
    var beta = screen.getByRole('tab', { name: 'Beta' })
    var gamma = screen.getByRole('tab', { name: 'Gamma' })
    expect(alpha).toHaveAttribute('tabindex', '0')
    expect(beta).toHaveAttribute('tabindex', '-1')
    alpha.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(beta).toHaveFocus()
    expect(fn).toHaveBeenLastCalledWith('b')
    await userEvent.keyboard('{End}')
    expect(gamma).toHaveFocus()
    expect(fn).toHaveBeenLastCalledWith('c')
  })
})

// ── PageHeader ────────────────────────────────────────────────────────────────

describe('PageHeader', function() {
  it('renders title', function() {
    render(<PageHeader title="My Page" />)
    expect(screen.getByText('My Page')).toBeInTheDocument()
  })

  it('renders subtitle when provided', function() {
    render(<PageHeader title="T" subtitle="A subtitle" />)
    expect(screen.getByText('A subtitle')).toBeInTheDocument()
  })

  it('renders breadcrumb when provided', function() {
    render(<PageHeader title="T" breadcrumb="Clients" />)
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('renders breadcrumbProduct with separator', function() {
    const { container } = render(<PageHeader title="T" breadcrumb="Sub" breadcrumbProduct="Studios" />)
    expect(screen.getByText('Studios')).toBeInTheDocument()
    // separator is a text node between elements — check container text includes it
    var bc = container.querySelector('.sm-bc')
    expect(bc.textContent).toContain(' / ')
  })

  it('renders children (action slot)', function() {
    render(<PageHeader title="T"><button>Action</button></PageHeader>)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})

// ── Table ─────────────────────────────────────────────────────────────────────

describe('Table', function() {
  var headers = ['Name', 'Status']
  var rows = [
    { key: '1', cells: ['Alice', 'Active'] },
    { key: '2', cells: ['Bob', 'Inactive'] },
  ]

  it('renders all header cells', function() {
    render(<Table headers={headers} rows={rows} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders all data cells', function() {
    render(<Table headers={headers} rows={rows} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows Empty when rows is empty', function() {
    render(<Table headers={headers} rows={[]} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('shows custom empty element when rows is empty', function() {
    render(<Table headers={headers} rows={[]} empty={<div>Custom empty</div>} />)
    expect(screen.getByText('Custom empty')).toBeInTheDocument()
  })

  it('fires onRowClick with row data', async function() {
    var fn = vi.fn()
    render(<Table headers={headers} rows={rows} onRowClick={fn} />)
    await userEvent.click(screen.getByText('Alice'))
    expect(fn).toHaveBeenCalledWith(rows[0], 0)
  })

  it('renders sortable headers when headers are objects', function() {
    var objHeaders = [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]
    render(<Table headers={objHeaders} rows={rows} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('sorts rows ascending on header click', async function() {
    var objHeaders = [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]
    var sortRows = [
      { key: '1', cells: ['Zara', 'Active'] },
      { key: '2', cells: ['Aaron', 'Inactive'] },
    ]
    render(<Table headers={objHeaders} rows={sortRows} />)
    var cells = screen.getAllByRole('cell')
    // before sort: Zara first
    expect(cells[0].textContent).toBe('Zara')
    await userEvent.click(screen.getByText('Name'))
    var cellsAfter = screen.getAllByRole('cell')
    // after asc sort: Aaron first
    expect(cellsAfter[0].textContent).toBe('Aaron')
  })
})

// ── ScoreRing ─────────────────────────────────────────────────────────────────

describe('ScoreRing', function() {
  it('renders score number', function() {
    render(<ScoreRing score={82} />)
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('renders default label when not provided', function() {
    render(<ScoreRing score={50} />)
    expect(screen.getByText('Score')).toBeInTheDocument()
  })

  it('renders custom label', function() {
    render(<ScoreRing score={50} label="Health" />)
    expect(screen.getByText('Health')).toBeInTheDocument()
  })

  it('renders 0 when score is not provided', function() {
    render(<ScoreRing />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

// ── Explainer ─────────────────────────────────────────────────────────────────

describe('Explainer', function() {
  it('renders the trigger button', function() {
    render(<Explainer title="Help"><p>content</p></Explainer>)
    expect(screen.getByRole('button', { name: /show guide/i })).toBeInTheDocument()
  })

  it('drawer content is not visible initially', function() {
    render(<Explainer title="Help"><p>Hidden content</p></Explainer>)
    // The backdrop exists in DOM but not "open" — content is not displayed to user
    const backdrop = document.querySelector('.sm-explainer-backdrop')
    expect(backdrop).not.toHaveClass('sm-explainer-open')
  })

  it('opens drawer on trigger click', async function() {
    render(<Explainer title="Help"><p>Drawer content</p></Explainer>)
    await userEvent.click(screen.getByRole('button', { name: /show guide/i }))
    const backdrop = document.querySelector('.sm-explainer-backdrop')
    expect(backdrop).toHaveClass('sm-explainer-open')
  })

  it('closes drawer on close button click', async function() {
    render(<Explainer title="Help"><p>content</p></Explainer>)
    await userEvent.click(screen.getByRole('button', { name: /show guide/i }))
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    const backdrop = document.querySelector('.sm-explainer-backdrop')
    expect(backdrop).not.toHaveClass('sm-explainer-open')
  })

  it('renders children content in drawer', async function() {
    render(<Explainer title="Help"><p>My drawer content</p></Explainer>)
    await userEvent.click(screen.getByRole('button', { name: /show guide/i }))
    expect(screen.getByText('My drawer content')).toBeInTheDocument()
  })

  it('renders title in drawer header', async function() {
    render(<Explainer title="My Title"><p>x</p></Explainer>)
    await userEvent.click(screen.getByRole('button', { name: /show guide/i }))
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })
})
