#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 SEARCH SYSTEM VALIDATION - SUB-AGENT 4');
console.log('=' * 60);

// Test 1: Database Search Functionality
async function testDatabaseSearch() {
  console.log('\n📊 TEST 1: DATABASE SEARCH FUNCTIONALITY');
  console.log('-' * 40);
  
  try {
    // Test artist search
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id, name, slug, image_url, followers, verified')
      .ilike('name', '%radio%')
      .order('followers', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Database search error:', error);
      return false;
    }
    
    console.log(`✅ Database search returned ${artists.length} artists`);
    artists.forEach(artist => {
      console.log(`   - ${artist.name} (slug: ${artist.slug})`);
    });
    
    return artists.length > 0;
  } catch (error) {
    console.error('❌ Database search failed:', error);
    return false;
  }
}

// Test 2: Search API Endpoints
async function testSearchAPIEndpoints() {
  console.log('\n🌐 TEST 2: SEARCH API ENDPOINTS');
  console.log('-' * 40);
  
  const testCases = [
    {
      name: 'Search for "radiohead"',
      url: 'http://localhost:3000/api/search?q=radiohead&type=artists',
      expectedMinResults: 1
    },
    {
      name: 'Search for "taylor"',
      url: 'http://localhost:3000/api/search?q=taylor&type=artists',
      expectedMinResults: 1
    },
    {
      name: 'Search all types',
      url: 'http://localhost:3000/api/search?q=radiohead&type=all',
      expectedMinResults: 1
    },
    {
      name: 'Empty search',
      url: 'http://localhost:3000/api/search?q=',
      expectedMinResults: 0
    }
  ];
  
  const results = [];
  
  for (const test of testCases) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      const response = await fetch(test.url);
      
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        results.push({ test: test.name, success: false, error: `HTTP ${response.status}` });
        continue;
      }
      
      const data = await response.json();
      console.log(`✅ Response received:`, JSON.stringify(data, null, 2));
      
      // Check if we got expected results
      const artistCount = data.artists ? data.artists.length : 0;
      const success = artistCount >= test.expectedMinResults;
      
      results.push({
        test: test.name,
        success,
        artistCount,
        data: data
      });
      
      if (success) {
        console.log(`✅ Test passed: ${artistCount} artists found`);
      } else {
        console.log(`❌ Test failed: Expected ${test.expectedMinResults}, got ${artistCount}`);
      }
      
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
      results.push({ test: test.name, success: false, error: error.message });
    }
  }
  
  return results;
}

// Test 3: Search Performance
async function testSearchPerformance() {
  console.log('\n⚡ TEST 3: SEARCH PERFORMANCE');
  console.log('-' * 40);
  
  const testQueries = ['radiohead', 'taylor', 'the', 'a'];
  const performanceResults = [];
  
  for (const query of testQueries) {
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}&type=artists`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      const data = await response.json();
      
      performanceResults.push({
        query,
        responseTime,
        success: response.ok,
        resultCount: data.artists ? data.artists.length : 0
      });
      
      console.log(`📊 Query "${query}": ${responseTime}ms (${data.artists ? data.artists.length : 0} results)`);
      
    } catch (error) {
      console.error(`❌ Performance test failed for "${query}":`, error.message);
    }
  }
  
  const avgResponseTime = performanceResults.reduce((sum, result) => sum + result.responseTime, 0) / performanceResults.length;
  console.log(`\n📈 Average response time: ${avgResponseTime.toFixed(2)}ms`);
  
  return performanceResults;
}

// Test 4: Search Component Integration
async function testSearchComponentIntegration() {
  console.log('\n🔧 TEST 4: SEARCH COMPONENT INTEGRATION');
  console.log('-' * 40);
  
  try {
    // Test search page
    const searchPageResponse = await fetch('http://localhost:3000/search');
    console.log(`✅ Search page accessible: ${searchPageResponse.ok ? 'YES' : 'NO'}`);
    
    // Test search with query parameter
    const searchWithQueryResponse = await fetch('http://localhost:3000/search?title=radiohead');
    console.log(`✅ Search with query accessible: ${searchWithQueryResponse.ok ? 'YES' : 'NO'}`);
    
    // Test homepage
    const homepageResponse = await fetch('http://localhost:3000');
    console.log(`✅ Homepage accessible: ${homepageResponse.ok ? 'YES' : 'NO'}`);
    
    return {
      searchPage: searchPageResponse.ok,
      searchWithQuery: searchWithQueryResponse.ok,
      homepage: homepageResponse.ok
    };
    
  } catch (error) {
    console.error('❌ Component integration test failed:', error.message);
    return {
      searchPage: false,
      searchWithQuery: false,
      homepage: false
    };
  }
}

// Test 5: Artist Navigation
async function testArtistNavigation() {
  console.log('\n🔗 TEST 5: ARTIST NAVIGATION');
  console.log('-' * 40);
  
  try {
    // Get an artist from database
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id, name, slug')
      .limit(1);
    
    if (error || !artists || artists.length === 0) {
      console.error('❌ No artists found for navigation test');
      return false;
    }
    
    const artist = artists[0];
    console.log(`🎯 Testing navigation to: ${artist.name} (slug: ${artist.slug})`);
    
    // Test artist page accessibility
    const artistPageResponse = await fetch(`http://localhost:3000/artists/${artist.slug}`);
    console.log(`✅ Artist page accessible: ${artistPageResponse.ok ? 'YES' : 'NO'}`);
    
    return artistPageResponse.ok;
    
  } catch (error) {
    console.error('❌ Artist navigation test failed:', error.message);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting comprehensive search system validation...\n');
  
  const results = {
    databaseSearch: await testDatabaseSearch(),
    apiEndpoints: await testSearchAPIEndpoints(),
    performance: await testSearchPerformance(),
    componentIntegration: await testSearchComponentIntegration(),
    artistNavigation: await testArtistNavigation()
  };
  
  console.log('\n' + '=' * 60);
  console.log('📋 SEARCH SYSTEM VALIDATION SUMMARY');
  console.log('=' * 60);
  
  console.log(`🔍 Database Search: ${results.databaseSearch ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🌐 API Endpoints: ${results.apiEndpoints.every(r => r.success) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`⚡ Performance: ${results.performance.every(r => r.success && r.responseTime < 2000) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔧 Component Integration: ${Object.values(results.componentIntegration).every(v => v) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔗 Artist Navigation: ${results.artistNavigation ? '✅ PASS' : '❌ FAIL'}`);
  
  // Detailed results
  console.log('\n📊 DETAILED RESULTS:');
  console.log('API Endpoint Tests:');
  results.apiEndpoints.forEach(result => {
    console.log(`  - ${result.test}: ${result.success ? '✅' : '❌'} ${result.artistCount || 0} results`);
  });
  
  console.log('\nPerformance Tests:');
  results.performance.forEach(result => {
    console.log(`  - "${result.query}": ${result.responseTime}ms (${result.resultCount} results)`);
  });
  
  console.log('\nComponent Integration:');
  Object.entries(results.componentIntegration).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value ? '✅' : '❌'}`);
  });
  
  return results;
}

// Run tests
runAllTests().then(results => {
  const allTestsPassed = Object.values(results).every(result => {
    if (Array.isArray(result)) {
      return result.every(r => r.success);
    }
    if (typeof result === 'object' && result !== null) {
      return Object.values(result).every(v => v);
    }
    return result;
  });
  
  console.log(`\n🎯 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(allTestsPassed ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});