#!/usr/bin/env node

/**
 * Comprehensive Performance Testing for MySetlist
 * Tests all aspects of performance with real data and usage patterns
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3004';
const RESULTS_FILE = path.join(__dirname, 'reports', `comprehensive-performance-${new Date().toISOString()}.json`);

// Ensure reports directory exists
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  testSuite: 'Comprehensive Performance Test',
  pageLoadTimes: {},
  apiResponseTimes: {},
  databaseQueryTimes: {},
  concurrentLoadResults: {},
  memoryUsage: {},
  bundleAnalysis: {},
  coreWebVitals: {},
  recommendations: []
};

console.log('🎯 COMPREHENSIVE PERFORMANCE TEST SUITE');
console.log('==========================================');

// Test 1: Page Load Times
async function testPageLoadTimes() {
  console.log('\n📊 1. Page Load Times Test');
  console.log('============================');

  const pages = [
    { name: 'Homepage', url: '/' },
    { name: 'Search Page', url: '/search' },
    { name: 'Shows Page', url: '/shows' },
    { name: 'Trending Page', url: '/trending' },
    { name: 'Artist Page', url: '/artists/taylor-swift' },
    { name: 'Show Detail', url: '/shows/1' }
  ];

  for (const page of pages) {
    const url = `${BASE_URL}${page.url}`;
    const times = [];
    
    console.log(`\n📄 Testing ${page.name} (${page.url})`);
    
    // Test 3 times for average
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        const end = performance.now();
        const loadTime = end - start;
        
        times.push(loadTime);
        console.log(`  Attempt ${i + 1}: ${loadTime.toFixed(2)}ms (${response.status})`);
        
        // Check if page has expected content
        if (response.ok && html.includes('<!DOCTYPE html>')) {
          console.log(`  ✅ Page loaded successfully`);
        } else {
          console.log(`  ❌ Page load issue detected`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        times.push(Infinity);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    results.pageLoadTimes[page.name] = {
      url: page.url,
      avgTime,
      minTime,
      maxTime,
      attempts: times.length,
      status: avgTime < 2000 ? 'PASS' : 'FAIL'
    };
    
    console.log(`  📊 Average: ${avgTime.toFixed(2)}ms | Min: ${minTime.toFixed(2)}ms | Max: ${maxTime.toFixed(2)}ms`);
    console.log(`  ${avgTime < 2000 ? '✅ PASS' : '❌ FAIL'} (Target: < 2000ms)`);
  }
}

// Test 2: API Response Times
async function testAPIResponseTimes() {
  console.log('\n🔌 2. API Response Times Test');
  console.log('==============================');

  const endpoints = [
    { name: 'Trending', url: '/api/trending' },
    { name: 'Shows', url: '/api/shows' },
    { name: 'Search Artists', url: '/api/search/artists?q=taylor' },
    { name: 'Featured Artists', url: '/api/featured' },
    { name: 'Artist Detail', url: '/api/artists/taylor-swift' },
    { name: 'Show Detail', url: '/api/shows/1' },
    { name: 'Vote Endpoint', url: '/api/votes', method: 'POST' }
  ];

  for (const endpoint of endpoints) {
    const url = `${BASE_URL}${endpoint.url}`;
    const times = [];
    
    console.log(`\n🔗 Testing ${endpoint.name} (${endpoint.url})`);
    
    // Test 5 times for better average
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      
      try {
        const options = {
          method: endpoint.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        };
        
        if (endpoint.method === 'POST') {
          options.body = JSON.stringify({
            setlistSongId: '1',
            voteType: 'up'
          });
        }
        
        const response = await fetch(url, options);
        const data = await response.json();
        const end = performance.now();
        const responseTime = end - start;
        
        times.push(responseTime);
        console.log(`  Attempt ${i + 1}: ${responseTime.toFixed(2)}ms (${response.status})`);
        
        // Check response structure
        if (response.ok && data) {
          console.log(`  ✅ API response valid`);
        } else {
          console.log(`  ⚠️ API response issue: ${response.status}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        times.push(Infinity);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    results.apiResponseTimes[endpoint.name] = {
      url: endpoint.url,
      avgTime,
      minTime,
      maxTime,
      attempts: times.length,
      status: avgTime < 500 ? 'PASS' : 'FAIL'
    };
    
    console.log(`  📊 Average: ${avgTime.toFixed(2)}ms | Min: ${minTime.toFixed(2)}ms | Max: ${maxTime.toFixed(2)}ms`);
    console.log(`  ${avgTime < 500 ? '✅ PASS' : '❌ FAIL'} (Target: < 500ms)`);
  }
}

// Test 3: Database Query Performance
async function testDatabaseQueryPerformance() {
  console.log('\n🗄️ 3. Database Query Performance Test');
  console.log('======================================');

  const queries = [
    { name: 'Artists Count', endpoint: '/api/stats' },
    { name: 'Shows Query', endpoint: '/api/shows?limit=10' },
    { name: 'Search Performance', endpoint: '/api/search/artists?q=taylor' },
    { name: 'Artist with Shows', endpoint: '/api/artists/taylor-swift/shows' },
    { name: 'Trending Algorithm', endpoint: '/api/trending' }
  ];

  for (const query of queries) {
    const url = `${BASE_URL}${query.endpoint}`;
    const times = [];
    
    console.log(`\n📊 Testing ${query.name}`);
    
    // Test database query performance
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        const end = performance.now();
        const queryTime = end - start;
        
        times.push(queryTime);
        console.log(`  Query ${i + 1}: ${queryTime.toFixed(2)}ms`);
        
        // Check data quality
        if (response.ok && data) {
          if (Array.isArray(data)) {
            console.log(`  ✅ Returned ${data.length} records`);
          } else if (data.count !== undefined) {
            console.log(`  ✅ Stats: ${JSON.stringify(data)}`);
          } else {
            console.log(`  ✅ Data structure valid`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Query error: ${error.message}`);
        times.push(Infinity);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    results.databaseQueryTimes[query.name] = {
      endpoint: query.endpoint,
      avgTime,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      status: avgTime < 100 ? 'PASS' : 'FAIL'
    };
    
    console.log(`  📊 Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  ${avgTime < 100 ? '✅ PASS' : '❌ FAIL'} (Target: < 100ms)`);
  }
}

// Test 4: Concurrent Load Testing
async function testConcurrentLoad() {
  console.log('\n⚡ 4. Concurrent Load Test');
  console.log('===========================');

  const endpoints = [
    `${BASE_URL}/api/trending`,
    `${BASE_URL}/api/shows`,
    `${BASE_URL}/api/search/artists?q=test`
  ];

  const concurrentUsers = [1, 5, 10, 20];
  
  for (const userCount of concurrentUsers) {
    console.log(`\n👥 Testing with ${userCount} concurrent users`);
    
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < userCount; i++) {
      const endpoint = endpoints[i % endpoints.length];
      promises.push(
        fetch(endpoint).then(response => ({
          status: response.status,
          endpoint: endpoint.replace(BASE_URL, ''),
          time: performance.now() - startTime
        }))
      );
    }
    
    try {
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successful = responses.filter(r => r.status === 200).length;
      const failed = responses.filter(r => r.status !== 200).length;
      const avgResponseTime = responses.reduce((sum, r) => sum + r.time, 0) / responses.length;
      
      results.concurrentLoadResults[`${userCount}_users`] = {
        userCount,
        totalTime,
        successful,
        failed,
        avgResponseTime,
        throughput: userCount / (totalTime / 1000), // requests per second
        status: failed === 0 ? 'PASS' : 'FAIL'
      };
      
      console.log(`  📊 Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  ✅ Successful: ${successful} | ❌ Failed: ${failed}`);
      console.log(`  📈 Throughput: ${(userCount / (totalTime / 1000)).toFixed(2)} req/sec`);
      console.log(`  ${failed === 0 ? '✅ PASS' : '❌ FAIL'} (No failures)`);
      
    } catch (error) {
      console.log(`  ❌ Concurrent load test failed: ${error.message}`);
      results.concurrentLoadResults[`${userCount}_users`] = {
        userCount,
        error: error.message,
        status: 'FAIL'
      };
    }
  }
}

// Test 5: Memory Usage Analysis
async function testMemoryUsage() {
  console.log('\n🧠 5. Memory Usage Analysis');
  console.log('============================');

  const memoryBefore = process.memoryUsage();
  console.log(`📊 Initial memory usage:`);
  console.log(`  RSS: ${(memoryBefore.rss / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Heap Used: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Heap Total: ${(memoryBefore.heapTotal / 1024 / 1024).toFixed(2)}MB`);

  // Simulate typical usage
  const testRequests = [
    `${BASE_URL}/api/trending`,
    `${BASE_URL}/api/shows`,
    `${BASE_URL}/api/search/artists?q=test`,
    `${BASE_URL}/`,
    `${BASE_URL}/search`,
    `${BASE_URL}/shows`
  ];

  for (let i = 0; i < 20; i++) {
    const endpoint = testRequests[i % testRequests.length];
    try {
      const response = await fetch(endpoint);
      await response.text();
    } catch (error) {
      // Ignore errors for memory test
    }
  }

  const memoryAfter = process.memoryUsage();
  const memoryIncrease = {
    rss: (memoryAfter.rss - memoryBefore.rss) / 1024 / 1024,
    heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024,
    heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024
  };

  results.memoryUsage = {
    before: memoryBefore,
    after: memoryAfter,
    increase: memoryIncrease,
    status: memoryIncrease.heapUsed < 50 ? 'PASS' : 'FAIL' // 50MB threshold
  };

  console.log(`\n📊 Memory usage after 20 requests:`);
  console.log(`  RSS: ${(memoryAfter.rss / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.rss.toFixed(2)}MB)`);
  console.log(`  Heap Used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.heapUsed.toFixed(2)}MB)`);
  console.log(`  Heap Total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.heapTotal.toFixed(2)}MB)`);
  console.log(`  ${memoryIncrease.heapUsed < 50 ? '✅ PASS' : '❌ FAIL'} (Target: < 50MB increase)`);
}

// Test 6: Bundle Analysis
async function analyzeBundleSize() {
  console.log('\n📦 6. Bundle Analysis');
  console.log('======================');

  const buildDir = path.join(__dirname, '.next');
  if (!fs.existsSync(buildDir)) {
    console.log('❌ Build directory not found. Run "npm run build" first.');
    results.bundleAnalysis = {
      status: 'FAIL',
      error: 'Build directory not found'
    };
    return;
  }

  const staticDir = path.join(buildDir, 'static');
  if (!fs.existsSync(staticDir)) {
    console.log('❌ Static directory not found.');
    results.bundleAnalysis = {
      status: 'FAIL',
      error: 'Static directory not found'
    };
    return;
  }

  const chunks = path.join(staticDir, 'chunks');
  if (!fs.existsSync(chunks)) {
    console.log('❌ Chunks directory not found.');
    results.bundleAnalysis = {
      status: 'FAIL',
      error: 'Chunks directory not found'
    };
    return;
  }

  const files = fs.readdirSync(chunks);
  let totalSize = 0;
  let largeFiles = 0;
  const fileSizes = [];

  files.forEach(file => {
    const filePath = path.join(chunks, file);
    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;
    totalSize += stats.size;
    
    fileSizes.push({
      file,
      size: sizeKB,
      isLarge: sizeKB > 250
    });
    
    if (sizeKB > 250) {
      largeFiles++;
      console.log(`⚠️  Large chunk: ${file} (${sizeKB.toFixed(2)}KB)`);
    }
  });

  const totalSizeMB = totalSize / 1024 / 1024;
  
  results.bundleAnalysis = {
    totalSizeMB,
    fileCount: files.length,
    largeFileCount: largeFiles,
    avgFileSize: (totalSize / files.length) / 1024,
    fileSizes,
    status: totalSizeMB < 10 ? 'PASS' : 'FAIL' // 10MB threshold
  };

  console.log(`📊 Bundle Statistics:`);
  console.log(`  Total Size: ${totalSizeMB.toFixed(2)}MB`);
  console.log(`  File Count: ${files.length}`);
  console.log(`  Large Files (>250KB): ${largeFiles}`);
  console.log(`  Average File Size: ${((totalSize / files.length) / 1024).toFixed(2)}KB`);
  console.log(`  ${totalSizeMB < 10 ? '✅ PASS' : '❌ FAIL'} (Target: < 10MB)`);
}

// Generate recommendations
function generateRecommendations() {
  console.log('\n💡 7. Performance Recommendations');
  console.log('===================================');

  const recommendations = [];

  // Page load recommendations
  Object.entries(results.pageLoadTimes).forEach(([pageName, data]) => {
    if (data.avgTime > 2000) {
      recommendations.push({
        category: 'Page Load',
        severity: 'HIGH',
        issue: `${pageName} loads slowly (${data.avgTime.toFixed(2)}ms)`,
        suggestion: 'Consider server-side rendering optimization, image optimization, or code splitting'
      });
    }
  });

  // API response recommendations
  Object.entries(results.apiResponseTimes).forEach(([apiName, data]) => {
    if (data.avgTime > 500) {
      recommendations.push({
        category: 'API Performance',
        severity: 'MEDIUM',
        issue: `${apiName} API responds slowly (${data.avgTime.toFixed(2)}ms)`,
        suggestion: 'Add database indexing, implement caching, or optimize queries'
      });
    }
  });

  // Database query recommendations
  Object.entries(results.databaseQueryTimes).forEach(([queryName, data]) => {
    if (data.avgTime > 100) {
      recommendations.push({
        category: 'Database',
        severity: 'HIGH',
        issue: `${queryName} query is slow (${data.avgTime.toFixed(2)}ms)`,
        suggestion: 'Add database indexes, optimize query structure, or implement query caching'
      });
    }
  });

  // Bundle size recommendations
  if (results.bundleAnalysis.totalSizeMB > 10) {
    recommendations.push({
      category: 'Bundle Size',
      severity: 'MEDIUM',
      issue: `Large bundle size (${results.bundleAnalysis.totalSizeMB.toFixed(2)}MB)`,
      suggestion: 'Implement code splitting, tree shaking, and lazy loading'
    });
  }

  // Memory usage recommendations
  if (results.memoryUsage.increase && results.memoryUsage.increase.heapUsed > 50) {
    recommendations.push({
      category: 'Memory',
      severity: 'HIGH',
      issue: `High memory usage increase (${results.memoryUsage.increase.heapUsed.toFixed(2)}MB)`,
      suggestion: 'Check for memory leaks, optimize object creation, implement proper cleanup'
    });
  }

  results.recommendations = recommendations;

  recommendations.forEach(rec => {
    const severityIcon = rec.severity === 'HIGH' ? '🚨' : rec.severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
    console.log(`${severityIcon} ${rec.category}: ${rec.issue}`);
    console.log(`   💡 ${rec.suggestion}`);
  });

  if (recommendations.length === 0) {
    console.log('🎉 No performance issues detected!');
  }
}

// Generate final report
function generateFinalReport() {
  console.log('\n📋 8. Final Performance Report');
  console.log('===============================');

  const totalTests = Object.keys(results.pageLoadTimes).length + 
                     Object.keys(results.apiResponseTimes).length + 
                     Object.keys(results.databaseQueryTimes).length + 
                     Object.keys(results.concurrentLoadResults).length + 1 + 1; // memory + bundle

  let passedTests = 0;
  let failedTests = 0;

  // Count passed/failed tests
  Object.values(results.pageLoadTimes).forEach(test => {
    if (test.status === 'PASS') passedTests++;
    else failedTests++;
  });

  Object.values(results.apiResponseTimes).forEach(test => {
    if (test.status === 'PASS') passedTests++;
    else failedTests++;
  });

  Object.values(results.databaseQueryTimes).forEach(test => {
    if (test.status === 'PASS') passedTests++;
    else failedTests++;
  });

  Object.values(results.concurrentLoadResults).forEach(test => {
    if (test.status === 'PASS') passedTests++;
    else failedTests++;
  });

  if (results.memoryUsage.status === 'PASS') passedTests++;
  else failedTests++;

  if (results.bundleAnalysis.status === 'PASS') passedTests++;
  else failedTests++;

  const overallStatus = failedTests === 0 ? 'PASS' : 'FAIL';
  const passPercentage = (passedTests / totalTests) * 100;

  console.log(`📊 Test Results Summary:`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passedTests} (${passPercentage.toFixed(1)}%)`);
  console.log(`  Failed: ${failedTests}`);
  console.log(`  Overall Status: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

  results.summary = {
    totalTests,
    passedTests,
    failedTests,
    passPercentage,
    overallStatus
  };

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${RESULTS_FILE}`);

  return overallStatus === 'PASS';
}

// Main execution
async function main() {
  try {
    console.log('Starting comprehensive performance testing...\n');
    
    await testPageLoadTimes();
    await testAPIResponseTimes();
    await testDatabaseQueryPerformance();
    await testConcurrentLoad();
    await testMemoryUsage();
    await analyzeBundleSize();
    
    generateRecommendations();
    const passed = generateFinalReport();
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏁 COMPREHENSIVE PERFORMANCE TEST: ${passed ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60));
    
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Performance test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
main();