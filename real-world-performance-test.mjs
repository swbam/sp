#!/usr/bin/env node

/**
 * Real-World Performance Test for MySetlist
 * Tests actual functioning components with real data
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3004';
const RESULTS_FILE = path.join(__dirname, 'reports', `real-world-performance-${new Date().toISOString()}.json`);

// Ensure reports directory exists
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  testSuite: 'Real-World Performance Test',
  results: {},
  summary: {}
};

console.log('🎯 REAL-WORLD PERFORMANCE TEST WITH ACTUAL DATA');
console.log('================================================');

// Test 1: Core Web Vitals - Real User Journey
async function testCoreWebVitals() {
  console.log('\n🚀 1. Core Web Vitals - Real User Journey');
  console.log('==========================================');

  const journey = [
    { name: 'Homepage Load', url: '/', description: 'Landing page with real trending data' },
    { name: 'Search Page', url: '/search', description: 'Search interface load time' },
    { name: 'Artist Search', url: '/search?q=taylor', description: 'Search with real query' },
    { name: 'Artist Page', url: '/artists/taylor-swift', description: 'Full artist page with shows' },
    { name: 'Shows List', url: '/shows', description: 'Shows listing page' },
    { name: 'Trending Page', url: '/trending', description: 'Trending content page' }
  ];

  const journeyResults = {};

  for (const step of journey) {
    const url = `${BASE_URL}${step.url}`;
    const times = [];
    
    console.log(`\n📄 Testing: ${step.name}`);
    console.log(`   URL: ${step.url}`);
    console.log(`   Description: ${step.description}`);
    
    // Test multiple times for reliability
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        const end = performance.now();
        const loadTime = end - start;
        
        times.push(loadTime);
        
        // Analyze content
        const hasContent = html.includes('<!DOCTYPE html>') && html.length > 1000;
        const hasErrors = html.includes('Error:') || html.includes('500');
        
        console.log(`   Attempt ${i + 1}: ${loadTime.toFixed(2)}ms (${response.status}) ${hasContent ? '✅' : '❌'} ${hasErrors ? '⚠️' : ''}`);
        
      } catch (error) {
        console.log(`   Attempt ${i + 1}: ERROR - ${error.message}`);
        times.push(Infinity);
      }
    }
    
    const validTimes = times.filter(t => t !== Infinity);
    const avgTime = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : Infinity;
    const minTime = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;
    const maxTime = validTimes.length > 0 ? Math.max(...validTimes) : Infinity;
    
    journeyResults[step.name] = {
      url: step.url,
      avgTime,
      minTime,
      maxTime,
      successRate: validTimes.length / times.length,
      status: avgTime < 2000 && validTimes.length >= 3 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   📊 Results: Avg ${avgTime.toFixed(2)}ms | Min ${minTime.toFixed(2)}ms | Max ${maxTime.toFixed(2)}ms`);
    console.log(`   📈 Success Rate: ${(validTimes.length / times.length * 100).toFixed(1)}%`);
    console.log(`   ${journeyResults[step.name].status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  }

  results.results.coreWebVitals = journeyResults;
  
  // Overall user journey assessment
  const allSteps = Object.values(journeyResults);
  const passedSteps = allSteps.filter(step => step.status === 'PASS').length;
  const avgJourneyTime = allSteps.reduce((sum, step) => sum + step.avgTime, 0) / allSteps.length;
  
  console.log(`\n📊 User Journey Summary:`);
  console.log(`   Passed Steps: ${passedSteps}/${allSteps.length}`);
  console.log(`   Average Journey Time: ${avgJourneyTime.toFixed(2)}ms`);
  console.log(`   Overall Status: ${passedSteps === allSteps.length ? '✅ PASS' : '❌ FAIL'}`);
}

// Test 2: API Performance Under Load
async function testAPIPerformanceUnderLoad() {
  console.log('\n🔌 2. API Performance Under Realistic Load');
  console.log('===========================================');

  const apiEndpoints = [
    { name: 'Trending API', url: '/api/trending', expectedResponse: 'array' },
    { name: 'Shows API', url: '/api/shows', expectedResponse: 'array' },
    { name: 'Search API', url: '/api/search/artists?q=taylor', expectedResponse: 'array' },
    { name: 'Artist API', url: '/api/artists/taylor-swift', expectedResponse: 'object' },
    { name: 'Stats API', url: '/api/stats', expectedResponse: 'object' }
  ];

  const loadLevels = [
    { name: 'Light Load', concurrent: 1, iterations: 5 },
    { name: 'Medium Load', concurrent: 3, iterations: 5 },
    { name: 'Heavy Load', concurrent: 5, iterations: 3 }
  ];

  const apiResults = {};

  for (const endpoint of apiEndpoints) {
    console.log(`\n🔗 Testing: ${endpoint.name}`);
    apiResults[endpoint.name] = {};
    
    for (const load of loadLevels) {
      console.log(`   ${load.name} (${load.concurrent} concurrent)`);
      
      const loadResults = [];
      
      for (let iteration = 0; iteration < load.iterations; iteration++) {
        const promises = [];
        const startTime = performance.now();
        
        for (let i = 0; i < load.concurrent; i++) {
          promises.push(
            fetch(`${BASE_URL}${endpoint.url}`)
              .then(async response => {
                const data = await response.json();
                return {
                  status: response.status,
                  responseTime: performance.now() - startTime,
                  dataValid: endpoint.expectedResponse === 'array' ? Array.isArray(data) : typeof data === 'object'
                };
              })
              .catch(error => ({
                status: 'ERROR',
                responseTime: performance.now() - startTime,
                error: error.message,
                dataValid: false
              }))
          );
        }
        
        const responses = await Promise.all(promises);
        const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
        const successRate = responses.filter(r => r.status === 200).length / responses.length;
        const dataValidRate = responses.filter(r => r.dataValid).length / responses.length;
        
        loadResults.push({
          avgResponseTime,
          successRate,
          dataValidRate,
          totalTime: performance.now() - startTime
        });
        
        console.log(`     Iteration ${iteration + 1}: ${avgResponseTime.toFixed(2)}ms avg, ${(successRate * 100).toFixed(1)}% success`);
      }
      
      const avgLoadTime = loadResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / loadResults.length;
      const avgSuccessRate = loadResults.reduce((sum, r) => sum + r.successRate, 0) / loadResults.length;
      const avgDataValidRate = loadResults.reduce((sum, r) => sum + r.dataValidRate, 0) / loadResults.length;
      
      apiResults[endpoint.name][load.name] = {
        avgResponseTime: avgLoadTime,
        successRate: avgSuccessRate,
        dataValidRate: avgDataValidRate,
        status: avgLoadTime < 1000 && avgSuccessRate >= 0.8 ? 'PASS' : 'FAIL'
      };
      
      console.log(`     📊 ${load.name} Results: ${avgLoadTime.toFixed(2)}ms avg, ${(avgSuccessRate * 100).toFixed(1)}% success`);
      console.log(`     ${apiResults[endpoint.name][load.name].status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    }
  }

  results.results.apiPerformance = apiResults;
}

// Test 3: Database Performance with Real Data
async function testDatabasePerformance() {
  console.log('\n🗄️ 3. Database Performance with Real Data');
  console.log('==========================================');

  const dbQueries = [
    { name: 'Stats Query', url: '/api/stats', description: 'Database counts and statistics' },
    { name: 'Search Query', url: '/api/search/artists?q=taylor', description: 'Full-text search performance' },
    { name: 'Artist Query', url: '/api/artists/taylor-swift', description: 'Artist with related data' },
    { name: 'Shows Query', url: '/api/shows?limit=20', description: 'Shows with pagination' },
    { name: 'Trending Query', url: '/api/trending', description: 'Complex trending algorithm' }
  ];

  const dbResults = {};

  for (const query of dbQueries) {
    console.log(`\n📊 Testing: ${query.name}`);
    console.log(`   Description: ${query.description}`);
    
    const queryTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(`${BASE_URL}${query.url}`);
        const data = await response.json();
        const end = performance.now();
        const queryTime = end - start;
        
        queryTimes.push(queryTime);
        
        // Analyze data structure
        let dataAnalysis = '';
        if (Array.isArray(data)) {
          dataAnalysis = `${data.length} items`;
        } else if (typeof data === 'object' && data !== null) {
          dataAnalysis = `${Object.keys(data).length} properties`;
        }
        
        console.log(`   Query ${i + 1}: ${queryTime.toFixed(2)}ms (${response.status}) ${dataAnalysis}`);
        
      } catch (error) {
        console.log(`   Query ${i + 1}: ERROR - ${error.message}`);
        queryTimes.push(Infinity);
      }
    }
    
    const validTimes = queryTimes.filter(t => t !== Infinity);
    const avgTime = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : Infinity;
    const minTime = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;
    const maxTime = validTimes.length > 0 ? Math.max(...validTimes) : Infinity;
    
    dbResults[query.name] = {
      url: query.url,
      avgTime,
      minTime,
      maxTime,
      successRate: validTimes.length / queryTimes.length,
      status: avgTime < 500 && validTimes.length >= 3 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   📊 Results: Avg ${avgTime.toFixed(2)}ms | Min ${minTime.toFixed(2)}ms | Max ${maxTime.toFixed(2)}ms`);
    console.log(`   📈 Success Rate: ${(validTimes.length / queryTimes.length * 100).toFixed(1)}%`);
    console.log(`   ${dbResults[query.name].status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  }

  results.results.databasePerformance = dbResults;
}

// Test 4: Real-time Features Performance
async function testRealTimePerformance() {
  console.log('\n⚡ 4. Real-time Features Performance');
  console.log('====================================');

  const realtimeTests = [
    { name: 'Vote Submission', method: 'POST', url: '/api/votes', body: { setlistSongId: 'test', voteType: 'up' } },
    { name: 'Trending Updates', method: 'GET', url: '/api/trending', description: 'Real-time trending data' },
    { name: 'Search Responsiveness', method: 'GET', url: '/api/search/artists?q=t', description: 'Incremental search' }
  ];

  const realtimeResults = {};

  for (const test of realtimeTests) {
    console.log(`\n⚡ Testing: ${test.name}`);
    
    const testTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      
      try {
        const options = {
          method: test.method,
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }
        
        const response = await fetch(`${BASE_URL}${test.url}`, options);
        const data = await response.json();
        const end = performance.now();
        const responseTime = end - start;
        
        testTimes.push(responseTime);
        
        console.log(`   Test ${i + 1}: ${responseTime.toFixed(2)}ms (${response.status})`);
        
      } catch (error) {
        console.log(`   Test ${i + 1}: ERROR - ${error.message}`);
        testTimes.push(Infinity);
      }
    }
    
    const validTimes = testTimes.filter(t => t !== Infinity);
    const avgTime = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : Infinity;
    const minTime = validTimes.length > 0 ? Math.min(...validTimes) : Infinity;
    const maxTime = validTimes.length > 0 ? Math.max(...validTimes) : Infinity;
    
    realtimeResults[test.name] = {
      avgTime,
      minTime,
      maxTime,
      successRate: validTimes.length / testTimes.length,
      status: avgTime < 300 && validTimes.length >= 3 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   📊 Results: Avg ${avgTime.toFixed(2)}ms | Min ${minTime.toFixed(2)}ms | Max ${maxTime.toFixed(2)}ms`);
    console.log(`   📈 Success Rate: ${(validTimes.length / testTimes.length * 100).toFixed(1)}%`);
    console.log(`   ${realtimeResults[test.name].status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  }

  results.results.realtimePerformance = realtimeResults;
}

// Test 5: Memory and Resource Usage
async function testMemoryUsage() {
  console.log('\n🧠 5. Memory and Resource Usage');
  console.log('================================');

  const memoryBefore = process.memoryUsage();
  
  console.log(`📊 Initial Memory Usage:`);
  console.log(`   RSS: ${(memoryBefore.rss / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Heap Used: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Heap Total: ${(memoryBefore.heapTotal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   External: ${(memoryBefore.external / 1024 / 1024).toFixed(2)}MB`);

  // Simulate heavy usage
  const heavyUsageEndpoints = [
    '/api/trending',
    '/api/shows',
    '/api/search/artists?q=taylor',
    '/api/artists/taylor-swift',
    '/api/stats',
    '/',
    '/search',
    '/shows',
    '/trending'
  ];

  console.log(`\n🔄 Simulating Heavy Usage (50 requests)...`);
  
  for (let i = 0; i < 50; i++) {
    const endpoint = heavyUsageEndpoints[i % heavyUsageEndpoints.length];
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      await response.text();
      
      if (i % 10 === 0) {
        const currentMemory = process.memoryUsage();
        console.log(`   Request ${i + 1}: Heap ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
    } catch (error) {
      // Continue testing despite errors
    }
  }

  const memoryAfter = process.memoryUsage();
  const memoryIncrease = {
    rss: (memoryAfter.rss - memoryBefore.rss) / 1024 / 1024,
    heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024,
    heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024,
    external: (memoryAfter.external - memoryBefore.external) / 1024 / 1024
  };

  console.log(`\n📊 Memory Usage After Heavy Load:`);
  console.log(`   RSS: ${(memoryAfter.rss / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.rss.toFixed(2)}MB)`);
  console.log(`   Heap Used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.heapUsed.toFixed(2)}MB)`);
  console.log(`   Heap Total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.heapTotal.toFixed(2)}MB)`);
  console.log(`   External: ${(memoryAfter.external / 1024 / 1024).toFixed(2)}MB (+${memoryIncrease.external.toFixed(2)}MB)`);

  const memoryStatus = memoryIncrease.heapUsed < 100 ? 'PASS' : 'FAIL';
  console.log(`   ${memoryStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'} (Target: < 100MB heap increase)`);

  results.results.memoryUsage = {
    before: memoryBefore,
    after: memoryAfter,
    increase: memoryIncrease,
    status: memoryStatus
  };
}

// Generate final report
function generateFinalReport() {
  console.log('\n📋 6. Final Performance Report');
  console.log('===============================');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Count results from all categories
  Object.entries(results.results).forEach(([category, categoryResults]) => {
    console.log(`\n📊 ${category} Results:`);
    
    Object.entries(categoryResults).forEach(([testName, testResult]) => {
      if (testResult.status) {
        totalTests++;
        if (testResult.status === 'PASS') {
          passedTests++;
          console.log(`   ✅ ${testName}: PASS`);
        } else {
          failedTests++;
          console.log(`   ❌ ${testName}: FAIL`);
        }
      }
    });
  });

  const passPercentage = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  const overallStatus = failedTests === 0 ? 'PASS' : 'FAIL';

  console.log(`\n📊 Overall Performance Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${passPercentage.toFixed(1)}%)`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Overall Status: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

  // Performance recommendations
  console.log(`\n💡 Performance Recommendations:`);
  
  if (failedTests > 0) {
    console.log(`   🚨 ${failedTests} tests failed - immediate optimization needed`);
  }
  
  if (passPercentage < 80) {
    console.log(`   ⚠️ Performance score below 80% - consider major optimizations`);
  } else if (passPercentage < 90) {
    console.log(`   ⚠️ Performance score below 90% - minor optimizations recommended`);
  } else {
    console.log(`   🎉 Excellent performance score - system is well optimized`);
  }

  results.summary = {
    totalTests,
    passedTests,
    failedTests,
    passPercentage,
    overallStatus,
    recommendations: failedTests > 0 ? ['Immediate optimization needed'] : passPercentage < 90 ? ['Minor optimizations recommended'] : ['System well optimized']
  };

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${RESULTS_FILE}`);

  return overallStatus === 'PASS';
}

// Main execution
async function main() {
  try {
    console.log('Starting real-world performance testing with actual data...\n');
    
    await testCoreWebVitals();
    await testAPIPerformanceUnderLoad();
    await testDatabasePerformance();
    await testRealTimePerformance();
    await testMemoryUsage();
    
    const passed = generateFinalReport();
    
    console.log('\n' + '='.repeat(70));
    console.log(`🏁 REAL-WORLD PERFORMANCE TEST: ${passed ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(70));
    
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Performance test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
main();