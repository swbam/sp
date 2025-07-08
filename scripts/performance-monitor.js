#!/usr/bin/env node

/**
 * Comprehensive Performance Monitoring Script
 * Monitors Core Web Vitals, API performance, and bundle sizes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      buildTime: 0,
      bundleSize: 0,
      coreWebVitals: {},
      apiPerformance: {},
      memoryUsage: process.memoryUsage(),
    };
    
    this.thresholds = {
      buildTime: 120000, // 2 minutes
      bundleSize: 5000000, // 5MB
      lcp: 2500, // ms
      fcp: 1800, // ms
      cls: 0.1,
      apiResponse: 1000, // ms
    };
  }

  // Monitor build performance
  async monitorBuild() {
    console.log('📊 Monitoring build performance...');
    
    const startTime = Date.now();
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      this.metrics.buildTime = Date.now() - startTime;
      
      console.log(`✅ Build completed in ${this.metrics.buildTime}ms`);
      
      if (this.metrics.buildTime > this.thresholds.buildTime) {
        console.log(`⚠️  Build time exceeds threshold: ${this.metrics.buildTime}ms > ${this.thresholds.buildTime}ms`);
      }
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      throw error;
    }
  }

  // Analyze bundle size
  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');
    
    const buildDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(buildDir)) {
      throw new Error('Build directory not found. Run build first.');
    }

    const staticDir = path.join(buildDir, 'static');
    let totalSize = 0;
    
    if (fs.existsSync(staticDir)) {
      const calculateSize = (dir) => {
        const files = fs.readdirSync(dir);
        let size = 0;
        
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            size += calculateSize(filePath);
          } else {
            size += stats.size;
          }
        });
        
        return size;
      };
      
      totalSize = calculateSize(staticDir);
    }
    
    this.metrics.bundleSize = totalSize;
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    console.log(`📊 Total bundle size: ${sizeMB}MB`);
    
    if (totalSize > this.thresholds.bundleSize) {
      console.log(`⚠️  Bundle size exceeds threshold: ${sizeMB}MB > ${(this.thresholds.bundleSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  // Monitor API performance
  async monitorAPIPerformance(baseUrl = 'http://localhost:3000') {
    console.log('🔧 Monitoring API performance...');
    
    const endpoints = [
      '/api/trending',
      '/api/shows',
      '/api/search/artists?q=test',
      '/api/featured',
      '/api/stats',
    ];

    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      const startTime = Date.now();
      
      try {
        const response = await fetch(url);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.metrics.apiPerformance[endpoint] = {
          duration,
          status: response.status,
          success: response.ok,
        };
        
        console.log(`${response.ok ? '✅' : '❌'} ${endpoint}: ${duration}ms (${response.status})`);
        
        if (duration > this.thresholds.apiResponse) {
          console.log(`⚠️  Slow API response: ${duration}ms > ${this.thresholds.apiResponse}ms`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
        this.metrics.apiPerformance[endpoint] = {
          duration: -1,
          status: 0,
          success: false,
          error: error.message,
        };
      }
    }
  }

  // Monitor memory usage
  monitorMemoryUsage() {
    console.log('🧠 Monitoring memory usage...');
    
    this.metrics.memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024);
    
    console.log(`📊 Memory usage: ${memoryMB}MB`);
    
    if (memoryMB > 512) {
      console.log(`⚠️  High memory usage: ${memoryMB}MB > 512MB`);
    }
  }

  // Check TypeScript compilation
  async checkTypeScript() {
    console.log('🔍 Checking TypeScript compilation...');
    
    try {
      execSync('npm run type-check', { stdio: 'inherit' });
      console.log('✅ TypeScript compilation successful');
    } catch (error) {
      console.error('❌ TypeScript compilation failed');
      throw error;
    }
  }

  // Check linting
  async checkLinting() {
    console.log('🔍 Checking linting...');
    
    try {
      execSync('npm run lint:check', { stdio: 'inherit' });
      console.log('✅ Linting successful');
    } catch (error) {
      console.error('❌ Linting failed');
      throw error;
    }
  }

  // Generate performance report
  generateReport() {
    console.log('\n📋 Performance Report');
    console.log('====================');
    
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      thresholds: this.thresholds,
      summary: {
        buildTime: {
          value: this.metrics.buildTime,
          status: this.metrics.buildTime <= this.thresholds.buildTime ? 'PASS' : 'FAIL',
        },
        bundleSize: {
          value: `${(this.metrics.bundleSize / 1024 / 1024).toFixed(2)}MB`,
          status: this.metrics.bundleSize <= this.thresholds.bundleSize ? 'PASS' : 'FAIL',
        },
        apiPerformance: {
          averageResponseTime: Object.values(this.metrics.apiPerformance)
            .filter(api => api.duration > 0)
            .reduce((sum, api) => sum + api.duration, 0) / 
            Object.values(this.metrics.apiPerformance).filter(api => api.duration > 0).length,
          failedRequests: Object.values(this.metrics.apiPerformance)
            .filter(api => !api.success).length,
        },
        memoryUsage: {
          value: `${Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
          status: this.metrics.memoryUsage.heapUsed / 1024 / 1024 <= 512 ? 'PASS' : 'FAIL',
        },
      },
    };

    // Save report
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `performance-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Report saved to: ${reportPath}`);
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`Build Time: ${report.summary.buildTime.status} (${this.metrics.buildTime}ms)`);
    console.log(`Bundle Size: ${report.summary.bundleSize.status} (${report.summary.bundleSize.value})`);
    console.log(`Memory Usage: ${report.summary.memoryUsage.status} (${report.summary.memoryUsage.value})`);
    console.log(`API Performance: ${report.summary.apiPerformance.averageResponseTime.toFixed(2)}ms avg`);
    console.log(`Failed API Requests: ${report.summary.apiPerformance.failedRequests}`);
    
    return report;
  }

  // Run complete performance audit
  async runCompleteAudit() {
    console.log('🚀 Starting comprehensive performance audit...\n');
    
    try {
      // Check code quality first
      await this.checkTypeScript();
      await this.checkLinting();
      
      // Monitor build performance
      await this.monitorBuild();
      
      // Analyze bundle size
      await this.analyzeBundleSize();
      
      // Monitor memory usage
      this.monitorMemoryUsage();
      
      // Monitor API performance (if server is running)
      try {
        await this.monitorAPIPerformance();
      } catch (error) {
        console.log('⚠️  API monitoring skipped (server not running)');
      }
      
      // Generate report
      const report = this.generateReport();
      
      // Determine overall status
      const overallPass = 
        report.summary.buildTime.status === 'PASS' &&
        report.summary.bundleSize.status === 'PASS' &&
        report.summary.memoryUsage.status === 'PASS' &&
        report.summary.apiPerformance.failedRequests === 0;
      
      console.log(`\n${overallPass ? '🎉' : '⚠️'} Overall Status: ${overallPass ? 'PASS' : 'FAIL'}`);
      
      return overallPass;
      
    } catch (error) {
      console.error('❌ Performance audit failed:', error.message);
      return false;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'audit';
  
  const monitor = new PerformanceMonitor();
  
  switch (command) {
    case 'build':
      await monitor.monitorBuild();
      break;
    case 'bundle':
      await monitor.analyzeBundleSize();
      break;
    case 'api':
      await monitor.monitorAPIPerformance(args[1]);
      break;
    case 'memory':
      monitor.monitorMemoryUsage();
      break;
    case 'audit':
    default:
      const success = await monitor.runCompleteAudit();
      process.exit(success ? 0 : 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceMonitor;