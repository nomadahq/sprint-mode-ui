import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePortalConfig, PortalConfigProvider } from '../usePortalConfig.tsx'

function Consumer() {
  var ctx = usePortalConfig()
  if (ctx.loading) return <div>loading</div>
  if (ctx.error) return <div>error: {ctx.error}</div>
  if (ctx.config) return <div>config: {ctx.config.name}</div>
  return <div>no config</div>
}

describe('usePortalConfig', function() {
  it('returns loading:true when used outside provider', function() {
    // Outside provider — context is null, hook returns { config: null, loading: true, error: null }
    render(<Consumer />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })
})

describe('PortalConfigProvider', function() {
  beforeEach(function() {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(function() {
    vi.restoreAllMocks()
  })

  it('renders children', function() {
    globalThis.fetch.mockResolvedValue({
      json: function() { return Promise.resolve({ ok: false }) },
    })
    render(
      <PortalConfigProvider subdomain="studios">
        <div>child</div>
      </PortalConfigProvider>
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('sets config on successful fetch', async function() {
    globalThis.fetch.mockResolvedValue({
      json: function() {
        return Promise.resolve({ ok: true, config: { name: 'Studios Portal' } })
      },
    })
    render(
      <PortalConfigProvider subdomain="studios">
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('config: Studios Portal')).toBeInTheDocument()
    })
  })

  it('sets error on failed fetch response', async function() {
    globalThis.fetch.mockResolvedValue({
      json: function() {
        return Promise.resolve({ ok: false, error: 'Not found' })
      },
    })
    render(
      <PortalConfigProvider subdomain="studios">
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('error: Not found')).toBeInTheDocument()
    })
  })

  it('sets error on fetch network failure', async function() {
    globalThis.fetch.mockRejectedValue(new Error('Network error'))
    render(
      <PortalConfigProvider subdomain="studios">
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('error: Network error')).toBeInTheDocument()
    })
  })

  it('skips fetch when no subdomain provided', async function() {
    render(
      <PortalConfigProvider>
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('no config')).toBeInTheDocument()
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  // BUG-2883 regression guard: brand tokens must be applied to :root on every
  // route — including /auth/login — not only inside the authed AppShell.
  it('sets --accent and --accent-10 on documentElement when config has brand fields', async function() {
    globalThis.fetch.mockResolvedValue({
      json: function() {
        return Promise.resolve({
          ok: true,
          config: { name: 'Capital', brand_color: '#1fac6a', brand_tint: '#e8f6f0' },
        })
      },
    })
    render(
      <PortalConfigProvider subdomain="capital">
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('config: Capital')).toBeInTheDocument()
    })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#1fac6a')
    expect(document.documentElement.style.getPropertyValue('--accent-10')).toBe('#e8f6f0')
  })

  it('does not set --accent when config has no brand_color', async function() {
    document.documentElement.style.removeProperty('--accent')
    globalThis.fetch.mockResolvedValue({
      json: function() {
        return Promise.resolve({ ok: true, config: { name: 'NoBrand' } })
      },
    })
    render(
      <PortalConfigProvider subdomain="nobrand">
        <Consumer />
      </PortalConfigProvider>
    )
    await waitFor(function() {
      expect(screen.getByText('config: NoBrand')).toBeInTheDocument()
    })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
  })
})
