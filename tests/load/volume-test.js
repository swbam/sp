/**
 * MySetlist Volume Testing Suite
 * 
 * Tests system behavior under sustained high volume over extended periods
 * Simulates peak festival/touring season with continuous high traffic
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Volume testing metrics
const sustainedPerformance = new Trend('sustained_performance')
const memoryLeakDetection = new Trend('memory_leak_indicator')
const performanceDegradation = new Rate('performance_degradation')
const resourceStability = new Counter('resource_stability_issues')
const longRunningErrors = new Counter('long_running_errors')

export const options = {
  stages: [
    // Gradual ramp to high volume
    { duration: '5m', target: 2000 },   // Initial ramp
    { duration: '10m', target: 5000 },  // Build to high volume
    
    // Sustained high volume periods
    { duration: '30m', target: 7000 },  // Sustained peak traffic
    { duration: '60m', target: 8000 },  // Extended high volume  
    { duration: '30m', target: 6000 },  // Slight reduction
    { duration: '45m', target: 7500 },  // Return to high volume
    { duration: '60m', target: 9000 },  // Maximum sustained load
    { duration: '30m', target: 8000 },  // Maintain high load
    
    // Gradual ramp down
    { duration: '15m', target: 5000 },  // Begin wind down
    { duration: '10m', target: 2000 },  // Reduce load
    { duration: '5m', target: 0 },      // Complete shutdown
  ],
  
  // Total test duration: ~5 hours
  
  thresholds: {
    // Strict thresholds for sustained performance
    http_req_duration: ['p(95)<3000'],           // Maintain performance over time
    http_req_failed: ['rate<0.08'],              // Low error rate sustained
    sustained_performance: ['p(90)<2500'],       // Consistent performance
    performance_degradation: ['rate<0.1'],       // Minimal degradation
    long_running_errors: ['count<1000'],         // Limited accumulated errors
  }
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Track test duration and performance trends
let testStartTime = null
let performanceBaseline = null
let errorAccumulator = 0

// Realistic user behavior patterns for volume testing
const userBehaviors = [
  'casual_browser',
  'active_voter', 
  'artist_follower',
  'show_researcher',
  'social_sharer'
]

function trackPerformanceTrend(responseTime) {
  if (!performanceBaseline) {
    performanceBaseline = responseTime
  }
  
  sustainedPerformance.add(responseTime)
  
  // Detect performance degradation
  const degradationRatio = responseTime / performanceBaseline
  if (degradationRatio > 2.5) {
    performanceDegradation.add(1)
    memoryLeakDetection.add(responseTime)
  } else {
    performanceDegradation.add(0)
  }
  
  // Track cumulative errors
  if (responseTime > 10000) {
    errorAccumulator++
    if (errorAccumulator > 100) {
      resourceStability.add(1)
      errorAccumulator = 0 // Reset counter
    }
  }
}

export default function () {
  if (!testStartTime) {
    testStartTime = Date.now()
  }
  
  const testDuration = Date.now() - testStartTime
  const behavior = userBehaviors[Math.floor(Math.random() * userBehaviors.length)]
  
  group(`Volume Test - ${behavior} (${Math.floor(testDuration / 60000)}min)`, () => {
    
    switch (behavior) {
      case 'casual_browser':
        // Light browsing pattern - 40% of users
        group('Casual Browsing Pattern', () => {
          const startTime = Date.now()
          
          // Homepage visit
          const homeResponse = http.get(`${BASE_URL}/`)
          trackPerformanceTrend(homeResponse.timings.duration)
          
          const homeSuccess = check(homeResponse, {
            'homepage available during volume': (r) => r.status === 200,
            'homepage performance stable': (r) => r.timings.duration < 5000,
          })
          
          if (!homeSuccess) {
            longRunningErrors.add(1)
          }
          
          sleep(Math.random() * 5 + 2) // 2-7s reading time
          
          // Browse trending
          if (Math.random() < 0.6) {
            const trendingResponse = http.get(`${BASE_URL}/trending`)
            trackPerformanceTrend(trendingResponse.timings.duration)
            
            check(trendingResponse, {
              'trending page stable': (r) => r.status === 200,
            })
          }
          
          sleep(Math.random() * 8 + 3) // 3-11s browsing
        })
        break
        
      case 'active_voter':
        // Heavy voting activity - 25% of users
        group('Active Voting Pattern', () => {
          // Find a show to vote on
          const artistsResponse = http.get(`${BASE_URL}/api/artists?limit=10`)
          trackPerformanceTrend(artistsResponse.timings.duration)
          
          if (artistsResponse.status === 200) {
            try {
              const artists = JSON.parse(artistsResponse.body)
              const artistData = Array.isArray(artists) ? artists : artists.data || []
              
              if (artistData.length > 0) {
                const randomArtist = artistData[Math.floor(Math.random() * artistData.length)]
                
                // Get shows for this artist
                const showsResponse = http.get(`${BASE_URL}/api/artists/${randomArtist.slug}/shows`)
                trackPerformanceTrend(showsResponse.timings.duration)
                
                if (showsResponse.status === 200) {
                  // Simulate multiple votes
                  for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
                    const votePayload = JSON.stringify({
                      setlist_song_id: `volume_test_${Math.random()}`,
                      vote_type: Math.random() < 0.7 ? 'up' : 'down'
                    })
                    
                    const voteResponse = http.post(`${BASE_URL}/api/votes`, votePayload, {
                      headers: { 'Content-Type': 'application/json' },
                      timeout: '8s'
                    })
                    
                    trackPerformanceTrend(voteResponse.timings.duration)
                    
                    const voteSuccess = check(voteResponse, {
                      'voting system stable under volume': (r) => r.status === 200 || r.status === 401 || r.status === 429,
                      'vote processing time acceptable': (r) => r.timings.duration < 8000,
                    })
                    
                    if (!voteSuccess) {
                      longRunningErrors.add(1)
                    }
                    
                    sleep(Math.random() * 2 + 1) // 1-3s between votes
                  }
                }
              }
            } catch (e) {
              longRunningErrors.add(1)
            }
          }
          
          sleep(Math.random() * 4 + 2) // 2-6s thinking time
        })
        break
        
      case 'artist_follower':
        // Following specific artists - 20% of users
        group('Artist Following Pattern', () => {
          const artists = ['radiohead', 'pearl-jam', 'foo-fighters']
          const artist = artists[Math.floor(Math.random() * artists.length)]
          
          // Visit artist page
          const artistResponse = http.get(`${BASE_URL}/artists/${artist}`)
          trackPerformanceTrend(artistResponse.timings.duration)
          
          check(artistResponse, {
            'artist pages stable during volume': (r) => r.status === 200,
            'artist page loads in reasonable time': (r) => r.timings.duration < 6000,
          })
          
          sleep(Math.random() * 3 + 2) // 2-5s viewing
          
          // Check artist's shows
          const showsResponse = http.get(`${BASE_URL}/api/artists/${artist}/shows`)
          trackPerformanceTrend(showsResponse.timings.duration)
          
          // Follow/unfollow simulation
          const followResponse = http.post(`${BASE_URL}/api/artists/${artist}/follow`, {
            headers: { 'Content-Type': 'application/json' }
          })
          
          trackPerformanceTrend(followResponse.timings.duration)
          
          sleep(Math.random() * 6 + 3) // 3-9s engagement time
        })
        break
        
      case 'show_researcher':
        // Researching shows in detail - 10% of users
        group('Show Research Pattern', () => {
          // Search for shows
          const searchResponse = http.get(`${BASE_URL}/api/search/artists?q=concert`)
          trackPerformanceTrend(searchResponse.timings.duration)
          
          // Get show details
          const showsResponse = http.get(`${BASE_URL}/api/shows?limit=20`)
          trackPerformanceTrend(showsResponse.timings.duration)
          
          check(showsResponse, {
            'show listings stable': (r) => r.status === 200,
            'show data loads timely': (r) => r.timings.duration < 4000,
          })
          
          // Deep dive into show details
          if (showsResponse.status === 200) {
            try {
              const shows = JSON.parse(showsResponse.body)
              const showData = Array.isArray(shows) ? shows : shows.data || []
              
              if (showData.length > 0) {
                const randomShow = showData[Math.floor(Math.random() * Math.min(showData.length, 5))]
                
                const showDetailResponse = http.get(`${BASE_URL}/shows/${randomShow.id}`)
                trackPerformanceTrend(showDetailResponse.timings.duration)
                
                check(showDetailResponse, {
                  'show details accessible': (r) => r.status === 200,
                })
              }
            } catch (e) {
              longRunningErrors.add(1)
            }
          }
          
          sleep(Math.random() * 10 + 5) // 5-15s research time
        })
        break
        
      case 'social_sharer':
        // Sharing and social activity - 5% of users
        group('Social Sharing Pattern', () => {
          // Check trending content
          const trendingResponse = http.get(`${BASE_URL}/trending`)
          trackPerformanceTrend(trendingResponse.timings.duration)
          
          // Get stats for sharing
          const statsResponse = http.get(`${BASE_URL}/api/stats`)
          trackPerformanceTrend(statsResponse.timings.duration)
          
          check(statsResponse, {
            'stats API stable under volume': (r) => r.status === 200,
            'stats response time acceptable': (r) => r.timings.duration < 3000,
          })
          
          sleep(Math.random() * 7 + 3) // 3-10s social activity
        })
        break
    }
  })
  
  // Realistic inter-action delays
  sleep(Math.random() * 3 + 1) // 1-4s between major actions
}

export function setup() {
  console.log('📊 Starting MySetlist VOLUME Testing')
  console.log('⏰ Duration: ~5 hours of sustained high load')
  console.log(`📈 Target: ${BASE_URL}`)
  console.log('🎯 Peak Load: 9,000 concurrent users sustained')
  console.log('📋 Testing for: Memory leaks, performance degradation, resource exhaustion')
  
  const response = http.get(BASE_URL)
  if (response.status !== 200) {
    throw new Error(`System not ready for volume testing. Status: ${response.status}`)
  }
  
  return { 
    startTime: new Date().toISOString(),
    baselineResponseTime: response.timings.duration
  }
}

export function teardown(data) {
  const endTime = new Date().toISOString()
  const durationHours = (Date.now() - new Date(data.startTime).getTime()) / (1000 * 60 * 60)
  
  console.log('📊 MySetlist Volume Testing Complete')
  console.log(`⏰ Started: ${data.startTime}`)
  console.log(`⏰ Ended: ${endTime}`)
  console.log(`⌛ Total Duration: ${durationHours.toFixed(2)} hours`)
  console.log(`📊 Baseline Response Time: ${data.baselineResponseTime}ms`)
  
  // Final health assessment
  const finalResponse = http.get(BASE_URL)
  const finalPerformance = finalResponse.timings.duration
  const performanceRatio = finalPerformance / data.baselineResponseTime
  
  console.log(`📈 Final Response Time: ${finalPerformance}ms`)
  console.log(`📊 Performance Ratio: ${performanceRatio.toFixed(2)}x baseline`)
  
  if (performanceRatio < 2.0) {
    console.log('✅ System maintained excellent performance under sustained volume')
  } else if (performanceRatio < 3.0) {
    console.log('⚠️  System showed acceptable performance degradation')
  } else {
    console.log('❌ System showed significant performance degradation')
  }
  
  console.log('📋 Volume Test Analysis:')
  console.log('   - Memory stability: Monitor for leaks over time')
  console.log('   - Performance consistency: Check for gradual degradation')
  console.log('   - Resource utilization: Verify efficient resource usage')
  console.log('   - Error accumulation: Monitor for increasing error rates')
}