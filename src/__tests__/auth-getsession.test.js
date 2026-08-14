// FLIP-HOTFIX-1: getSession per-door cookie read.
// Post LOGIN_DOOR_CUTOVER a login sets only sm_session_{product}; getSession
// must find it (by explicit product or portal subdomain) and keep the legacy
// sm_client fallback for surviving pre-flip sessions.
import { describe, it, expect } from 'vitest'
import { getSession } from '../auth'

// Minimal Request stand-in (getSession touches only .url and .headers.get) —
// the eslint env for plain .js tests has no Request global.
function req(url, cookie) {
  return {
    url: url,
    headers: { get: function (name) { return name === 'Cookie' ? (cookie || null) : null } },
  }
}

describe('getSession per-door cookie read', () => {
  it('reads the per-door cookie derived from the portal subdomain', () => {
    expect(getSession(req('https://signal.sprintmode.ai/dash', 'sm_session_signal=tok1'))).toBe('tok1')
    expect(getSession(req('https://waffle.sprintmode.ai/', 'other=x; sm_session_waffle=tok2'))).toBe('tok2')
  })

  it('prefers the per-door cookie over sm_client when both exist', () => {
    expect(getSession(req('https://signal.sprintmode.ai/', 'sm_client=legacy; sm_session_signal=door'))).toBe('door')
  })

  it('falls back to legacy sm_client when no per-door cookie exists', () => {
    expect(getSession(req('https://signal.sprintmode.ai/', 'sm_client=legacy'))).toBe('legacy')
  })

  it('honors an explicit product over the hostname', () => {
    expect(getSession(req('https://example.pages.dev/', 'sm_session_studios=tok3'), 'studios')).toBe('tok3')
  })

  it('does not cross-match another door cookie', () => {
    expect(getSession(req('https://signal.sprintmode.ai/', 'sm_session_admin=admintok'))).toBe(null)
  })

  it('returns null with no session cookies at all', () => {
    expect(getSession(req('https://signal.sprintmode.ai/', 'unrelated=1'))).toBe(null)
  })
})
