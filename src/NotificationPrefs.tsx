import React, { useState, useEffect } from 'react'

// Lightweight notification delivery preferences page for client portals.
// Shows delivery channel toggles (in-app, Slack, email).
// event_filters retired in INBOX-TRANSITION-1 Phase C — routing is now
// controlled via portal_notification_config, not per-user event filters.

interface NotificationPrefsProps {
  apiBase?: string
  // Portal scope for prefs (sm-api routes accept ?portal=; default 'global').
  // Portal-wide behavior lives here in the shared surface - portals pass
  // their subdomain and consume; no per-portal proxy pinning.
  portal?: string
  // 'full' shows all 3 channels (admin use); 'simple' shows in-app only (client portals)
  mode?: 'simple' | 'full'
  title?: string
  subtitle?: string
}

function TogglePill({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return React.createElement('button', {
    onClick: function() { onChange(!on) },
    'aria-pressed': on,
    style: {
      width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 2,
      background: on ? 'var(--accent)' : 'var(--border)', transition: 'background .15s',
      display: 'flex', alignItems: 'center', flexShrink: 0,
    }
  },
    React.createElement('span', {
      style: {
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transform: on ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .15s',
        boxShadow: '0 1px 3px rgba(0,0,0,.18)',
        display: 'block',
      }
    })
  )
}

export function NotificationPrefs(props: NotificationPrefsProps) {
  var apiBase = props.apiBase !== undefined ? props.apiBase : ''
  var portalQ = props.portal ? '?portal=' + encodeURIComponent(props.portal) : ''
  var mode = props.mode || 'simple'
  var title = props.title || 'Notification Settings'
  var subtitle = props.subtitle || 'Manage how you receive notifications'

  var _prefs = useState<Record<string, any>>({ app_enabled: true, slack_enabled: false, email_enabled: false })
  var prefs = _prefs[0]; var setPrefs = _prefs[1]
  var _loading = useState(true); var loading = _loading[0]; var setLoading = _loading[1]
  var _saving = useState(false); var saving = _saving[0]; var setSaving = _saving[1]
  var _saved = useState(false); var saved = _saved[0]; var setSaved = _saved[1]
  var _error = useState<string | null>(null); var error = _error[0]; var setError = _error[1]

  useEffect(function() {
    fetch(apiBase + '/api/notifications/prefs' + portalQ, { credentials: 'include' })
      .then(function(r) { return r.json() })
      .then(function(d: any) {
        if (d.ok && d.data) {
          setPrefs({
            app_enabled: d.data.app_enabled !== 0,
            slack_enabled: !!d.data.slack_enabled,
            email_enabled: !!d.data.email_enabled,
          })
        }
        setLoading(false)
      })
      .catch(function() { setLoading(false) })
  }, [apiBase, props.portal])

  function save() {
    setSaving(true)
    setError(null)
    fetch(apiBase + '/api/notifications/prefs' + portalQ, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_enabled: prefs.app_enabled,
        slack_enabled: prefs.slack_enabled,
        email_enabled: prefs.email_enabled,
      }),
    })
      .then(function(r) { return r.json() })
      .then(function(d: any) {
        if (d.ok) { setSaved(true); setTimeout(function() { setSaved(false) }, 2000) }
        else { setError(d.error || 'Failed to save') }
      })
      .catch(function() { setError('Network error') })
      .finally(function() { setSaving(false) })
  }

  function toggleChannel(key: string) {
    setPrefs(function(p) { var n = Object.assign({}, p); n[key] = !n[key]; return n })
  }

  var CHANNELS_SIMPLE = [
    { key: 'app_enabled', label: 'In-app notifications', description: 'Shown in-app' },
  ]

  var CHANNELS_FULL = [
    { key: 'app_enabled', label: 'In-app', description: 'Shown in-app' },
    { key: 'slack_enabled', label: 'Slack DM', description: 'Sprint Mode Slack bot' },
    { key: 'email_enabled', label: 'Email', description: 'Sent to your login email' },
  ]

  var channels = mode === 'full' ? CHANNELS_FULL : CHANNELS_SIMPLE

  if (loading) {
    return React.createElement('div', {
      style: { padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }
    }, 'Loading...')
  }

  return React.createElement('div', { style: { maxWidth: 560, padding: 24 } },
    // Header
    React.createElement('div', { style: { marginBottom: 24 } },
      React.createElement('h2', {
        style: { fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'var(--foreground)' }
      }, title),
      React.createElement('p', {
        style: { fontSize: 13, color: 'var(--muted)', margin: 0 }
      }, subtitle)
    ),

    // Channel toggles
    React.createElement('div', {
      style: {
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
        background: 'var(--bg-card)', marginBottom: 20,
      }
    },
      React.createElement('div', {
        style: {
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
        }
      }, 'Delivery channels'),
      channels.map(function(ch, i) {
        return React.createElement('div', {
          key: ch.key,
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: i < channels.length - 1 ? '1px solid var(--border)' : 'none',
          }
        },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 14, fontWeight: 500, color: 'var(--foreground)' } }, ch.label),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--muted)', marginTop: 2 } }, ch.description)
          ),
          React.createElement(TogglePill, { on: prefs[ch.key], onChange: function() { toggleChannel(ch.key) } })
        )
      })
    ),

    // Error
    error ? React.createElement('div', {
      style: { padding: '10px 14px', background: 'rgba(239,68,68,.1)', color: '#dc2626', borderRadius: 7, fontSize: 13, marginBottom: 16 }
    }, error) : null,

    // Save button
    React.createElement('button', {
      onClick: save,
      disabled: saving,
      style: {
        padding: '8px 20px', borderRadius: 8, border: 'none',
        background: saved ? '#16a34a' : 'var(--accent)',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.7 : 1, transition: 'background .2s, opacity .2s',
      }
    }, saved ? '\u2713 Saved' : saving ? 'Saving...' : 'Save preferences')
  )
}
