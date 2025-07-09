import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types_db'

/**
 * Integration tests for Search API
 * 
 * Tests the search functionality with real database connections
 */

describe('Search API Integration', () => {
  let supabase: ReturnType<typeof createClient<Database>>
  let testArtistId: string
  
  beforeAll(async () => {
    // Setup test database connection
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
    
    // Create test data
    const { data: testArtist, error: artistError } = await supabase
      .from('artists')
      .insert({
        name: 'Integration Test Artist',
        slug: 'integration-test-artist',
        image_url: 'https://example.com/test.jpg',
        genres: ['rock', 'alternative'],
        followers: 1000,
        verified: true
      })
      .select()
      .single()
    
    if (artistError) throw artistError
    testArtistId = testArtist.id
  })
  
  afterAll(async () => {
    // Cleanup test data
    if (testArtistId) {
      await supabase
        .from('artists')
        .delete()
        .eq('id', testArtistId)
    }
  })

  it('should search artists by name', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=Integration Test')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    
    const foundArtist = data.find((artist: any) => 
      artist.name === 'Integration Test Artist'
    )
    
    expect(foundArtist).toBeDefined()
    expect(foundArtist.slug).toBe('integration-test-artist')
    expect(foundArtist.genres).toContain('rock')
  })

  it('should handle case-insensitive search', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=integration%20test')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    const foundArtist = data.find((artist: any) => 
      artist.name === 'Integration Test Artist'
    )
    
    expect(foundArtist).toBeDefined()
  })

  it('should handle partial name search', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=Integration')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    const foundArtist = data.find((artist: any) => 
      artist.name.includes('Integration')
    )
    
    expect(foundArtist).toBeDefined()
  })

  it('should limit search results', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=test&limit=5')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(5)
  })

  it('should handle empty search query', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=')
    
    expect(response.status).toBe(400)
    
    const data = await response.json()
    
    expect(data.error).toBeDefined()
    expect(data.error).toContain('query')
  })

  it('should handle invalid search parameters', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?limit=invalid')
    
    expect(response.status).toBe(400)
    
    const data = await response.json()
    
    expect(data.error).toBeDefined()
  })

  it('should search by genre', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=rock&genre=rock')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    if (data.length > 0) {
      const foundArtist = data.find((artist: any) => 
        artist.genres && artist.genres.includes('rock')
      )
      
      expect(foundArtist).toBeDefined()
    }
  })

  it('should return proper artist data structure', async () => {
    const response = await fetch('http://localhost:3000/api/search/artists?q=Integration Test')
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    if (data.length > 0) {
      const artist = data[0]
      
      // Verify required fields
      expect(artist).toHaveProperty('id')
      expect(artist).toHaveProperty('name')
      expect(artist).toHaveProperty('slug')
      expect(artist).toHaveProperty('image_url')
      expect(artist).toHaveProperty('genres')
      expect(artist).toHaveProperty('followers')
      expect(artist).toHaveProperty('verified')
      
      // Verify data types
      expect(typeof artist.id).toBe('string')
      expect(typeof artist.name).toBe('string')
      expect(typeof artist.slug).toBe('string')
      expect(Array.isArray(artist.genres)).toBe(true)
      expect(typeof artist.followers).toBe('number')
      expect(typeof artist.verified).toBe('boolean')
    }
  })

  it('should handle special characters in search', async () => {
    // Test with various special characters
    const specialQueries = [
      'AC/DC',
      'Guns N\' Roses',
      'Sigur Rós',
      'Mötley Crüe'
    ]
    
    for (const query of specialQueries) {
      const response = await fetch(
        `http://localhost:3000/api/search/artists?q=${encodeURIComponent(query)}`
      )
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    }
  })

  it('should handle pagination', async () => {
    const firstPageResponse = await fetch('http://localhost:3000/api/search/artists?q=test&limit=2&offset=0')
    const secondPageResponse = await fetch('http://localhost:3000/api/search/artists?q=test&limit=2&offset=2')
    
    expect(firstPageResponse.status).toBe(200)
    expect(secondPageResponse.status).toBe(200)
    
    const firstPageData = await firstPageResponse.json()
    const secondPageData = await secondPageResponse.json()
    
    expect(Array.isArray(firstPageData)).toBe(true)
    expect(Array.isArray(secondPageData)).toBe(true)
    
    // Results should be different (assuming enough test data)
    if (firstPageData.length > 0 && secondPageData.length > 0) {
      expect(firstPageData[0].id).not.toBe(secondPageData[0].id)
    }
  })

  it('should handle SQL injection attempts', async () => {
    const maliciousQueries = [
      "'; DROP TABLE artists; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --"
    ]
    
    for (const query of maliciousQueries) {
      const response = await fetch(
        `http://localhost:3000/api/search/artists?q=${encodeURIComponent(query)}`
      )
      
      // Should not return 500 error or expose database errors
      expect(response.status).not.toBe(500)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
      }
    }
  })

  it('should return results sorted by relevance', async () => {
    // Create additional test artists for sorting test
    const testArtists = [
      { name: 'Test Band Primary', slug: 'test-band-primary' },
      { name: 'Secondary Test Group', slug: 'secondary-test-group' },
      { name: 'Another Test Artist', slug: 'another-test-artist' }
    ]
    
    const createdArtists = []
    
    try {
      for (const artist of testArtists) {
        const { data, error } = await supabase
          .from('artists')
          .insert({
            ...artist,
            image_url: 'https://example.com/test.jpg',
            genres: ['test'],
            followers: Math.floor(Math.random() * 1000),
            verified: false
          })
          .select()
          .single()
        
        if (!error) {
          createdArtists.push(data.id)
        }
      }
      
      const response = await fetch('http://localhost:3000/api/search/artists?q=Test')
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      if (data.length > 1) {
        // Artists with "Test" at the beginning should rank higher
        const firstResult = data[0]
        expect(firstResult.name.toLowerCase().startsWith('test')).toBe(true)
      }
      
    } finally {
      // Cleanup test artists
      if (createdArtists.length > 0) {
        await supabase
          .from('artists')
          .delete()
          .in('id', createdArtists)
      }
    }
  })

  it('should handle concurrent search requests', async () => {
    // Send multiple concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(`http://localhost:3000/api/search/artists?q=test${i}`)
    )
    
    const responses = await Promise.all(promises)
    
    // All requests should complete successfully
    responses.forEach(response => {
      expect(response.status).toBe(200)
    })
    
    // Verify all responses are valid JSON
    const dataPromises = responses.map(response => response.json())
    const dataResults = await Promise.all(dataPromises)
    
    dataResults.forEach(data => {
      expect(Array.isArray(data)).toBe(true)
    })
  })

  it('should respect rate limiting', async () => {
    // Send many rapid requests to test rate limiting
    const rapidRequests = Array.from({ length: 100 }, () =>
      fetch('http://localhost:3000/api/search/artists?q=test')
    )
    
    const responses = await Promise.all(rapidRequests.map(req => 
      req.catch(err => ({ status: 0, error: err }))
    ))
    
    const successfulResponses = responses.filter(r => r.status === 200)
    const rateLimitedResponses = responses.filter(r => r.status === 429)
    
    // Should have some successful responses
    expect(successfulResponses.length).toBeGreaterThan(0)
    
    // May have rate limited responses (depending on implementation)
    if (rateLimitedResponses.length > 0) {
      console.log(`✅ Rate limiting active: ${rateLimitedResponses.length} requests limited`)
    }
  })
})