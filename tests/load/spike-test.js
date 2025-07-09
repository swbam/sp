/**
 * MySetlist Spike Testing Suite
 * 
 * Tests system behavior under sudden traffic spikes
 * Simulates viral events, social media mentions, artist announcements
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Spike testing metrics
const spikeRecoveryTime = new Trend('spike_recovery_time')
const spikeErrorRate = new Rate('spike_error_rate')
const autoScalingResponse = new Trend('autoscaling_response_time')
const trafficSpikes = new Counter('traffic_spikes_detected')

export const options = {
  stages: [
    // Normal load baseline
    { duration: '2m', target: 100 },
    
    // SPIKE 1: Artist announces tour
    { duration: '30s', target: 5000 },  // Sudden spike
    { duration: '1m', target: 5000 },   // Hold spike
    { duration: '2m', target: 200 },    // Recovery to slightly higher baseline
    
    // Brief calm period
    { duration: '1m', target: 150 },
    
    // SPIKE 2: Social media viral moment
    { duration: '15s', target: 8000 },  // Very sudden spike
    { duration: '3m', target: 8000 },   // Extended viral traffic
    { duration: '2m', target: 300 },    // Recovery with new baseline
    
    // Another calm period
    { duration: '30s', target: 200 },
    
    // SPIKE 3: Concert day voting frenzy
    { duration: '10s', target: 12000 }, // Extreme sudden spike
    { duration: '5m', target: 12000 },  // Peak concert day traffic
    { duration: '30s', target: 10000 }, // Slight reduction
    { duration: '1m', target: 6000 },   // Post-concert wind down
    { duration: '2m', target: 500 },    // New elevated baseline
    
    // Final spike - breaking news
    { duration: '5s', target: 15000 },  // Lightning spike
    { duration: '2m', target: 15000 },  // Breaking news traffic
    { duration: '3m', target: 100 },    // Return to normal
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // Allow slower response during spikes
    http_req_failed: ['rate<0.15'],     // Accept 15% failure during spikes
    spike_recovery_time: ['p(90)<120000'], // Recovery under 2 minutes
    spike_error_rate: ['rate<0.2'],     // Spike-specific error tolerance
  }
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Spike scenarios simulating real-world events
const spikeScenarios = [
  'artist_announcement',
  'viral_social_media',
  'concert_day_voting',
  'breaking_news',
  'influencer_mention'
]

// Track spike phases
let currentPhase = 'baseline'
let spikeStartTime = null

function detectSpike(currentVUs) {
  if (currentVUs > 3000 && currentPhase === 'baseline') {
    currentPhase = 'spike'
    spikeStartTime = Date.now()
    trafficSpikes.add(1)
    console.log(`🔥 SPIKE DETECTED: ${currentVUs} users`)
  } else if (currentVUs < 1000 && currentPhase === 'spike') {
    const recoveryTime = Date.now() - spikeStartTime
    spikeRecoveryTime.add(recoveryTime)
    currentPhase = 'recovery'
    console.log(`📉 Spike recovery: ${recoveryTime}ms`)
  } else if (currentVUs < 500 && currentPhase === 'recovery') {
    currentPhase = 'baseline'
    console.log('✅ Returned to baseline')
  }
}

export default function () {
  // Estimate current VU count (approximate)
  const estimatedVUs = __VU * (__ITER + 1)
  detectSpike(estimatedVUs)
  
  const scenario = spikeScenarios[Math.floor(Math.random() * spikeScenarios.length)]
  
  group(`Spike Scenario: ${scenario}`, () => {
    
    switch (scenario) {
      case 'artist_announcement':
        // Users rush to see artist's upcoming shows
        group('Artist Announcement Traffic', () => {
          const artist = 'radiohead' // Hot artist
          
          // Check artist page
          const artistResponse = http.get(`${BASE_URL}/artists/${artist}`)
          
          const success = check(artistResponse, {
            'artist page accessible during spike': (r) => r.status === 200,
            'artist page loads in reasonable time': (r) => r.timings.duration < 10000,
          })
          
          if (!success && currentPhase === 'spike') {
            spikeErrorRate.add(1)
          } else {
            spikeErrorRate.add(0)
          }
          
          // Check for shows
          http.get(`${BASE_URL}/api/artists/${artist}/shows`)
          
          sleep(0.5) // Quick browsing during excitement
        })
        break
        
      case 'viral_social_media':
        // Viral content brings users to search and explore
        group('Viral Social Media Traffic', () => {
          // Heavy search activity
          const searchTerms = ['viral', 'trending', 'popular', 'hot']
          const term = searchTerms[Math.floor(Math.random() * searchTerms.length)]
          
          const searchResponse = http.get(`${BASE_URL}/api/search/artists?q=${term}`)
          
          check(searchResponse, {
            'search handles viral traffic': (r) => r.status === 200 || r.status === 429,
            'search responds during spike': (r) => r.timings.duration < 15000,
          })
          
          // Check trending page
          http.get(`${BASE_URL}/trending`)
          
          sleep(0.3) // Rapid browsing
        })
        break
        
      case 'concert_day_voting':
        // Concert day: heavy voting activity
        group('Concert Day Voting Frenzy', () => {
          // Intense voting patterns
          const votePayload = JSON.stringify({
            setlist_song_id: `concert_day_${Math.random()}`,
            vote_type: Math.random() < 0.8 ? 'up' : 'down' // More upvotes during excitement
          })
          
          const voteResponse = http.post(`${BASE_URL}/api/votes`, votePayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: '5s'
          })
          
          const voteSuccess = check(voteResponse, {
            'voting system handles concert day load': (r) => r.status === 200 || r.status === 401 || r.status === 429,
            'voting responds during peak': (r) => r.timings.duration < 8000,
          })
          
          if (!voteSuccess && currentPhase === 'spike') {
            spikeErrorRate.add(1)
          }
          
          // Check real-time updates
          http.get(`${BASE_URL}/api/realtime/votes`)
          
          sleep(0.2) // Rapid-fire voting
        })
        break
        
      case 'breaking_news':
        // Breaking news drives traffic to specific content
        group('Breaking News Traffic', () => {
          // Heavy homepage traffic
          const homeResponse = http.get(`${BASE_URL}/`)
          
          check(homeResponse, {
            'homepage survives news spike': (r) => r.status === 200,
            'homepage loads during news event': (r) => r.timings.duration < 12000,
          })
          
          // Check multiple pages rapidly
          http.get(`${BASE_URL}/trending`)
          http.get(`${BASE_URL}/search`)
          
          sleep(0.4) // News reading pattern
        })
        break
        
      case 'influencer_mention':
        // Influencer mention brings sustained high traffic
        group('Influencer Mention Traffic', () => {
          // Mixed activity pattern
          if (Math.random() < 0.5) {
            // Search for mentioned artist
            http.get(`${BASE_URL}/api/search/artists?q=mentioned`)
          } else {
            // Browse trending content  
            http.get(`${BASE_URL}/trending`)
          }
          
          // Social sharing simulation
          http.get(`${BASE_URL}/api/stats`)
          
          sleep(0.6) // Social media browsing pattern
        })
        break
    }
  })
  
  // Variable sleep based on current phase
  if (currentPhase === 'spike') {
    sleep(Math.random() * 0.5) // Rapid activity during spike
  } else if (currentPhase === 'recovery') {
    sleep(Math.random() * 1 + 0.5) // Moderate activity during recovery  
  } else {
    sleep(Math.random() * 2 + 1) // Normal activity at baseline
  }
}

export function setup() {
  console.log('⚡ Starting MySetlist SPIKE Testing')
  console.log('🎯 Simulating viral events and traffic spikes')
  console.log(`📊 Target: ${BASE_URL}`)
  console.log('📈 Peak Load: 15,000 concurrent users in 5 seconds')
  
  const response = http.get(BASE_URL)
  if (response.status !== 200) {
    throw new Error(`System not ready for spike testing. Status: ${response.status}`)
  }
  
  return { 
    startTime: new Date().toISOString(),
    baselineResponseTime: response.timings.duration,
    spikesGenerated: 0
  }
}

export function teardown(data) {
  console.log('⚡ MySetlist Spike Testing Complete')
  console.log(`⏱️  Started: ${data.startTime}`)
  console.log(`⏱️  Ended: ${new Date().toISOString()}`)
  console.log(`📊 Baseline Response Time: ${data.baselineResponseTime}ms`)
  
  // Final health check
  const finalResponse = http.get(BASE_URL)
  if (finalResponse.status === 200) {
    console.log('✅ System recovered from all spikes successfully')
    console.log(`📈 Final response time: ${finalResponse.timings.duration}ms`)
  } else {
    console.log('⚠️  System showing stress after spike testing')
  }
  
  console.log('📋 Spike Test Summary:')
  console.log('   - Artist Announcement Spike: 5,000 users in 30s')
  console.log('   - Viral Social Media Spike: 8,000 users in 15s') 
  console.log('   - Concert Day Spike: 12,000 users in 10s')
  console.log('   - Breaking News Spike: 15,000 users in 5s')
}