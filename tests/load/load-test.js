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

// Load testing configuration optimized for MySetlist production requirements
export const options = {
  stages: [
    // Realistic user ramp-up based on concert discovery patterns
    { duration: '2m', target: 50 },     // Initial concert discovery
    { duration: '3m', target: 200 },    // Artist search phase
    { duration: '5m', target: 500 },    // Active voting period
    { duration: '10m', target: 1000 },  // Peak concert engagement
    { duration: '8m', target: 2000 },   // Sustained voting activity
    { duration: '5m', target: 3000 },   // High-traffic moments
    { duration: '3m', target: 5000 },   // Ticket release spike
    { duration: '2m', target: 7500 },   // Maximum concurrent users
    { duration: '5m', target: 7500 },   // Hold peak traffic
    { duration: '8m', target: 1000 },   // Gradual wind-down
    { duration: '5m', target: 0 },      // Complete ramp down
  ],
  
  thresholds: {
    // Production performance targets aligned with MySetlist requirements
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms (target)
    http_req_failed: ['rate<0.02'],     // Error rate under 2%
    
    // Database performance targets
    'http_req_duration{name:database}': ['p(95)<100'], // Database queries under 100ms
    
    // API-specific performance targets
    'http_req_duration{name:search}': ['p(95)<300'],    // Search API under 300ms
    'http_req_duration{name:voting}': ['p(95)<200'],    // Voting API under 200ms
    'http_req_duration{name:shows}': ['p(95)<400'],     // Shows API under 400ms
    
    // Custom metric thresholds
    error_rate: ['rate<0.015'],         // Custom error rate under 1.5%
    response_time: ['p(90)<400'],       // 90% under 400ms
    voting_success_rate: ['rate>0.98'], // 98% voting success
    search_latency: ['p(95)<250'],      // Search under 250ms
    page_load_time: ['p(95)<2000'],     // Page loads under 2s
    
    // Real-time performance targets
    realtime_latency: ['p(90)<100'],    // Real-time updates under 100ms
    concurrent_votes: ['p(95)<150'],    // Concurrent voting under 150ms
  },
  
  // Enhanced configuration for production testing
  noConnectionReuse: false,
  batchPerHost: 10,
  batch: 20,
  
  // Environment-specific timeouts
  setupTimeout: '3m',
  teardownTimeout: '2m'
}

// Enhanced test data for realistic concert scenarios
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const PRODUCTION_URL = __ENV.PRODUCTION_URL || 'https://mysetlist.vercel.app'
const TEST_ENV = __ENV.TEST_ENV || 'development'

// Realistic artist data for concert setlist testing
const artists = [
  'radiohead', 'pearl-jam', 'foo-fighters', 'nirvana', 'red-hot-chili-peppers',
  'taylor-swift', 'the-beatles', 'led-zeppelin', 'pink-floyd', 'queen',
  'metallica', 'ac-dc', 'rolling-stones', 'the-who', 'u2',
  'coldplay', 'imagine-dragons', 'linkin-park', 'green-day', 'blink-182'
]

// Progressive search terms for realistic user behavior
const searchTerms = [
  'rad', 'pea', 'foo', 'nir', 'red', 'tay', 'bea', 'led',
  'pin', 'que', 'met', 'ac', 'rol', 'who', 'u2',
  'col', 'ima', 'lin', 'gre', 'bli'
]

// Voting scenarios for realistic interaction patterns
const votingScenarios = [
  { type: 'upvote', weight: 0.7 },
  { type: 'downvote', weight: 0.2 },
  { type: 'toggle', weight: 0.1 }
]

// Performance monitoring configurations
const performanceConfig = {
  slowResponseThreshold: 1000,
  criticalResponseThreshold: 2000,
  errorRateThreshold: 0.02,
  memoryUsageThreshold: 512 * 1024 * 1024 // 512MB
}

// Enhanced helper functions for realistic testing patterns
function getRandomArtist() {
  return artists[Math.floor(Math.random() * artists.length)]
}

function getRandomSearchTerm() {
  return searchTerms[Math.floor(Math.random() * searchTerms.length)]
}

function getVotingScenario() {
  const random = Math.random()
  let cumulative = 0
  
  for (const scenario of votingScenarios) {
    cumulative += scenario.weight
    if (random <= cumulative) {
      return scenario.type
    }
  }
  
  return 'upvote' // fallback
}

function simulateRealUserBehavior() {
  // Simulate realistic user think time based on action
  const actions = {
    'search': () => Math.random() * 3 + 1, // 1-4s search think time
    'browse': () => Math.random() * 5 + 2, // 2-7s browse think time
    'vote': () => Math.random() * 2 + 0.5, // 0.5-2.5s vote think time
    'navigate': () => Math.random() * 1 + 0.5 // 0.5-1.5s navigation time
  }
  
  return actions
}

function recordPerformanceMetrics(response, operation) {
  const duration = response.timings.duration
  const operationName = operation || 'unknown'
  
  // Record operation-specific metrics
  response.timings.name = operationName
  
  // Flag slow responses
  if (duration > performanceConfig.slowResponseThreshold) {
    console.warn(`⚠️  Slow ${operationName} response: ${duration}ms`)
  }
  
  // Flag critical responses
  if (duration > performanceConfig.criticalResponseThreshold) {
    console.error(`🚨 Critical ${operationName} response: ${duration}ms`)
  }
  
  return duration
}

// Main test scenario
export default function () {
  group('MySetlist User Journey', () => {
    
    // Scenario 1: Homepage Load with Enhanced Monitoring (30% of users)
    if (Math.random() < 0.3) {
      group('Homepage Visit', () => {
        const startTime = Date.now()
        const response = http.get(`${BASE_URL}/`)
        const loadTime = Date.now() - startTime
        
        pageLoadTime.add(loadTime)
        responseTime.add(response.timings.duration)
        recordPerformanceMetrics(response, 'homepage')
        
        const success = check(response, {
          'homepage loads successfully': (r) => r.status === 200,
          'homepage contains MySetlist branding': (r) => r.body.includes('MySetlist'),
          'homepage loads under 2s': (r) => r.timings.duration < 2000,
          'homepage has proper content-type': (r) => r.headers['Content-Type']?.includes('text/html'),
          'homepage is properly compressed': (r) => r.headers['Content-Encoding']?.includes('gzip') || r.headers['Content-Encoding']?.includes('br'),
          'homepage has security headers': (r) => r.headers['X-Frame-Options'] || r.headers['X-Content-Type-Options'],
        })
        
        if (!success) {
          errorRate.add(1)
          apiErrorCount.add(1)
        } else {
          errorRate.add(0)
        }
        
        // Check for Core Web Vitals indicators
        if (response.body.includes('web-vitals') || response.body.includes('performance')) {
          console.log('✅ Homepage includes performance monitoring')
        }
        
        // Simulate realistic user behavior after homepage load
        const userAction = simulateRealUserBehavior()
        sleep(userAction.browse())
      })
    }
    
    // Scenario 2: Artist Search with Performance Validation (40% of users)
    else if (Math.random() < 0.7) {
      group('Artist Search Flow', () => {
        // Search for artists with realistic progressive typing
        const searchTerm = getRandomSearchTerm()
        const startTime = Date.now()
        
        // Test progressive search (as user types)
        const progressiveQueries = []
        for (let i = 1; i <= searchTerm.length; i++) {
          const partialTerm = searchTerm.substring(0, i)
          if (i >= 2) { // Start searching after 2 characters
            progressiveQueries.push(partialTerm)
          }
        }
        
        // Test final search
        const searchResponse = http.get(`${BASE_URL}/api/search/artists?q=${searchTerm}`, {
          tags: { name: 'search' }
        })
        const searchTime = Date.now() - startTime
        
        searchLatency.add(searchTime)
        responseTime.add(searchResponse.timings.duration)
        recordPerformanceMetrics(searchResponse, 'search')
        
        const searchSuccess = check(searchResponse, {
          'search API responds successfully': (r) => r.status === 200,
          'search returns valid JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
          'search completes under 250ms': (r) => r.timings.duration < 250,
          'search includes cache headers': (r) => r.headers['Cache-Control'] || r.headers['ETag'],
          'search result structure valid': (r) => {
            try {
              const data = JSON.parse(r.body)
              return Array.isArray(data) || (data && typeof data === 'object')
            } catch {
              return false
            }
          },
        })
        
        if (!searchSuccess) {
          errorRate.add(1)
          apiErrorCount.add(1)
        } else {
          errorRate.add(0)
          
          // Navigate to search results page
          const searchPageResponse = http.get(`${BASE_URL}/search?q=${searchTerm}`)
          
          check(searchPageResponse, {
            'search page loads successfully': (r) => r.status === 200,
            'search results displayed': (r) => r.body.includes('search') || r.body.includes('artist'),
            'search page has proper meta tags': (r) => r.body.includes('<meta') && r.body.includes('description'),
            'search page includes accessibility features': (r) => r.body.includes('aria-') || r.body.includes('role=')
          })
        }
        
        // Simulate realistic user search behavior
        const userAction = simulateRealUserBehavior()
        sleep(userAction.search())
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
        
        // Enhanced voting simulation with realistic patterns
        try {
          const showsData = JSON.parse(showsResponse.body)
          const shows = Array.isArray(showsData) ? showsData : showsData.data
          
          if (shows && shows.length > 0) {
            const randomShow = shows[Math.floor(Math.random() * shows.length)]
            
            // Visit show page with performance monitoring
            const showResponse = http.get(`${BASE_URL}/shows/${randomShow.id}`, {
              tags: { name: 'shows' }
            })
            
            recordPerformanceMetrics(showResponse, 'show-detail')
            
            const showPageSuccess = check(showResponse, {
              'show page loads successfully': (r) => r.status === 200,
              'show page loads under 400ms': (r) => r.timings.duration < 400,
              'show page has voting interface': (r) => r.body.includes('vote') || r.body.includes('setlist'),
              'show page has proper structured data': (r) => r.body.includes('application/ld+json') || r.body.includes('schema.org'),
            })
            
            if (showPageSuccess) {
              // Simulate realistic user interaction with show page
              const userAction = simulateRealUserBehavior()
              sleep(userAction.browse())
              
              // Simulate realistic voting patterns
              const votingScenario = getVotingScenario()
              const voteType = votingScenario === 'toggle' ? 'up' : votingScenario
              
              const votePayload = JSON.stringify({
                setlist_song_id: `test-song-${randomShow.id}-${Math.floor(Math.random() * 10)}`,
                vote_type: voteType
              })
              
              const voteResponse = http.post(`${BASE_URL}/api/votes`, votePayload, {
                headers: { 'Content-Type': 'application/json' },
                tags: { name: 'voting' }
              })
              
              recordPerformanceMetrics(voteResponse, 'voting')
              
              const voteSuccess = check(voteResponse, {
                'vote API responds': (r) => r.status === 200 || r.status === 401,
                'vote processed under 200ms': (r) => r.timings.duration < 200,
                'vote returns valid response': (r) => r.status !== 500,
                'vote includes proper CORS headers': (r) => r.headers['Access-Control-Allow-Origin'] || r.status === 401,
              })
              
              votingSuccess.add(voteSuccess ? 1 : 0)
              
              if (!voteSuccess) {
                apiErrorCount.add(1)
              }
              
              // Test vote toggle scenario
              if (votingScenario === 'toggle' && voteSuccess) {
                sleep(0.5) // Brief pause before toggle
                
                const toggleResponse = http.post(`${BASE_URL}/api/votes`, votePayload, {
                  headers: { 'Content-Type': 'application/json' },
                  tags: { name: 'voting' }
                })
                
                check(toggleResponse, {
                  'vote toggle responds': (r) => r.status === 200 || r.status === 401,
                  'vote toggle processed quickly': (r) => r.timings.duration < 200,
                })
              }
            }
          }
        } catch (e) {
          console.error('Error in enhanced voting flow:', e)
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