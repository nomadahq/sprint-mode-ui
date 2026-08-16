// vite.config.lib.ts
// Library-mode build for standalone IIFE bundles.
// Called with STANDALONE_ENTRY env var to select which entry to build.
//
// Outputs (one per invocation):
//   dist/bug-panel.iife.js
//   dist/user-menu.iife.js
//   dist/inbox-page.iife.js
//
// Usage: STANDALONE_ENTRY=bug-panel npm run build:standalone:one

import { defineConfig } from 'vite'
import { resolve } from 'path'

var entries: Record<string, { file: string; name: string }> = {
  'user-menu': { file: 'src/user-menu-standalone.ts', name: 'SMUserMenu' },
  'inbox-page': { file: 'src/inbox-page-standalone.ts', name: 'SMInboxPage' },
}

var entryKey = process.env.STANDALONE_ENTRY || 'bug-panel'
var entry = entries[entryKey]
if (!entry) throw new Error('Unknown STANDALONE_ENTRY: ' + entryKey)

export default defineConfig({
  plugins: [],
  build: {
    lib: {
      entry: resolve(__dirname, entry.file),
      name: entry.name,
      fileName: entryKey,
      formats: ['iife'],
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
