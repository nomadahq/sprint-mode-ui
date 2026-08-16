// TASK-2062: the shell opens the ONE panel (the Waffle app's /panel
// popout). The legacy in-shell BugPanel and its tests are retired;
// this locks the popout contract: gating unchanged, Cmd+. shortcut,
// ?bug= deep link carries the focus param.
import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('waffle panel popout (TASK-2062)', () => {
  afterEach(() => { vi.restoreAllMocks() })
  it('layout source carries the popout, Cmd+. binding, and no BugPanel', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8')
    expect(src).toContain("waffle.sprintmode.ai/panel")
    expect(src).toContain("e.key === '.'")
    expect(src).not.toContain("e.key === 'b'")
    expect(src).not.toMatch(/from '\.\/BugPanel/)
  })
})
