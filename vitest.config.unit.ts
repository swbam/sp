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
    name: 'Unit Tests',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'components/**/*.test.{js,ts,jsx,tsx}',
      'hooks/**/*.test.{js,ts,jsx,tsx}',
      'libs/**/*.test.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'tests/integration/**/*',
      'tests/e2e/**/*',
      'tests/load/**/*',
      'node_modules'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    testTimeout: 5000,
    pool: 'threads'
  }
})