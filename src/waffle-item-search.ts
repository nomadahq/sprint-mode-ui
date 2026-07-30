// WAFFLE-3.5: default Waffle item-search provider for the Cmd+K palette.
//
// Gate 0 ruling (2026-07-30): the existing per-portal cmdk toggle in Portal
// Manager (portal_configs.cmdk) IS the config system — no new tunables. This
// provider is the built-in default: active wherever the bug panel is enabled
// and the host app passes no custom onSearch, zero config required, fully
// functional with the Admin portal off (s12 test 2 — sm-api enforces access).
//
// Results deep-link as `?bug={id}` on the current path: Layout's existing
// deep-link effect opens the bug panel focused on that item in EVERY portal.

import type { CmdKItem } from './Layout.tsx'

interface WaffleSearchRow {
  id?: string
  display_id?: string | null
  title?: string
  status?: string
  product?: string
  subsystem?: string | null
  tags?: string | null
  submitted_by_name?: string | null
}

export interface WaffleItemSearchOptions {
  /** API base prefix, matching the host's proxy convention (default ''). */
  apiBase?: string
  /** Max results shown in the palette (default 8; server caps apply). */
  limit?: number
}

export function createWaffleItemSearch(
  opts?: WaffleItemSearchOptions,
): (query: string) => Promise<{ items: CmdKItem[]; total?: number }> {
  var apiBase = (opts && opts.apiBase) || ''
  var limit = (opts && opts.limit) || 8
  return function (query: string) {
    var params = new URLSearchParams()
    params.set('q', query)
    params.set('limit', String(limit))
    return fetch(apiBase + '/api/bugs?' + params.toString(), { credentials: 'include' })
      .then(function (r) {
        return r.ok ? r.json() : null
      })
      .then(function (d: { data?: WaffleSearchRow[]; total?: number } | null) {
        var rows = (d && d.data) || []
        var items: CmdKItem[] = rows.map(function (b) {
          var handle = b.display_id || b.id || ''
          return {
            label: (handle ? handle + ' \u00b7 ' : '') + (b.title || ''),
            section: 'Work items',
            keywords: [b.product, b.subsystem, b.tags, b.submitted_by_name, b.id]
              .filter(Boolean)
              .join(' '),
            to: '?bug=' + encodeURIComponent(b.id || ''),
          }
        })
        return { items: items, total: (d && d.total) || items.length }
      })
      .catch(function () {
        return { items: [], total: 0 }
      })
  }
}
