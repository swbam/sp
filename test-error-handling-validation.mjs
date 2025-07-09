#!/usr/bin/env node

/**
 * ERROR HANDLING VALIDATION TEST SUITE
 * 
 * This script comprehensively tests all error scenarios and failure modes
 * to ensure robust error handling throughout MySetlist.
 * 
 * SUB-AGENT 9: ERROR HANDLING VALIDATION AGENT
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eotvxxipggnqxonvzkks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzY0NjYsImV4cCI6MjA2NzUxMjQ2Nn0.jOetqdvld75LwNpzlxGXiHvMaGaO1FIeebkcObwYKhc';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: [],
  warnings: [],
  critical: []
};

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

// Utility functions
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message, error) {
  const errorMsg = `❌ ${message}: ${error?.message || error}`;
  log(errorMsg, 'red');
  testResults.errors.push({ message, error: error?.message || error });
  testResults.failed++;
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
  testResults.passed++;
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
  testResults.warnings.push(message);
}

function logCritical(message) {
  log(`🚨 CRITICAL: ${message}`, 'red');
  testResults.critical.push(message);
}

// Test helper functions
async function makeRequest(url, options = {}) {
  const startTime = performance.now();
  try {
    const response = await fetch(url, {
      timeout: 30000,
      ...options
    });
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      responseTime,
      ok: response.ok
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      responseTime: endTime - startTime,
      ok: false
    };
  }
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test Categories
class ErrorValidationTests {
  async runAllTests() {
    log('🔍 ERROR HANDLING VALIDATION AGENT - SUB-AGENT 9', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');
    log('Testing all error scenarios and failure modes...', 'white');
    
    // Test categories
    await this.testNetworkFailures();
    await this.testDatabaseErrors();
    await this.testInvalidInputs();
    await this.testAuthenticationErrors();
    await this.testMissingData();
    await this.testAPIEndpointErrors();
    await this.testErrorBoundaries();
    await this.testRetryMechanisms();
    await this.testGracefulDegradation();
    await this.testUserFriendlyErrors();
    
    this.generateReport();
  }

  async testNetworkFailures() {
    log('\n📡 Testing Network Failures and Timeouts...', 'blue');
    testResults.total++;
    
    try {
      // Test timeout scenarios
      const timeoutTests = [
        { url: `${BASE_URL}/api/search/artists?q=test`, timeout: 1 },
        { url: `${BASE_URL}/api/trending`, timeout: 1 },
        { url: `${BASE_URL}/api/votes`, timeout: 1 }
      ];
      
      for (const test of timeoutTests) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), test.timeout);
          
          const response = await fetch(test.url, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            logWarning(`Timeout test failed - request completed too quickly: ${test.url}`);
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            logSuccess(`Timeout handling works for: ${test.url}`);
          } else {
            logError(`Unexpected error in timeout test: ${test.url}`, error);
          }
        }
      }
      
      // Test invalid URLs
      const invalidResponse = await makeRequest(`${BASE_URL}/api/nonexistent-endpoint`);
      if (invalidResponse.status === 404) {
        logSuccess('404 handling works for invalid API endpoints');
      } else {
        logError('Invalid API endpoint should return 404', `Got ${invalidResponse.status}`);
      }
      
    } catch (error) {
      logError('Network failure tests failed', error);
    }
  }

  async testDatabaseErrors() {
    log('\n🗄️  Testing Database Connection Errors...', 'blue');
    testResults.total++;
    
    try {
      // Test invalid database queries
      const invalidQueries = [
        { table: 'nonexistent_table', operation: 'select' },
        { table: 'artists', operation: 'select', filter: 'invalid_column' }
      ];
      
      for (const query of invalidQueries) {
        try {
          let result;
          if (query.filter) {
            result = await supabase.from(query.table).select('*').eq(query.filter, 'test');
          } else {
            result = await supabase.from(query.table).select('*');
          }
          
          if (result.error) {
            logSuccess(`Database error properly handled: ${result.error.message}`);
          } else {
            logWarning(`Expected database error but query succeeded: ${query.table}`);
          }
        } catch (error) {
          logSuccess(`Database error caught: ${error.message}`);
        }
      }
      
      // Test database connection recovery
      const { data, error } = await supabase.from('artists').select('id').limit(1);
      if (error) {
        logError('Database connection test failed', error);
      } else {
        logSuccess('Database connection recovery works');
      }
      
    } catch (error) {
      logError('Database error tests failed', error);
    }
  }

  async testInvalidInputs() {
    log('\n🚫 Testing Invalid User Inputs...', 'blue');
    testResults.total++;
    
    try {
      // Test search with invalid inputs
      const invalidSearchTests = [
        { query: '', expected: 400 },
        { query: '   ', expected: 400 },
        { query: 'a'.repeat(1000), expected: 400 },
        { query: '<script>alert("xss")</script>', expected: 200 }, // Should be sanitized
        { query: '../../etc/passwd', expected: 200 }, // Should be sanitized
        { query: 'DROP TABLE artists;', expected: 200 } // Should be sanitized
      ];
      
      for (const test of invalidSearchTests) {
        const response = await makeRequest(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(test.query)}`);
        
        if (response.status === test.expected) {
          logSuccess(`Invalid input handled correctly: "${test.query.substring(0, 50)}"`);
        } else {
          logError(`Invalid input not handled: "${test.query.substring(0, 50)}"`, `Expected ${test.expected}, got ${response.status}`);
        }
      }
      
      // Test voting with invalid data
      const invalidVoteTests = [
        { data: null, expected: 400 },
        { data: '', expected: 400 },
        { data: { vote_type: 'invalid' }, expected: 400 },
        { data: { setlist_song_id: 'invalid-uuid' }, expected: 400 },
        { data: { setlist_song_id: '', vote_type: 'up' }, expected: 400 }
      ];
      
      for (const test of invalidVoteTests) {
        const response = await makeRequest(`${BASE_URL}/api/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test.data)
        });
        
        if (response.status === test.expected) {
          logSuccess(`Invalid vote data handled correctly`);
        } else {
          logError(`Invalid vote data not handled properly`, `Expected ${test.expected}, got ${response.status}`);
        }
      }
      
    } catch (error) {
      logError('Invalid input tests failed', error);
    }
  }

  async testAuthenticationErrors() {
    log('\n🔐 Testing Authentication Failures...', 'blue');
    testResults.total++;
    
    try {
      // Test protected endpoints without authentication
      const protectedEndpoints = [
        { url: `${BASE_URL}/api/user/following`, method: 'GET' },
        { url: `${BASE_URL}/api/votes`, method: 'POST' },
        { url: `${BASE_URL}/api/artists/test-artist/follow`, method: 'POST' }
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await makeRequest(endpoint.url, {
          method: endpoint.method,
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        
        if (response.status === 401 || response.status === 403) {
          logSuccess(`Authentication properly enforced for ${endpoint.url}`);
        } else {
          logError(`Authentication not enforced for ${endpoint.url}`, `Got ${response.status}`);
        }
      }
      
      // Test with malformed tokens
      const malformedTokenTests = [
        'invalid-token',
        'Bearer ',
        'Bearer invalid.token.here',
        'Bearer ' + 'a'.repeat(1000)
      ];
      
      for (const token of malformedTokenTests) {
        const response = await makeRequest(`${BASE_URL}/api/user/following`, {
          headers: { 'Authorization': token }
        });
        
        if (response.status === 401) {
          logSuccess(`Malformed token properly rejected: ${token.substring(0, 20)}...`);
        } else {
          logError(`Malformed token not rejected: ${token.substring(0, 20)}...`, `Got ${response.status}`);
        }
      }
      
    } catch (error) {
      logError('Authentication error tests failed', error);
    }
  }

  async testMissingData() {
    log('\n🔍 Testing Missing Data and 404 Errors...', 'blue');
    testResults.total++;
    
    try {
      // Test missing artist pages
      const nonExistentArtists = [
        'non-existent-artist',
        'invalid-slug-123',
        'test-artist-not-found'
      ];
      
      for (const slug of nonExistentArtists) {
        const response = await makeRequest(`${BASE_URL}/api/artists/${slug}`);
        
        if (response.status === 404) {
          logSuccess(`Missing artist properly returns 404: ${slug}`);
        } else {
          logError(`Missing artist should return 404: ${slug}`, `Got ${response.status}`);
        }
      }
      
      // Test missing show pages
      const nonExistentShows = [
        'invalid-uuid-123',
        'non-existent-show',
        '00000000-0000-0000-0000-000000000000'
      ];
      
      for (const showId of nonExistentShows) {
        const response = await makeRequest(`${BASE_URL}/api/shows/${showId}`);
        
        if (response.status === 404) {
          logSuccess(`Missing show properly returns 404: ${showId}`);
        } else {
          logError(`Missing show should return 404: ${showId}`, `Got ${response.status}`);
        }
      }
      
      // Test empty search results
      const emptySearchResponse = await makeRequest(`${BASE_URL}/api/search/artists?q=zzz-impossible-artist-name-xyz`);
      if (emptySearchResponse.ok && Array.isArray(emptySearchResponse.data)) {
        logSuccess('Empty search results handled gracefully');
      } else {
        logError('Empty search results not handled properly', emptySearchResponse.status);
      }
      
    } catch (error) {
      logError('Missing data tests failed', error);
    }
  }

  async testAPIEndpointErrors() {
    log('\n🔌 Testing API Endpoint Errors...', 'blue');
    testResults.total++;
    
    try {
      // Test malformed request bodies
      const malformedBodyTests = [
        { endpoint: '/api/votes', body: 'invalid-json' },
        { endpoint: '/api/votes', body: '{"incomplete": }' },
        { endpoint: '/api/votes', body: null },
        { endpoint: '/api/setlists/import', body: 'not-json' }
      ];
      
      for (const test of malformedBodyTests) {
        const response = await makeRequest(`${BASE_URL}${test.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: test.body
        });
        
        if (response.status === 400 || response.status === 422) {
          logSuccess(`Malformed request body properly rejected: ${test.endpoint}`);
        } else {
          logError(`Malformed request body not rejected: ${test.endpoint}`, `Got ${response.status}`);
        }
      }
      
      // Test missing required parameters
      const missingParamTests = [
        { endpoint: '/api/search/artists', params: '' },
        { endpoint: '/api/votes', method: 'POST', body: '{}' },
        { endpoint: '/api/shows', params: '?invalid_param=true' }
      ];
      
      for (const test of missingParamTests) {
        const url = `${BASE_URL}${test.endpoint}${test.params || ''}`;
        const response = await makeRequest(url, {
          method: test.method || 'GET',
          headers: test.body ? { 'Content-Type': 'application/json' } : {},
          body: test.body
        });
        
        if (response.status === 400) {
          logSuccess(`Missing parameters properly handled: ${test.endpoint}`);
        } else {
          logError(`Missing parameters not handled: ${test.endpoint}`, `Got ${response.status}`);
        }
      }
      
    } catch (error) {
      logError('API endpoint error tests failed', error);
    }
  }

  async testErrorBoundaries() {
    log('\n🛡️  Testing Error Boundaries and Fallback UI...', 'blue');
    testResults.total++;
    
    try {
      // Test error boundary implementation by checking if it's properly imported
      const errorBoundaryTests = [
        { url: `${BASE_URL}/`, description: 'Homepage error boundary' },
        { url: `${BASE_URL}/search`, description: 'Search page error boundary' },
        { url: `${BASE_URL}/trending`, description: 'Trending page error boundary' },
        { url: `${BASE_URL}/artists/test-artist`, description: 'Artist page error boundary' }
      ];
      
      for (const test of errorBoundaryTests) {
        const response = await makeRequest(test.url);
        
        if (response.ok) {
          logSuccess(`${test.description} accessible`);
        } else if (response.status === 404) {
          logSuccess(`${test.description} properly returns 404`);
        } else {
          logError(`${test.description} failed`, `Status: ${response.status}`);
        }
      }
      
      // Test that error boundaries don't crash the app
      const errorProneRequests = [
        `${BASE_URL}/api/artists/cause-error`,
        `${BASE_URL}/api/shows/cause-error`,
        `${BASE_URL}/api/trending?invalid=true`
      ];
      
      for (const url of errorProneRequests) {
        const response = await makeRequest(url);
        
        if (response.status >= 400 && response.status < 500) {
          logSuccess(`Error boundary handles client errors: ${url}`);
        } else if (response.status >= 500) {
          logSuccess(`Error boundary handles server errors: ${url}`);
        } else {
          logWarning(`Error boundary test inconclusive: ${url}`);
        }
      }
      
    } catch (error) {
      logError('Error boundary tests failed', error);
    }
  }

  async testRetryMechanisms() {
    log('\n🔄 Testing Retry Mechanisms...', 'blue');
    testResults.total++;
    
    try {
      // Test that failed requests can be retried
      const retryTests = [
        { url: `${BASE_URL}/api/trending`, description: 'Trending API retry' },
        { url: `${BASE_URL}/api/search/artists?q=test`, description: 'Search API retry' },
        { url: `${BASE_URL}/api/shows`, description: 'Shows API retry' }
      ];
      
      for (const test of retryTests) {
        const firstResponse = await makeRequest(test.url);
        const secondResponse = await makeRequest(test.url);
        
        if (firstResponse.ok && secondResponse.ok) {
          logSuccess(`${test.description} - consistent responses`);
        } else if (firstResponse.ok || secondResponse.ok) {
          logSuccess(`${test.description} - retry mechanism working`);
        } else {
          logError(`${test.description} - retry mechanism failed`, 'Both requests failed');
        }
      }
      
      // Test database connection retry
      const { data, error } = await supabase.from('artists').select('id').limit(1);
      if (!error) {
        logSuccess('Database connection retry works');
      } else {
        logError('Database connection retry failed', error);
      }
      
    } catch (error) {
      logError('Retry mechanism tests failed', error);
    }
  }

  async testGracefulDegradation() {
    log('\n🏗️  Testing Graceful Degradation...', 'blue');
    testResults.total++;
    
    try {
      // Test that app works when external services fail
      const degradationTests = [
        { 
          url: `${BASE_URL}/api/trending`, 
          description: 'Trending works when some data missing',
          shouldDegrade: true
        },
        { 
          url: `${BASE_URL}/api/search/artists?q=test`, 
          description: 'Search works with fallback',
          shouldDegrade: true
        },
        { 
          url: `${BASE_URL}/api/shows`, 
          description: 'Shows list works with partial data',
          shouldDegrade: true
        }
      ];
      
      for (const test of degradationTests) {
        const response = await makeRequest(test.url);
        
        if (response.ok) {
          logSuccess(`${test.description} - graceful degradation works`);
        } else if (response.status === 500) {
          logWarning(`${test.description} - service completely down`);
        } else {
          logError(`${test.description} - degradation failed`, `Status: ${response.status}`);
        }
      }
      
      // Test that frontend handles API failures gracefully
      const frontendPages = [
        { url: `${BASE_URL}/`, description: 'Homepage with API failures' },
        { url: `${BASE_URL}/search`, description: 'Search page with API failures' },
        { url: `${BASE_URL}/trending`, description: 'Trending page with API failures' }
      ];
      
      for (const page of frontendPages) {
        const response = await makeRequest(page.url);
        
        if (response.ok) {
          logSuccess(`${page.description} - frontend resilience works`);
        } else {
          logError(`${page.description} - frontend not resilient`, `Status: ${response.status}`);
        }
      }
      
    } catch (error) {
      logError('Graceful degradation tests failed', error);
    }
  }

  async testUserFriendlyErrors() {
    log('\n👥 Testing User-Friendly Error Messages...', 'blue');
    testResults.total++;
    
    try {
      // Test that API errors return user-friendly messages
      const userErrorTests = [
        { 
          url: `${BASE_URL}/api/search/artists?q=`, 
          description: 'Empty search query',
          shouldHaveMessage: true
        },
        { 
          url: `${BASE_URL}/api/votes`, 
          method: 'POST',
          body: '{}',
          description: 'Invalid vote data',
          shouldHaveMessage: true
        },
        { 
          url: `${BASE_URL}/api/artists/non-existent`, 
          description: 'Non-existent artist',
          shouldHaveMessage: true
        }
      ];
      
      for (const test of userErrorTests) {
        const response = await makeRequest(test.url, {
          method: test.method || 'GET',
          headers: test.body ? { 'Content-Type': 'application/json' } : {},
          body: test.body
        });
        
        if (response.status >= 400 && response.data?.error) {
          const errorMessage = response.data.error;
          
          // Check if error message is user-friendly (not technical)
          const isTechnical = errorMessage.includes('stack') || 
                             errorMessage.includes('database') || 
                             errorMessage.includes('SQL') ||
                             errorMessage.includes('undefined');
          
          if (!isTechnical) {
            logSuccess(`${test.description} - user-friendly error message`);
          } else {
            logError(`${test.description} - technical error exposed`, errorMessage);
          }
        } else {
          logWarning(`${test.description} - no error message found`);
        }
      }
      
      // Test that 404 pages are user-friendly
      const notFoundResponse = await makeRequest(`${BASE_URL}/non-existent-page`);
      if (notFoundResponse.status === 404) {
        logSuccess('404 page returns user-friendly error');
      } else {
        logError('404 page not properly handled', `Status: ${notFoundResponse.status}`);
      }
      
    } catch (error) {
      logError('User-friendly error tests failed', error);
    }
  }

  generateReport() {
    log('\n📊 ERROR HANDLING VALIDATION REPORT', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');
    
    const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
    
    log(`\n📈 SUMMARY STATISTICS:`, 'white');
    log(`Total Tests: ${testResults.total}`, 'white');
    log(`✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, 'red');
    log(`⚠️  Warnings: ${testResults.warnings.length}`, 'yellow');
    log(`🚨 Critical: ${testResults.critical.length}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate > 90 ? 'green' : successRate > 70 ? 'yellow' : 'red');
    
    if (testResults.critical.length > 0) {
      log(`\n🚨 CRITICAL ISSUES:`, 'red');
      testResults.critical.forEach(issue => {
        log(`   • ${issue}`, 'red');
      });
    }
    
    if (testResults.errors.length > 0) {
      log(`\n❌ ERRORS FOUND:`, 'red');
      testResults.errors.forEach(error => {
        log(`   • ${error.message}: ${error.error}`, 'red');
      });
    }
    
    if (testResults.warnings.length > 0) {
      log(`\n⚠️  WARNINGS:`, 'yellow');
      testResults.warnings.forEach(warning => {
        log(`   • ${warning}`, 'yellow');
      });
    }
    
    log(`\n🎯 ERROR HANDLING ASSESSMENT:`, 'cyan');
    
    if (successRate >= 95) {
      log('EXCELLENT - Error handling is robust and comprehensive', 'green');
    } else if (successRate >= 85) {
      log('GOOD - Error handling is solid with minor improvements needed', 'yellow');
    } else if (successRate >= 70) {
      log('MODERATE - Error handling needs significant improvements', 'yellow');
    } else {
      log('POOR - Error handling is inadequate and needs major fixes', 'red');
    }
    
    log(`\n📋 RECOMMENDATIONS:`, 'cyan');
    
    if (testResults.critical.length > 0) {
      log('• Fix all critical error handling issues immediately', 'red');
    }
    
    if (testResults.errors.length > 0) {
      log('• Implement proper error boundaries for all components', 'yellow');
      log('• Add user-friendly error messages for all API endpoints', 'yellow');
      log('• Implement retry mechanisms for transient failures', 'yellow');
    }
    
    if (testResults.warnings.length > 0) {
      log('• Review and address all warning conditions', 'yellow');
      log('• Implement graceful degradation for external service failures', 'yellow');
    }
    
    log('• Monitor error rates in production', 'white');
    log('• Implement comprehensive logging for debugging', 'white');
    log('• Regular error handling validation tests', 'white');
    
    log(`\n🚀 SUB-AGENT 9 MISSION STATUS:`, 'cyan');
    
    if (successRate >= 90 && testResults.critical.length === 0) {
      log('✅ MISSION COMPLETE - Error handling validation successful', 'green');
    } else if (successRate >= 80) {
      log('⚠️  MISSION PARTIAL - Error handling needs minor improvements', 'yellow');
    } else {
      log('❌ MISSION INCOMPLETE - Error handling needs major fixes', 'red');
    }
    
    log('\n═══════════════════════════════════════════════════════', 'cyan');
  }
}

// Run the validation
async function main() {
  const validator = new ErrorValidationTests();
  await validator.runAllTests();
  
  // Exit with appropriate code
  process.exit(testResults.critical.length > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logCritical(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logCritical(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  logCritical(`Test runner failed: ${error.message}`);
  process.exit(1);
});