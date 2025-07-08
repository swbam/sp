#!/usr/bin/env node

/**
 * Enhanced Performance Monitoring Script for MySetlist
 * Comprehensive performance testing with real API validation
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnhancedPerformanceMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      metrics: {},
      thresholds: {
        apiResponse: 500, // ms
        buildTime: 120000, // ms
        bundleSize: 5000000, // bytes
        lcp: 2500, // ms
        fcp: 1800, // ms
        cls: 0.1,
        memoryUsage: 100 * 1024 * 1024, // 100MB
      },
      tests: [],
      recommendations: []
    };
    
    this.performanceData = {
      apiEndpoints: [],
      webVitals: {},
      buildMetrics: {},
      bundleAnalysis: {},
      memoryProfile: {}
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const colorMap = {
      INFO: '\x1b[36m',
      SUCCESS: '\x1b[32m',
      WARNING: '\x1b[33m',
      ERROR: '\x1b[31m',
      RESET: '\x1b[0m'
    };
    
    console.log(`${colorMap[level]}[${timestamp}] ${message}${colorMap.RESET}`);
  }

  async testAPIEndpoint(endpoint, expectedStatus = 200) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}${endpoint}`;
    
    this.log(`Testing API endpoint: ${endpoint}`);
    
    const startTime = performance.now();
    let testResult = {
      endpoint,
      url,
      success: false,
      responseTime: -1,
      status: 0,
      error: null,
      size: 0
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MySetlist-Performance-Monitor/1.0'
        }
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      testResult = {
        ...testResult,
        success: response.ok,
        responseTime: Math.round(responseTime),
        status: response.status,
        size: parseInt(response.headers.get('content-length') || '0')
      };

      if (response.ok) {
        const data = await response.json();
        testResult.size = JSON.stringify(data).length;
        this.log(`✅ ${endpoint}: ${responseTime.toFixed(2)}ms (${response.status})`, 'SUCCESS');
      } else {
        testResult.error = `HTTP ${response.status}: ${response.statusText}`;
        this.log(`❌ ${endpoint}: ${response.status} ${response.statusText}`, 'ERROR');
      }

    } catch (error) {
      const endTime = performance.now();
      testResult.responseTime = endTime - startTime;
      testResult.error = error.message;
      this.log(`❌ ${endpoint}: ${error.message}`, 'ERROR');
    }

    // Performance analysis
    if (testResult.responseTime > this.results.thresholds.apiResponse) {
      this.results.recommendations.push({
        type: 'API_PERFORMANCE',
        severity: 'HIGH',
        endpoint,
        message: `API response time ${testResult.responseTime}ms exceeds threshold ${this.results.thresholds.apiResponse}ms`,
        suggestions: [
          'Implement request caching',
          'Optimize database queries',
          'Add CDN caching headers',
          'Consider response compression'
        ]
      });
    }

    this.performanceData.apiEndpoints.push(testResult);
    return testResult;
  }

  async testCriticalAPIEndpoints() {
    this.log('🔧 Testing Critical API Endpoints', 'INFO');
    
    const endpoints = [
      '/api/trending',
      '/api/shows',
      '/api/search/artists?q=test',
      '/api/featured',
      '/api/stats'
    ];

    const apiResults = [];
    
    for (const endpoint of endpoints) {
      const result = await this.testAPIEndpoint(endpoint);
      apiResults.push(result);
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate API performance metrics
    const successfulRequests = apiResults.filter(r => r.success);
    const avgResponseTime = successfulRequests.length > 0 
      ? successfulRequests.reduce((acc, r) => acc + r.responseTime, 0) / successfulRequests.length
      : -1;

    this.results.metrics.apiPerformance = {
      totalRequests: apiResults.length,
      successfulRequests: successfulRequests.length,
      failedRequests: apiResults.length - successfulRequests.length,
      averageResponseTime: avgResponseTime,
      results: apiResults
    };

    this.log(`📊 API Performance: ${successfulRequests.length}/${apiResults.length} successful, avg: ${avgResponseTime.toFixed(2)}ms`);
    
    return apiResults;
  }

  async analyzeBundleSize() {
    this.log('📦 Analyzing Bundle Size', 'INFO');
    
    const buildDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(buildDir)) {
      this.log('❌ Build directory not found. Running build...', 'WARNING');
      try {
        execSync('npm run build', { stdio: 'inherit' });
      } catch (error) {
        this.log(`❌ Build failed: ${error.message}`, 'ERROR');
        return null;
      }
    }

    const staticDir = path.join(buildDir, 'static');
    if (!fs.existsSync(staticDir)) {
      this.log('❌ Static directory not found', 'ERROR');
      return null;
    }

    let totalSize = 0;
    const largeFiles = [];
    const bundleAnalysis = {
      totalSize: 0,
      fileCount: 0,
      largeFiles: [],
      chunks: []
    };

    const analyzeDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          analyzeDirectory(filePath);
        } else {
          totalSize += stats.size;
          bundleAnalysis.fileCount++;
          
          const relativePath = path.relative(staticDir, filePath);
          
          // Track large files (>250KB)
          if (stats.size > 250000) {
            const largeFile = {
              file: relativePath,
              size: stats.size,
              sizeKB: (stats.size / 1024).toFixed(2)
            };
            largeFiles.push(largeFile);
            bundleAnalysis.largeFiles.push(largeFile);
          }
          
          // Track chunks
          if (file.endsWith('.js') || file.endsWith('.css')) {
            bundleAnalysis.chunks.push({
              file: relativePath,
              size: stats.size,
              type: file.endsWith('.js') ? 'javascript' : 'css'
            });
          }
        }
      });
    };

    analyzeDirectory(staticDir);
    
    bundleAnalysis.totalSize = totalSize;
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    this.results.metrics.bundleSize = totalSize;
    this.results.metrics.bundleSizeMB = totalSizeMB;
    this.performanceData.bundleAnalysis = bundleAnalysis;
    
    this.log(`📊 Bundle Analysis: ${totalSizeMB}MB total, ${bundleAnalysis.fileCount} files`);
    
    if (largeFiles.length > 0) {
      this.log(`⚠️  Found ${largeFiles.length} large files:`, 'WARNING');
      largeFiles.forEach(file => {
        this.log(`    ${file.file}: ${file.sizeKB}KB`, 'WARNING');
      });
    }

    // Bundle size recommendations
    if (totalSize > this.results.thresholds.bundleSize) {
      this.results.recommendations.push({
        type: 'BUNDLE_SIZE',
        severity: 'MEDIUM',
        message: `Bundle size ${totalSizeMB}MB exceeds recommended threshold`,
        suggestions: [
          'Implement code splitting',
          'Use dynamic imports for heavy components',
          'Enable tree shaking',
          'Optimize image assets',
          'Remove unused dependencies'
        ]
      });
    }

    return bundleAnalysis;
  }

  async measureBuildTime() {
    this.log('⏱️  Measuring Build Time', 'INFO');
    
    const startTime = performance.now();
    
    try {
      // Clean build to get accurate timing
      if (fs.existsSync('.next')) {
        fs.rmSync('.next', { recursive: true, force: true });
      }
      
      execSync('npm run build', { stdio: 'inherit' });
      
      const endTime = performance.now();
      const buildTime = endTime - startTime;
      
      this.results.metrics.buildTime = buildTime;
      this.performanceData.buildMetrics = {
        buildTime,
        buildTimeSeconds: (buildTime / 1000).toFixed(2)
      };
      
      this.log(`✅ Build completed in ${(buildTime / 1000).toFixed(2)}s`, 'SUCCESS');
      
      if (buildTime > this.results.thresholds.buildTime) {
        this.results.recommendations.push({
          type: 'BUILD_TIME',
          severity: 'LOW',
          message: `Build time ${(buildTime / 1000).toFixed(2)}s exceeds threshold`,
          suggestions: [
            'Enable SWC compiler',
            'Optimize webpack configuration',
            'Use incremental builds',
            'Reduce dependency count'
          ]
        });
      }
      
      return buildTime;
      
    } catch (error) {
      this.log(`❌ Build failed: ${error.message}`, 'ERROR');
      return -1;
    }
  }

  async profileMemoryUsage() {
    this.log('🧠 Profiling Memory Usage', 'INFO');
    
    const memoryUsage = process.memoryUsage();
    const memoryProfile = {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
    };
    
    this.results.metrics.memoryUsage = memoryProfile;
    this.performanceData.memoryProfile = memoryProfile;
    
    this.log(`📊 Memory Usage: ${memoryProfile.heapUsedMB}MB heap used`);
    
    if (memoryUsage.heapUsed > this.results.thresholds.memoryUsage) {
      this.results.recommendations.push({
        type: 'MEMORY_USAGE',
        severity: 'MEDIUM',
        message: `Memory usage ${memoryProfile.heapUsedMB}MB exceeds threshold`,
        suggestions: [
          'Optimize data structures',
          'Implement memory caching limits',
          'Review memory leaks',
          'Use object pooling'
        ]
      });
    }
    
    return memoryProfile;
  }

  async testDatabasePerformance() {
    this.log('🗄️  Testing Database Performance', 'INFO');
    
    const dbTests = [
      { name: 'Artist Search', endpoint: '/api/search/artists?q=test' },
      { name: 'Show Listing', endpoint: '/api/shows?limit=10' },
      { name: 'Trending Data', endpoint: '/api/trending?type=shows&limit=5' }
    ];

    const dbResults = [];
    
    for (const test of dbTests) {
      const result = await this.testAPIEndpoint(test.endpoint);
      dbResults.push({
        ...result,
        testName: test.name
      });
    }

    // Analyze database performance
    const dbPerformance = {
      tests: dbResults,
      averageQueryTime: dbResults.reduce((acc, r) => acc + r.responseTime, 0) / dbResults.length,
      slowQueries: dbResults.filter(r => r.responseTime > 100)
    };

    this.performanceData.databasePerformance = dbPerformance;
    
    this.log(`📊 Database Performance: ${dbPerformance.averageQueryTime.toFixed(2)}ms average`);
    
    if (dbPerformance.slowQueries.length > 0) {
      this.results.recommendations.push({
        type: 'DATABASE_PERFORMANCE',
        severity: 'HIGH',
        message: `${dbPerformance.slowQueries.length} slow database queries detected`,
        suggestions: [
          'Add database indexes',
          'Optimize query structure',
          'Implement query caching',
          'Consider read replicas'
        ]
      });
    }

    return dbPerformance;
  }

  generatePerformanceReport() {
    this.log('📋 Generating Performance Report', 'INFO');
    
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `enhanced-performance-${timestamp}.json`);
    
    const report = {
      ...this.results,
      performanceData: this.performanceData,
      summary: this.generateSummary()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📄 Performance report saved: ${reportPath}`, 'SUCCESS');
    
    return report;
  }

  generateSummary() {
    const summary = {
      overallScore: 0,
      categories: {},
      criticalIssues: 0,
      recommendations: this.results.recommendations.length
    };

    // API Performance Score
    const apiMetrics = this.results.metrics.apiPerformance;
    if (apiMetrics) {
      const apiScore = apiMetrics.successfulRequests / apiMetrics.totalRequests * 100;
      summary.categories.apiPerformance = {
        score: apiScore,
        status: apiScore >= 90 ? 'EXCELLENT' : apiScore >= 70 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      };
    }

    // Bundle Size Score
    const bundleSize = this.results.metrics.bundleSize;
    if (bundleSize) {
      const bundleScore = bundleSize <= this.results.thresholds.bundleSize ? 100 : 
                         bundleSize <= this.results.thresholds.bundleSize * 1.5 ? 80 : 60;
      summary.categories.bundleSize = {
        score: bundleScore,
        status: bundleScore >= 90 ? 'EXCELLENT' : bundleScore >= 70 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      };
    }

    // Build Time Score
    const buildTime = this.results.metrics.buildTime;
    if (buildTime && buildTime > 0) {
      const buildScore = buildTime <= this.results.thresholds.buildTime ? 100 : 
                        buildTime <= this.results.thresholds.buildTime * 1.5 ? 80 : 60;
      summary.categories.buildTime = {
        score: buildScore,
        status: buildScore >= 90 ? 'EXCELLENT' : buildScore >= 70 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      };
    }

    // Critical issues count
    summary.criticalIssues = this.results.recommendations.filter(r => r.severity === 'HIGH').length;

    // Overall score calculation
    const scores = Object.values(summary.categories).map(cat => cat.score);
    summary.overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return summary;
  }

  displayResults() {
    this.log('📊 Performance Test Results', 'INFO');
    console.log('='.repeat(60));
    
    // API Performance
    const apiMetrics = this.results.metrics.apiPerformance;
    if (apiMetrics) {
      console.log(`\n🔧 API Performance:`);
      console.log(`   Successful Requests: ${apiMetrics.successfulRequests}/${apiMetrics.totalRequests}`);
      console.log(`   Average Response Time: ${apiMetrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`   Failed Requests: ${apiMetrics.failedRequests}`);
    }

    // Bundle Size
    if (this.results.metrics.bundleSize) {
      console.log(`\n📦 Bundle Size:`);
      console.log(`   Total Size: ${this.results.metrics.bundleSizeMB}MB`);
      console.log(`   Status: ${this.results.metrics.bundleSize <= this.results.thresholds.bundleSize ? '✅ GOOD' : '⚠️ LARGE'}`);
    }

    // Build Time
    if (this.results.metrics.buildTime) {
      console.log(`\n⏱️  Build Time:`);
      console.log(`   Duration: ${(this.results.metrics.buildTime / 1000).toFixed(2)}s`);
      console.log(`   Status: ${this.results.metrics.buildTime <= this.results.thresholds.buildTime ? '✅ GOOD' : '⚠️ SLOW'}`);
    }

    // Memory Usage
    if (this.results.metrics.memoryUsage) {
      console.log(`\n🧠 Memory Usage:`);
      console.log(`   Heap Used: ${this.results.metrics.memoryUsage.heapUsedMB}MB`);
      console.log(`   Status: ${this.results.metrics.memoryUsage.heapUsed <= this.results.thresholds.memoryUsage ? '✅ GOOD' : '⚠️ HIGH'}`);
    }

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      this.results.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.severity}] ${rec.message}`);
        if (rec.suggestions) {
          rec.suggestions.forEach(suggestion => {
            console.log(`      - ${suggestion}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    
    const summary = this.generateSummary();
    console.log(`\n🎯 Overall Performance Score: ${summary.overallScore.toFixed(1)}/100`);
    console.log(`📊 Critical Issues: ${summary.criticalIssues}`);
    console.log(`💡 Total Recommendations: ${summary.recommendations}`);
    
    return summary.overallScore >= 80;
  }

  async runComprehensiveTest() {
    this.log('🚀 Starting Comprehensive Performance Test', 'INFO');
    
    try {
      // Memory profiling
      await this.profileMemoryUsage();
      
      // API endpoint testing
      await this.testCriticalAPIEndpoints();
      
      // Database performance testing
      await this.testDatabasePerformance();
      
      // Build time measurement
      await this.measureBuildTime();
      
      // Bundle size analysis
      await this.analyzeBundleSize();
      
      // Generate comprehensive report
      const report = this.generatePerformanceReport();
      
      // Display results
      const passed = this.displayResults();
      
      this.log(`🏁 Performance test completed: ${passed ? 'PASSED' : 'ISSUES FOUND'}`, 
                passed ? 'SUCCESS' : 'WARNING');
      
      return { passed, report };
      
    } catch (error) {
      this.log(`❌ Performance test failed: ${error.message}`, 'ERROR');
      return { passed: false, error: error.message };
    }
  }
}

// CLI execution
async function main() {
  const monitor = new EnhancedPerformanceMonitor();
  const result = await monitor.runComprehensiveTest();
  
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = EnhancedPerformanceMonitor;