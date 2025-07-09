/**
 * MySetlist Load Testing Suite
 * 
 * Progressive load testing for concert setlist voting platform
 * Tests realistic user behavior patterns
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('error_rate')
const responseTime = new Trend('response_time')
const votingSuccess = new Rate('voting_success_rate')
const searchLatency = new Trend('search_latency')
const pageLoadTime = new Trend('page_load_time')
const apiErrorCount = new Counter('api_errors')

// Load testing configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 100 },    // Warm up with 100 users
    { duration: '3m', target: 500 },    // Scale to 500 users
    { duration: '5m', target: 1000 },   // Peak at 1000 users
    { duration: '10m', target: 2000 },  // Sustained load at 2000 users
    { duration: '5m', target: 5000 },   // Stress test at 5000 users
    { duration: '2m', target: 10000 },  // Maximum load at 10000 users
    { duration: '5m', target: 10000 },  // Hold maximum load
    { duration: '5m', target: 0 },      // Ramp down
  ],
  
  thresholds: {
    // Overall performance targets
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    
    // Custom metric thresholds
    error_rate: ['rate<0.03'],         // Custom error rate under 3%
    response_time: ['p(90)<1500'],     // 90% under 1.5s
    voting_success_rate: ['rate>0.95'], // 95% voting success
    search_latency: ['p(95)<500'],     // Search under 500ms
    page_load_time: ['p(95)<3000'],    // Page loads under 3s
  }
}

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const artists = ['radiohead', 'pearl-jam', 'foo-fighters', 'nirvana', 'red-hot-chili-peppers']
const searchTerms = ['rad', 'pea', 'foo', 'nir', 'red']

// Helper functions
function getRandomArtist() {
  return artists[Math.floor(Math.random() * artists.length)]
}

function getRandomSearchTerm() {
  return searchTerms[Math.floor(Math.random() * searchTerms.length)]
}

// Main test scenario
export default function () {
  group('MySetlist User Journey', () => {
    
    // Scenario 1: Homepage Load (30% of users)
    if (Math.random() < 0.3) {
      group('Homepage Visit', () => {
        const startTime = Date.now()
        const response = http.get(`${BASE_URL}/`)
        const loadTime = Date.now() - startTime
        
        pageLoadTime.add(loadTime)
        responseTime.add(response.timings.duration)
        
        const success = check(response, {
          'homepage loads': (r) => r.status === 200,
          'homepage contains MySetlist': (r) => r.body.includes('MySetlist'),
          'homepage loads in <3s': (r) => r.timings.duration < 3000,
        })
        
        if (!success) {
          errorRate.add(1)
          apiErrorCount.add(1)
        } else {
          errorRate.add(0)
        }
        
        sleep(Math.random() * 3 + 1) // 1-4s think time
      })
    }
    
    // Scenario 2: Artist Search (40% of users)
    else if (Math.random() < 0.7) {
      group('Artist Search Flow', () => {
        // Search for artists
        const searchTerm = getRandomSearchTerm()
        const startTime = Date.now()
        
        const searchResponse = http.get(`${BASE_URL}/api/search/artists?q=${searchTerm}`)
        const searchTime = Date.now() - startTime
        
        searchLatency.add(searchTime)
        responseTime.add(searchResponse.timings.duration)
        
        const searchSuccess = check(searchResponse, {
          'search API responds': (r) => r.status === 200,
          'search returns JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
          'search completes quickly': (r) => r.timings.duration < 500,
        })
        
        if (!searchSuccess) {
          errorRate.add(1)
          apiErrorCount.add(1)
        } else {
          errorRate.add(0)
          
          // Navigate to search results page
          const searchPageResponse = http.get(`${BASE_URL}/search?q=${searchTerm}`)
          
          check(searchPageResponse, {
            'search page loads': (r) => r.status === 200,
            'search results displayed': (r) => r.body.includes('search') || r.body.includes('artist'),
          })
        }
        
        sleep(Math.random() * 2 + 1) // 1-3s think time
      })
    }
    
    // Scenario 3: Artist Page & Voting (25% of users)
    else if (Math.random() < 0.95) {
      group('Artist Page & Voting Flow', () => {
        const artist = getRandomArtist()
        
        // Visit artist page
        const artistResponse = http.get(`${BASE_URL}/artists/${artist}`)
        responseTime.add(artistResponse.timings.duration)
        
        const artistPageSuccess = check(artistResponse, {
          'artist page loads': (r) => r.status === 200,
          'artist page has content': (r) => r.body.length > 1000,
        })
        
        if (!artistPageSuccess) {
          errorRate.add(1)
          return
        }
        
        sleep(Math.random() * 2 + 1)
        
        // Get shows for artist
        const showsResponse = http.get(`${BASE_URL}/api/artists/${artist}/shows`)
        
        const showsSuccess = check(showsResponse, {
          'shows API responds': (r) => r.status === 200,
          'shows data returned': (r) => {
            try {
              const shows = JSON.parse(r.body)
              return Array.isArray(shows) || (shows && shows.data)
            } catch {
              return false
            }
          },
        })
        
        if (!showsSuccess) {
          errorRate.add(1)
          apiErrorCount.add(1)
          return
        }
        
        sleep(Math.random() * 3 + 1)
        
        // Simulate voting (if shows exist)
        try {
          const showsData = JSON.parse(showsResponse.body)
          const shows = Array.isArray(showsData) ? showsData : showsData.data
          
          if (shows && shows.length > 0) {
            const randomShow = shows[Math.floor(Math.random() * shows.length)]
            
            // Visit show page
            const showResponse = http.get(`${BASE_URL}/shows/${randomShow.id}`)
            
            check(showResponse, {
              'show page loads': (r) => r.status === 200,
            })
            
            sleep(Math.random() * 2 + 1)
            
            // Simulate voting
            const votePayload = JSON.stringify({
              setlist_song_id: 'test-song-id',
              vote_type: Math.random() < 0.7 ? 'up' : 'down'
            })
            
            const voteResponse = http.post(`${BASE_URL}/api/votes`, votePayload, {
              headers: { 'Content-Type': 'application/json' },
            })
            
            const voteSuccess = check(voteResponse, {
              'vote API responds': (r) => r.status === 200 || r.status === 401, // 401 if not authenticated
              'vote processed': (r) => r.status !== 500,
            })
            
            votingSuccess.add(voteSuccess ? 1 : 0)
            
            if (!voteSuccess) {
              apiErrorCount.add(1)
            }
          }
        } catch (e) {
          console.error('Error in voting flow:', e)
          errorRate.add(1)
        }
        
        errorRate.add(0)
      })
    }
    
    // Scenario 4: Trending Page (5% of users)
    else {
      group('Trending Page Visit', () => {
        const trendingResponse = http.get(`${BASE_URL}/trending`)
        responseTime.add(trendingResponse.timings.duration)
        
        const trendingSuccess = check(trendingResponse, {
          'trending page loads': (r) => r.status === 200,
          'trending page has content': (r) => r.body.includes('trending') || r.body.includes('popular'),
        })
        
        if (!trendingSuccess) {
          errorRate.add(1)
        } else {
          errorRate.add(0)
        }
        
        sleep(Math.random() * 4 + 2) // 2-6s think time
      })
    }
  })
  
  // Random sleep between user sessions
  sleep(Math.random() * 2 + 0.5) // 0.5-2.5s between actions
}

// Setup function
export function setup() {
  console.log('🚀 Starting MySetlist Load Testing')
  console.log(`📊 Target: ${BASE_URL}`)
  console.log('⏱️  Duration: ~40 minutes with up to 10,000 concurrent users')
  
  // Verify the application is running
  const response = http.get(BASE_URL)
  if (response.status !== 200) {
    throw new Error(`Application not available at ${BASE_URL}. Status: ${response.status}`)
  }
  
  return { startTime: new Date().toISOString() }
}

// Teardown function
export function teardown(data) {
  console.log('✅ MySetlist Load Testing Complete')
  console.log(`🕐 Started: ${data.startTime}`)
  console.log(`🕐 Ended: ${new Date().toISOString()}`)
}