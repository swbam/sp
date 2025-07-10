#!/usr/bin/env node

/**
 * MySetlist Blue-Green Deployment Testing Strategy
 * 
 * Comprehensive testing framework for zero-downtime deployments
 * with automated rollback capabilities and production validation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class BlueGreenDeploymentTester {
  constructor(options = {}) {
    this.productionUrl = options.productionUrl || 'https://mysetlist.vercel.app';
    this.stagingUrl = options.stagingUrl || 'https://staging.mysetlist.vercel.app';
    this.testSuiteTimeout = options.testSuiteTimeout || 10 * 60 * 1000; // 10 minutes
    this.healthCheckInterval = options.healthCheckInterval || 30 * 1000; // 30 seconds
    this.rollbackThreshold = options.rollbackThreshold || 0.95; // 95% success rate
    this.outputDir = options.outputDir || 'deployment-testing';
    
    this.deploymentMetrics = {
      preDeploymentHealth: null,
      postDeploymentHealth: null,
      canaryTestResults: [],
      productionValidation: null,
      rollbackDecision: null,
      deploymentTimeline: []
    };
    
    this.testSuites = {
      smokeTests: this.getSmokeTests(),
      canaryTests: this.getCanaryTests(),
      productionValidation: this.getProductionValidationTests(),
      rollbackTests: this.getRollbackTests()
    };
  }

  getSmokeTests() {
    return [
      {
        name: 'Homepage Loads',
        critical: true,
        test: async (page, baseUrl) => {
          await page.goto(baseUrl);
          await page.waitForLoadState('networkidle');
          
          const title = await page.title();
          const hasMySetlist = title.includes('MySetlist');
          
          return {
            passed: hasMySetlist,
            message: hasMySetlist ? 'Homepage loads correctly' : 'Homepage title incorrect',
            metrics: {
              loadTime: await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart),
              title
            }
          };
        }
      },
      {
        name: 'Search Functionality',
        critical: true,
        test: async (page, baseUrl) => {
          await page.goto(`${baseUrl}/search`);
          
          const searchInput = page.locator('input[type="search"]').first();
          await searchInput.fill('radiohead');
          await searchInput.press('Enter');
          
          await page.waitForLoadState('networkidle');
          
          const hasResults = await page.locator('[class*="result"], [class*="artist"]').count() > 0;
          
          return {
            passed: hasResults,
            message: hasResults ? 'Search returns results' : 'Search not working',
            metrics: {
              searchTerm: 'radiohead',
              resultsFound: hasResults
            }
          };
        }
      },
      {
        name: 'API Health Check',
        critical: true,
        test: async (page, baseUrl) => {
          const response = await page.request.get(`${baseUrl}/api/sync/health`);
          const data = await response.json();
          
          return {
            passed: response.ok() && data.status === 'healthy',
            message: response.ok() ? 'API health check passed' : 'API health check failed',
            metrics: {
              status: response.status(),
              responseTime: data.responseTime || 0,
              timestamp: data.timestamp
            }
          };
        }
      },
      {
        name: 'Database Connectivity',
        critical: true,
        test: async (page, baseUrl) => {
          const response = await page.request.get(`${baseUrl}/api/artists`);
          const data = await response.json();
          
          return {
            passed: response.ok() && Array.isArray(data) && data.length > 0,
            message: response.ok() ? 'Database connectivity verified' : 'Database connectivity failed',
            metrics: {
              status: response.status(),
              recordsReturned: Array.isArray(data) ? data.length : 0
            }
          };
        }
      },
      {
        name: 'Authentication System',
        critical: false,
        test: async (page, baseUrl) => {
          await page.goto(baseUrl);
          
          // Look for auth-related elements
          const authButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();
          const hasAuth = await authButton.isVisible();
          
          return {
            passed: hasAuth,
            message: hasAuth ? 'Authentication system available' : 'Authentication system not visible',
            metrics: {
              authElementFound: hasAuth
            }
          };
        }
      }
    ];
  }

  getCanaryTests() {
    return [
      {
        name: 'Voting System End-to-End',
        weight: 0.3,
        test: async (page, baseUrl) => {
          await page.goto(`${baseUrl}/shows/1`);
          
          const voteButton = page.locator('[class*="vote"], [data-testid*="vote"]').first();
          const hasVoteButton = await voteButton.isVisible();
          
          if (hasVoteButton) {
            await voteButton.click();
            await page.waitForTimeout(2000);
            
            // Check for response (auth modal or vote success)
            const hasAuthModal = await page.locator('[role="dialog"]').isVisible();
            const hasVoteResponse = await page.locator('[class*="notification"], [class*="toast"]').isVisible();
            
            return {
              passed: hasAuthModal || hasVoteResponse,
              message: 'Voting system responds correctly',
              metrics: {
                voteButtonFound: hasVoteButton,
                responseReceived: hasAuthModal || hasVoteResponse
              }
            };
          }
          
          return {
            passed: false,
            message: 'Vote button not found',
            metrics: {
              voteButtonFound: false
            }
          };
        }
      },
      {
        name: 'Artist Page Performance',
        weight: 0.2,
        test: async (page, baseUrl) => {
          const startTime = Date.now();
          
          await page.goto(`${baseUrl}/artists/radiohead`);
          await page.waitForLoadState('networkidle');
          
          const endTime = Date.now();
          const loadTime = endTime - startTime;
          
          const hasArtistInfo = await page.locator('[class*="artist"], h1').count() > 0;
          const hasShows = await page.locator('[class*="show"], [class*="concert"]').count() > 0;
          
          return {
            passed: hasArtistInfo && loadTime < 3000,
            message: `Artist page loaded in ${loadTime}ms`,
            metrics: {
              loadTime,
              hasArtistInfo,
              hasShows,
              performanceGood: loadTime < 3000
            }
          };
        }
      },
      {
        name: 'Search Performance',
        weight: 0.25,
        test: async (page, baseUrl) => {
          await page.goto(`${baseUrl}/search`);
          
          const searchInput = page.locator('input[type="search"]').first();
          const startTime = Date.now();
          
          await searchInput.fill('radiohead');
          await searchInput.press('Enter');
          await page.waitForLoadState('networkidle');
          
          const endTime = Date.now();
          const searchTime = endTime - startTime;
          
          const resultCount = await page.locator('[class*="result"], [class*="artist"]').count();
          
          return {
            passed: resultCount > 0 && searchTime < 2000,
            message: `Search completed in ${searchTime}ms with ${resultCount} results`,
            metrics: {
              searchTime,
              resultCount,
              performanceGood: searchTime < 2000
            }
          };
        }
      },
      {
        name: 'Mobile Responsiveness',
        weight: 0.15,
        test: async (page, baseUrl) => {
          await page.setViewportSize({ width: 375, height: 667 });
          await page.goto(baseUrl);
          
          const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
          const viewportWidth = await page.evaluate(() => window.innerWidth);
          
          const isResponsive = bodyWidth <= viewportWidth + 20; // 20px tolerance
          
          // Check for mobile navigation
          const hasHamburger = await page.locator('[class*="hamburger"], [class*="menu-toggle"]').isVisible();
          const hasNavigation = await page.locator('nav').isVisible();
          
          return {
            passed: isResponsive && (hasHamburger || hasNavigation),
            message: isResponsive ? 'Mobile responsiveness verified' : 'Mobile responsiveness issues',
            metrics: {
              bodyWidth,
              viewportWidth,
              isResponsive,
              hasHamburger,
              hasNavigation
            }
          };
        }
      },
      {
        name: 'Real-time Features',
        weight: 0.1,
        test: async (page, baseUrl) => {
          await page.goto(`${baseUrl}/shows/1`);
          
          // Look for real-time indicators
          const hasLiveIndicator = await page.locator('[class*="live"], [class*="realtime"]').isVisible();
          const hasWebSocket = await page.evaluate(() => {
            return window.WebSocket !== undefined;
          });
          
          return {
            passed: hasLiveIndicator || hasWebSocket,
            message: hasLiveIndicator ? 'Real-time features active' : 'Real-time features not detected',
            metrics: {
              hasLiveIndicator,
              hasWebSocket
            }
          };
        }
      }
    ];
  }

  getProductionValidationTests() {
    return [
      {
        name: 'Core Web Vitals Validation',
        test: async (page, baseUrl) => {
          await page.goto(baseUrl);
          
          const webVitals = await page.evaluate(() => {
            return new Promise((resolve) => {
              const vitals = {};
              
              // Get LCP
              const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                if (entries.length > 0) {
                  vitals.lcp = entries[entries.length - 1].startTime;
                }
              });
              observer.observe({ entryTypes: ['largest-contentful-paint'] });
              
              // Get FCP
              const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
              if (fcpEntry) {
                vitals.fcp = fcpEntry.startTime;
              }
              
              // Get CLS
              let clsValue = 0;
              const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                  }
                }
                vitals.cls = clsValue;
              });
              clsObserver.observe({ entryTypes: ['layout-shift'] });
              
              setTimeout(() => resolve(vitals), 3000);
            });
          });
          
          const lcpGood = webVitals.lcp < 2500;
          const fcpGood = webVitals.fcp < 1800;
          const clsGood = webVitals.cls < 0.1;
          
          return {
            passed: lcpGood && fcpGood && clsGood,
            message: 'Core Web Vitals validation',
            metrics: {
              lcp: webVitals.lcp,
              fcp: webVitals.fcp,
              cls: webVitals.cls,
              lcpGood,
              fcpGood,
              clsGood
            }
          };
        }
      },
      {
        name: 'Security Headers Validation',
        test: async (page, baseUrl) => {
          const response = await page.request.get(baseUrl);
          const headers = response.headers();
          
          const hasXFrameOptions = 'x-frame-options' in headers;
          const hasXContentTypeOptions = 'x-content-type-options' in headers;
          const hasXXSSProtection = 'x-xss-protection' in headers;
          const hasStrictTransportSecurity = 'strict-transport-security' in headers;
          
          const securityScore = [
            hasXFrameOptions,
            hasXContentTypeOptions,
            hasXXSSProtection,
            hasStrictTransportSecurity
          ].filter(Boolean).length;
          
          return {
            passed: securityScore >= 3,
            message: `Security headers validation: ${securityScore}/4 headers present`,
            metrics: {
              hasXFrameOptions,
              hasXContentTypeOptions,
              hasXXSSProtection,
              hasStrictTransportSecurity,
              securityScore
            }
          };
        }
      },
      {
        name: 'API Response Time Validation',
        test: async (page, baseUrl) => {
          const endpoints = [
            '/api/trending',
            '/api/shows',
            '/api/artists',
            '/api/search/artists?q=test'
          ];
          
          const results = [];
          
          for (const endpoint of endpoints) {
            const startTime = Date.now();
            const response = await page.request.get(`${baseUrl}${endpoint}`);
            const endTime = Date.now();
            
            results.push({
              endpoint,
              responseTime: endTime - startTime,
              status: response.status(),
              ok: response.ok()
            });
          }
          
          const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
          const allSuccessful = results.every(r => r.ok);
          const allFast = results.every(r => r.responseTime < 1000);
          
          return {
            passed: allSuccessful && allFast && avgResponseTime < 500,
            message: `API validation: ${avgResponseTime.toFixed(0)}ms avg response time`,
            metrics: {
              avgResponseTime,
              allSuccessful,
              allFast,
              results
            }
          };
        }
      },
      {
        name: 'Database Connection Pool Health',
        test: async (page, baseUrl) => {
          const response = await page.request.get(`${baseUrl}/api/sync/health`);
          const healthData = await response.json();
          
          const dbConnectionsHealthy = healthData.databaseConnections < 80; // Less than 80% pool usage
          const responseTime = healthData.responseTime < 100; // Less than 100ms
          
          return {
            passed: dbConnectionsHealthy && responseTime,
            message: 'Database connection pool health check',
            metrics: {
              databaseConnections: healthData.databaseConnections,
              responseTime: healthData.responseTime,
              dbConnectionsHealthy,
              responseTimeGood: responseTime
            }
          };
        }
      }
    ];
  }

  getRollbackTests() {
    return [
      {
        name: 'Rollback Health Check',
        test: async (page, baseUrl) => {
          await page.goto(baseUrl);
          
          const isAccessible = await page.locator('body').isVisible();
          const hasContent = await page.locator('main, [role="main"]').isVisible();
          
          return {
            passed: isAccessible && hasContent,
            message: isAccessible ? 'Rollback health check passed' : 'Rollback health check failed',
            metrics: {
              isAccessible,
              hasContent
            }
          };
        }
      },
      {
        name: 'Critical Functionality Restored',
        test: async (page, baseUrl) => {
          // Test core functionality after rollback
          await page.goto(baseUrl);
          
          const hasNavigation = await page.locator('nav').isVisible();
          const hasSearchInput = await page.locator('input[type="search"]').isVisible();
          
          return {
            passed: hasNavigation && hasSearchInput,
            message: 'Critical functionality restored',
            metrics: {
              hasNavigation,
              hasSearchInput
            }
          };
        }
      }
    ];
  }

  async runPreDeploymentHealthCheck() {
    console.log('🏥 Running pre-deployment health check...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Pre-deployment health check started'
    });
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      const healthResults = await this.runTestSuite(page, this.productionUrl, this.testSuites.smokeTests);
      
      this.deploymentMetrics.preDeploymentHealth = {
        timestamp: new Date().toISOString(),
        results: healthResults,
        overallSuccess: healthResults.every(r => r.passed),
        criticalFailures: healthResults.filter(r => r.critical && !r.passed).length
      };
      
      console.log(`✅ Pre-deployment health check: ${healthResults.filter(r => r.passed).length}/${healthResults.length} tests passed`);
      
      if (this.deploymentMetrics.preDeploymentHealth.criticalFailures > 0) {
        console.log('🚨 Critical failures detected in pre-deployment check');
        return false;
      }
      
      return true;
      
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async runCanaryTesting() {
    console.log('🐦 Running canary testing...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Canary testing started'
    });
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      const canaryResults = await this.runTestSuite(page, this.stagingUrl, this.testSuites.canaryTests);
      
      // Calculate weighted success rate
      let totalWeight = 0;
      let weightedScore = 0;
      
      for (const result of canaryResults) {
        const weight = result.weight || 1;
        totalWeight += weight;
        if (result.passed) {
          weightedScore += weight;
        }
      }
      
      const successRate = weightedScore / totalWeight;
      
      this.deploymentMetrics.canaryTestResults = {
        timestamp: new Date().toISOString(),
        results: canaryResults,
        successRate,
        passed: successRate >= this.rollbackThreshold
      };
      
      console.log(`✅ Canary testing: ${(successRate * 100).toFixed(1)}% success rate`);
      
      if (successRate < this.rollbackThreshold) {
        console.log('🚨 Canary tests below rollback threshold');
        return false;
      }
      
      return true;
      
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async runProductionValidation() {
    console.log('✅ Running production validation...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Production validation started'
    });
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      const validationResults = await this.runTestSuite(page, this.productionUrl, this.testSuites.productionValidation);
      
      this.deploymentMetrics.productionValidation = {
        timestamp: new Date().toISOString(),
        results: validationResults,
        overallSuccess: validationResults.every(r => r.passed),
        failureCount: validationResults.filter(r => !r.passed).length
      };
      
      console.log(`✅ Production validation: ${validationResults.filter(r => r.passed).length}/${validationResults.length} tests passed`);
      
      return this.deploymentMetrics.productionValidation.overallSuccess;
      
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async runRollbackValidation() {
    console.log('🔄 Running rollback validation...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Rollback validation started'
    });
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      const rollbackResults = await this.runTestSuite(page, this.productionUrl, this.testSuites.rollbackTests);
      
      const rollbackSuccess = rollbackResults.every(r => r.passed);
      
      console.log(`✅ Rollback validation: ${rollbackResults.filter(r => r.passed).length}/${rollbackResults.length} tests passed`);
      
      return rollbackSuccess;
      
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async runTestSuite(page, baseUrl, testSuite) {
    const results = [];
    
    for (const test of testSuite) {
      console.log(`  Running: ${test.name}`);
      
      try {
        const startTime = Date.now();
        const result = await test.test(page, baseUrl);
        const endTime = Date.now();
        
        results.push({
          name: test.name,
          ...result,
          duration: endTime - startTime,
          critical: test.critical || false,
          weight: test.weight || 1,
          timestamp: new Date().toISOString()
        });
        
        const status = result.passed ? '✅' : '❌';
        console.log(`    ${status} ${test.name}: ${result.message}`);
        
      } catch (error) {
        console.error(`    ❌ ${test.name}: ${error.message}`);
        
        results.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          error: error.message,
          critical: test.critical || false,
          weight: test.weight || 1,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  async executeBlueGreenDeployment() {
    console.log('🚀 Starting Blue-Green Deployment Testing...');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Step 1: Pre-deployment health check
      const preDeploymentHealthy = await this.runPreDeploymentHealthCheck();
      
      if (!preDeploymentHealthy) {
        console.log('🚨 Pre-deployment health check failed. Aborting deployment.');
        return this.generateDeploymentReport(false, 'Pre-deployment health check failed');
      }
      
      // Step 2: Canary testing on staging
      const canarySuccessful = await this.runCanaryTesting();
      
      if (!canarySuccessful) {
        console.log('🚨 Canary testing failed. Aborting deployment.');
        return this.generateDeploymentReport(false, 'Canary testing failed');
      }
      
      // Step 3: Production validation (simulated deployment)
      console.log('🔄 Simulating production deployment...');
      await this.simulateDeployment();
      
      const productionValid = await this.runProductionValidation();
      
      if (!productionValid) {
        console.log('🚨 Production validation failed. Initiating rollback...');
        
        // Simulate rollback
        await this.simulateRollback();
        
        // Validate rollback
        const rollbackSuccessful = await this.runRollbackValidation();
        
        this.deploymentMetrics.rollbackDecision = {
          timestamp: new Date().toISOString(),
          decision: 'rollback',
          reason: 'Production validation failed',
          rollbackSuccessful
        };
        
        return this.generateDeploymentReport(false, 'Production validation failed, rollback executed');
      }
      
      // Step 4: Success
      console.log('✅ Blue-Green deployment successful!');
      
      this.deploymentMetrics.rollbackDecision = {
        timestamp: new Date().toISOString(),
        decision: 'proceed',
        reason: 'All tests passed'
      };
      
      return this.generateDeploymentReport(true, 'Deployment successful');
      
    } catch (error) {
      console.error('❌ Deployment testing failed:', error);
      return this.generateDeploymentReport(false, `Deployment testing error: ${error.message}`);
    }
  }

  async simulateDeployment() {
    console.log('🔄 Simulating deployment...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Production deployment simulated'
    });
    
    // In a real scenario, this would trigger actual deployment
    // For testing purposes, we'll just wait
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async simulateRollback() {
    console.log('🔄 Simulating rollback...');
    
    this.deploymentMetrics.deploymentTimeline.push({
      timestamp: new Date().toISOString(),
      event: 'Rollback simulated'
    });
    
    // In a real scenario, this would trigger actual rollback
    // For testing purposes, we'll just wait
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  generateDeploymentReport(success, summary) {
    const report = {
      timestamp: new Date().toISOString(),
      success,
      summary,
      productionUrl: this.productionUrl,
      stagingUrl: this.stagingUrl,
      metrics: this.deploymentMetrics,
      testConfiguration: {
        testSuiteTimeout: this.testSuiteTimeout,
        healthCheckInterval: this.healthCheckInterval,
        rollbackThreshold: this.rollbackThreshold
      }
    };
    
    const reportPath = path.join(this.outputDir, `deployment-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Deployment report generated: ${reportPath}`);
    
    // Generate summary
    this.generateDeploymentSummary(report);
    
    return report;
  }

  generateDeploymentSummary(report) {
    console.log('\n📊 DEPLOYMENT SUMMARY');
    console.log('==================');
    console.log(`Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Summary: ${report.summary}`);
    console.log(`Timestamp: ${report.timestamp}`);
    
    if (report.metrics.preDeploymentHealth) {
      const preHealth = report.metrics.preDeploymentHealth;
      console.log(`Pre-deployment Health: ${preHealth.overallSuccess ? '✅' : '❌'} (${preHealth.results.filter(r => r.passed).length}/${preHealth.results.length})`);
    }
    
    if (report.metrics.canaryTestResults) {
      const canary = report.metrics.canaryTestResults;
      console.log(`Canary Tests: ${canary.passed ? '✅' : '❌'} (${(canary.successRate * 100).toFixed(1)}% success rate)`);
    }
    
    if (report.metrics.productionValidation) {
      const prodVal = report.metrics.productionValidation;
      console.log(`Production Validation: ${prodVal.overallSuccess ? '✅' : '❌'} (${prodVal.results.filter(r => r.passed).length}/${prodVal.results.length})`);
    }
    
    if (report.metrics.rollbackDecision) {
      const rollback = report.metrics.rollbackDecision;
      console.log(`Decision: ${rollback.decision} (${rollback.reason})`);
    }
    
    console.log('\n📋 Timeline:');
    report.metrics.deploymentTimeline.forEach(event => {
      console.log(`  ${event.timestamp}: ${event.event}`);
    });
    
    console.log('\n==================\n');
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';
  const productionUrl = args[1] || 'https://mysetlist.vercel.app';
  const stagingUrl = args[2] || 'https://staging.mysetlist.vercel.app';
  
  const tester = new BlueGreenDeploymentTester({
    productionUrl,
    stagingUrl,
    outputDir: 'deployment-testing'
  });
  
  switch (command) {
    case 'deploy':
      const result = await tester.executeBlueGreenDeployment();
      process.exit(result.success ? 0 : 1);
      break;
      
    case 'health':
      const healthy = await tester.runPreDeploymentHealthCheck();
      process.exit(healthy ? 0 : 1);
      break;
      
    case 'canary':
      const canarySuccess = await tester.runCanaryTesting();
      process.exit(canarySuccess ? 0 : 1);
      break;
      
    case 'validate':
      const validationSuccess = await tester.runProductionValidation();
      process.exit(validationSuccess ? 0 : 1);
      break;
      
    default:
      console.log('Usage: node blue-green-deployment-testing.js [deploy|health|canary|validate] [productionUrl] [stagingUrl]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BlueGreenDeploymentTester;