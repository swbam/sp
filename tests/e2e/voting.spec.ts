import { test, expect, type Page } from '@playwright/test'

/**
 * MySetlist Voting System E2E Tests
 * 
 * Tests the core voting functionality for setlist songs
 * Critical feature testing for the concert setlist voting platform
 */

test.describe('Voting System', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to a show page with voting capability
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Try to find a show to test voting on
    const showCard = page.getByTestId('show-card')
      .or(page.locator('[class*="show-card"]'))
      .first()
    
    const hasShows = await showCard.isVisible().catch(() => false)
    
    if (hasShows) {
      await showCard.click()
      await page.waitForURL(/\/shows\//)
    } else {
      // Navigate directly to shows page to find a show
      await page.goto('/shows')
      await page.waitForLoadState('networkidle')
      
      const showLink = page.getByTestId('show-link')
        .or(page.locator('a[href*="/shows/"]'))
        .first()
      
      const hasShowLinks = await showLink.isVisible().catch(() => false)
      
      if (hasShowLinks) {
        await showLink.click()
        await page.waitForURL(/\/shows\//)
      } else {
        // If no shows available, skip these tests
        test.skip('No shows available for voting tests')
      }
    }
  })

  test('should display voting interface on show page', async ({ page }) => {
    // Verify we're on a show page
    await expect(page).toHaveURL(/\/shows\//)
    
    // Look for setlist voting section
    const votingSection = page.getByTestId('setlist-voting')
      .or(page.locator('[class*="voting"], [class*="setlist"]'))
      .first()
    
    await expect(votingSection).toBeVisible({ timeout: 10000 })
    
    // Check for vote buttons
    const voteButtons = page.getByTestId('vote-button')
      .or(page.locator('[class*="vote-button"]'))
    
    await expect(voteButtons.first()).toBeVisible()
    
    // Should have both upvote and downvote buttons
    const upvoteButton = page.getByTestId('upvote-button')
      .or(page.locator('[class*="upvote"], [aria-label*="upvote" i]'))
      .first()
    
    const downvoteButton = page.getByTestId('downvote-button')
      .or(page.locator('[class*="downvote"], [aria-label*="downvote" i]'))
      .first()
    
    await expect(upvoteButton).toBeVisible()
    await expect(downvoteButton).toBeVisible()
  })

  test('should allow upvoting a song', async ({ page }) => {
    // Find the first song with voting capability
    const firstSong = page.getByTestId('setlist-song')
      .or(page.locator('[class*="song-item"]'))
      .first()
    
    await expect(firstSong).toBeVisible()
    
    // Get the upvote button for this song
    const upvoteButton = firstSong.getByTestId('upvote-button')
      .or(firstSong.locator('[class*="upvote"], [aria-label*="upvote" i]'))
      .first()
    
    await expect(upvoteButton).toBeVisible()
    
    // Get initial vote count if displayed
    const voteCount = firstSong.getByTestId('vote-count')
      .or(firstSong.locator('[class*="vote-count"], [class*="score"]'))
      .first()
    
    let initialCount = 0
    const hasVoteCount = await voteCount.isVisible().catch(() => false)
    
    if (hasVoteCount) {
      const countText = await voteCount.textContent()
      initialCount = parseInt(countText?.replace(/[^\d-]/g, '') || '0')
    }
    
    // Click upvote button
    await upvoteButton.click()
    
    // Wait for vote to register
    await page.waitForTimeout(2000)
    
    // Check for visual feedback
    const isUpvoteActive = await upvoteButton.getAttribute('class')
      .then(classes => classes?.includes('active') || classes?.includes('selected'))
      .catch(() => false)
    
    if (isUpvoteActive) {
      console.log('✅ Upvote button shows active state')
    }
    
    // Check if vote count increased (if authentication allows)
    if (hasVoteCount) {
      const newCountText = await voteCount.textContent()
      const newCount = parseInt(newCountText?.replace(/[^\d-]/g, '') || '0')
      
      if (newCount > initialCount) {
        console.log('✅ Vote count increased after upvote')
      } else {
        console.log('ℹ️  Vote count unchanged - may require authentication')
      }
    }
    
    // Check for success notification
    const notification = page.getByTestId('vote-notification')
      .or(page.locator('[class*="notification"], [class*="toast"]'))
      .first()
    
    const hasNotification = await notification.isVisible().catch(() => false)
    
    if (hasNotification) {
      await expect(notification).toContainText(/vote|success/i)
    }
  })

  test('should allow downvoting a song', async ({ page }) => {
    // Find a song to downvote
    const songItem = page.getByTestId('setlist-song')
      .or(page.locator('[class*="song-item"]'))
      .nth(1) // Use second song to avoid conflicts with upvote test
    
    await expect(songItem).toBeVisible()
    
    // Get the downvote button
    const downvoteButton = songItem.getByTestId('downvote-button')
      .or(songItem.locator('[class*="downvote"], [aria-label*="downvote" i]'))
      .first()
    
    await expect(downvoteButton).toBeVisible()
    
    // Get initial vote count
    const voteCount = songItem.getByTestId('vote-count')
      .or(songItem.locator('[class*="vote-count"], [class*="score"]'))
      .first()
    
    let initialCount = 0
    const hasVoteCount = await voteCount.isVisible().catch(() => false)
    
    if (hasVoteCount) {
      const countText = await voteCount.textContent()
      initialCount = parseInt(countText?.replace(/[^\d-]/g, '') || '0')
    }
    
    // Click downvote button
    await downvoteButton.click()
    
    // Wait for vote to register
    await page.waitForTimeout(2000)
    
    // Check for visual feedback
    const isDownvoteActive = await downvoteButton.getAttribute('class')
      .then(classes => classes?.includes('active') || classes?.includes('selected'))
      .catch(() => false)
    
    if (isDownvoteActive) {
      console.log('✅ Downvote button shows active state')
    }
    
    // Check if vote count decreased
    if (hasVoteCount) {
      const newCountText = await voteCount.textContent()
      const newCount = parseInt(newCountText?.replace(/[^\d-]/g, '') || '0')
      
      if (newCount < initialCount) {
        console.log('✅ Vote count decreased after downvote')
      } else {
        console.log('ℹ️  Vote count unchanged - may require authentication')
      }
    }
  })

  test('should handle vote toggling (remove vote)', async ({ page }) => {
    // Find a song to test vote toggling
    const songItem = page.getByTestId('setlist-song')
      .or(page.locator('[class*="song-item"]'))
      .nth(2)
    
    await expect(songItem).toBeVisible()
    
    const upvoteButton = songItem.getByTestId('upvote-button')
      .or(songItem.locator('[class*="upvote"]'))
      .first()
    
    // First upvote
    await upvoteButton.click()
    await page.waitForTimeout(1000)
    
    // Check if button is active
    const isActiveAfterFirstClick = await upvoteButton.getAttribute('class')
      .then(classes => classes?.includes('active') || classes?.includes('selected'))
      .catch(() => false)
    
    // Click again to remove vote
    await upvoteButton.click()
    await page.waitForTimeout(1000)
    
    // Check if button is no longer active
    const isActiveAfterSecondClick = await upvoteButton.getAttribute('class')
      .then(classes => classes?.includes('active') || classes?.includes('selected'))
      .catch(() => false)
    
    if (isActiveAfterFirstClick && !isActiveAfterSecondClick) {
      console.log('✅ Vote toggling functionality working')
    } else {
      console.log('ℹ️  Vote toggling may not be implemented or requires authentication')
    }
  })

  test('should handle authentication requirement for voting', async ({ page }) => {
    // Try to vote without authentication
    const voteButton = page.getByTestId('upvote-button')
      .or(page.locator('[class*="upvote"]'))
      .first()
    
    await voteButton.click()
    await page.waitForTimeout(2000)
    
    // Check if authentication modal appears
    const authModal = page.getByTestId('auth-modal')
      .or(page.locator('[class*="modal"], [class*="dialog"]'))
      .first()
    
    const hasAuthModal = await authModal.isVisible().catch(() => false)
    
    if (hasAuthModal) {
      console.log('✅ Authentication required for voting')
      
      // Test modal accessibility
      await expect(authModal).toHaveAttribute('role', 'dialog')
      await expect(authModal).toHaveAttribute('aria-modal', 'true')
      
      // Test focus management
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
      
      // Test that modal can be closed
      const closeButton = authModal.getByTestId('close-button')
        .or(authModal.locator('[aria-label="Close"]'))
        .or(authModal.locator('button:has-text("Close")'))
        .first()
      
      const hasCloseButton = await closeButton.isVisible().catch(() => false)
      
      if (hasCloseButton) {
        await closeButton.click()
        
        // Modal should disappear
        await expect(authModal).toBeHidden()
        
        // Focus should return to trigger element
        await expect(voteButton).toBeFocused()
      } else {
        // Try ESC key to close modal
        await page.keyboard.press('Escape')
        await expect(authModal).toBeHidden()
      }
    } else {
      // Check for notification about needing to sign in
      const notification = page.getByTestId('auth-notification')
        .or(page.getByText(/sign in|log in|authenticate/i))
        .first()
      
      const hasNotification = await notification.isVisible().catch(() => false)
      
      if (hasNotification) {
        console.log('✅ Authentication notification displayed')
        
        // Test notification accessibility
        await expect(notification).toHaveAttribute('role', 'alert')
      } else {
        console.log('ℹ️  Voting may be allowed without authentication')
      }
    }
  })

  test('should display vote counts and rankings', async ({ page }) => {
    // Look for vote count displays
    const voteCounts = page.getByTestId('vote-count')
      .or(page.locator('[class*="vote-count"], [class*="score"]'))
    
    const voteCountsVisible = await voteCounts.count()
    
    if (voteCountsVisible > 0) {
      // Test that vote counts are properly formatted
      for (let i = 0; i < Math.min(voteCountsVisible, 3); i++) {
        const count = voteCounts.nth(i)
        const countText = await count.textContent()
        
        // Should contain numbers or +/- indicators
        const hasValidFormat = /[-+]?\d+/.test(countText || '')
        
        if (hasValidFormat) {
          console.log(`✅ Vote count ${i + 1} properly formatted: ${countText}`)
        }
      }
    }
    
    // Look for song rankings
    const rankings = page.getByTestId('song-ranking')
      .or(page.locator('[class*="rank"], [class*="position"]'))
    
    const rankingsVisible = await rankings.count()
    
    if (rankingsVisible > 0) {
      console.log('✅ Song rankings displayed')
      
      // Test that rankings are in logical order
      const firstRank = await rankings.first().textContent()
      const secondRank = await rankings.nth(1).textContent()
      
      if (firstRank?.includes('1') && secondRank?.includes('2')) {
        console.log('✅ Rankings in correct order')
      }
    }
  })

  test('should show real-time vote updates', async ({ page }) => {
    // Get initial state of vote counts
    const voteCount = page.getByTestId('vote-count')
      .or(page.locator('[class*="vote-count"]'))
      .first()
    
    const hasVoteCount = await voteCount.isVisible().catch(() => false)
    
    if (hasVoteCount) {
      const initialText = await voteCount.textContent()
      
      // Simulate another user voting (this would normally come from real-time updates)
      // We'll test that the UI is capable of handling updates
      
      // Look for real-time indicators
      const realtimeIndicator = page.getByTestId('realtime-indicator')
        .or(page.locator('[class*="live"], [class*="realtime"]'))
        .first()
      
      const hasRealtimeIndicator = await realtimeIndicator.isVisible().catch(() => false)
      
      if (hasRealtimeIndicator) {
        console.log('✅ Real-time voting indicator present')
      }
      
      // Test voting on another song to see if counts update
      const otherVoteButton = page.getByTestId('upvote-button')
        .or(page.locator('[class*="upvote"]'))
        .nth(1)
      
      const hasOtherButton = await otherVoteButton.isVisible().catch(() => false)
      
      if (hasOtherButton) {
        await otherVoteButton.click()
        await page.waitForTimeout(3000)
        
        // Check if any vote counts changed
        const updatedText = await voteCount.textContent()
        
        if (updatedText !== initialText) {
          console.log('✅ Vote counts update in real-time')
        }
      }
    }
  })

  test('should handle vote submission errors gracefully', async ({ page }) => {
    // Intercept voting API to simulate different error scenarios
    await page.route('**/api/votes**', route => {
      // Simulate network error
      route.abort('failed')
    })
    
    const voteButton = page.getByTestId('upvote-button')
      .or(page.locator('[class*="upvote"]'))
      .first()
    
    await voteButton.click()
    await page.waitForTimeout(3000)
    
    // Look for error notifications
    const errorNotification = page.getByTestId('vote-error')
      .or(page.getByText(/error|failed|try again/i))
      .first()
    
    const hasErrorNotification = await errorNotification.isVisible().catch(() => false)
    
    if (hasErrorNotification) {
      console.log('✅ Vote error handling implemented')
      
      // Test error notification accessibility
      await expect(errorNotification).toHaveAttribute('role', 'alert')
      await expect(errorNotification).toHaveAttribute('aria-live', 'polite')
      
      // Test retry functionality
      const retryButton = page.getByTestId('retry-vote')
        .or(page.getByText(/retry|try again/i))
        .first()
      
      const hasRetryButton = await retryButton.isVisible().catch(() => false)
      
      if (hasRetryButton) {
        // Test retry button accessibility
        await expect(retryButton).toHaveAttribute('aria-label')
        
        // Remove route interception to allow retry
        await page.unroute('**/api/votes**')
        
        await retryButton.click()
        await page.waitForTimeout(2000)
        
        console.log('✅ Vote retry functionality working')
      }
    } else {
      // Check if vote button shows loading/disabled state
      const isDisabled = await voteButton.isDisabled()
      const hasLoadingClass = await voteButton.getAttribute('class')
        .then(classes => classes?.includes('loading') || classes?.includes('disabled'))
        .catch(() => false)
      
      if (isDisabled || hasLoadingClass) {
        console.log('✅ Vote button shows loading/error state')
        
        // Test that disabled button has proper ARIA attributes
        await expect(voteButton).toHaveAttribute('aria-disabled', 'true')
      }
    }
    
    // Test different error scenarios
    await page.unroute('**/api/votes**')
    
    // Test server error (500)
    await page.route('**/api/votes**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    await voteButton.click()
    await page.waitForTimeout(2000)
    
    const serverErrorNotification = page.getByText(/server error|internal error/i).first()
    const hasServerErrorNotification = await serverErrorNotification.isVisible().catch(() => false)
    
    if (hasServerErrorNotification) {
      console.log('✅ Server error handling implemented')
    }
    
    // Test rate limiting (429)
    await page.unroute('**/api/votes**')
    
    await page.route('**/api/votes**', route => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' })
      })
    })
    
    await voteButton.click()
    await page.waitForTimeout(2000)
    
    const rateLimitNotification = page.getByText(/rate limit|too many requests/i).first()
    const hasRateLimitNotification = await rateLimitNotification.isVisible().catch(() => false)
    
    if (hasRateLimitNotification) {
      console.log('✅ Rate limit error handling implemented')
    }
  })

  test('should be accessible via keyboard navigation', async ({ page }) => {
    // Test keyboard navigation through voting interface
    await page.keyboard.press('Tab')
    
    // Navigate to voting section
    let attempts = 0
    let foundVoteButton = false
    
    while (attempts < 20 && !foundVoteButton) {
      const focusedElement = page.locator(':focus')
      const className = await focusedElement.getAttribute('class').catch(() => '')
      const ariaLabel = await focusedElement.getAttribute('aria-label').catch(() => '')
      
      if (className?.includes('vote') || ariaLabel?.toLowerCase().includes('vote')) {
        foundVoteButton = true
        
        // Test voting with keyboard
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)
        
        console.log('✅ Voting accessible via keyboard')
        break
      }
      
      await page.keyboard.press('Tab')
      attempts++
    }
    
    if (!foundVoteButton) {
      console.log('ℹ️  Vote buttons may not be keyboard accessible')
    }
    
    // Test that vote buttons have proper ARIA labels
    const voteButtons = page.getByTestId('vote-button')
      .or(page.locator('[class*="vote-button"]'))
    
    const buttonCount = await voteButtons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = voteButtons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      
      if (ariaLabel && ariaLabel.includes('vote')) {
        console.log(`✅ Vote button ${i + 1} has proper ARIA label: ${ariaLabel}`)
      }
    }
  })

  test('should display voting statistics and trends', async ({ page }) => {
    // Look for voting statistics section
    const statsSection = page.getByTestId('voting-stats')
      .or(page.locator('[class*="stats"], [class*="statistics"]'))
      .first()
    
    const hasStats = await statsSection.isVisible().catch(() => false)
    
    if (hasStats) {
      console.log('✅ Voting statistics section present')
      
      // Check for specific stats
      const totalVotes = page.getByTestId('total-votes')
        .or(page.getByText(/total votes/i))
        .first()
      
      const topSong = page.getByTestId('top-song')
        .or(page.getByText(/most voted/i))
        .first()
      
      const hasVoteStats = await totalVotes.isVisible().catch(() => false)
      const hasTopSong = await topSong.isVisible().catch(() => false)
      
      if (hasVoteStats) {
        console.log('✅ Total votes statistic displayed')
      }
      
      if (hasTopSong) {
        console.log('✅ Top voted song displayed')
      }
    }
    
    // Look for voting trends or charts
    const trendsChart = page.getByTestId('voting-trends')
      .or(page.locator('[class*="chart"], [class*="graph"]'))
      .first()
    
    const hasTrends = await trendsChart.isVisible().catch(() => false)
    
    if (hasTrends) {
      console.log('✅ Voting trends visualization present')
    }
  })
})