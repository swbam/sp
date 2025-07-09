#!/usr/bin/env node

/**
 * SPECIFIC ERROR SCENARIO TESTING
 * 
 * This script tests specific error scenarios identified in the initial validation
 * to provide detailed analysis and recommendations for fixes.
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3005';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSpecificScenarios() {
  log('🔍 TESTING SPECIFIC ERROR SCENARIOS', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');

  // Test 1: Vote API with invalid data should return 400, not 500
  log('\n1. Testing Vote API Error Handling...', 'blue');
  
  const voteTests = [
    { body: null, expected: 400 },
    { body: '{"invalid": "json"}', expected: 400 },
    { body: '{}', expected: 400 },
    { body: '{"setlist_song_id": "invalid"}', expected: 400 },
    { body: '{"vote_type": "invalid"}', expected: 400 }
  ];
  
  for (const test of voteTests) {
    try {
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: test.body
      });
      
      const data = await response.text();
      
      log(`   Body: ${test.body ? test.body.substring(0, 30) + '...' : 'null'}`, 'white');
      log(`   Expected: ${test.expected}, Got: ${response.status}`, 
          response.status === test.expected ? 'green' : 'red');
      
      if (response.status >= 500) {
        log(`   Response: ${data}`, 'red');
      }
      
    } catch (error) {
      log(`   Error: ${error.message}`, 'red');
    }
  }

  // Test 2: Show API with invalid IDs should return 404, not 500
  log('\n2. Testing Show API Error Handling...', 'blue');
  
  const showTests = [
    'invalid-uuid-123',
    'not-a-uuid',
    'test-show-123',
    ''
  ];
  
  for (const showId of showTests) {
    try {
      const response = await fetch(`${BASE_URL}/api/shows/${showId}`);
      const data = await response.text();
      
      log(`   Show ID: "${showId}"`, 'white');
      log(`   Status: ${response.status}`, response.status === 404 ? 'green' : 'red');
      
      if (response.status >= 500) {
        log(`   Response: ${data}`, 'red');
      }
      
    } catch (error) {
      log(`   Error: ${error.message}`, 'red');
    }
  }

  // Test 3: Authentication enforcement
  log('\n3. Testing Authentication Enforcement...', 'blue');
  
  const authTests = [
    { endpoint: '/api/user/following', method: 'GET', shouldRequireAuth: true },
    { endpoint: '/api/votes', method: 'POST', shouldRequireAuth: true },
    { endpoint: '/api/artists/test/follow', method: 'POST', shouldRequireAuth: true },
    { endpoint: '/api/search/artists?q=test', method: 'GET', shouldRequireAuth: false },
    { endpoint: '/api/trending', method: 'GET', shouldRequireAuth: false }
  ];
  
  for (const test of authTests) {
    try {
      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: test.method,
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      
      log(`   ${test.method} ${test.endpoint}`, 'white');
      
      if (test.shouldRequireAuth) {
        if (response.status === 401 || response.status === 403) {
          log(`   ✅ Properly requires auth (${response.status})`, 'green');
        } else {
          log(`   ❌ Should require auth but got ${response.status}`, 'red');
        }
      } else {
        if (response.status < 400) {
          log(`   ✅ Properly allows unauthenticated access (${response.status})`, 'green');
        } else {
          log(`   ⚠️  Unexpected status for public endpoint: ${response.status}`, 'yellow');
        }
      }
      
    } catch (error) {
      log(`   Error: ${error.message}`, 'red');
    }
  }

  // Test 4: Input validation for search
  log('\n4. Testing Search Input Validation...', 'blue');
  
  const searchTests = [
    { query: '', shouldFail: true },
    { query: '   ', shouldFail: true },
    { query: 'a'.repeat(1000), shouldFail: true },
    { query: 'normal query', shouldFail: false },
    { query: '<script>alert("xss")</script>', shouldFail: false }, // Should be sanitized
    { query: 'DROP TABLE artists;', shouldFail: false } // Should be sanitized
  ];
  
  for (const test of searchTests) {
    try {
      const response = await fetch(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(test.query)}`);
      const data = await response.json();
      
      log(`   Query: "${test.query.substring(0, 50)}${test.query.length > 50 ? '...' : ''}"`, 'white');
      
      if (test.shouldFail) {
        if (response.status === 400) {
          log(`   ✅ Properly rejects invalid input (${response.status})`, 'green');
        } else {
          log(`   ❌ Should reject invalid input but got ${response.status}`, 'red');
        }
      } else {
        if (response.status === 200) {
          log(`   ✅ Properly handles valid input (${response.status})`, 'green');
        } else {
          log(`   ❌ Should handle valid input but got ${response.status}`, 'red');
        }
      }
      
    } catch (error) {
      log(`   Error: ${error.message}`, 'red');
    }
  }

  // Test 5: Error message quality
  log('\n5. Testing Error Message Quality...', 'blue');
  
  const errorMessageTests = [
    { 
      url: '/api/search/artists?q=',
      description: 'Empty search query'
    },
    { 
      url: '/api/votes',
      method: 'POST',
      body: '{}',
      description: 'Invalid vote data'
    },
    { 
      url: '/api/artists/non-existent-artist',
      description: 'Non-existent artist'
    }
  ];
  
  for (const test of errorMessageTests) {
    try {
      const response = await fetch(`${BASE_URL}${test.url}`, {
        method: test.method || 'GET',
        headers: test.body ? { 'Content-Type': 'application/json' } : {},
        body: test.body
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = await response.text();
      }
      
      log(`   ${test.description}:`, 'white');
      log(`   Status: ${response.status}`, response.status >= 400 ? 'yellow' : 'green');
      
      if (response.status >= 400 && data?.error) {
        const errorMessage = data.error;
        
        // Check if error message is user-friendly
        const isTechnical = errorMessage.includes('stack') || 
                           errorMessage.includes('database') || 
                           errorMessage.includes('SQL') ||
                           errorMessage.includes('undefined') ||
                           errorMessage.includes('TypeError') ||
                           errorMessage.includes('ReferenceError');
        
        if (isTechnical) {
          log(`   ❌ Technical error exposed: ${errorMessage}`, 'red');
        } else {
          log(`   ✅ User-friendly error: ${errorMessage}`, 'green');
        }
      } else {
        log(`   ⚠️  No error message found`, 'yellow');
      }
      
    } catch (error) {
      log(`   Network Error: ${error.message}`, 'red');
    }
  }

  // Test 6: Frontend error boundaries
  log('\n6. Testing Frontend Error Boundaries...', 'blue');
  
  const frontendTests = [
    { url: '/', description: 'Homepage' },
    { url: '/search', description: 'Search page' },
    { url: '/trending', description: 'Trending page' },
    { url: '/non-existent-page', description: '404 page' },
    { url: '/artists/non-existent-artist', description: 'Non-existent artist' }
  ];
  
  for (const test of frontendTests) {
    try {
      const response = await fetch(`${BASE_URL}${test.url}`);
      const html = await response.text();
      
      log(`   ${test.description}:`, 'white');
      log(`   Status: ${response.status}`, response.status < 400 ? 'green' : 'yellow');
      
      // Check if error boundary is working (look for error boundary HTML)
      if (html.includes('Something went wrong') || html.includes('Page Not Found')) {
        log(`   ✅ Error boundary working`, 'green');
      } else if (response.status >= 400) {
        log(`   ⚠️  Error boundary may not be working`, 'yellow');
      } else {
        log(`   ✅ Page loads normally`, 'green');
      }
      
    } catch (error) {
      log(`   Network Error: ${error.message}`, 'red');
    }
  }

  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('🎯 SPECIFIC ERROR SCENARIO TESTING COMPLETE', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
}

// Run the tests
testSpecificScenarios().catch(console.error);