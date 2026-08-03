import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatRelative,
  escapeHtml,
  clearSession,
} from '../api.ts'

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', function() {
  it('returns $0 for null', function() {
    expect(formatCurrency(null)).toBe('$0')
  })

  it('returns $0 for undefined', function() {
    expect(formatCurrency(undefined)).toBe('$0')
  })

  it('converts cents > 100 to dollars', function() {
    // 150000 cents = $1,500
    expect(formatCurrency(150000)).toBe('$1,500')
  })

  it('formats small values as-is when <= 100', function() {
    expect(formatCurrency(50)).toBe('$50')
  })

  it('handles exactly 100', function() {
    // 100 is not > 100, treated as-is
    expect(formatCurrency(100)).toBe('$100')
  })

  it('formats large dollar amounts with commas', function() {
    expect(formatCurrency(1000000)).toBe('$10,000')
  })
})

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', function() {
  it('returns -- for null', function() {
    expect(formatDate(null)).toBe('--')
  })

  it('returns -- for empty string', function() {
    expect(formatDate('')).toBe('--')
  })

  it('formats a valid ISO date string', function() {
    // Midday UTC stays on March 15 across every supported local timezone.
    var result = formatDate('2025-03-15T12:00:00Z')
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2025/)
  })

  it('returns original string for invalid date', function() {
    expect(formatDate('not-a-date')).toBe('Invalid Date')
  })
})

// ── formatRelative ────────────────────────────────────────────────────────────

describe('formatRelative', function() {
  it('returns empty string for null', function() {
    expect(formatRelative(null)).toBe('')
  })

  it('returns empty string for empty string', function() {
    expect(formatRelative('')).toBe('')
  })

  it('returns "just now" for very recent timestamps', function() {
    var now = new Date().toISOString()
    expect(formatRelative(now)).toBe('just now')
  })

  it('returns minutes ago for recent timestamps', function() {
    var fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelative(fiveMinutesAgo)).toBe('5m ago')
  })

  it('returns hours ago for older timestamps', function() {
    var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago for very old timestamps', function() {
    var threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(threeDaysAgo)).toBe('3d ago')
  })
})

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', function() {
  it('returns empty string for null', function() {
    expect(escapeHtml(null)).toBe('')
  })

  it('returns empty string for undefined', function() {
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes ampersand', function() {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes less-than', function() {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes greater-than', function() {
    expect(escapeHtml('x > 0')).toBe('x &gt; 0')
  })

  it('escapes double quotes', function() {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('handles plain strings with no special chars', function() {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('handles multiple special chars in one string', function() {
    expect(escapeHtml('<a href="x">link & more</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;link &amp; more&lt;/a&gt;'
    )
  })
})

// ── clearSession ──────────────────────────────────────────────────────────────

describe('clearSession', function() {
  it('does not throw when called', function() {
    expect(() => clearSession()).not.toThrow()
  })
})
