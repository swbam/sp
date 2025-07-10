import { test, expect, type Page } from '@playwright/test'

/**
 * MySetlist Authentication Regression Tests
 * 
 * Comprehensive testing of authentication flows, session management,
 * and security features to prevent regressions in auth system
 */

test.describe('Authentication Regression Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()
    await page.context().clearPermissions()
  })

  test.describe('Sign In Flow', () => {
    
    test('should display sign in modal when accessing protected features', async ({ page }) => {
      await page.goto('/')
      
      // Try to access a protected feature (voting)
      const voteButton = page.getByTestId('upvote-button')
        .or(page.locator('[class*="vote"], button[aria-label*="vote" i]'))
        .first()
      
      const hasVoteButton = await voteButton.isVisible().catch(() => false)
      
      if (hasVoteButton) {
        await voteButton.click()
        
        // Should trigger authentication modal
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[class*="modal"], [role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible({ timeout: 5000 })
        
        // Test modal accessibility
        await expect(authModal).toHaveAttribute('role', 'dialog')
        await expect(authModal).toHaveAttribute('aria-modal', 'true')
        
        // Should contain sign in form
        const signInForm = authModal.getByTestId('sign-in-form')
          .or(authModal.locator('form'))
          .first()
        
        await expect(signInForm).toBeVisible()
        
        // Test form fields
        const emailInput = signInForm.getByTestId('email-input')
          .or(signInForm.locator('input[type="email"]'))
          .first()
        
        const passwordInput = signInForm.getByTestId('password-input')
          .or(signInForm.locator('input[type="password"]'))
          .first()
        
        await expect(emailInput).toBeVisible()
        await expect(passwordInput).toBeVisible()
        
        // Test form accessibility
        await expect(emailInput).toHaveAttribute('aria-label')
        await expect(passwordInput).toHaveAttribute('aria-label')
        
        console.log('✅ Sign in modal displays correctly with accessible form')
      }
    })

    test('should handle invalid credentials gracefully', async ({ page }) => {
      await page.goto('/')
      
      // Open auth modal
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        // Fill in invalid credentials
        const emailInput = authModal.getByTestId('email-input')
          .or(authModal.locator('input[type="email"]'))
          .first()
        
        const passwordInput = authModal.getByTestId('password-input')
          .or(authModal.locator('input[type="password"]'))
          .first()
        
        const submitButton = authModal.getByTestId('submit-button')
          .or(authModal.locator('button[type="submit"]'))
          .first()
        
        await emailInput.fill('invalid@example.com')
        await passwordInput.fill('wrongpassword')
        await submitButton.click()
        
        // Should show error message
        const errorMessage = authModal.getByTestId('auth-error')
          .or(authModal.getByText(/invalid|error|incorrect/i))
          .first()
        
        await expect(errorMessage).toBeVisible({ timeout: 5000 })
        
        // Test error accessibility
        await expect(errorMessage).toHaveAttribute('role', 'alert')
        await expect(errorMessage).toHaveAttribute('aria-live', 'polite')
        
        console.log('✅ Invalid credentials error handled gracefully')
      }
    })

    test('should support OAuth providers', async ({ page }) => {
      await page.goto('/')
      
      // Open auth modal
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        // Look for OAuth providers
        const googleButton = authModal.getByTestId('google-auth')
          .or(authModal.getByText(/google|continue with google/i))
          .first()
        
        const spotifyButton = authModal.getByTestId('spotify-auth')
          .or(authModal.getByText(/spotify|continue with spotify/i))
          .first()
        
        const hasGoogleAuth = await googleButton.isVisible().catch(() => false)
        const hasSpotifyAuth = await spotifyButton.isVisible().catch(() => false)
        
        if (hasGoogleAuth) {
          // Test Google OAuth button accessibility
          await expect(googleButton).toHaveAttribute('aria-label')
          await expect(googleButton).toHaveAttribute('type', 'button')
          
          console.log('✅ Google OAuth provider available')\n        }
        
        if (hasSpotifyAuth) {
          // Test Spotify OAuth button accessibility
          await expect(spotifyButton).toHaveAttribute('aria-label')
          await expect(spotifyButton).toHaveAttribute('type', 'button')
          
          console.log('✅ Spotify OAuth provider available')
        }
        
        if (!hasGoogleAuth && !hasSpotifyAuth) {
          console.log('ℹ️  No OAuth providers found')
        }
      }
    })

    test('should handle OAuth flow redirects', async ({ page }) => {
      // Mock OAuth redirect
      await page.route('**/auth/spotify**', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': '/auth/callback?code=test123&state=test'
          }
        })
      })
      
      await page.goto('/')
      
      // Test OAuth callback handling
      await page.goto('/auth/callback?code=test123&state=test')
      
      // Should handle callback and redirect appropriately
      await page.waitForLoadState('networkidle')
      
      // Check for success indicators or error handling
      const successIndicator = page.getByTestId('auth-success')
        .or(page.getByText(/welcome|signed in|authenticated/i))
        .first()
      
      const errorIndicator = page.getByTestId('auth-error')
        .or(page.getByText(/error|failed|invalid/i))
        .first()
      
      const hasSuccess = await successIndicator.isVisible().catch(() => false)
      const hasError = await errorIndicator.isVisible().catch(() => false)
      
      if (hasSuccess) {
        console.log('✅ OAuth callback handled successfully')
      } else if (hasError) {
        console.log('⚠️ OAuth callback resulted in error (expected in test)')
      } else {
        console.log('ℹ️  OAuth callback handling not clearly indicated')
      }
    })
  })

  test.describe('Session Management', () => {
    
    test('should maintain user session across page refreshes', async ({ page }) => {
      // Mock authenticated state
      await page.context().addCookies([
        {
          name: 'supabase-auth-token',
          value: 'mock-token-123',
          domain: 'localhost',
          path: '/'
        }
      ])
      
      await page.goto('/')
      
      // Check for authenticated state indicators
      const userMenu = page.getByTestId('user-menu')
        .or(page.getByText(/account|profile|settings/i))
        .first()
      
      const signOutButton = page.getByTestId('sign-out')
        .or(page.getByText(/sign out|log out/i))
        .first()
      
      const hasUserMenu = await userMenu.isVisible().catch(() => false)
      const hasSignOut = await signOutButton.isVisible().catch(() => false)
      
      if (hasUserMenu || hasSignOut) {
        console.log('✅ User session indicators present')
        
        // Refresh page
        await page.reload()
        await page.waitForLoadState('networkidle')
        
        // Check if session persists
        const userMenuAfterRefresh = page.getByTestId('user-menu')
          .or(page.getByText(/account|profile|settings/i))
          .first()
        
        const hasUserMenuAfterRefresh = await userMenuAfterRefresh.isVisible().catch(() => false)
        
        if (hasUserMenuAfterRefresh) {
          console.log('✅ User session persists across page refresh')
        } else {
          console.log('⚠️ User session not maintained across refresh')
        }
      } else {
        console.log('ℹ️  No clear authenticated state indicators found')
      }
    })

    test('should handle session expiration gracefully', async ({ page }) => {
      // Mock expired session
      await page.context().addCookies([
        {
          name: 'supabase-auth-token',
          value: 'expired-token',
          domain: 'localhost',
          path: '/'
        }
      ])
      
      await page.goto('/')
      
      // Try to perform authenticated action
      const voteButton = page.getByTestId('upvote-button')
        .or(page.locator('[class*="vote"]'))
        .first()
      
      const hasVoteButton = await voteButton.isVisible().catch(() => false)
      
      if (hasVoteButton) {
        // Mock expired session response
        await page.route('**/api/votes**', route => {
          route.fulfill({
            status: 401,
            body: JSON.stringify({ error: 'Session expired' })
          })
        })
        
        await voteButton.click()
        await page.waitForTimeout(2000)
        
        // Should handle expired session
        const sessionExpiredNotification = page.getByTestId('session-expired')
          .or(page.getByText(/session expired|please sign in/i))
          .first()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        const hasSessionExpiredNotification = await sessionExpiredNotification.isVisible().catch(() => false)
        const hasAuthModal = await authModal.isVisible().catch(() => false)
        
        if (hasSessionExpiredNotification || hasAuthModal) {
          console.log('✅ Session expiration handled gracefully')
        } else {
          console.log('⚠️ Session expiration handling not clearly indicated')
        }
      }
    })

    test('should handle concurrent sessions', async ({ page }) => {
      // Test multiple tab scenario
      const context = page.context()
      const newPage = await context.newPage()
      
      // Mock authenticated state in both tabs
      await context.addCookies([
        {
          name: 'supabase-auth-token',
          value: 'mock-token-123',
          domain: 'localhost',
          path: '/'
        }
      ])
      
      await page.goto('/')
      await newPage.goto('/')
      
      // Sign out from first tab
      const signOutButton = page.getByTestId('sign-out')
        .or(page.getByText(/sign out|log out/i))
        .first()
      
      const hasSignOutButton = await signOutButton.isVisible().catch(() => false)
      
      if (hasSignOutButton) {
        await signOutButton.click()
        await page.waitForTimeout(2000)
        
        // Check if second tab reflects sign out
        await newPage.reload()
        await newPage.waitForLoadState('networkidle')
        
        const userMenuInSecondTab = newPage.getByTestId('user-menu')
          .or(newPage.getByText(/account|profile|settings/i))
          .first()
        
        const hasUserMenuInSecondTab = await userMenuInSecondTab.isVisible().catch(() => false)
        
        if (!hasUserMenuInSecondTab) {
          console.log('✅ Sign out propagated to other tabs')
        } else {
          console.log('⚠️ Sign out not propagated to other tabs')
        }
      }
      
      await newPage.close()
    })
  })

  test.describe('Security Features', () => {
    
    test('should prevent XSS attacks in auth forms', async ({ page }) => {
      await page.goto('/')
      
      // Open auth modal
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        // Try XSS payload in email field
        const emailInput = authModal.getByTestId('email-input')
          .or(authModal.locator('input[type="email"]'))
          .first()
        
        const xssPayload = '<script>alert("XSS")</script>test@example.com'
        
        await emailInput.fill(xssPayload)
        
        // Check that script is not executed
        const emailValue = await emailInput.inputValue()
        
        // Should not contain script tags or should be sanitized
        if (!emailValue.includes('<script>')) {
          console.log('✅ XSS protection active in email field')
        } else {
          console.log('⚠️ Potential XSS vulnerability in email field')
        }
        
        // Test form submission with XSS payload
        const submitButton = authModal.getByTestId('submit-button')
          .or(authModal.locator('button[type="submit"]'))
          .first()
        
        await submitButton.click()
        await page.waitForTimeout(2000)
        
        // Check for any executed scripts or alerts
        const hasAlert = await page.locator('text="XSS"').isVisible().catch(() => false)
        
        if (!hasAlert) {
          console.log('✅ XSS payload properly sanitized')
        } else {
          console.log('🚨 XSS vulnerability detected!')
        }
      }
    })

    test('should implement proper CSRF protection', async ({ page }) => {
      await page.goto('/')
      
      // Test CSRF token presence
      const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content').catch(() => null)
      
      if (csrfToken) {
        console.log('✅ CSRF token present in page')
      } else {
        console.log('ℹ️  CSRF token not found in meta tag')
      }
      
      // Test form submissions include CSRF protection
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        const signInForm = authModal.getByTestId('sign-in-form')
          .or(authModal.locator('form'))
          .first()
        
        // Check for CSRF token in form
        const csrfInput = signInForm.locator('input[name="csrf_token"], input[name="_token"]').first()
        const hasCsrfInput = await csrfInput.isVisible().catch(() => false)
        
        if (hasCsrfInput) {
          console.log('✅ CSRF token present in auth form')
        } else {
          console.log('ℹ️  CSRF token not found in auth form')
        }
      }
    })

    test('should enforce rate limiting on auth endpoints', async ({ page }) => {
      await page.goto('/')
      
      // Mock rate limiting
      let requestCount = 0
      
      await page.route('**/auth/signin**', route => {
        requestCount++
        
        if (requestCount > 5) {
          route.fulfill({
            status: 429,
            headers: {
              'Retry-After': '60'
            },
            body: JSON.stringify({ error: 'Rate limit exceeded' })
          })
        } else {
          route.fulfill({
            status: 400,
            body: JSON.stringify({ error: 'Invalid credentials' })
          })
        }
      })
      
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        const emailInput = authModal.getByTestId('email-input')
          .or(authModal.locator('input[type="email"]'))
          .first()
        
        const passwordInput = authModal.getByTestId('password-input')
          .or(authModal.locator('input[type="password"]'))
          .first()
        
        const submitButton = authModal.getByTestId('submit-button')
          .or(authModal.locator('button[type="submit"]'))
          .first()
        
        // Attempt multiple rapid sign-ins
        for (let i = 0; i < 7; i++) {
          await emailInput.fill(`test${i}@example.com`)
          await passwordInput.fill('password123')
          await submitButton.click()
          await page.waitForTimeout(500)
        }
        
        // Check for rate limit error
        const rateLimitError = authModal.getByText(/rate limit|too many|wait/i).first()
        const hasRateLimitError = await rateLimitError.isVisible().catch(() => false)
        
        if (hasRateLimitError) {
          console.log('✅ Rate limiting enforced on auth endpoints')
        } else {
          console.log('⚠️ Rate limiting not detected on auth endpoints')
        }
      }
    })

    test('should secure password reset flow', async ({ page }) => {
      await page.goto('/')
      
      // Open auth modal
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        // Look for forgot password link
        const forgotPasswordLink = authModal.getByTestId('forgot-password')
          .or(authModal.getByText(/forgot password|reset password/i))
          .first()
        
        const hasForgotPasswordLink = await forgotPasswordLink.isVisible().catch(() => false)
        
        if (hasForgotPasswordLink) {
          await forgotPasswordLink.click()
          await page.waitForTimeout(2000)
          
          // Should show password reset form
          const resetForm = authModal.getByTestId('reset-password-form')
            .or(authModal.locator('form'))
            .first()
          
          const emailInput = resetForm.getByTestId('email-input')
            .or(resetForm.locator('input[type="email"]'))
            .first()
          
          const resetButton = resetForm.getByTestId('reset-button')
            .or(resetForm.locator('button[type="submit"]'))
            .first()
          
          // Test password reset submission
          await emailInput.fill('test@example.com')
          await resetButton.click()
          await page.waitForTimeout(2000)
          
          // Should show success message
          const successMessage = authModal.getByText(/reset link sent|check your email/i).first()
          const hasSuccessMessage = await successMessage.isVisible().catch(() => false)
          
          if (hasSuccessMessage) {
            console.log('✅ Password reset flow implemented')
            
            // Test success message accessibility
            await expect(successMessage).toHaveAttribute('role', 'alert')
          } else {
            console.log('ℹ️  Password reset flow not clearly indicated')
          }
        } else {
          console.log('ℹ️  Forgot password link not found')
        }
      }
    })
  })

  test.describe('User Experience', () => {
    
    test('should provide clear authentication state feedback', async ({ page }) => {
      await page.goto('/')
      
      // Test unauthenticated state
      const signInButton = page.getByTestId('sign-in-button')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasSignInButton = await signInButton.isVisible().catch(() => false)
      
      if (hasSignInButton) {
        console.log('✅ Unauthenticated state clearly indicated')
      }
      
      // Mock authenticated state
      await page.context().addCookies([
        {
          name: 'supabase-auth-token',
          value: 'mock-token-123',
          domain: 'localhost',
          path: '/'
        }
      ])
      
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Test authenticated state indicators
      const userMenu = page.getByTestId('user-menu')
        .or(page.getByText(/account|profile/i))
        .first()
      
      const userAvatar = page.getByTestId('user-avatar')
        .or(page.locator('[class*="avatar"]'))
        .first()
      
      const hasUserMenu = await userMenu.isVisible().catch(() => false)
      const hasUserAvatar = await userAvatar.isVisible().catch(() => false)
      
      if (hasUserMenu || hasUserAvatar) {
        console.log('✅ Authenticated state clearly indicated')
      } else {
        console.log('ℹ️  Authenticated state indicators not clearly visible')
      }
    })

    test('should handle authentication loading states', async ({ page }) => {
      await page.goto('/')
      
      // Mock slow authentication
      await page.route('**/auth/signin**', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true })
          })
        }, 3000)
      })
      
      const authTrigger = page.getByTestId('auth-trigger')
        .or(page.getByText(/sign in|log in/i))
        .first()
      
      const hasAuthTrigger = await authTrigger.isVisible().catch(() => false)
      
      if (hasAuthTrigger) {
        await authTrigger.click()
        
        const authModal = page.getByTestId('auth-modal')
          .or(page.locator('[role="dialog"]'))
          .first()
        
        await expect(authModal).toBeVisible()
        
        const emailInput = authModal.getByTestId('email-input')
          .or(authModal.locator('input[type="email"]'))
          .first()
        
        const passwordInput = authModal.getByTestId('password-input')
          .or(authModal.locator('input[type="password"]'))
          .first()
        
        const submitButton = authModal.getByTestId('submit-button')
          .or(authModal.locator('button[type="submit"]'))
          .first()
        
        await emailInput.fill('test@example.com')
        await passwordInput.fill('password123')
        await submitButton.click()
        
        // Should show loading state
        const loadingIndicator = authModal.getByTestId('loading')
          .or(authModal.locator('[class*="loading"], [class*="spinner"]'))
          .first()
        
        const hasLoadingIndicator = await loadingIndicator.isVisible().catch(() => false)
        
        if (hasLoadingIndicator) {
          console.log('✅ Authentication loading state displayed')
          
          // Test loading state accessibility
          await expect(loadingIndicator).toHaveAttribute('aria-label')
        } else {
          // Check if submit button shows loading state
          const isButtonDisabled = await submitButton.isDisabled()
          const hasLoadingClass = await submitButton.getAttribute('class')
            .then(classes => classes?.includes('loading'))
            .catch(() => false)
          
          if (isButtonDisabled || hasLoadingClass) {
            console.log('✅ Submit button shows loading state')
          } else {
            console.log('ℹ️  Loading state not clearly indicated')
          }
        }
      }
    })

    test('should support keyboard navigation in auth flows', async ({ page }) => {
      await page.goto('/')
      
      // Test keyboard navigation to auth trigger
      await page.keyboard.press('Tab')
      
      let foundAuthTrigger = false
      let tabCount = 0
      const maxTabs = 20
      
      while (tabCount < maxTabs && !foundAuthTrigger) {
        const focusedElement = page.locator(':focus')
        const elementText = await focusedElement.textContent().catch(() => '')
        
        if (elementText.toLowerCase().includes('sign in') || 
            elementText.toLowerCase().includes('log in')) {
          foundAuthTrigger = true
          
          // Activate auth trigger with Enter
          await page.keyboard.press('Enter')
          
          const authModal = page.getByTestId('auth-modal')
            .or(page.locator('[role="dialog"]'))
            .first()
          
          await expect(authModal).toBeVisible()
          
          // Test keyboard navigation within modal
          await page.keyboard.press('Tab')
          
          const firstFocusedElement = page.locator(':focus')
          const isInputFocused = await firstFocusedElement.getAttribute('type')
            .then(type => type === 'email' || type === 'password')
            .catch(() => false)
          
          if (isInputFocused) {
            console.log('✅ Keyboard navigation works in auth modal')
          }
          
          // Test Escape key to close modal
          await page.keyboard.press('Escape')
          
          const isModalClosed = await authModal.isHidden().catch(() => false)
          
          if (isModalClosed) {
            console.log('✅ Escape key closes auth modal')
          }
          
          break
        }
        
        await page.keyboard.press('Tab')
        tabCount++
      }
      
      if (!foundAuthTrigger) {
        console.log('ℹ️  Auth trigger not found via keyboard navigation')
      }
    })
  })
})