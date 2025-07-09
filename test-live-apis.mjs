#!/usr/bin/env node

console.log('🔍 LIVE API ENDPOINT TESTING');
console.log('=============================');

// Test all critical API endpoints
const BASE_URL = 'http://localhost:3000';

const endpoints = [
  {
    path: '/api/artists',
    method: 'GET',
    description: 'Get all artists',
    expectedKeys: ['artists']
  },
  {
    path: '/api/artists?limit=3',
    method: 'GET',
    description: 'Get artists with limit',
    expectedKeys: ['artists']
  },
  {
    path: '/api/shows',
    method: 'GET',
    description: 'Get all shows',
    expectedKeys: ['shows']
  },
  {
    path: '/api/shows?limit=5',
    method: 'GET',
    description: 'Get shows with limit',
    expectedKeys: ['shows']
  },
  {
    path: '/api/trending',
    method: 'GET',
    description: 'Get trending data',
    expectedKeys: ['trending_shows']
  },
  {
    path: '/api/trending?type=shows&limit=3',
    method: 'GET',
    description: 'Get trending shows',
    expectedKeys: ['trending_shows']
  },
  {
    path: '/api/trending?type=artists&limit=3',
    method: 'GET',
    description: 'Get trending artists',
    expectedKeys: ['trending_artists']
  },
  {
    path: '/api/search/artists?q=radiohead',
    method: 'GET',
    description: 'Search artists',
    expectedKeys: [] // Ticketmaster format
  },
  {
    path: '/api/votes?setlist_song_ids=test',
    method: 'GET',
    description: 'Get vote counts',
    expectedKeys: ['voteCounts']
  }
];

async function testEndpoint(endpoint) {
  const { path, method, description, expectedKeys } = endpoint;
  
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   ${method} ${path}`);
    
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ FAILED: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return false;
    }
    
    // Check if response has expected structure
    const responseKeys = Object.keys(data);
    console.log(`✅ SUCCESS: ${response.status}`);
    console.log(`   Response keys: ${responseKeys.join(', ')}`);
    
    // Show sample data
    if (data.artists && data.artists.length > 0) {
      console.log(`   Sample artist: ${data.artists[0].name}`);
    }
    if (data.shows && data.shows.length > 0) {
      console.log(`   Sample show: ${data.shows[0].name}`);
    }
    if (data.trending_shows && data.trending_shows.length > 0) {
      console.log(`   Sample trending show: ${data.trending_shows[0].name}`);
    }
    if (data.trending_artists && data.trending_artists.length > 0) {
      console.log(`   Sample trending artist: ${data.trending_artists[0].name}`);
    }
    if (Array.isArray(data) && data.length > 0 && data[0].name) {
      console.log(`   Sample result: ${data[0].name}`);
    }
    
    return true;
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Starting API endpoint tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n======================');
  console.log('📊 TEST SUMMARY');
  console.log('======================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All API endpoints are working correctly!');
  } else {
    console.log(`\n⚠️  ${failed} endpoints need attention.`);
  }
}

runTests().catch(console.error);