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

var VERIFY_URL = 'https://api.sprintmode.ai/auth/verify-code'

function renderLogin(props) {
  return render(<Login authBase="https://api.sprintmode.ai" {...props} />)
}

beforeEach(function() {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(function() {
  vi.restoreAllMocks()
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

  it('shows passkey coming-soon label in signin mode', function() {
    renderLogin()
    expect(screen.getByText(/passkey sign-in coming soon/i)).toBeTruthy()
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
