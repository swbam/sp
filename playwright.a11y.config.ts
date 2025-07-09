import { defineConfig, devices } from '@playwright/test'

/**
 * Accessibility Testing Configuration
 * Tests MySetlist for WCAG compliance and accessibility standards
 */
export default defineConfig({
  testDir: './tests/a11y',
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report-a11y' }],
    ['json', { outputFile: 'test-results/a11y-results.json' }],
    ['junit', { outputFile: 'test-results/a11y-junit.xml' }]
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Accessibility-specific settings
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    
    // Reduce motion for accessibility testing
    reducedMotion: 'reduce'
  },

  projects: [
    // Standard accessibility testing
    {
      name: 'a11y-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        // Force prefers-reduced-motion
        extraHTTPHeaders: {
          'prefers-reduced-motion': 'reduce'
        }
      }
    },
    
    // High contrast mode testing
    {
      name: 'a11y-high-contrast',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        forcedColors: 'active'
      }
    },
    
    // Screen reader simulation
    {
      name: 'a11y-screen-reader',
      use: { 
        ...devices['Desktop Chrome'],
        // Simulate screen reader behavior
        hasTouch: false,
        isMobile: false
      }
    },
    
    // Keyboard navigation testing
    {
      name: 'a11y-keyboard-only',
      use: { 
        ...devices['Desktop Chrome'],
        // Test without mouse interaction
        hasTouch: false
      }
    },
    
    // Mobile accessibility
    {
      name: 'a11y-mobile',
      use: { 
        ...devices['iPhone 14'],
        // Mobile accessibility features
        reducedMotion: 'reduce'
      }
    },
    
    // Voice Over simulation (iOS)
    {
      name: 'a11y-voiceover',
      use: { 
        ...devices['iPhone 14'],
        // Simulate VoiceOver usage patterns
        hasTouch: true,
        isMobile: true
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
      // Enable accessibility features
      FORCE_REDUCED_MOTION: 'true',
      HIGH_CONTRAST_MODE: 'true'
    }
  },

  outputDir: 'test-results/a11y/',
  timeout: 45 * 1000,
  
  expect: {
    timeout: 8 * 1000,
    // Accessibility-specific assertions
    toPass: {
      intervals: [100, 250, 500, 1000],
      timeout: 10000
    }
  }
})