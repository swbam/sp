#!/usr/bin/env node

/**
 * Performance Testing Script for MySetlist
 * Tests Core Web Vitals and key metrics
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runPerformanceTest(url = 'http://localhost:3000') {
  console.log(`🚀 Starting performance test for: ${url}`);
  
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };

  try {
    const runnerResult = await lighthouse(url, options);
    const reportJson = runnerResult.report;
    const report = JSON.parse(reportJson);

    // Extract key metrics
    const metrics = {
      performance: report.categories.performance.score * 100,
      fcp: report.audits['first-contentful-paint'].displayValue,
      lcp: report.audits['largest-contentful-paint'].displayValue,
      tti: report.audits['interactive'].displayValue,
      cls: report.audits['cumulative-layout-shift'].displayValue,
      tbt: report.audits['total-blocking-time'].displayValue,
      speedIndex: report.audits['speed-index'].displayValue,
    };

    console.log('\n📊 Performance Results:');
    console.log('========================');
    console.log(`Performance Score: ${metrics.performance.toFixed(1)}/100`);
    console.log(`First Contentful Paint: ${metrics.fcp}`);
    console.log(`Largest Contentful Paint: ${metrics.lcp}`);
    console.log(`Time to Interactive: ${metrics.tti}`);
    console.log(`Cumulative Layout Shift: ${metrics.cls}`);
    console.log(`Total Blocking Time: ${metrics.tbt}`);
    console.log(`Speed Index: ${metrics.speedIndex}`);

    // Performance thresholds
    const thresholds = {
      performance: 90,
      lcp: 2500, // ms
      fcp: 1800, // ms
      cls: 0.1,
    };

    // Check if metrics meet thresholds
    const lcpMs = parseFloat(metrics.lcp.replace(/[^\d.]/g, '')) * 1000;
    const fcpMs = parseFloat(metrics.fcp.replace(/[^\d.]/g, '')) * 1000;
    const clsValue = parseFloat(metrics.cls.replace(/[^\d.]/g, ''));

    console.log('\n✅ Threshold Analysis:');
    console.log('=======================');
    
    const passed = [];
    const failed = [];

    if (metrics.performance >= thresholds.performance) {
      passed.push(`Performance Score: ${metrics.performance.toFixed(1)} >= ${thresholds.performance}`);
    } else {
      failed.push(`Performance Score: ${metrics.performance.toFixed(1)} < ${thresholds.performance}`);
    }

    if (lcpMs <= thresholds.lcp) {
      passed.push(`LCP: ${lcpMs}ms <= ${thresholds.lcp}ms`);
    } else {
      failed.push(`LCP: ${lcpMs}ms > ${thresholds.lcp}ms`);
    }

    if (fcpMs <= thresholds.fcp) {
      passed.push(`FCP: ${fcpMs}ms <= ${thresholds.fcp}ms`);
    } else {
      failed.push(`FCP: ${fcpMs}ms > ${thresholds.fcp}ms`);
    }

    if (clsValue <= thresholds.cls) {
      passed.push(`CLS: ${clsValue} <= ${thresholds.cls}`);
    } else {
      failed.push(`CLS: ${clsValue} > ${thresholds.cls}`);
    }

    // Display results
    if (passed.length > 0) {
      console.log('\n✅ Passed Checks:');
      passed.forEach(check => console.log(`  ✓ ${check}`));
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Checks:');
      failed.forEach(check => console.log(`  ✗ ${check}`));
    }

    // Overall result
    const overallPass = failed.length === 0;
    console.log(`\n${overallPass ? '🎉' : '⚠️'} Overall Result: ${overallPass ? 'PASS' : 'FAIL'}`);

    // Save detailed report
    const fs = require('fs');
    const path = require('path');
    const reportsDir = path.join(process.cwd(), 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `lighthouse-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return overallPass;

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return false;
  } finally {
    await chrome.kill();
  }
}

// API Performance Test
async function testAPIPerformance(baseUrl = 'http://localhost:3000') {
  console.log('\n🔧 Testing API Performance:');
  console.log('============================');

  const endpoints = [
    '/api/trending',
    '/api/shows',
    '/api/search/artists?q=test',
  ];

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    const start = performance.now();
    
    try {
      const response = await fetch(url);
      const end = performance.now();
      const duration = end - start;
      
      const status = response.ok ? '✅' : '❌';
      console.log(`${status} ${endpoint}: ${duration.toFixed(2)}ms (${response.status})`);
      
      if (duration > 1000) {
        console.log(`  ⚠️  Slow response time: ${duration.toFixed(2)}ms > 1000ms`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
    }
  }
}

// Bundle Size Analysis
async function analyzeBundleSize() {
  console.log('\n📦 Bundle Size Analysis:');
  console.log('========================');

  const path = require('path');
  const fs = require('fs');
  
  const buildDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(buildDir)) {
    console.log('❌ Build directory not found. Run "npm run build" first.');
    return;
  }

  // Analyze built files
  const staticDir = path.join(buildDir, 'static');
  if (fs.existsSync(staticDir)) {
    const chunks = path.join(staticDir, 'chunks');
    if (fs.existsSync(chunks)) {
      const files = fs.readdirSync(chunks);
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(chunks, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        totalSize += stats.size;
        
        if (stats.size > 250000) { // 250KB threshold
          console.log(`⚠️  Large chunk: ${file} (${sizeKB}KB)`);
        } else {
          console.log(`✅ ${file}: ${sizeKB}KB`);
        }
      });

      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`\n📊 Total bundle size: ${totalSizeMB}MB`);
      
      if (totalSize > 5000000) { // 5MB threshold
        console.log('⚠️  Bundle size is large. Consider code splitting.');
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const url = args[0] || 'http://localhost:3000';
  
  console.log('🎯 MySetlist Performance Test Suite');
  console.log('=====================================\n');

  try {
    // Run Lighthouse performance test
    const lighthousePass = await runPerformanceTest(url);
    
    // Test API performance
    await testAPIPerformance(url);
    
    // Analyze bundle size
    await analyzeBundleSize();
    
    console.log('\n' + '='.repeat(50));
    console.log(`🏁 Performance test completed: ${lighthousePass ? 'PASS' : 'FAIL'}`);
    
    process.exit(lighthousePass ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runPerformanceTest,
  testAPIPerformance,
  analyzeBundleSize,
};