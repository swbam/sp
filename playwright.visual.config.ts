import { defineConfig, devices } from '@playwright/test'

/**
 * Visual Regression Testing Configuration
 * Tests MySetlist UI consistency and visual changes
 */
export default defineConfig({
  testDir: './tests/visual',
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report-visual' }],
    ['json', { outputFile: 'test-results/visual-results.json' }]
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Visual testing specific settings
    viewport: { width: 1280, height: 720 },
    actionTimeout: 5000,
    navigationTimeout: 10000,
    
    // Ensure consistent rendering
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce'
  },

  projects: [
    // Desktop visual tests
    {
      name: 'visual-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Consistent font rendering
        fontFamily: 'Arial, sans-serif'
      }
    },
    
    // Different screen sizes
    {
      name: 'visual-desktop-large',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      }
    },
    {
      name: 'visual-desktop-small',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 }
      }
    },
    
    // Mobile visual tests
    {
      name: 'visual-mobile',
      use: { 
        ...devices['iPhone 14'],
        // Ensure consistent mobile rendering
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: 'visual-tablet',
      use: { 
        ...devices['iPad Pro'],
        // Tablet-specific visual testing
        hasTouch: true,
        isMobile: false
      }
    },
    
    // Dark mode visual tests
    {
      name: 'visual-dark-mode',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1280, height: 720 }
      }
    },
    
    // Light mode visual tests
    {
      name: 'visual-light-mode',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1280, height: 720 }
      }
    }
  ],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: 'test',
      // Disable animations for visual testing
      DISABLE_ANIMATIONS: 'true',
      FORCE_REDUCED_MOTION: 'true'
    }
  },

  outputDir: 'test-results/visual/',
  timeout: 30 * 1000,
  
  expect: {
    timeout: 5 * 1000,
    // Visual regression specific settings
    toHaveScreenshot: {
      threshold: 0.2, // Strict visual comparison
      mode: 'strict',
      animations: 'disabled'
    },
    toMatchScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 100
    }
  }
})