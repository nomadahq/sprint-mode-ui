import { describe, it, expect } from 'vitest'
import { mapBugsToCmdKItems } from '../Layout.tsx'

// WAFFLE-3.5: default palette item-search provider — row mapping.

describe('mapBugsToCmdKItems', function() {
  it('maps a full row to a palette item with display-id badge', function() {
    var items = mapBugsToCmdKItems([{
      id: 'bug_abc123def456',
      display_id: 'BUG-812',
      title: 'Lanes derive from events present',
      status: 'open',
      product: 'waffle',
      tags: 'aaron-qa',
      subsystem: 'waffle_app',
    }])
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Lanes derive from events present')
    expect(items[0].to).toBe('https://waffle.sprintmode.ai/squares/bug_abc123def456')
    expect(items[0].meta.badge).toBe('BUG-812')
    expect(items[0].meta.detail).toBe('open \u00b7 waffle')
    expect(items[0].keywords).toContain('BUG-812')
    expect(items[0].keywords).toContain('aaron-qa')
  })

  it('falls back to the raw-id handle when display_id is missing', function() {
    var items = mapBugsToCmdKItems([{ id: 'bug_9c1f00aa77bb', title: 'Old row' }])
    expect(items[0].meta.badge).toBe('bug_9c1f00aa')
  })

  it('uses the handle as label when title is empty and survives empty input', function() {
    var items = mapBugsToCmdKItems([{ id: 'bug_x1', display_id: 'TASK-4', title: null }])
    expect(items[0].label).toBe('TASK-4')
    expect(mapBugsToCmdKItems([])).toEqual([])
    expect(mapBugsToCmdKItems(null)).toEqual([])
  })
})
