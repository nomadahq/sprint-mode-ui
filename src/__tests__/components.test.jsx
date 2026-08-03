import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  Card, CardBody, Pill, Badge, Button,
  StatCard, Stats, Progress, Empty, Spinner,
} from '../components.tsx'

// ── Card ─────────────────────────────────────────────────────────────────────

describe('Card', function() {
  it('renders children', function() {
    render(<Card>Hello card</Card>)
    expect(screen.getByText('Hello card')).toBeInTheDocument()
  })

  it('applies sm-card class', function() {
    const { container } = render(<Card>x</Card>)
    expect(container.firstChild).toHaveClass('sm-card')
  })

  it('merges extra className', function() {
    const { container } = render(<Card className="extra">x</Card>)
    expect(container.firstChild).toHaveClass('sm-card', 'extra')
  })

  it('applies accent border style', function() {
    const { container } = render(<Card accent="#ff0000">x</Card>)
    expect(container.firstChild.style.borderColor).toBe('rgb(255, 0, 0)')
  })

  it('forwards native attributes and its ref to the card element', function() {
    var ref = createRef()
    render(<Card ref={ref} aria-label="Project summary" data-testid="card">x</Card>)
    var card = screen.getByLabelText('Project summary')
    expect(card).toHaveAttribute('data-testid', 'card')
    expect(ref.current).toBe(card)
  })
})

// ── CardBody ─────────────────────────────────────────────────────────────────

describe('CardBody', function() {
  it('renders children', function() {
    render(<CardBody>body content</CardBody>)
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('applies sm-card-body class', function() {
    const { container } = render(<CardBody>x</CardBody>)
    expect(container.firstChild).toHaveClass('sm-card-body')
  })

  it('merges className and forwards native attributes', function() {
    var ref = createRef()
    render(<CardBody ref={ref} className="summary-body" data-testid="body">x</CardBody>)
    var body = screen.getByTestId('body')
    expect(body).toHaveClass('sm-card-body', 'summary-body')
    expect(ref.current).toBe(body)
  })
})

// ── Pill ─────────────────────────────────────────────────────────────────────

describe('Pill', function() {
  it('renders children', function() {
    render(<Pill>Active</Pill>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('defaults to gray color class', function() {
    const { container } = render(<Pill>x</Pill>)
    expect(container.firstChild).toHaveClass('sm-pill-gray')
  })

  it('applies given color class', function() {
    const { container } = render(<Pill color="green">x</Pill>)
    expect(container.firstChild).toHaveClass('sm-pill-green')
  })

  it('merges className and forwards native attributes', function() {
    var ref = createRef()
    render(<Pill ref={ref} className="source-pill" title="Source status">Live</Pill>)
    var pill = screen.getByTitle('Source status')
    expect(pill).toHaveClass('sm-pill', 'source-pill')
    expect(ref.current).toBe(pill)
  })
})

// ── Badge ─────────────────────────────────────────────────────────────────────

describe('Badge', function() {
  it('renders children', function() {
    render(<Badge>3</Badge>)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('defaults to gray color class', function() {
    const { container } = render(<Badge>x</Badge>)
    expect(container.firstChild).toHaveClass('sm-badge-gray')
  })

  it('applies given color class', function() {
    const { container } = render(<Badge color="red">x</Badge>)
    expect(container.firstChild).toHaveClass('sm-badge-red')
  })

  it('merges className and forwards native attributes', function() {
    var ref = createRef()
    render(<Badge ref={ref} className="count-badge" aria-label="Three unread">3</Badge>)
    var badge = screen.getByLabelText('Three unread')
    expect(badge).toHaveClass('sm-badge', 'count-badge')
    expect(ref.current).toBe(badge)
  })
})

// ── Button ───────────────────────────────────────────────────────────────────

describe('Button', function() {
  it('renders children', function() {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('defaults to secondary variant', function() {
    const { container } = render(<Button>x</Button>)
    expect(container.firstChild).toHaveClass('sm-btn-secondary')
  })

  it('applies primary variant', function() {
    const { container } = render(<Button variant="primary">x</Button>)
    expect(container.firstChild).toHaveClass('sm-btn-primary')
  })

  it('applies danger variant', function() {
    const { container } = render(<Button variant="danger">x</Button>)
    expect(container.firstChild).toHaveClass('sm-btn-danger')
  })

  it('applies sm size class', function() {
    const { container } = render(<Button size="sm">x</Button>)
    expect(container.firstChild).toHaveClass('sm-btn-sm')
  })

  it('applies lg size class', function() {
    const { container } = render(<Button size="lg">x</Button>)
    expect(container.firstChild).toHaveClass('sm-btn-lg')
  })

  it('fires onClick', async function() {
    const fn = vi.fn()
    render(<Button onClick={fn}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('renders an anchor when href is given', function() {
    render(<Button href="/foo">Link</Button>)
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', '/foo')
  })

  it('is disabled when disabled prop is set', function() {
    render(<Button disabled>x</Button>)
    expect(screen.getByRole('button', { name: 'x' })).toBeDisabled()
  })

  it('forwards native props, className, and ref to a button', function() {
    var ref = createRef()
    render(
      <Button ref={ref} className="hub-action" aria-label="Create space" data-testid="action">
        Create
      </Button>,
    )
    var button = screen.getByRole('button', { name: 'Create space' })
    expect(button).toHaveClass('sm-btn', 'hub-action')
    expect(button).toHaveAttribute('data-testid', 'action')
    expect(ref.current).toBe(button)
  })

  it('forwards anchor attributes when href is given', function() {
    var ref = createRef()
    render(<Button ref={ref} href="/spaces" target="_blank" rel="noreferrer" aria-label="Open spaces">Spaces</Button>)
    var link = screen.getByRole('link', { name: 'Open spaces' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
    expect(ref.current).toBe(link)
  })

  it('renders an empty href as an anchor and forwards its anchor ref', function() {
    var ref = createRef()
    render(<Button ref={ref} href="">Current page</Button>)
    var link = screen.getByText('Current page')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '')
    expect(ref.current).toBe(link)
  })
})

// ── StatCard ─────────────────────────────────────────────────────────────────

describe('StatCard', function() {
  it('renders label and value', function() {
    render(<StatCard label="Revenue" value="$1,200" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })

  it('renders sub text when provided', function() {
    render(<StatCard label="x" value="0" sub="vs last month" />)
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('does not render sub element when omitted', function() {
    const { container } = render(<StatCard label="x" value="0" />)
    expect(container.querySelector('.sm-stat-sub')).toBeNull()
  })
})

// ── Stats ────────────────────────────────────────────────────────────────────

describe('Stats', function() {
  it('renders children inside sm-stats container', function() {
    const { container } = render(<Stats><span>child</span></Stats>)
    expect(container.firstChild).toHaveClass('sm-stats')
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})

// ── Progress ─────────────────────────────────────────────────────────────────

describe('Progress', function() {
  it('renders progress fill with correct width', function() {
    const { container } = render(<Progress value={75} />)
    const fill = container.querySelector('.sm-progress-fill')
    expect(fill).toBeInTheDocument()
    expect(fill.style.width).toBe('75%')
  })

  it('defaults value to 0 when not provided', function() {
    const { container } = render(<Progress />)
    const fill = container.querySelector('.sm-progress-fill')
    expect(fill.style.width).toBe('0%')
  })
})

// ── Empty ────────────────────────────────────────────────────────────────────

describe('Empty', function() {
  it('renders title and message', function() {
    render(<Empty title="Nothing here" message="Add something to get started." />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument()
  })

  it('renders without crashing when no props', function() {
    const { container } = render(<Empty />)
    expect(container.firstChild).toHaveClass('sm-empty')
  })
})

// ── Spinner ───────────────────────────────────────────────────────────────────

describe('Spinner', function() {
  it('renders without crashing', function() {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.spinner')).toBeInTheDocument()
  })

  it('renders a compact labelled status at the requested size', function() {
    render(<Spinner size={16} label="Loading threads" inline />)
    var status = screen.getByRole('status', { name: 'Loading threads' })
    expect(status).toHaveClass('sm-spinner-wrap', 'sm-spinner-wrap-inline')
    expect(status.querySelector('.spinner')).toHaveStyle({ width: '16px', height: '16px' })
  })
})
