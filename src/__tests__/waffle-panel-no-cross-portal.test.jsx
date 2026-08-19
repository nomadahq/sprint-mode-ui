// BUG-2220: cross-portal panel is dead. This test LOCKS that state.
// No waffle.sprintmode.ai/panel reference and no Cmd+. binding may ever
// re-appear in Layout.tsx as part of the sm-ui shell.
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('cross-portal panel removed (BUG-2220)', () => {
  it('Layout source has NO waffle.sprintmode.ai/panel reference', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8')
    expect(src).not.toContain('waffle.sprintmode.ai/panel')
  })

  it('Layout source has NO e.key === "." binding', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8')
    expect(src).not.toMatch(/e\.key\s*===\s*['"]\.['"]/)
  })

  it('Layout source has NO WafflePanelButton or WaffleDrawer component', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8')
    expect(src).not.toContain('WafflePanelButton')
    expect(src).not.toContain('WaffleDrawer')
  })

  it('Layout source has NO openWafflePanel function', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8')
    expect(src).not.toContain('openWafflePanel')
  })
})
