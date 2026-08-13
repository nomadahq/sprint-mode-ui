import React, { useState, useEffect, ReactNode } from 'react'
import { isDarkMode, themedMarkFromLogoUrl, applyResolvedThemeAttr } from './dark-mode'
import { usePortalConfig } from './usePortalConfig.jsx'

export interface LoginProps {
  productName?: string
  /** @deprecated Use icon+title props instead */
  _logoSrc?: string
  authBase?: string
  icon?: ReactNode
  title?: string
  byLine?: string
  iconBg?: string
  iconColor?: string
  /** When set, enables the "Create an account" toggle with signup fields.
   *  Value is appended to the magic link POST body (e.g. "signup=true&product=studios"). */
  signupParams?: string
  /** Controls company name field visibility in signup mode.
   *  'required' (default) — shown and required (B2B portals).
   *  'optional' — shown but can be left blank; user can add company later.
   *  'hidden' — not rendered; no company record created on signup. */
  companyField?: 'required' | 'optional' | 'hidden'
  /** When set, the Login component operates in "Link Account" mode.
   *  The value is the current user_id to link to. Magic link requests will
   *  include link_to={linkTo}. Heading changes to "Link Another Account".
   *  Signup toggle is hidden. */
  linkTo?: string
  /** Optional cancel URL shown in link mode. Defaults to '/'. */
  cancelHref?: string
}

const Login: React.FC<LoginProps> = function Login({ productName, _logoSrc: _ls, authBase, icon, title, byLine, iconBg, iconColor, signupParams, companyField, linkTo, cancelHref }: LoginProps) {
  var _portalCfg = usePortalConfig()
  var _email = useState('')
  var email = _email[0]; var setEmail = _email[1]
  var _loading = useState(false)
  var loading = _loading[0]; var setLoading = _loading[1]
  var _error = useState<string | null>(null)
  var error = _error[0]; var setError = _error[1]
  var _sent = useState(false)
  var sent = _sent[0]; var setSent = _sent[1]
  var _mode = useState<'signin' | 'signup'>('signin')
  var mode = _mode[0]; var setMode = _mode[1]
  var _firstName = useState('')
  var firstName = _firstName[0]; var setFirstName = _firstName[1]
  var _lastName = useState('')
  var lastName = _lastName[0]; var setLastName = _lastName[1]
  var _companyName = useState('')
  var companyName = _companyName[0]; var setCompanyName = _companyName[1]

  // Pre-auth: Layout never mounts here, so the login surface resolves and
  // applies the theme itself from the same source the portal chrome uses
  // (stored sm-theme, else OS preference). Fixes light-card-on-dark logins
  // on portals whose index.html bootstrap skips auto-resolution.
  useEffect(function() { applyResolvedThemeAttr() }, [])

  var cfMode = companyField || 'required'
  var base = authBase || ''
  var params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  var rawRedirect = params.get('redirect') || '/'
  var redirect = rawRedirect.indexOf('http') === 0 ? rawRedirect : (typeof window !== 'undefined' ? window.location.origin : '') + rawRedirect

  var displayTitle = title || productName || 'Sprint Mode'
  var badgeBg = iconBg || 'var(--accent-10)'
  var isSignup = signupParams && mode === 'signup' && !linkTo
  var showCompanyField = cfMode !== 'hidden'
  var isLinkMode = !!linkTo

  function handleMagicLink(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (isSignup && (!firstName.trim() || !lastName.trim())) {
      setError('Please enter your first and last name.')
      return
    }
    if (isSignup && cfMode === 'required' && !companyName.trim()) {
      setError('Please enter your company name.')
      return
    }
    setLoading(true)
    setError(null)
    var bodyObj: Record<string, string> = { email: email, redirect: redirect }
    if (linkTo) bodyObj.link_to = linkTo
    if (isSignup && signupParams) {
      var sp = new URLSearchParams(signupParams)
      sp.forEach(function(val, key) { bodyObj[key] = val })
      bodyObj.first_name = firstName
      bodyObj.last_name = lastName
      bodyObj.company_field = cfMode
      if (showCompanyField && companyName) {
        bodyObj.company_name = companyName
      }
    }
    fetch(base + '/auth/magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    })
      .then(function(res) { return res.json() })
      .then(function(data: { ok: boolean; error?: string }) {
        setLoading(false)
        if (data.ok) {
          setSent(true)
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
      })
      .catch(function() {
        setLoading(false)
        setError('Network error. Please try again.')
      })
  }

  function switchMode(newMode: 'signin' | 'signup') {
    setMode(newMode)
    setError(null)
    setSent(false)
  }

  var inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font)',
    color: 'var(--foreground)', background: 'var(--bg)', lineHeight: '1.4',
    marginBottom: 12, outline: 'none', boxSizing: 'border-box' as const,
  }

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--blue)'
    e.target.style.boxShadow = '0 0 0 3px var(--blue-10)'
  }
  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {(() => {
              var _dark = isDarkMode()
              var _markUrl = _portalCfg.config && (_portalCfg.config as any).logo_mark_url
              var _themedMark = themedMarkFromLogoUrl(_markUrl)
              if (_themedMark) {
                return <div style={{ width: 36, height: 36, borderRadius: 9, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={_themedMark} width={28} height={28} style={{ display: 'block' }} alt="" />
                </div>
              }
              return <div style={{ width: 36, height: 36, borderRadius: 9, background: _dark ? 'transparent' : badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon || <svg viewBox="0 0 24 24" fill="none" stroke={iconColor || 'var(--accent)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="10 8 14 12 10 16"/></svg>}
              </div>
            })()}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--foreground)' }}>{displayTitle}</span>
              {byLine && <span style={{ fontSize: 13, fontWeight: 400, color: 'hsl(220, 9%, 40%)' }}>{byLine}</span>}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px 28px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '0 0 4px', color: 'var(--foreground)' }}>
            {isLinkMode ? 'Link Another Account' : isSignup ? 'Create an account' : 'Sign in'}
          </h2>
          {isLinkMode && (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Sign in with a different account to link it to your current identity.
            </p>
          )}
          {!isLinkMode && <div style={{ marginBottom: 20 }} />}

          {error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {isSignup && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>First name</label>
                  <input type="text" value={firstName} onChange={function(e) { setFirstName(e.target.value) }} placeholder="Jane" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Last name</label>
                  <input type="text" value={lastName} onChange={function(e) { setLastName(e.target.value) }} placeholder="Smith" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </div>
              </div>
              {showCompanyField && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    {'Company name' + (cfMode === 'optional' ? ' (optional)' : '')}
                  </label>
                  <input type="text" value={companyName} onChange={function(e) { setCompanyName(e.target.value) }} placeholder="Acme Corp" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </div>
              )}
            </div>
          )}

          {!sent && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={function(e) { setEmail(e.target.value) }}
                placeholder="you@company.com"
                autoFocus
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={function(e) { if (e.key === 'Enter') handleMagicLink(e) }}
              />
              <button
                onClick={handleMagicLink}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
              {!isSignup && !isLinkMode && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5"/></svg>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Passkey sign-in coming soon</span>
                </div>
              )}
            </div>
          )}

          {sent && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>&#9993;</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
              </div>
            </div>
          )}

          {signupParams && !isLinkMode && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
              {mode === 'signin' ? (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  New here?{' '}
                  <a href="#" onClick={function(e) { e.preventDefault(); switchMode('signup') }} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Create an account
                  </a>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Already have an account?{' '}
                  <a href="#" onClick={function(e) { e.preventDefault(); switchMode('signin') }} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Sign in
                  </a>
                </span>
              )}
            </div>
          )}

          {isLinkMode && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <a href={cancelHref || redirect || '/'} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Cancel
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Login
