/**
 * MySetlist Stress Testing Suite
 * 
 * High-intensity stress testing to find breaking points
 * Tests system behavior under extreme load conditions
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Stress testing metrics
const stressErrorRate = new Rate('stress_error_rate')
const systemBreakpoint = new Trend('system_breakpoint')
const resourceExhaustion = new Counter('resource_exhaustion')
const crashDetection = new Counter('system_crashes')

export const options = {
  stages: [
    // Aggressive ramp up to stress system
    { duration: '1m', target: 1000 },   // Quick ramp to 1k
    { duration: '2m', target: 5000 },   // Aggressive scaling
    { duration: '3m', target: 15000 },  // Beyond normal capacity
    { duration: '5m', target: 25000 },  // Extreme stress load
    { duration: '10m', target: 50000 }, // Maximum stress test
    { duration: '2m', target: 25000 },  // Partial recovery
    { duration: '3m', target: 0 },      // Emergency shutdown
  ],
  
  thresholds: {
    // Relaxed thresholds for stress testing
    http_req_duration: ['p(95)<10000'], // Allow up to 10s response time
    http_req_failed: ['rate<0.25'],     // Accept 25% failure rate
    stress_error_rate: ['rate<0.3'],    // Monitor stress-specific errors
  },
  
  // Resource limits for stress testing
  noConnectionReuse: true, // Stress connection pooling
  noVUConnectionReuse: true,
  
  // Extended timeouts for stress conditions
  setupTimeout: '5m',
  teardownTimeout: '5m'
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Stress test patterns
const stressPatterns = [
  'database_overload',
  'memory_exhaustion', 
  'connection_flooding',
  'api_bombardment',
  'concurrent_voting'
]

function getStressPattern() {
  return stressPatterns[Math.floor(Math.random() * stressPatterns.length)]
}

export default function () {
  const pattern = getStressPattern()
  
  group(`Stress Pattern: ${pattern}`, () => {
    
    switch (pattern) {
      case 'database_overload':
        // Hammer database with complex queries
        group('Database Overload Test', () => {
          const responses = []
          
          // Rapid-fire database queries
          for (let i = 0; i < 5; i++) {
            responses.push(http.get(`${BASE_URL}/api/search/artists?q=stress_test_${i}`))
            responses.push(http.get(`${BASE_URL}/api/shows?limit=100&offset=${i * 100}`))
            responses.push(http.get(`${BASE_URL}/api/trending?complex=true`))
          }
          
          const failures = responses.filter(r => r.status >= 500)
          if (failures.length > 3) {
            resourceExhaustion.add(1)
            systemBreakpoint.add(failures.length)
          }
          
          stressErrorRate.add(failures.length / responses.length)
        })
        break
        
      case 'memory_exhaustion':
        // Request large payloads to stress memory
        group('Memory Exhaustion Test', () => {
          const largeQueries = [
            `${BASE_URL}/api/artists?limit=1000`,
            `${BASE_URL}/api/shows?include_setlists=true&limit=500`,
            `${BASE_URL}/api/search/artists?q=a&include_all=true`
          ]
          
          largeQueries.forEach(url => {
            const response = http.get(url)
            if (response.status === 503 || response.status === 507) {
              resourceExhaustion.add(1)
            }
            if (response.timings.duration > 30000) {
              systemBreakpoint.add(response.timings.duration)
            }
          })
        })
        break
        
      case 'connection_flooding':
        // Flood with rapid connections
        group('Connection Flooding Test', () => {
          const rapidRequests = []
          
          // Send 20 rapid requests
          for (let i = 0; i < 20; i++) {
            rapidRequests.push(http.get(`${BASE_URL}/`, {
              timeout: '1s'
            }))
          }
          
          const timeouts = rapidRequests.filter(r => r.error_code === 1050)
          if (timeouts.length > 10) {
            resourceExhaustion.add(1)
          }
          
          const errors = rapidRequests.filter(r => r.status >= 500)
          stressErrorRate.add(errors.length / rapidRequests.length)
        })
        break
        
      case 'api_bombardment':
        // Bombardment of all API endpoints
        group('API Bombardment Test', () => {
          const apis = [
            '/api/artists',
            '/api/shows', 
            '/api/votes',
            '/api/search/artists',
            '/api/trending',
            '/api/stats',
            '/api/sync/health'
          ]
          
          apis.forEach(endpoint => {
            // Hit each endpoint multiple times rapidly
            for (let i = 0; i < 3; i++) {
              const response = http.get(`${BASE_URL}${endpoint}`)
              
              if (response.status === 429) {
                // Rate limiting activated - good stress response
                console.log(`Rate limiting active on ${endpoint}`)
              } else if (response.status >= 500) {
                crashDetection.add(1)
                systemBreakpoint.add(1)
              }
            }
          })
        })
        break
        
      case 'concurrent_voting':
        // Simulate voting storm
        group('Concurrent Voting Storm', () => {
          const votePayload = JSON.stringify({
            setlist_song_id: `stress_test_${Math.random()}`,
            vote_type: 'up'
          })
          
          // Rapid voting attempts
          for (let i = 0; i < 10; i++) {
            const response = http.post(`${BASE_URL}/api/votes`, votePayload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: '2s'
            })
            
            if (response.status === 503) {
              resourceExhaustion.add(1)
            }
          }
        })
        break
    }
  })
  
  // Minimal sleep for maximum stress
  sleep(0.1)
}

export function setup() {
  console.log('💥 Starting MySetlist STRESS Testing')
  console.log('⚠️  WARNING: This will attempt to break the system')
  console.log(`📊 Target: ${BASE_URL}`)
  console.log('🔥 Max Load: 50,000 concurrent users')
  
  // Check if system is ready for stress testing
  const response = http.get(BASE_URL)
  if (response.status !== 200) {
    throw new Error(`System not ready for stress testing. Status: ${response.status}`)
  }
  
  return { 
    startTime: new Date().toISOString(),
    baselineResponseTime: response.timings.duration
  }
}

export function teardown(data) {
  console.log('🏁 MySetlist Stress Testing Complete')
  console.log(`⏱️  Started: ${data.startTime}`)
  console.log(`⏱️  Ended: ${new Date().toISOString()}`)
  console.log(`📊 Baseline Response Time: ${data.baselineResponseTime}ms`)
  
  // Check if system is still responsive after stress
  const recoveryResponse = http.get(BASE_URL)
  if (recoveryResponse.status === 200) {
    console.log('✅ System survived stress testing')
  } else {
    console.log('⚠️  System may need recovery time')
  }
}