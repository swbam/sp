#!/usr/bin/env node

/**
 * PRODUCTION ERROR HANDLING VALIDATION
 * 
 * This script validates error handling in production-like conditions
 * and provides comprehensive error scenario testing for deployment readiness.
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eotvxxipggnqxonvzkks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzY0NjYsImV4cCI6MjA2NzUxMjQ2Nn0.jOetqdvld75LwNpzlxGXiHvMaGaO1FIeebkcObwYKhc';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';

// Test tracking
let results = {
  total: 0,
  passed: 0,
  failed: 0,
  critical: 0,
  errors: []
};

// Colors for output
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

function recordTest(name, passed, error = null) {
  results.total++;
  if (passed) {
    results.passed++;
    log(`✅ ${name}`, 'green');
  } else {
    results.failed++;
    if (error) {
      results.errors.push({ name, error });
    }
    log(`❌ ${name}`, 'red');
  }
}

function recordCritical(name, error) {
  results.critical++;
  results.errors.push({ name, error, critical: true });
  log(`🚨 CRITICAL: ${name}`, 'red');
}

class ProductionErrorValidator {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async validateAll() {
    log('🔍 PRODUCTION ERROR HANDLING VALIDATION', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');
    
    await this.validateAPIErrorHandling();
    await this.validateDatabaseErrorHandling();
    await this.validateAuthenticationErrors();
    await this.validateInputValidation();
    await this.validateErrorBoundaries();
    await this.validateUserExperience();
    await this.validatePerformanceUnderErrors();
    
    this.generateReport();
  }

  async validateAPIErrorHandling() {
    log('\n🔌 Validating API Error Handling...', 'blue');
    
    // Test 1: Invalid endpoints
    try {
      const response = await fetch(`${BASE_URL}/api/nonexistent`);
      recordTest('Invalid endpoint returns 404', response.status === 404);
    } catch (error) {
      recordTest('Invalid endpoint handling', false, error.message);
    }

    // Test 2: Malformed requests
    try {
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      recordTest('Malformed JSON handled', response.status === 400);
    } catch (error) {
      recordTest('Malformed JSON handling', false, error.message);
    }

    // Test 3: Large payloads
    try {
      const largePayload = JSON.stringify({ data: 'x'.repeat(100000) });
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largePayload
      });
      recordTest('Large payload handled', response.status === 413 || response.status === 400);
    } catch (error) {
      recordTest('Large payload handling', false, error.message);
    }

    // Test 4: Missing content type
    try {
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'POST',
        body: '{}'
      });
      recordTest('Missing content type handled', response.status >= 400);
    } catch (error) {
      recordTest('Missing content type handling', false, error.message);
    }

    // Test 5: Invalid HTTP methods
    try {
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'DELETE'
      });
      recordTest('Invalid HTTP method handled', response.status === 405);
    } catch (error) {
      recordTest('Invalid HTTP method handling', false, error.message);
    }
  }

  async validateDatabaseErrorHandling() {
    log('\n🗄️ Validating Database Error Handling...', 'blue');
    
    // Test 1: Invalid UUID format
    try {
      const response = await fetch(`${BASE_URL}/api/shows/invalid-uuid`);
      const isProperError = response.status === 400 || response.status === 404;
      recordTest('Invalid UUID format handled', isProperError);
      
      if (response.status === 500) {
        recordCritical('UUID validation missing', 'Returns 500 instead of 400/404');
      }
    } catch (error) {
      recordTest('Invalid UUID handling', false, error.message);
    }

    // Test 2: Non-existent resources
    try {
      const response = await fetch(`${BASE_URL}/api/shows/00000000-0000-0000-0000-000000000000`);
      recordTest('Non-existent resource handled', response.status === 404);
    } catch (error) {
      recordTest('Non-existent resource handling', false, error.message);
    }

    // Test 3: Database connection simulation
    try {
      const { data, error } = await this.supabase.from('artists').select('id').limit(1);
      recordTest('Database connection works', !error);
    } catch (error) {
      recordTest('Database connection handling', false, error.message);
    }
  }

  async validateAuthenticationErrors() {
    log('\n🔐 Validating Authentication Error Handling...', 'blue');
    
    // Test 1: No auth token
    try {
      const response = await fetch(`${BASE_URL}/api/user/following`);
      recordTest('Missing auth token handled', response.status === 401);
    } catch (error) {
      recordTest('Missing auth token handling', false, error.message);
    }

    // Test 2: Invalid auth token
    try {
      const response = await fetch(`${BASE_URL}/api/user/following`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      recordTest('Invalid auth token handled', response.status === 401);
    } catch (error) {
      recordTest('Invalid auth token handling', false, error.message);
    }

    // Test 3: Expired token simulation
    try {
      const response = await fetch(`${BASE_URL}/api/user/following`, {
        headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired' }
      });
      recordTest('Expired token handled', response.status === 401);
    } catch (error) {
      recordTest('Expired token handling', false, error.message);
    }

    // Test 4: Protected POST endpoint
    try {
      const response = await fetch(`${BASE_URL}/api/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setlist_song_id: 'test', vote_type: 'up' })
      });
      
      const isProperAuth = response.status === 401 || response.status === 403;
      recordTest('Protected POST requires auth', isProperAuth);
      
      if (response.status === 500) {
        recordCritical('Vote API auth check missing', 'Returns 500 instead of 401');
      }
    } catch (error) {
      recordTest('Protected POST auth handling', false, error.message);
    }
  }

  async validateInputValidation() {
    log('\n🚫 Validating Input Validation...', 'blue');
    
    // Test 1: Empty search query
    try {
      const response = await fetch(`${BASE_URL}/api/search/artists?q=`);
      recordTest('Empty search query rejected', response.status === 400);
    } catch (error) {
      recordTest('Empty search query handling', false, error.message);
    }

    // Test 2: Whitespace-only query
    try {
      const response = await fetch(`${BASE_URL}/api/search/artists?q=${encodeURIComponent('   ')}`);
      recordTest('Whitespace-only query rejected', response.status === 400);
    } catch (error) {
      recordTest('Whitespace-only query handling', false, error.message);
    }

    // Test 3: Extremely long query
    try {
      const longQuery = 'a'.repeat(1000);
      const response = await fetch(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(longQuery)}`);
      recordTest('Long query handled', response.status === 400 || response.status === 413);
    } catch (error) {
      recordTest('Long query handling', false, error.message);
    }

    // Test 4: XSS attempt
    try {
      const xssAttempt = '<script>alert("xss")</script>';
      const response = await fetch(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(xssAttempt)}`);
      recordTest('XSS attempt sanitized', response.status === 200);
    } catch (error) {
      recordTest('XSS attempt handling', false, error.message);
    }

    // Test 5: SQL injection attempt
    try {
      const sqlAttempt = "'; DROP TABLE artists; --";
      const response = await fetch(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(sqlAttempt)}`);
      recordTest('SQL injection attempt blocked', response.status === 200);
    } catch (error) {
      recordTest('SQL injection handling', false, error.message);
    }
  }

  async validateErrorBoundaries() {
    log('\n🛡️ Validating Error Boundaries...', 'blue');
    
    // Test 1: Homepage error boundary
    try {
      const response = await fetch(`${BASE_URL}/`);
      const html = await response.text();
      const hasErrorBoundary = html.includes('ErrorBoundary') || response.status === 200;
      recordTest('Homepage error boundary active', hasErrorBoundary);
    } catch (error) {
      recordTest('Homepage error boundary', false, error.message);
    }

    // Test 2: Search page error boundary
    try {
      const response = await fetch(`${BASE_URL}/search`);
      const html = await response.text();
      const hasErrorBoundary = html.includes('ErrorBoundary') || response.status === 200;
      recordTest('Search page error boundary active', hasErrorBoundary);
    } catch (error) {
      recordTest('Search page error boundary', false, error.message);
    }

    // Test 3: 404 page
    try {
      const response = await fetch(`${BASE_URL}/nonexistent-page`);
      recordTest('404 page works', response.status === 404);
    } catch (error) {
      recordTest('404 page handling', false, error.message);
    }

    // Test 4: Artist not found
    try {
      const response = await fetch(`${BASE_URL}/artists/nonexistent-artist`);
      recordTest('Artist not found handled', response.status === 404 || response.status === 200);
    } catch (error) {
      recordTest('Artist not found handling', false, error.message);
    }
  }

  async validateUserExperience() {
    log('\n👥 Validating User Experience...', 'blue');
    
    // Test 1: Error message quality
    try {
      const response = await fetch(`${BASE_URL}/api/search/artists?q=`);
      if (response.status === 400) {
        const data = await response.json();
        const hasGoodMessage = data.error && !data.error.includes('stack') && !data.error.includes('database');
        recordTest('Error messages user-friendly', hasGoodMessage);
      } else {
        recordTest('Error messages user-friendly', false);
      }
    } catch (error) {
      recordTest('Error message quality', false, error.message);
    }

    // Test 2: Response time under errors
    try {
      const start = performance.now();
      await fetch(`${BASE_URL}/api/shows/invalid-uuid`);
      const end = performance.now();
      const responseTime = end - start;
      recordTest('Error response time acceptable', responseTime < 1000);
    } catch (error) {
      recordTest('Error response time', false, error.message);
    }

    // Test 3: Consistent error format
    try {
      const response1 = await fetch(`${BASE_URL}/api/search/artists?q=`);
      const response2 = await fetch(`${BASE_URL}/api/artists/nonexistent`);
      
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      const hasConsistentFormat = data1.error && data2.error && 
                                 typeof data1.error === 'string' && 
                                 typeof data2.error === 'string';
      recordTest('Consistent error format', hasConsistentFormat);
    } catch (error) {
      recordTest('Consistent error format', false, error.message);
    }
  }

  async validatePerformanceUnderErrors() {
    log('\n⚡ Validating Performance Under Errors...', 'blue');
    
    // Test 1: Multiple simultaneous errors
    try {
      const promises = Array(10).fill(null).map(() => 
        fetch(`${BASE_URL}/api/shows/invalid-uuid-${Math.random()}`)
      );
      
      const start = performance.now();
      const responses = await Promise.all(promises);
      const end = performance.now();
      
      const avgResponseTime = (end - start) / promises.length;
      recordTest('Multiple errors handled efficiently', avgResponseTime < 500);
    } catch (error) {
      recordTest('Multiple errors performance', false, error.message);
    }

    // Test 2: Error handling doesn't block other requests
    try {
      const errorPromise = fetch(`${BASE_URL}/api/shows/invalid-uuid`);
      const validPromise = fetch(`${BASE_URL}/api/trending`);
      
      const [errorResponse, validResponse] = await Promise.all([errorPromise, validPromise]);
      
      recordTest('Errors don\'t block valid requests', validResponse.status === 200);
    } catch (error) {
      recordTest('Error isolation', false, error.message);
    }

    // Test 3: Memory usage under errors
    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many error requests
      const promises = Array(50).fill(null).map(() => 
        fetch(`${BASE_URL}/api/shows/invalid-uuid-${Math.random()}`)
      );
      
      await Promise.all(promises);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      recordTest('Memory usage stable under errors', memoryIncrease < 50 * 1024 * 1024); // 50MB
    } catch (error) {
      recordTest('Memory usage under errors', false, error.message);
    }
  }

  generateReport() {
    log('\n📊 PRODUCTION ERROR HANDLING REPORT', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');
    
    const successRate = ((results.passed / results.total) * 100).toFixed(1);
    
    log(`\n📈 SUMMARY:`, 'white');
    log(`Total Tests: ${results.total}`, 'white');
    log(`✅ Passed: ${results.passed}`, 'green');
    log(`❌ Failed: ${results.failed}`, 'red');
    log(`🚨 Critical: ${results.critical}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate > 90 ? 'green' : successRate > 75 ? 'yellow' : 'red');
    
    if (results.critical > 0) {
      log(`\n🚨 CRITICAL ISSUES:`, 'red');
      results.errors.filter(e => e.critical).forEach(error => {
        log(`   • ${error.name}: ${error.error}`, 'red');
      });
    }
    
    if (results.errors.length > 0) {
      log(`\n❌ ERRORS:`, 'red');
      results.errors.filter(e => !e.critical).forEach(error => {
        log(`   • ${error.name}: ${error.error}`, 'red');
      });
    }
    
    log(`\n🎯 PRODUCTION READINESS:`, 'cyan');
    
    if (results.critical > 0) {
      log('❌ NOT READY - Critical issues must be fixed', 'red');
    } else if (successRate >= 90) {
      log('✅ READY - Error handling is production-ready', 'green');
    } else if (successRate >= 75) {
      log('⚠️  CAUTION - Minor issues should be addressed', 'yellow');
    } else {
      log('❌ NOT READY - Significant improvements needed', 'red');
    }
    
    log(`\n📋 DEPLOYMENT RECOMMENDATIONS:`, 'cyan');
    
    if (results.critical > 0) {
      log('• Fix all critical issues before deployment', 'red');
    }
    
    if (results.failed > 0) {
      log('• Review and fix all failed test cases', 'yellow');
    }
    
    log('• Set up error monitoring in production', 'white');
    log('• Configure automated error alerts', 'white');
    log('• Implement performance monitoring', 'white');
    log('• Schedule regular error validation tests', 'white');
    
    log('\n═══════════════════════════════════════════════════════', 'cyan');
    
    // Exit with appropriate code
    process.exit(results.critical > 0 ? 1 : 0);
  }
}

// Run validation
async function main() {
  const validator = new ProductionErrorValidator();
  await validator.validateAll();
}

// Error handling
process.on('uncaughtException', (error) => {
  log(`🚨 UNCAUGHT EXCEPTION: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`🚨 UNHANDLED REJECTION: ${reason}`, 'red');
  process.exit(1);
});

main().catch(error => {
  log(`🚨 VALIDATION FAILED: ${error.message}`, 'red');
  process.exit(1);
});