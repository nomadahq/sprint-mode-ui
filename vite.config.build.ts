// vite.config.build.ts
// Library-mode build: outputs dist/index.js + dist/*.d.ts
// Externalizes React peer deps -- consumers provide them.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx'],
      exclude: ['src/__tests__', 'src/user-menu-standalone.ts', 'src/inbox-page-standalone.ts'],
      outDir: 'dist',
      tsconfigPath: './tsconfig.json',
      pathsToAliases: false,
      rollupTypes: true,
      copyDtsFiles: false,
      // TS5097 is expected: sources use allowImportingTsExtensions which is
      // intentional for the dev tsconfig. Declaration emit still succeeds.
      afterDiagnostic: () => Promise.resolve(),
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        auth: resolve(__dirname, 'src/auth.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
