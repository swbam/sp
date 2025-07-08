#!/usr/bin/env node

/**
 * Comprehensive Performance Optimization Validation Script
 * Validates all performance optimizations are working correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceOptimizationValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      validations: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        overallStatus: 'UNKNOWN'
      }
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

  async validateCheck(name, testFunction) {
    this.log(`Validating: ${name}`, 'INFO');
    this.results.summary.totalChecks++;
    
    try {
      const result = await testFunction();
      const validation = {
        name,
        status: result.success ? 'PASSED' : 'FAILED',
        details: result.details || '',
        metrics: result.metrics || {},
        timestamp: new Date().toISOString()
      };
      
      this.results.validations.push(validation);
      
      if (result.success) {
        this.results.summary.passedChecks++;
        this.log(`✅ ${name}: PASSED`, 'SUCCESS');
      } else {
        this.results.summary.failedChecks++;
        this.log(`❌ ${name}: FAILED - ${result.details}`, 'ERROR');
      }
      
      return result.success;
    } catch (error) {
      this.results.summary.failedChecks++;
      this.log(`❌ ${name}: ERROR - ${error.message}`, 'ERROR');
      
      this.results.validations.push({
        name,
        status: 'ERROR',
        details: error.message,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }

  async validateBundleOptimization() {
    return this.validateCheck('Bundle Size Optimization', async () => {
      const buildDir = path.join(process.cwd(), '.next');
      
      if (!fs.existsSync(buildDir)) {
        this.log('Building application for bundle analysis...', 'INFO');
        execSync('npm run build', { stdio: 'inherit' });
      }
      
      const staticDir = path.join(buildDir, 'static');
      if (!fs.existsSync(staticDir)) {
        return {
          success: false,
          details: 'Static build directory not found'
        };
      }
      
      let totalSize = 0;
      const largeChunks = [];
      
      const analyzeDirectory = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            analyzeDirectory(filePath);
          } else {
            totalSize += stats.size;
            
            if (stats.size > 1000000) { // 1MB chunks
              largeChunks.push({
                file: path.relative(staticDir, filePath),
                size: (stats.size / 1024 / 1024).toFixed(2) + 'MB'
              });
            }
          }
        });
      };
      
      analyzeDirectory(staticDir);
      
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      const success = totalSize < 5000000; // 5MB threshold
      
      return {
        success,
        details: success 
          ? `Bundle size ${totalSizeMB}MB is within limits`
          : `Bundle size ${totalSizeMB}MB exceeds 5MB threshold`,
        metrics: {
          totalSizeMB: parseFloat(totalSizeMB),
          largeChunks: largeChunks.length,
          threshold: 5
        }
      };
    });
  }

  async validateImageOptimization() {
    return this.validateCheck('Image Optimization Configuration', async () => {
      const nextConfigPath = path.join(process.cwd(), 'next.config.js');
      
      if (!fs.existsSync(nextConfigPath)) {
        return {
          success: false,
          details: 'next.config.js not found'
        };
      }
      
      const config = fs.readFileSync(nextConfigPath, 'utf8');
      
      const checks = [
        { name: 'WebP/AVIF formats', test: /formats:\s*\[.*webp.*avif.*\]/ },
        { name: 'Device sizes', test: /deviceSizes:\s*\[.*\]/ },
        { name: 'Image sizes', test: /imageSizes:\s*\[.*\]/ },
        { name: 'Cache TTL', test: /minimumCacheTTL:\s*\d+/ }
      ];
      
      const results = checks.map(check => ({
        name: check.name,
        passed: check.test.test(config)
      }));
      
      const passedCount = results.filter(r => r.passed).length;
      const success = passedCount === checks.length;
      
      return {
        success,
        details: success 
          ? 'All image optimizations configured'
          : `${passedCount}/${checks.length} image optimizations configured`,
        metrics: {
          configuredOptimizations: passedCount,
          totalOptimizations: checks.length,
          results
        }
      };
    });
  }

  async validatePerformanceMonitoring() {
    return this.validateCheck('Performance Monitoring Setup', async () => {
      const monitoringFiles = [
        'libs/performance.ts',
        'components/WebVitalsMonitor.tsx',
        'components/ProductionPerformanceMonitor.tsx',
        'app/api/analytics/web-vitals/route.ts'
      ];
      
      const missingFiles = monitoringFiles.filter(file => {
        const filePath = path.join(process.cwd(), file);
        return !fs.existsSync(filePath);
      });
      
      if (missingFiles.length > 0) {
        return {
          success: false,
          details: `Missing monitoring files: ${missingFiles.join(', ')}`
        };
      }
      
      // Check if monitoring is integrated in layout
      const layoutPath = path.join(process.cwd(), 'app/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      
      const hasWebVitals = layoutContent.includes('WebVitalsMonitor');
      const hasProductionMonitor = layoutContent.includes('ProductionPerformanceMonitor');
      
      const success = hasWebVitals && hasProductionMonitor;
      
      return {
        success,
        details: success 
          ? 'Performance monitoring fully integrated'
          : `Missing integration: ${!hasWebVitals ? 'WebVitals ' : ''}${!hasProductionMonitor ? 'ProductionMonitor' : ''}`,
        metrics: {
          monitoringFiles: monitoringFiles.length,
          integratedComponents: (hasWebVitals ? 1 : 0) + (hasProductionMonitor ? 1 : 0)
        }
      };
    });
  }

  async validateCachingStrategy() {
    return this.validateCheck('Caching Strategy Implementation', async () => {
      const nextConfigPath = path.join(process.cwd(), 'next.config.js');
      
      if (!fs.existsSync(nextConfigPath)) {
        return {
          success: false,
          details: 'next.config.js not found'
        };
      }
      
      const config = fs.readFileSync(nextConfigPath, 'utf8');
      
      const cacheChecks = [
        { name: 'API Cache Headers', test: /\/api\/.*Cache-Control/ },
        { name: 'Static Assets Cache', test: /_next\/static.*max-age=31536000/ },
        { name: 'Compression Enabled', test: /compress:\s*true/ },
        { name: 'ETags Disabled', test: /generateEtags:\s*false/ }
      ];
      
      const results = cacheChecks.map(check => ({
        name: check.name,
        configured: check.test.test(config)
      }));
      
      const configuredCount = results.filter(r => r.configured).length;
      const success = configuredCount >= 3; // At least 3 out of 4
      
      // Check performance library for caching utilities
      const perfLibPath = path.join(process.cwd(), 'libs/performance.ts');
      const hasCacheUtils = fs.existsSync(perfLibPath) && 
        fs.readFileSync(perfLibPath, 'utf8').includes('DatabaseOptimizer');
      
      return {
        success: success && hasCacheUtils,
        details: success && hasCacheUtils
          ? 'Caching strategy fully implemented'
          : `Caching configuration: ${configuredCount}/4, Cache utilities: ${hasCacheUtils}`,
        metrics: {
          configuredCacheHeaders: configuredCount,
          totalCacheOptions: cacheChecks.length,
          cacheUtilsAvailable: hasCacheUtils
        }
      };
    });
  }

  async validateDatabaseOptimization() {
    return this.validateCheck('Database Optimization Scripts', async () => {
      const dbOptimizationFiles = [
        'scripts/database-optimization.js',
        'actions/getArtists.ts',
        'actions/getShows.ts'
      ];
      
      const missingFiles = dbOptimizationFiles.filter(file => {
        const filePath = path.join(process.cwd(), file);
        return !fs.existsSync(filePath);
      });
      
      if (missingFiles.length > 0) {
        return {
          success: false,
          details: `Missing database optimization files: ${missingFiles.join(', ')}`
        };
      }
      
      // Check if database optimization script exists and is executable
      const dbScriptPath = path.join(process.cwd(), 'scripts/database-optimization.js');
      const dbScript = fs.readFileSync(dbScriptPath, 'utf8');
      
      const hasIndexCreation = dbScript.includes('createOptimizedIndexes');
      const hasQueryOptimization = dbScript.includes('createOptimizedFunctions');
      const hasPerformanceTest = dbScript.includes('testQueryPerformance');
      
      const optimizations = [hasIndexCreation, hasQueryOptimization, hasPerformanceTest];
      const optimizationCount = optimizations.filter(Boolean).length;
      
      return {
        success: optimizationCount === 3,
        details: `Database optimization features: ${optimizationCount}/3 implemented`,
        metrics: {
          hasIndexCreation,
          hasQueryOptimization,
          hasPerformanceTest,
          optimizationScore: optimizationCount
        }
      };
    });
  }

  async validateProductionReadiness() {
    return this.validateCheck('Production Readiness', async () => {
      const checks = [
        {
          name: 'Environment Variables',
          test: () => {
            const requiredEnvVars = [
              'NEXT_PUBLIC_SUPABASE_URL',
              'NEXT_PUBLIC_SUPABASE_ANON_KEY',
              'SUPABASE_SERVICE_ROLE_KEY'
            ];
            
            return requiredEnvVars.every(envVar => process.env[envVar]);
          }
        },
        {
          name: 'Performance Scripts',
          test: () => {
            const scripts = [
              'scripts/performance-test.js',
              'scripts/enhanced-performance-monitor.js',
              'scripts/optimize-production.js'
            ];
            
            return scripts.every(script => {
              const scriptPath = path.join(process.cwd(), script);
              return fs.existsSync(scriptPath);
            });
          }
        },
        {
          name: 'TypeScript Configuration',
          test: () => {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            if (!fs.existsSync(tsconfigPath)) return false;
            
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            return tsconfig.compilerOptions && tsconfig.compilerOptions.strict;
          }
        },
        {
          name: 'Build Configuration',
          test: () => {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packageJsonPath)) return false;
            
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.scripts && 
                   packageJson.scripts['build:production'] &&
                   packageJson.scripts['optimize:production'];
          }
        }
      ];
      
      const results = checks.map(check => ({
        name: check.name,
        passed: check.test()
      }));
      
      const passedCount = results.filter(r => r.passed).length;
      const success = passedCount === checks.length;
      
      return {
        success,
        details: success 
          ? 'All production readiness checks passed'
          : `${passedCount}/${checks.length} production readiness checks passed`,
        metrics: {
          passedChecks: passedCount,
          totalChecks: checks.length,
          results
        }
      };
    });
  }

  async validatePerformanceTargets() {
    return this.validateCheck('Performance Targets Configuration', async () => {
      const perfLibPath = path.join(process.cwd(), 'libs/performance.ts');
      
      if (!fs.existsSync(perfLibPath)) {
        return {
          success: false,
          details: 'Performance library not found'
        };
      }
      
      const perfLib = fs.readFileSync(perfLibPath, 'utf8');
      
      const targetChecks = [
        { name: 'API Response Optimization', test: /APIOptimizer/ },
        { name: 'Database Caching', test: /DatabaseOptimizer/ },
        { name: 'Image Optimization', test: /ImageOptimizer/ },
        { name: 'Bundle Optimization', test: /BundleOptimizer/ },
        { name: 'Performance Monitoring', test: /PerformanceMonitor/ },
        { name: 'Web Vitals Monitoring', test: /WebVitalsMonitor/ }
      ];
      
      const results = targetChecks.map(check => ({
        name: check.name,
        implemented: check.test.test(perfLib)
      }));
      
      const implementedCount = results.filter(r => r.implemented).length;
      const success = implementedCount >= 5; // At least 5 out of 6
      
      return {
        success,
        details: success 
          ? 'Performance targets fully configured'
          : `${implementedCount}/${targetChecks.length} performance targets configured`,
        metrics: {
          implementedTargets: implementedCount,
          totalTargets: targetChecks.length,
          results
        }
      };
    });
  }

  generateValidationReport() {
    this.log('📋 Generating Validation Report', 'INFO');
    
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `performance-optimization-validation-${timestamp}.json`);
    
    // Calculate overall status
    const successRate = (this.results.summary.passedChecks / this.results.summary.totalChecks) * 100;
    
    if (successRate >= 90) {
      this.results.summary.overallStatus = 'EXCELLENT';
    } else if (successRate >= 80) {
      this.results.summary.overallStatus = 'GOOD';
    } else if (successRate >= 70) {
      this.results.summary.overallStatus = 'ACCEPTABLE';
    } else {
      this.results.summary.overallStatus = 'NEEDS_IMPROVEMENT';
    }
    
    this.results.summary.successRate = successRate;
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    this.log(`📄 Validation report saved: ${reportPath}`, 'SUCCESS');
    
    return this.results;
  }

  displayResults() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 Performance Optimization Validation Results');
    console.log('='.repeat(70));
    
    console.log(`\n📊 Overall Summary:`);
    console.log(`   Total Checks: ${this.results.summary.totalChecks}`);
    console.log(`   Passed: ${this.results.summary.passedChecks}`);
    console.log(`   Failed: ${this.results.summary.failedChecks}`);
    console.log(`   Success Rate: ${this.results.summary.successRate?.toFixed(1)}%`);
    console.log(`   Overall Status: ${this.results.summary.overallStatus}`);
    
    console.log(`\n📋 Detailed Results:`);
    this.results.validations.forEach((validation, index) => {
      const statusIcon = validation.status === 'PASSED' ? '✅' : 
                        validation.status === 'FAILED' ? '❌' : '⚠️';
      
      console.log(`   ${index + 1}. ${statusIcon} ${validation.name}: ${validation.status}`);
      if (validation.details) {
        console.log(`      Details: ${validation.details}`);
      }
    });
    
    console.log(`\n🎯 Performance Grade: ${this.getPerformanceGrade()}`);
    console.log(`\n💡 Recommendations:`);
    
    const failedValidations = this.results.validations.filter(v => v.status === 'FAILED');
    if (failedValidations.length > 0) {
      failedValidations.forEach(validation => {
        console.log(`   - Fix ${validation.name}: ${validation.details}`);
      });
    } else {
      console.log('   - All optimizations are working correctly! 🎉');
      console.log('   - Consider running regular performance monitoring');
      console.log('   - Schedule periodic optimization reviews');
    }
    
    console.log('\n' + '='.repeat(70));
    
    return this.results.summary.overallStatus !== 'NEEDS_IMPROVEMENT';
  }

  getPerformanceGrade() {
    const rate = this.results.summary.successRate || 0;
    
    if (rate >= 95) return 'A+';
    if (rate >= 90) return 'A';
    if (rate >= 85) return 'A-';
    if (rate >= 80) return 'B+';
    if (rate >= 75) return 'B';
    if (rate >= 70) return 'B-';
    if (rate >= 65) return 'C+';
    if (rate >= 60) return 'C';
    return 'D';
  }

  async runComprehensiveValidation() {
    this.log('🚀 Starting Comprehensive Performance Optimization Validation', 'INFO');
    
    try {
      // Run all validations
      await this.validateBundleOptimization();
      await this.validateImageOptimization();
      await this.validatePerformanceMonitoring();
      await this.validateCachingStrategy();
      await this.validateDatabaseOptimization();
      await this.validateProductionReadiness();
      await this.validatePerformanceTargets();
      
      // Generate report
      const report = this.generateValidationReport();
      
      // Display results
      const success = this.displayResults();
      
      this.log(`🏁 Validation completed: ${success ? 'SUCCESS' : 'ISSUES FOUND'}`, 
                success ? 'SUCCESS' : 'WARNING');
      
      return { success, report };
      
    } catch (error) {
      this.log(`❌ Validation failed: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }
}

// CLI execution
async function main() {
  const validator = new PerformanceOptimizationValidator();
  const result = await validator.runComprehensiveValidation();
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = PerformanceOptimizationValidator;