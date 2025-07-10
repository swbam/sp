#!/usr/bin/env node

/**
 * MySetlist Comprehensive CI/CD Test Runner
 * 
 * Orchestrates all testing phases for production deployment
 * with parallel execution, failure handling, and comprehensive reporting
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ComprehensiveTestRunner {
  constructor(options = {}) {
    this.environment = options.environment || 'development';
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.parallelism = options.parallelism || 3;
    this.timeout = options.timeout || 30 * 60 * 1000; // 30 minutes
    this.outputDir = options.outputDir || 'test-results';
    this.failFast = options.failFast || false;
    
    this.testSuites = {
      unit: {
        name: 'Unit Tests',
        command: 'npm run test:unit',
        critical: true,
        parallel: false,
        timeout: 5 * 60 * 1000
      },
      integration: {
        name: 'Integration Tests', 
        command: 'npm run test:integration',
        critical: true,
        parallel: false,
        timeout: 10 * 60 * 1000
      },
      e2e: {
        name: 'End-to-End Tests',
        command: 'npm run test:e2e',
        critical: true,
        parallel: false,
        timeout: 15 * 60 * 1000
      },
      accessibility: {
        name: 'Accessibility Tests',
        command: `node tests/a11y/accessibility-test-suite.js ${this.baseUrl}`,
        critical: true,
        parallel: true,
        timeout: 10 * 60 * 1000
      },
      lighthouse: {
        name: 'Lighthouse Performance Tests',
        command: `node tests/lighthouse/lighthouse-ci.js audit ${this.baseUrl}`,
        critical: true,
        parallel: true,
        timeout: 15 * 60 * 1000
      },
      security: {
        name: 'Security Tests',
        command: 'npm run test:security',
        critical: true,
        parallel: true,
        timeout: 10 * 60 * 1000
      },
      load: {
        name: 'Load Tests',
        command: `BASE_URL=${this.baseUrl} k6 run tests/load/load-test.js`,
        critical: false,
        parallel: true,
        timeout: 20 * 60 * 1000
      },
      stress: {
        name: 'Stress Tests',
        command: `BASE_URL=${this.baseUrl} k6 run tests/load/stress-test.js`,
        critical: false,
        parallel: true,
        timeout: 25 * 60 * 1000
      }
    };
    
    this.results = {
      startTime: null,
      endTime: null,
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteResults: [],
      overallSuccess: false,
      criticalFailures: [],
      warnings: []
    };
  }

  async runComprehensiveTests() {
    console.log('🚀 Starting MySetlist Comprehensive Test Suite');
    console.log(`Environment: ${this.environment}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Parallelism: ${this.parallelism}`);
    console.log(`Timeout: ${this.timeout / 1000}s`);
    console.log('=====================================\n');

    this.results.startTime = new Date();
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // Phase 1: Critical Sequential Tests (must pass before continuing)
      console.log('📋 Phase 1: Critical Sequential Tests');
      const criticalTests = this.getCriticalSequentialTests();
      const criticalSuccess = await this.runSequentialTests(criticalTests);
      
      if (!criticalSuccess && this.failFast) {
        console.log('🚨 Critical tests failed. Stopping execution.');
        return this.generateFinalReport();
      }

      // Phase 2: Parallel Tests (can run concurrently)
      console.log('\n📋 Phase 2: Parallel Tests');
      const parallelTests = this.getParallelTests();
      await this.runParallelTests(parallelTests);

      // Phase 3: Performance Tests (if critical tests passed)
      if (criticalSuccess) {
        console.log('\n📋 Phase 3: Performance Tests');
        const performanceTests = this.getPerformanceTests();
        await this.runParallelTests(performanceTests);
      }

      // Generate final report
      return this.generateFinalReport();

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      this.results.overallSuccess = false;
      return this.generateFinalReport();
    }
  }

  getCriticalSequentialTests() {
    return Object.entries(this.testSuites)
      .filter(([_, suite]) => suite.critical && !suite.parallel)
      .map(([key, suite]) => ({ key, ...suite }));
  }

  getParallelTests() {
    return Object.entries(this.testSuites)
      .filter(([_, suite]) => suite.critical && suite.parallel)
      .map(([key, suite]) => ({ key, ...suite }));
  }

  getPerformanceTests() {
    return Object.entries(this.testSuites)
      .filter(([_, suite]) => !suite.critical)
      .map(([key, suite]) => ({ key, ...suite }));
  }

  async runSequentialTests(tests) {
    let allPassed = true;
    
    for (const test of tests) {
      const result = await this.runSingleTest(test);
      
      if (!result.success) {
        allPassed = false;
        
        if (this.failFast) {
          console.log(`🚨 Critical test ${test.name} failed. Stopping execution.`);
          break;
        }
      }
    }
    
    return allPassed;
  }

  async runParallelTests(tests) {
    const chunks = this.chunkArray(tests, this.parallelism);
    
    for (const chunk of chunks) {
      const promises = chunk.map(test => this.runSingleTest(test));
      await Promise.all(promises);
    }
  }

  async runSingleTest(test) {
    console.log(`🔍 Running ${test.name}...`);
    
    const startTime = Date.now();
    const result = {
      name: test.name,
      key: test.key,
      command: test.command,
      critical: test.critical,
      startTime: new Date().toISOString(),
      success: false,
      duration: 0,
      output: '',
      error: '',
      metrics: {}
    };

    try {
      const { stdout, stderr } = await this.executeCommand(test.command, test.timeout);
      
      result.success = true;
      result.output = stdout;
      result.error = stderr;
      result.metrics = this.parseTestMetrics(stdout, test.key);
      
      this.results.passed++;
      
      const duration = Date.now() - startTime;
      result.duration = duration;
      
      console.log(`  ✅ ${test.name} passed (${duration}ms)`);
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.output = error.stdout || '';
      
      this.results.failed++;
      
      const duration = Date.now() - startTime;
      result.duration = duration;
      
      console.log(`  ❌ ${test.name} failed (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
      
      if (test.critical) {
        this.results.criticalFailures.push({
          test: test.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.results.suiteResults.push(result);
    return result;
  }

  async executeCommand(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: this.environment }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command failed with exit code ${code}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  parseTestMetrics(output, testKey) {
    const metrics = {};
    
    try {
      switch (testKey) {
        case 'unit':
        case 'integration':
        case 'e2e':
          // Parse Jest/Vitest output
          const testMatch = output.match(/Tests:\s*(\d+)\s*passed/);
          if (testMatch) {
            metrics.testsRun = parseInt(testMatch[1]);
          }
          
          const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)/);
          if (coverageMatch) {
            metrics.coverage = parseFloat(coverageMatch[1]);
          }
          break;
          
        case 'accessibility':
          // Parse accessibility metrics
          const violationsMatch = output.match(/(\d+)\s*total\s*violations/);
          if (violationsMatch) {
            metrics.violations = parseInt(violationsMatch[1]);
          }
          
          const complianceMatch = output.match(/(\d+)%\s*Overall\s*Compliance/);
          if (complianceMatch) {
            metrics.compliance = parseInt(complianceMatch[1]);
          }
          break;
          
        case 'lighthouse':
          // Parse Lighthouse metrics
          const performanceMatch = output.match(/Performance:\s*(\d+)/);
          if (performanceMatch) {
            metrics.performance = parseInt(performanceMatch[1]);
          }
          
          const accessibilityMatch = output.match(/Accessibility:\s*(\d+)/);
          if (accessibilityMatch) {
            metrics.accessibility = parseInt(accessibilityMatch[1]);
          }
          break;
          
        case 'load':
        case 'stress':
          // Parse k6 metrics
          const requestsMatch = output.match(/http_reqs[^:]+:\s*(\d+)/);
          if (requestsMatch) {
            metrics.totalRequests = parseInt(requestsMatch[1]);
          }
          
          const errorRateMatch = output.match(/http_req_failed[^:]+:\s*([\d.]+)%/);
          if (errorRateMatch) {
            metrics.errorRate = parseFloat(errorRateMatch[1]);
          }
          
          const avgResponseMatch = output.match(/http_req_duration[^:]+avg=([\d.]+)ms/);
          if (avgResponseMatch) {
            metrics.avgResponseTime = parseFloat(avgResponseMatch[1]);
          }
          break;
      }
    } catch (error) {
      console.warn(`Warning: Could not parse metrics for ${testKey}:`, error.message);
    }
    
    return metrics;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  generateFinalReport() {
    this.results.endTime = new Date();
    this.results.totalDuration = this.results.endTime - this.results.startTime;
    this.results.overallSuccess = this.results.failed === 0 && this.results.criticalFailures.length === 0;

    console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
    console.log('=====================================');
    console.log(`Overall Status: ${this.results.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Total Duration: ${(this.results.totalDuration / 1000).toFixed(1)}s`);
    console.log(`Tests Passed: ${this.results.passed}`);
    console.log(`Tests Failed: ${this.results.failed}`);
    console.log(`Critical Failures: ${this.results.criticalFailures.length}`);
    
    if (this.results.criticalFailures.length > 0) {
      console.log('\n🚨 Critical Failures:');
      this.results.criticalFailures.forEach(failure => {
        console.log(`  - ${failure.test}: ${failure.error}`);
      });
    }

    console.log('\n📊 Suite Results:');
    this.results.suiteResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      const critical = result.critical ? ' (CRITICAL)' : '';
      
      console.log(`  ${status} ${result.name}: ${duration}s${critical}`);
      
      if (Object.keys(result.metrics).length > 0) {
        Object.entries(result.metrics).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
    });

    // Generate detailed report file
    const reportPath = this.generateDetailedReport();
    console.log(`\n📄 Detailed report: ${reportPath}`);
    
    // Generate JUnit XML for CI integration
    const junitPath = this.generateJUnitReport();
    console.log(`📄 JUnit report: ${junitPath}`);
    
    // Generate SARIF report for security results
    const sarifPath = this.generateSARIFReport();
    console.log(`📄 SARIF report: ${sarifPath}`);
    
    console.log('\n=====================================');
    
    return {
      success: this.results.overallSuccess,
      results: this.results,
      reportPath,
      junitPath,
      sarifPath
    };
  }

  generateDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      baseUrl: this.baseUrl,
      configuration: {
        parallelism: this.parallelism,
        timeout: this.timeout,
        failFast: this.failFast
      },
      results: this.results,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memoryUsage: process.memoryUsage()
      }
    };

    const reportPath = path.join(this.outputDir, `comprehensive-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }

  generateJUnitReport() {
    const junitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MySetlist Comprehensive Tests" tests="${this.results.passed + this.results.failed}" failures="${this.results.failed}" time="${(this.results.totalDuration / 1000).toFixed(3)}">
  <testsuite name="Comprehensive Test Suite" tests="${this.results.passed + this.results.failed}" failures="${this.results.failed}" time="${(this.results.totalDuration / 1000).toFixed(3)}">
    ${this.results.suiteResults.map(result => `
    <testcase name="${result.name}" classname="MySetlist.${result.key}" time="${(result.duration / 1000).toFixed(3)}">
      ${!result.success ? `<failure message="${result.error.replace(/"/g, '&quot;')}">${result.error}</failure>` : ''}
    </testcase>`).join('')}
  </testsuite>
</testsuites>`;

    const junitPath = path.join(this.outputDir, 'junit-report.xml');
    fs.writeFileSync(junitPath, junitXml);
    
    return junitPath;
  }

  generateSARIFReport() {
    const sarif = {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'MySetlist Comprehensive Test Suite',
            version: '1.0.0',
            informationUri: 'https://github.com/mysetlist/testing'
          }
        },
        results: this.results.suiteResults
          .filter(result => !result.success)
          .map(result => ({
            ruleId: result.key,
            message: {
              text: result.error
            },
            level: result.critical ? 'error' : 'warning',
            locations: [{
              physicalLocation: {
                artifactLocation: {
                  uri: result.command
                }
              }
            }]
          }))
      }]
    };

    const sarifPath = path.join(this.outputDir, 'sarif-report.json');
    fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
    
    return sarifPath;
  }

  async runPreDeploymentChecks() {
    console.log('🔍 Running Pre-deployment Checks...');
    
    const preDeploymentTests = [
      this.testSuites.unit,
      this.testSuites.integration,
      this.testSuites.e2e,
      this.testSuites.accessibility,
      this.testSuites.lighthouse,
      this.testSuites.security
    ];

    const results = [];
    
    for (const test of preDeploymentTests) {
      const result = await this.runSingleTest(test);
      results.push(result);
      
      if (!result.success && result.critical) {
        console.log('🚨 Pre-deployment check failed. Deployment should be blocked.');
        return false;
      }
    }

    console.log('✅ Pre-deployment checks passed');
    return true;
  }

  async runPostDeploymentValidation() {
    console.log('🔍 Running Post-deployment Validation...');
    
    const validationTests = [
      this.testSuites.e2e,
      this.testSuites.accessibility,
      this.testSuites.lighthouse
    ];

    const results = [];
    
    for (const test of validationTests) {
      const result = await this.runSingleTest(test);
      results.push(result);
    }

    const allPassed = results.every(r => r.success);
    
    if (allPassed) {
      console.log('✅ Post-deployment validation passed');
    } else {
      console.log('❌ Post-deployment validation failed');
    }
    
    return allPassed;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'comprehensive';
  const environment = args[1] || 'development';
  const baseUrl = args[2] || 'http://localhost:3000';
  
  const runner = new ComprehensiveTestRunner({
    environment,
    baseUrl,
    parallelism: 3,
    timeout: 30 * 60 * 1000,
    failFast: process.env.FAIL_FAST === 'true'
  });
  
  let result;
  
  switch (command) {
    case 'comprehensive':
      result = await runner.runComprehensiveTests();
      break;
      
    case 'pre-deployment':
      const preDeploymentSuccess = await runner.runPreDeploymentChecks();
      process.exit(preDeploymentSuccess ? 0 : 1);
      break;
      
    case 'post-deployment':
      const postDeploymentSuccess = await runner.runPostDeploymentValidation();
      process.exit(postDeploymentSuccess ? 0 : 1);
      break;
      
    default:
      console.log('Usage: node comprehensive-test-runner.js [comprehensive|pre-deployment|post-deployment] [environment] [baseUrl]');
      process.exit(1);
  }
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensiveTestRunner;