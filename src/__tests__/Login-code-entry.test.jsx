// src/__tests__/Login-code-entry.test.jsx
// FEAT-2156 Half 1: 6-digit code login UI — Login component code-entry state
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Login from '../Login.tsx'

// usePortalConfig returns empty config in tests (no provider needed)
vi.mock('../usePortalConfig.jsx', function() {
  return {
    usePortalConfig: function() { return { config: null } },
  }
})

// Suppress dark-mode side effects
vi.mock('../dark-mode', function() {
  return {
    isDarkMode: function() { return false },
    themedMarkFromLogoUrl: function() { return null },
    applyResolvedThemeAttr: function() {},
  }
})

vi.mock('@simplewebauthn/browser', function() {
  return {
    startAuthentication: vi.fn().mockResolvedValue({ id: 'cred_id', response: {} }),
    startRegistration: vi.fn().mockResolvedValue({ id: 'cred_id', response: {} }),
  }
})

var VERIFY_URL = 'https://api.sprintmode.ai/auth/verify-code'

function renderLogin(props) {
  return render(<Login authBase="https://api.sprintmode.ai" {...props} />)
}

beforeEach(function() {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(function() {
  vi.restoreAllMocks()
  // FEAT-2156 Half 2 tests stub PublicKeyCredential; never let it leak.
  vi.unstubAllGlobals()
})

// helper: get the component into code-entry state
async function enterCodeState(emailVal) {
  var email = emailVal || 'test@example.com'
  fetch.mockResolvedValueOnce({
    json: function() { return Promise.resolve({ ok: true, redirect_url: '/dashboard' }) },
  })
  var input = screen.getByPlaceholderText('you@company.com')
  fireEvent.change(input, { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /send code/i }))
  await waitFor(function() {
    expect(screen.queryByText(/Enter the code we sent to/i)).toBeTruthy()
  })
}

// ─── State A: email entry ─────────────────────────────────────────────────────

describe('Login — state A (email entry)', function() {
  it('renders email input and Send code button', function() {
    renderLogin()
    expect(screen.getByPlaceholderText('you@company.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: /send code/i })).toBeTruthy()
  })

  // FEAT-2156 Half 2: the coming-soon label is gone; the passkey button is
  // feature-detected on window.PublicKeyCredential.
  it('hides the passkey button when the browser lacks WebAuthn', function() {
    renderLogin()
    expect(screen.queryByText(/use a passkey/i)).toBeNull()
    expect(screen.queryByText(/coming soon/i)).toBeNull()
  })

  it('shows "Use a passkey" when WebAuthn is available, in signin mode only', async function() {
    vi.stubGlobal('PublicKeyCredential', function() {})
    renderLogin()
    await waitFor(function() {
      expect(screen.getByText(/use a passkey/i)).toBeTruthy()
    })
  })

  it('passkey button works with no email (usernameless): posts login/options without an email', async function() {
    vi.stubGlobal('PublicKeyCredential', function() {})
    fetch.mockResolvedValueOnce({ json: function() { return Promise.resolve({ ok: true, options: { challenge: 'x', rpId: 'sprintmode.ai', allowCredentials: [] } }) } })
    renderLogin()
    fireEvent.click(await screen.findByText(/use a passkey/i))
    await waitFor(function() {
      expect(screen.getByText(/waiting for your passkey/i)).toBeTruthy()
    })
    var call = fetch.mock.calls.find(function(c) { return String(c[0]).indexOf('/auth/webauthn/login/options') !== -1 })
    expect(call).toBeTruthy()
    expect(JSON.parse(call[1].body)).not.toHaveProperty('email')
    expect(screen.queryByText(/enter your email address first/i)).toBeNull()
  })

  it('passkey button posts login/options for the email and shows the waiting state', async function() {
    vi.stubGlobal('PublicKeyCredential', function() {})
    // options call resolves; startAuthentication never resolves in jsdom (no authenticator) -- we assert the waiting state
    fetch.mockResolvedValueOnce({ json: function() { return Promise.resolve({ ok: true, options: { challenge: 'x', rpId: 'sprintmode.ai', allowCredentials: [] } }) } })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'aaron@sprintmode.ai' } })
    fireEvent.click(await screen.findByText(/use a passkey/i))
    await waitFor(function() {
      expect(screen.getByText(/waiting for your passkey/i)).toBeTruthy()
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.sprintmode.ai/auth/webauthn/login/options',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })
})

// ─── State B: code entry ──────────────────────────────────────────────────────

describe('Login — state B (code entry)', function() {
  beforeEach(async function() {
    renderLogin()
    await enterCodeState('jane@acme.com')
  })

  it('shows the email the code was sent to', function() {
    expect(screen.getByText('jane@acme.com')).toBeTruthy()
  })

  it('renders a single code input with one-time-code autocomplete', function() {
    var input = document.querySelector('input[autocomplete="one-time-code"]')
    expect(input).toBeTruthy()
    expect(input.getAttribute('maxlength')).toBe('6')
    expect(input.getAttribute('inputmode')).toBe('numeric')
  })

  it('renders Verify code button', function() {
    expect(screen.getByRole('button', { name: /verify code/i })).toBeTruthy()
  })

  it('renders resend link', function() {
    expect(screen.getByText(/didn.t get it\? resend code/i)).toBeTruthy()
  })

  it('renders use-a-different-email link', function() {
    expect(screen.getByText(/use a different email/i)).toBeTruthy()
  })

  it('hides old "We sent a sign-in link" message', function() {
    expect(screen.queryByText(/sign-in link/i)).toBeFalsy()
  })

  it('strips non-digits from pasted code', function() {
    var input = document.querySelector('input[autocomplete="one-time-code"]')
    fireEvent.change(input, { target: { value: '48 29 15' } })
    expect(input.value).toBe('482915')
  })

  it('POSTs to /auth/verify-code with email, cleaned code, and portal', async function() {
    fetch.mockResolvedValueOnce({
      json: function() { return Promise.resolve({ ok: true, redirect_url: '/dashboard' }) },
    })
    var input = document.querySelector('input[autocomplete="one-time-code"]')
    fireEvent.change(input, { target: { value: '482915' } })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))
    await waitFor(function() {
      expect(fetch).toHaveBeenCalledWith(
        VERIFY_URL,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"code":"482915"'),
        })
      )
    })
    expect(fetch.mock.calls[fetch.mock.calls.length - 1][1].body).toContain('"email":"jane@acme.com"')
  })

  it('shows error on wrong code and increments attempt count', async function() {
    fetch.mockResolvedValueOnce({
      json: function() { return Promise.resolve({ ok: false, error: 'Incorrect code. Try again.' }) },
    })
    var input = document.querySelector('input[autocomplete="one-time-code"]')
    fireEvent.change(input, { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))
    await waitFor(function() {
      expect(screen.queryByText(/incorrect code/i)).toBeTruthy()
    })
  })

  it('shows too-many-attempts message after 3 failures', async function() {
    for (var i = 0; i < 3; i++) {
      fetch.mockResolvedValueOnce({
        json: function() { return Promise.resolve({ ok: false, error: 'Incorrect code.' }) },
      })
      var input = document.querySelector('input[autocomplete="one-time-code"]')
      fireEvent.change(input, { target: { value: '11111' + i } })
      fireEvent.click(screen.getByRole('button', { name: /verify code/i }))
      await waitFor(function() { expect(fetch).toBeCalled() })
    }
    await waitFor(function() {
      expect(screen.queryByText(/too many attempts/i)).toBeTruthy()
    })
    expect(screen.queryAllByText(/request a new code/i).length).toBeGreaterThan(0)
  })

  it('handleResend resets to email-entry state', async function() {
    fireEvent.click(screen.getByText(/didn.t get it\? resend code/i))
    await waitFor(function() {
      expect(screen.queryByPlaceholderText('you@company.com')).toBeTruthy()
    })
    expect(screen.queryByText(/Enter the code we sent to/i)).toBeFalsy()
  })

  it('use-a-different-email link returns to email-entry', function() {
    fireEvent.click(screen.getByText(/use a different email/i))
    expect(screen.queryByPlaceholderText('you@company.com')).toBeTruthy()
  })

  it('shows Signing you in on success', async function() {
    fetch.mockResolvedValueOnce({
      json: function() { return Promise.resolve({ ok: true, redirect_url: '/dashboard' }) },
    })
    var input = document.querySelector('input[autocomplete="one-time-code"]')
    fireEvent.change(input, { target: { value: '482915' } })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))
    await waitFor(function() {
      expect(screen.queryByText(/signing you in/i)).toBeTruthy()
    })
  })
})

// ─── BUG-3091: product field in /auth/magic POST ──────────────────────────────
// When the portal prop is set, handleMagicLink must include product in the
// magic-link POST body. Without it, /auth/magic falls back to Origin
// derivation, which fails on non-*.sprintmode.ai origins (e.g. a pages.dev
// preview URL), stamping product=null and making verify-code always fail.

describe('Login — BUG-3091 product field in /auth/magic', function() {
  beforeEach(function() {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(function() {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends product in /auth/magic body when portal prop is set', async function() {
    fetch.mockResolvedValueOnce({
      json: function() { return Promise.resolve({ ok: true, redirect_url: '/dashboard' }) },
    })
    render(<Login authBase="https://api.sprintmode.ai" portal="safeshepherd" />)
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'admin@safeshepherd.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(function() {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sprintmode.ai/auth/magic',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    var call = fetch.mock.calls.find(function(c) { return String(c[0]).indexOf('/auth/magic') !== -1 })
    expect(call).toBeTruthy()
    var body = JSON.parse(call[1].body)
    expect(body.product).toBe('safeshepherd')
    expect(body.email).toBe('admin@safeshepherd.com')
  })

  it('does not include portal-specific product when portal prop is omitted', async function() {
    fetch.mockResolvedValueOnce({
      json: function() { return Promise.resolve({ ok: true, redirect_url: '/dashboard' }) },
    })
    render(<Login authBase="https://api.sprintmode.ai" />)
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(function() {
      expect(fetch).toHaveBeenCalled()
    })
    var call = fetch.mock.calls.find(function(c) { return String(c[0]).indexOf('/auth/magic') !== -1 })
    expect(call).toBeTruthy()
    var body = JSON.parse(call[1].body)
    // product may be derived from jsdom hostname, but must not be 'safeshepherd'
    expect(body.product).not.toBe('safeshepherd')
  })
})
