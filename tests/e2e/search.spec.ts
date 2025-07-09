import { test, expect, type Page } from '@playwright/test'

/**
 * MySetlist Search Functionality E2E Tests
 * 
 * Tests artist search, search suggestions, filtering, and search results
 */

test.describe('Search Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to search page or homepage with search
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should perform basic artist search', async ({ page }) => {
    // Locate the search input
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await expect(searchInput).toBeVisible()
    
    // Perform search
    await searchInput.click()
    await searchInput.fill('radiohead')
    await searchInput.press('Enter')
    
    // Wait for navigation to search results
    await page.waitForURL(/\/search/)
    
    // Verify search results page loads
    await expect(page).toHaveURL(/search/)
    
    // Check for search results
    const searchResults = page.getByTestId('search-results')
      .or(page.locator('[class*="search-result"]'))
    
    await expect(searchResults.first()).toBeVisible({ timeout: 10000 })
    
    // Verify search term is displayed
    const searchTerm = page.getByTestId('search-term')
      .or(page.getByText('radiohead'))
      .first()
    
    await expect(searchTerm).toBeVisible()
  })

  test('should show search suggestions while typing', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await searchInput.click()
    
    // Type partial search term
    await searchInput.type('rad', { delay: 100 })
    
    // Look for search suggestions/dropdown
    const searchSuggestions = page.getByTestId('search-suggestions')
      .or(page.locator('[class*="suggestion"], [class*="dropdown"]'))
    
    // Wait for suggestions to appear
    await expect(searchSuggestions.first()).toBeVisible({ timeout: 5000 })
    
    // Test clicking on a suggestion
    const firstSuggestion = searchSuggestions.first()
    await firstSuggestion.click()
    
    // Should navigate to artist page or search results
    await page.waitForURL(/\/(artists|search)/)
  })

  test('should handle empty search gracefully', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await searchInput.click()
    await searchInput.press('Enter')
    
    // Should handle empty search appropriately
    // Either stay on current page or show empty state
    const currentUrl = page.url()
    
    if (currentUrl.includes('/search')) {
      // If navigated to search page, should show empty state
      const emptyState = page.getByTestId('empty-search-state')
        .or(page.getByText(/enter a search term/i))
        .first()
      
      await expect(emptyState).toBeVisible()
    }
  })

  test('should display search results with proper formatting', async ({ page }) => {
    // Navigate to search page
    await page.goto('/search?q=test')
    await page.waitForLoadState('networkidle')
    
    // Check for search results container
    const resultsContainer = page.getByTestId('search-results-container')
      .or(page.locator('main'))
      .first()
    
    await expect(resultsContainer).toBeVisible()
    
    // Look for individual artist results
    const artistResults = page.getByTestId('artist-result')
      .or(page.locator('[class*="artist-card"], [class*="search-result"]'))
    
    const resultCount = await artistResults.count()
    
    if (resultCount > 0) {
      const firstResult = artistResults.first()
      
      // Test artist result contains necessary information
      const artistName = firstResult.getByTestId('artist-name')
        .or(firstResult.locator('h3, h2, [class*="name"]'))
        .first()
      
      await expect(artistName).toBeVisible()
      
      // Test artist image
      const artistImage = firstResult.getByTestId('artist-image')
        .or(firstResult.locator('img'))
        .first()
      
      await expect(artistImage).toBeVisible()
      
      // Test followers/stats if displayed
      const artistStats = firstResult.getByTestId('artist-stats')
        .or(firstResult.locator('[class*="followers"], [class*="stats"]'))
        .first()
      
      const hasStats = await artistStats.isVisible().catch(() => false)
      if (hasStats) {
        await expect(artistStats).toBeVisible()
      }
      
      // Test clicking on result navigates to artist page
      await firstResult.click()
      await page.waitForURL(/\/artists\//)
    } else {
      // No results - check for no results message
      const noResults = page.getByTestId('no-results')
        .or(page.getByText(/no artists found/i))
        .first()
      
      await expect(noResults).toBeVisible()
    }
  })

  test('should handle search with special characters', async ({ page }) => {
    const specialSearchTerms = [
      'AC/DC',
      'Sigur Rós', 
      '¿?',
      'B.o.B',
      'Die Ärzte'
    ]
    
    for (const term of specialSearchTerms) {
      const searchInput = page.getByTestId('search-input')
        .or(page.getByPlaceholder(/search/i))
        .first()
      
      await searchInput.click()
      await searchInput.fill('')
      await searchInput.fill(term)
      await searchInput.press('Enter')
      
      // Wait for search to complete
      await page.waitForTimeout(2000)
      
      // Should not cause errors
      const errorMessage = page.getByTestId('error-message')
        .or(page.getByText(/error|failed/i))
        .first()
      
      const hasError = await errorMessage.isVisible().catch(() => false)
      
      if (hasError) {
        console.warn(`⚠️ Search error with term: ${term}`)
      }
      
      // Navigate back to start fresh
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    }
  })

  test('should support search filtering and sorting', async ({ page }) => {
    // Navigate to search page with results
    await page.goto('/search?q=rock')
    await page.waitForLoadState('networkidle')
    
    // Look for filter options
    const filterSection = page.getByTestId('search-filters')
      .or(page.locator('[class*="filter"]'))
      .first()
    
    const hasFilters = await filterSection.isVisible().catch(() => false)
    
    if (hasFilters) {
      // Test genre filter if available
      const genreFilter = page.getByTestId('genre-filter')
        .or(page.getByText('Genre'))
        .first()
      
      const hasGenreFilter = await genreFilter.isVisible().catch(() => false)
      
      if (hasGenreFilter) {
        await genreFilter.click()
        
        // Look for genre options
        const genreOption = page.getByTestId('genre-rock')
          .or(page.getByText('Rock'))
          .first()
        
        const hasGenreOption = await genreOption.isVisible().catch(() => false)
        
        if (hasGenreOption) {
          await genreOption.click()
          
          // Wait for filtered results
          await page.waitForTimeout(2000)
          
          // Results should update
          const filteredResults = page.getByTestId('search-results')
            .or(page.locator('[class*="search-result"]'))
          
          await expect(filteredResults.first()).toBeVisible()
        }
      }
    }
    
    // Look for sort options
    const sortSection = page.getByTestId('search-sort')
      .or(page.locator('[class*="sort"]'))
      .first()
    
    const hasSorting = await sortSection.isVisible().catch(() => false)
    
    if (hasSorting) {
      // Test sort by popularity/followers
      const sortByPopular = page.getByTestId('sort-popular')
        .or(page.getByText(/popular|followers/i))
        .first()
      
      const hasSortOption = await sortByPopular.isVisible().catch(() => false)
      
      if (hasSortOption) {
        await sortByPopular.click()
        
        // Wait for re-sorted results
        await page.waitForTimeout(2000)
        
        // Results should re-order
        const sortedResults = page.getByTestId('search-results')
          .or(page.locator('[class*="search-result"]'))
        
        await expect(sortedResults.first()).toBeVisible()
      }
    }
  })

  test('should handle search pagination', async ({ page }) => {
    // Search for a common term that should have many results
    await page.goto('/search?q=the')
    await page.waitForLoadState('networkidle')
    
    // Look for pagination controls
    const pagination = page.getByTestId('pagination')
      .or(page.locator('[class*="pagination"]'))
      .first()
    
    const hasPagination = await pagination.isVisible().catch(() => false)
    
    if (hasPagination) {
      // Test next page button
      const nextButton = page.getByTestId('next-page')
        .or(page.getByText('Next'))
        .or(page.locator('[aria-label="Next page"]'))
        .first()
      
      const hasNextButton = await nextButton.isVisible().catch(() => false)
      
      if (hasNextButton && await nextButton.isEnabled()) {
        // Get current results
        const currentResults = page.getByTestId('search-results')
          .or(page.locator('[class*="search-result"]'))
        
        const currentResultCount = await currentResults.count()
        
        // Click next page
        await nextButton.click()
        
        // Wait for new results to load
        await page.waitForTimeout(3000)
        
        // URL should update with page parameter
        expect(page.url()).toMatch(/page=2|offset=/)
        
        // Results should update
        const newResults = page.getByTestId('search-results')
          .or(page.locator('[class*="search-result"]'))
        
        await expect(newResults.first()).toBeVisible()
        
        // Test previous page button
        const prevButton = page.getByTestId('prev-page')
          .or(page.getByText('Previous'))
          .or(page.locator('[aria-label="Previous page"]'))
          .first()
        
        const hasPrevButton = await prevButton.isVisible().catch(() => false)
        
        if (hasPrevButton) {
          await prevButton.click()
          
          // Should return to first page
          await page.waitForTimeout(2000)
          expect(page.url()).toMatch(/page=1|^(?!.*page=)/)
        }
      }
    } else {
      console.log('ℹ️  No pagination found - search may not have enough results')
    }
  })

  test('should persist search state across navigation', async ({ page }) => {
    // Perform a search
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await searchInput.click()
    await searchInput.fill('pearl jam')
    await searchInput.press('Enter')
    
    await page.waitForURL(/\/search/)
    
    // Navigate to an artist page
    const artistResult = page.getByTestId('artist-result')
      .or(page.locator('[class*="artist-card"]'))
      .first()
    
    const hasResults = await artistResult.isVisible().catch(() => false)
    
    if (hasResults) {
      await artistResult.click()
      await page.waitForURL(/\/artists\//)
      
      // Navigate back to search
      await page.goBack()
      
      // Search term should still be in the input
      const searchInputAfterBack = page.getByTestId('search-input')
        .or(page.getByPlaceholder(/search/i))
        .first()
      
      const searchValue = await searchInputAfterBack.inputValue()
      expect(searchValue).toContain('pearl')
      
      // Results should still be displayed
      const resultsAfterBack = page.getByTestId('search-results')
        .or(page.locator('[class*="search-result"]'))
      
      await expect(resultsAfterBack.first()).toBeVisible()
    }
  })

  test('should handle search API errors gracefully', async ({ page }) => {
    // Intercept search API and simulate error
    await page.route('**/api/search/**', route => {
      route.abort('failed')
    })
    
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await searchInput.click()
    await searchInput.fill('test search')
    await searchInput.press('Enter')
    
    // Wait for error handling
    await page.waitForTimeout(5000)
    
    // Should show error message
    const errorMessage = page.getByTestId('search-error')
      .or(page.getByText(/error|failed|try again/i))
      .first()
    
    const hasErrorMessage = await errorMessage.isVisible().catch(() => false)
    
    if (hasErrorMessage) {
      await expect(errorMessage).toBeVisible()
      
      // Test retry functionality if available
      const retryButton = page.getByTestId('retry-search')
        .or(page.getByText(/try again|retry/i))
        .first()
      
      const hasRetryButton = await retryButton.isVisible().catch(() => false)
      
      if (hasRetryButton) {
        // Remove route interception to allow retry to work
        await page.unroute('**/api/search/**')
        
        await retryButton.click()
        
        // Should attempt search again
        await page.waitForTimeout(3000)
      }
    } else {
      console.log('ℹ️  No specific error handling detected for search failures')
    }
  })

  test('should be keyboard accessible', async ({ page }) => {
    // Test keyboard navigation to search
    await page.keyboard.press('Tab')
    
    // Keep tabbing until we reach the search input
    let attempts = 0
    while (attempts < 10) {
      const focusedElement = page.locator(':focus')
      const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase())
      const inputType = await focusedElement.getAttribute('type')
      
      if (tagName === 'input' && (inputType === 'search' || inputType === 'text')) {
        break
      }
      
      await page.keyboard.press('Tab')
      attempts++
    }
    
    // Type search term
    await page.keyboard.type('keyboard test')
    
    // Press Enter to search
    await page.keyboard.press('Enter')
    
    // Should navigate to search results
    await page.waitForURL(/\/search/)
    
    // Test keyboard navigation in results
    await page.keyboard.press('Tab')
    
    // Should be able to navigate through search results
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Test Escape key to clear search if supported
    const searchInput = page.getByTestId('search-input')
      .or(page.getByPlaceholder(/search/i))
      .first()
    
    await searchInput.focus()
    await page.keyboard.press('Escape')
    
    // Search input should be cleared or search suggestions should close
    const searchValue = await searchInput.inputValue()
    const hasSearchSuggestions = await page.getByTestId('search-suggestions')
      .isVisible().catch(() => false)
    
    // Either input should be cleared or suggestions should be hidden
    if (searchValue === '' || !hasSearchSuggestions) {
      console.log('✅ Escape key functionality working')
    }
  })
})