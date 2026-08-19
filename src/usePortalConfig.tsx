import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react'

export interface PortalConfig {
  id?: string
  subdomain?: string
  name?: string
  brand_color?: string | null
  brand_tint?: string | null
  logo_url?: string | null
  favicon_url?: string | null
  icon_key?: string | null
  logo_mark_url?: string | null
  custom_domain?: string | null
  nav_enabled?: boolean | number
  billing_enabled?: boolean | number
  cmdk_enabled?: boolean | number
  // bug_panel removed — BUG-2220 killed cross-portal panel
  updates_enabled?: boolean | number
  chat_enabled?: boolean | number
  [key: string]: unknown
}

export interface PortalConfigContextValue {
  config: PortalConfig | null
  loading: boolean
  error: string | null
}

export interface PortalConfigProviderProps {
  subdomain: string
  apiBase?: string
  children: ReactNode
}

var PortalConfigContext = createContext<PortalConfigContextValue | null>(null)

export function usePortalConfig(): PortalConfigContextValue {
  return useContext(PortalConfigContext) || { config: null, loading: true, error: null }
}

export function PortalConfigProvider({ subdomain, apiBase, children }: PortalConfigProviderProps) {
  var [config, setConfig] = useState<PortalConfig | null>(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState<string | null>(null)

  useEffect(function() {
    if (!subdomain) { setLoading(false); return }
    var base = apiBase ?? 'https://api.sprintmode.ai'
    fetch(base + '/api/portal/config?subdomain=' + encodeURIComponent(subdomain), {
      credentials: 'include'
    })
      .then(function(r) { return r.json() })
      .then(function(d: { ok: boolean; config?: PortalConfig; error?: string }) {
        if (d.ok && d.config) {
          setConfig(d.config)
        } else {
          setError(d.error || 'Failed to load portal config')
        }
        setLoading(false)
      })
      .catch(function(err: Error) {
        setError(err.message)
        setLoading(false)
      })
  }, [subdomain, apiBase])

  return (
    <PortalConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </PortalConfigContext.Provider>
  )
}
