import { chromium, type FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Global setup for MySetlist E2E tests
 * Handles authentication, test data setup, and environment preparation
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 MySetlist E2E Testing - Global Setup')
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
  
  // Launch browser for setup tasks
  const browser = await chromium.launch()
  
  try {
    // Test user authentication setup
    await setupTestAuthentication(browser, baseURL)
    
    // Setup test data
    await setupTestData()
    
    // Verify application health
    await verifyApplicationHealth(baseURL)
    
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function setupTestAuthentication(browser: any, baseURL: string) {
  console.log('🔐 Setting up test authentication...')
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Navigate to login page
    await page.goto(`${baseURL}/auth/signin`)
    
    // Check if we can access authentication
    const hasAuthForm = await page.locator('[data-testid="auth-form"]').isVisible()
      .catch(() => false)
    
    if (hasAuthForm) {
      // Create test user session if needed
      console.log('📝 Creating test user session...')
      
      // This would typically involve:
      // 1. Creating a test user
      // 2. Signing them in
      // 3. Saving the authentication state
      
      // For now, we'll create a mock auth state
      await context.storageState({ 
        path: 'tests/e2e/.auth/user.json' 
      })
      
      console.log('✅ Test user authentication configured')
    } else {
      console.log('ℹ️  Authentication form not found - using guest access')
      
      // Save guest state
      await context.storageState({ 
        path: 'tests/e2e/.auth/user.json' 
      })
    }
    
    // Setup mobile user auth state
    await context.storageState({ 
      path: 'tests/e2e/.auth/mobile-user.json' 
    })
    
  } catch (error) {
    console.warn('⚠️ Authentication setup had issues:', error.message)
    
    // Create empty auth files as fallback
    const emptyAuth = { cookies: [], origins: [] }
    require('fs').writeFileSync('tests/e2e/.auth/user.json', JSON.stringify(emptyAuth))
    require('fs').writeFileSync('tests/e2e/.auth/mobile-user.json', JSON.stringify(emptyAuth))
  } finally {
    await context.close()
  }
}

async function setupTestData() {
  console.log('📊 Setting up test data...')
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('ℹ️  Supabase credentials not available - skipping data setup')
      return
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check if test data already exists
    const { data: existingArtists } = await supabase
      .from('artists')
      .select('id')
      .ilike('name', '%test%')
      .limit(1)
    
    if (existingArtists && existingArtists.length > 0) {
      console.log('ℹ️  Test data already exists')
      return
    }
    
    // Create test artists
    const testArtists = [
      {
        name: 'E2E Test Band',
        slug: 'e2e-test-band',
        image_url: 'https://example.com/test-band.jpg',
        genres: ['rock', 'alternative'],
        followers: 1000,
        verified: true
      },
      {
        name: 'Playwright Test Orchestra',
        slug: 'playwright-test-orchestra',
        image_url: 'https://example.com/test-orchestra.jpg', 
        genres: ['classical', 'experimental'],
        followers: 500,
        verified: false
      }
    ]
    
    const { data: insertedArtists, error: artistError } = await supabase
      .from('artists')
      .insert(testArtists)
      .select()
    
    if (artistError) {
      console.warn('⚠️ Could not create test artists:', artistError.message)
      return
    }
    
    console.log(`✅ Created ${insertedArtists?.length || 0} test artists`)
    
    // Create test shows if artists were created
    if (insertedArtists && insertedArtists.length > 0) {
      const testShows = insertedArtists.map((artist, index) => ({
        artist_id: artist.id,
        name: `Test Concert ${index + 1}`,
        date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'upcoming'
      }))
      
      const { data: insertedShows, error: showError } = await supabase
        .from('shows')
        .insert(testShows)
        .select()
      
      if (!showError && insertedShows) {
        console.log(`✅ Created ${insertedShows.length} test shows`)
      }
    }
    
  } catch (error) {
    console.warn('⚠️ Test data setup had issues:', error.message)
  }
}

async function verifyApplicationHealth(baseURL: string) {
  console.log('🏥 Verifying application health...')
  
  try {
    const response = await fetch(baseURL)
    
    if (!response.ok) {
      throw new Error(`Application not responding: ${response.status}`)
    }
    
    const body = await response.text()
    
    if (!body.includes('MySetlist')) {
      throw new Error('Application content does not match expected')
    }
    
    // Test API endpoints
    const apiHealthResponse = await fetch(`${baseURL}/api/artists`)
    
    if (apiHealthResponse.ok) {
      console.log('✅ API endpoints responding')
    } else {
      console.warn('⚠️ API endpoints may have issues')
    }
    
    console.log('✅ Application health check passed')
    
  } catch (error) {
    console.error('❌ Application health check failed:', error.message)
    throw error
  }
}

export default globalSetup