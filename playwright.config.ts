import { defineConfig, devices } from '@playwright/test'

/**
 * MySetlist E2E Testing Configuration
 * 
 * Comprehensive Playwright setup for testing concert setlist voting platform
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Capture screenshot only when test fails
    screenshot: 'only-on-failure',
    
    // Record video only when retrying a test for the first time
    video: 'retain-on-failure',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Custom test timeout
    actionTimeout: 10000,
    navigationTimeout: 15000
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup'
    },
    {
      name: 'cleanup', 
      testMatch: /.*\.teardown\.ts/
    },
    
    // Desktop Chrome
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // Desktop Safari
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // Test against branded browsers
    {
      name: 'Microsoft Edge',
      use: { 
        ...devices['Desktop Edge'], 
        channel: 'msedge',
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'Google Chrome',
      use: { 
        ...devices['Desktop Chrome'], 
        channel: 'chrome',
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    }
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: 'test'
    }
  },

  // Test output directories
  outputDir: 'test-results/',
  
  // Global test settings
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
    // Custom matchers for better assertions
    toHaveScreenshot: {
      threshold: 0.3,
      mode: 'strict'
    },
    toMatchScreenshot: {
      threshold: 0.3
    }
  }
})