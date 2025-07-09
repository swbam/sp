import { defineConfig, devices } from '@playwright/test'

/**
 * Mobile-focused E2E Testing Configuration
 * Tests MySetlist mobile experience and touch interactions
 */
export default defineConfig({
  testDir: './tests/mobile',
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report-mobile' }],
    ['json', { outputFile: 'test-results/mobile-results.json' }]
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Mobile-specific settings
    actionTimeout: 15000, // Longer timeout for mobile interactions
    navigationTimeout: 20000
  },

  projects: [
    // Mobile setup
    {
      name: 'mobile-setup',
      testMatch: /.*\.mobile-setup\.ts/
    },
    
    // iOS devices
    {
      name: 'iPhone 14',
      use: { 
        ...devices['iPhone 14'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    {
      name: 'iPhone 14 Pro',
      use: { 
        ...devices['iPhone 14 Pro'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    {
      name: 'iPhone SE',
      use: { 
        ...devices['iPhone SE'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    
    // Android devices
    {
      name: 'Pixel 7',
      use: { 
        ...devices['Pixel 7'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    {
      name: 'Galaxy S9+',
      use: { 
        ...devices['Galaxy S9+'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    
    // Tablets
    {
      name: 'iPad Pro',
      use: { 
        ...devices['iPad Pro'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    },
    {
      name: 'iPad Mini',
      use: { 
        ...devices['iPad Mini'],
        storageState: 'tests/e2e/.auth/mobile-user.json'
      },
      dependencies: ['mobile-setup']
    }
  ],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  },

  outputDir: 'test-results/mobile/',
  timeout: 60 * 1000, // Longer timeout for mobile tests
  
  expect: {
    timeout: 10 * 1000, // Longer expectations for mobile
    toHaveScreenshot: {
      threshold: 0.4, // More tolerance for mobile screenshots
      mode: 'strict'
    }
  }
})