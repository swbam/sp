/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],
  test: {
    name: 'Integration Tests',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts', './tests/integration-setup.ts'],
    include: [
      'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'app/api/**/*.test.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'tests/unit/**/*',
      'tests/e2e/**/*',
      'tests/load/**/*',
      'node_modules'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 2
      }
    }
  }
})