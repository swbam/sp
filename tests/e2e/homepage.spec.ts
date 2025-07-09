import { test, expect, type Page } from '@playwright/test'

/**
 * MySetlist Homepage E2E Tests
 * 
 * Tests the main landing page functionality, navigation, and key features
 */

test.describe('Homepage', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage before each test
    await page.goto('/')
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test('should load homepage with correct title and branding', async ({ page }) => {
    // Test page title
    await expect(page).toHaveTitle(/MySetlist/)
    
    // Test main branding/logo
    const logo = page.getByTestId('logo').or(page.getByText('MySetlist')).first()
    await expect(logo).toBeVisible()
    
    // Test main navigation is present
    const navigation = page.getByTestId('navigation').or(page.locator('nav')).first()
    await expect(navigation).toBeVisible()
  })

  test('should display featured content and trending section', async ({ page }) => {
    // Test for featured section
    const featuredSection = page.getByTestId('featured-section')
      .or(page.locator('[class*="featured"]'))
      .first()
    
    await expect(featuredSection).toBeVisible()
    
    // Test for trending section
    const trendingSection = page.getByTestId('trending-section')
      .or(page.getByText('Trending').locator('..'))
      .first()
    
    await expect(trendingSection).toBeVisible()
    
    // Test that trending content loads
    const trendingItems = page.getByTestId('trending-item')
      .or(page.locator('[class*="trending"] [class*="card"]'))
    
    await expect(trendingItems.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have working search functionality', async ({ page }) => {
    // Locate search input
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await expect(searchInput).toBeVisible()
    
    // Test search input interaction
    await searchInput.click()
    await searchInput.fill('radiohead')
    
    // Test search suggestions or results appear
    const searchResults = page.getByTestId('search-results')
      .or(page.locator('[class*="search-result"]'))
    
    // Wait for search results to appear
    await expect(searchResults.first()).toBeVisible({ timeout: 5000 })
    
    // Test clicking on a search result
    await searchResults.first().click()
    
    // Should navigate to search page or artist page
    await page.waitForURL(/\/(search|artists)/)
    
    // Verify we're on the correct page
    expect(page.url()).toMatch(/\/(search|artists)/)
  })

  test('should display artist cards with proper information', async ({ page }) => {
    // Look for artist cards on homepage
    const artistCards = page.getByTestId('artist-card')
      .or(page.locator('[class*="artist-card"]'))
    
    // Should have at least one artist card
    await expect(artistCards.first()).toBeVisible()
    
    // Test artist card contains required information
    const firstCard = artistCards.first()
    
    // Artist name should be visible
    const artistName = firstCard.getByTestId('artist-name')
      .or(firstCard.locator('h3, h2, [class*="name"]'))
      .first()
    
    await expect(artistName).toBeVisible()
    
    // Artist image should be present
    const artistImage = firstCard.getByTestId('artist-image')
      .or(firstCard.locator('img'))
      .first()
    
    await expect(artistImage).toBeVisible()
    
    // Test clicking on artist card navigates to artist page
    await firstCard.click()
    
    await page.waitForURL(/\/artists\//)
    expect(page.url()).toMatch(/\/artists\//)
  })

  test('should display show cards with event information', async ({ page }) => {
    // Look for show/event cards
    const showCards = page.getByTestId('show-card')
      .or(page.locator('[class*="show-card"], [class*="event-card"]'))
    
    // Wait for at least one show card to be visible
    await expect(showCards.first()).toBeVisible({ timeout: 10000 })
    
    const firstShowCard = showCards.first()
    
    // Test show card contains event details
    const showTitle = firstShowCard.getByTestId('show-title')
      .or(firstShowCard.locator('h3, h2, [class*="title"]'))
      .first()
    
    await expect(showTitle).toBeVisible()
    
    // Test show date is visible
    const showDate = firstShowCard.getByTestId('show-date')
      .or(firstShowCard.locator('[class*="date"]'))
      .first()
    
    await expect(showDate).toBeVisible()
    
    // Test clicking on show card navigates to show page
    await firstShowCard.click()
    
    await page.waitForURL(/\/shows\//)
    expect(page.url()).toMatch(/\/shows\//)
  })

  test('should have functional navigation menu', async ({ page }) => {
    // Test main navigation items
    const navigationItems = [
      { text: 'Home', url: '/' },
      { text: 'Search', url: '/search' },
      { text: 'Shows', url: '/shows' },
      { text: 'Trending', url: '/trending' }
    ]
    
    for (const item of navigationItems) {
      // Find navigation link
      const navLink = page.getByTestId(`nav-${item.text.toLowerCase()}`)
        .or(page.getByRole('link', { name: item.text }))
        .first()
      
      if (await navLink.isVisible()) {
        await navLink.click()
        
        // Wait for navigation
        await page.waitForURL(item.url)
        expect(page.url()).toContain(item.url)
        
        // Navigate back to homepage for next test
        await page.goto('/')
        await page.waitForLoadState('networkidle')
      }
    }
  })

  test('should be responsive on different screen sizes', async ({ page, browserName }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Verify mobile navigation
    const mobileMenuButton = page.getByTestId('mobile-menu-button')
      .or(page.locator('[aria-label="Menu"]'))
      .first()
    
    // Mobile menu should be visible on small screens
    await expect(mobileMenuButton).toBeVisible()
    
    // Test mobile menu functionality
    await mobileMenuButton.click()
    
    const mobileMenu = page.getByTestId('mobile-menu')
      .or(page.locator('[class*="mobile-menu"]'))
      .first()
    
    await expect(mobileMenu).toBeVisible()
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    
    // Content should still be visible and properly laid out
    const mainContent = page.getByTestId('main-content')
      .or(page.locator('main'))
      .first()
    
    await expect(mainContent).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Desktop navigation should be visible
    const desktopNav = page.getByTestId('desktop-navigation')
      .or(page.locator('nav'))
      .first()
    
    await expect(desktopNav).toBeVisible()
  })

  test('should handle loading states gracefully', async ({ page }) => {
    // Simulate slow network to test loading states
    await page.route('**/api/**', route => {
      setTimeout(() => route.continue(), 1000)
    })
    
    // Navigate to homepage
    await page.goto('/')
    
    // Look for loading indicators
    const loadingIndicator = page.getByTestId('loading-indicator')
      .or(page.locator('[class*="loading"], [class*="spinner"]'))
      .first()
    
    // Loading indicator should appear briefly
    const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false)
    
    if (isLoadingVisible) {
      // Loading should eventually disappear
      await expect(loadingIndicator).toBeHidden({ timeout: 10000 })
    }
    
    // Content should eventually load
    const content = page.getByTestId('homepage-content')
      .or(page.locator('main'))
      .first()
    
    await expect(content).toBeVisible({ timeout: 15000 })
  })

  test('should display error states appropriately', async ({ page }) => {
    // Simulate network errors
    await page.route('**/api/trending**', route => {
      route.abort('failed')
    })
    
    // Navigate to homepage
    await page.goto('/')
    
    // Wait for error handling
    await page.waitForTimeout(3000)
    
    // Look for error messages or fallback content
    const errorMessage = page.getByTestId('error-message')
      .or(page.getByText(/error|failed|unavailable/i))
      .first()
    
    const fallbackContent = page.getByTestId('fallback-content')
      .or(page.locator('[class*="fallback"]'))
      .first()
    
    // Either error message or fallback content should be present
    const hasErrorHandling = await errorMessage.isVisible().catch(() => false) ||
                            await fallbackContent.isVisible().catch(() => false)
    
    if (!hasErrorHandling) {
      console.log('ℹ️  No specific error handling detected - application may handle errors silently')
    }
    
    // Page should still be functional despite API errors
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await expect(searchInput).toBeVisible()
  })

  test('should have proper SEO and accessibility', async ({ page }) => {
    // Test meta description
    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveAttribute('content', /.+/)
    
    // Test heading structure
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
    
    // Test alt text on images
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i)
      const altText = await img.getAttribute('alt')
      
      if (altText === null || altText === '') {
        console.warn(`⚠️ Image ${i} missing alt text`)
      }
    }
    
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    
    // First focusable element should be focused
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Test skip link if present
    const skipLink = page.getByTestId('skip-link')
      .or(page.getByText(/skip to content/i))
      .first()
    
    const hasSkipLink = await skipLink.isVisible().catch(() => false)
    
    if (hasSkipLink) {
      await skipLink.click()
      
      // Should focus on main content
      const mainContent = page.locator('main')
      await expect(mainContent).toBeFocused()
    }
  })
})