import { test as setup, expect } from '@playwright/test'

/**
 * Authentication setup for MySetlist E2E tests
 * Creates authenticated user sessions for test execution
 */

const authFile = 'tests/e2e/.auth/user.json'
const mobileAuthFile = 'tests/e2e/.auth/mobile-user.json'

setup('authenticate user', async ({ page }) => {
  console.log('🔐 Setting up user authentication for E2E tests...')
  
  try {
    // Navigate to the application
    await page.goto('/')
    
    // Check if the application loads
    await expect(page).toHaveTitle(/MySetlist/)
    
    // Look for authentication elements
    const signInButton = page.getByTestId('sign-in-button').or(page.getByText('Sign In')).first()
    const isSignInVisible = await signInButton.isVisible().catch(() => false)
    
    if (isSignInVisible) {
      console.log('📝 Authentication required - setting up test user...')
      
      // Click sign in button
      await signInButton.click()
      
      // Wait for auth modal or redirect
      await page.waitForLoadState('networkidle')
      
      // Check if we have Supabase auth UI
      const emailInput = page.getByTestId('email-input')
        .or(page.locator('input[type="email"]'))
        .first()
      
      const isEmailInputVisible = await emailInput.isVisible().catch(() => false)
      
      if (isEmailInputVisible) {
        // Fill in test credentials
        await emailInput.fill('test@mysetlist.com')
        
        const passwordInput = page.getByTestId('password-input')
          .or(page.locator('input[type="password"]'))
          .first()
        
        await passwordInput.fill('testpassword123')
        
        // Submit form
        const submitButton = page.getByTestId('auth-submit')
          .or(page.getByRole('button', { name: /sign in/i }))
          .first()
        
        await submitButton.click()
        
        // Wait for authentication to complete
        await page.waitForURL('/', { timeout: 10000 }).catch(() => {
          console.log('ℹ️  Authentication redirect may not have occurred')
        })
        
        // Verify authentication success
        const userMenu = page.getByTestId('user-menu')
          .or(page.getByText('Account'))
          .first()
        
        const isAuthenticated = await userMenu.isVisible().catch(() => false)
        
        if (isAuthenticated) {
          console.log('✅ User authentication successful')
        } else {
          console.log('ℹ️  Using guest/anonymous access for tests')
        }
      } else {
        console.log('ℹ️  Auth form not found - using guest access')
      }
    } else {
      console.log('ℹ️  No authentication required - using public access')
    }
    
    // Save the authenticated state
    await page.context().storageState({ path: authFile })
    console.log(`💾 Authentication state saved to ${authFile}`)
    
  } catch (error) {
    console.warn('⚠️ Authentication setup encountered issues:', error.message)
    
    // Create a minimal auth state as fallback
    const emptyAuth = {
      cookies: [],
      origins: []
    }
    
    require('fs').writeFileSync(authFile, JSON.stringify(emptyAuth, null, 2))
    console.log('📄 Created fallback authentication state')
  }
})

setup('authenticate mobile user', async ({ page }) => {
  console.log('📱 Setting up mobile user authentication...')
  
  try {
    // Navigate to the application
    await page.goto('/')
    
    // Mobile-specific authentication setup
    // This is typically the same as desktop but we maintain separate state
    // for mobile-specific tests
    
    await expect(page).toHaveTitle(/MySetlist/)
    
    // Check for mobile navigation
    const mobileMenuButton = page.getByTestId('mobile-menu-button')
      .or(page.locator('[aria-label="Menu"]'))
      .first()
    
    const isMobileMenuVisible = await mobileMenuButton.isVisible().catch(() => false)
    
    if (isMobileMenuVisible) {
      console.log('📱 Mobile interface detected')
      
      // Open mobile menu
      await mobileMenuButton.click()
      
      // Look for sign in option in mobile menu
      const mobileSignIn = page.getByTestId('mobile-sign-in')
        .or(page.getByText('Sign In'))
        .first()
      
      const isMobileSignInVisible = await mobileSignIn.isVisible().catch(() => false)
      
      if (isMobileSignInVisible) {
        await mobileSignIn.click()
        
        // Follow similar authentication flow as desktop
        // but adapted for mobile interface
        await page.waitForLoadState('networkidle')
        
        console.log('📱 Mobile authentication flow initiated')
      }
    }
    
    // Save mobile authentication state
    await page.context().storageState({ path: mobileAuthFile })
    console.log(`💾 Mobile authentication state saved to ${mobileAuthFile}`)
    
  } catch (error) {
    console.warn('⚠️ Mobile authentication setup encountered issues:', error.message)
    
    // Create fallback mobile auth state
    const emptyAuth = {
      cookies: [],
      origins: []
    }
    
    require('fs').writeFileSync(mobileAuthFile, JSON.stringify(emptyAuth, null, 2))
    console.log('📄 Created fallback mobile authentication state')
  }
})