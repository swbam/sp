#!/usr/bin/env node

/**
 * MySetlist Lighthouse Performance & Accessibility Testing
 * 
 * Comprehensive Lighthouse CI integration for performance budgets,
 * accessibility compliance, and Core Web Vitals monitoring
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

class LighthouseCI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.outputDir = options.outputDir || 'lighthouse-reports';
    this.budgets = options.budgets || this.getDefaultBudgets();
    this.accessibilityStandards = options.accessibilityStandards || 'WCAG2AA';
    
    // Performance budgets aligned with MySetlist requirements
    this.performanceBudgets = {
      'performance': 90,    // Lighthouse performance score ≥ 90
      'accessibility': 95,  // Accessibility score ≥ 95
      'best-practices': 90, // Best practices score ≥ 90
      'seo': 85,           // SEO score ≥ 85
      'pwa': 80,           // PWA score ≥ 80
      'first-contentful-paint': 1800,  // FCP ≤ 1.8s
      'largest-contentful-paint': 2500, // LCP ≤ 2.5s
      'cumulative-layout-shift': 0.1,   // CLS ≤ 0.1
      'speed-index': 3000,              // Speed Index ≤ 3s
      'interactive': 3500,              // TTI ≤ 3.5s
      'first-meaningful-paint': 2000,   // FMP ≤ 2s
      'total-blocking-time': 300,       // TBT ≤ 300ms
    };
    
    // Test URLs for comprehensive coverage
    this.testUrls = [
      { name: 'Homepage', url: '/' },
      { name: 'Search Page', url: '/search' },
      { name: 'Artist Page', url: '/artists/radiohead' },
      { name: 'Show Page', url: '/shows/1' },
      { name: 'Trending Page', url: '/trending' },
      { name: 'Account Page', url: '/account' },
    ];
    
    // Device configurations for mobile-first testing
    this.deviceConfigs = {
      desktop: {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'desktop',
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
          },
          throttling: {
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
          },
        },
      },
      mobile: {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'mobile',
          screenEmulation: {
            mobile: true,
            width: 360,
            height: 640,
            deviceScaleFactor: 2,
          },
          throttling: {
            requestLatencyMs: 562.5,
            downloadThroughputKbps: 1474.56,
            uploadThroughputKbps: 675,
          },
        },
      },
    };
  }

  getDefaultBudgets() {
    return {
      resourceSizes: [
        { resourceType: 'script', budget: 400 },      // JavaScript ≤ 400KB
        { resourceType: 'stylesheet', budget: 100 },  // CSS ≤ 100KB
        { resourceType: 'image', budget: 1000 },      // Images ≤ 1MB
        { resourceType: 'font', budget: 150 },        // Fonts ≤ 150KB
        { resourceType: 'total', budget: 2000 },      // Total ≤ 2MB
      ],
      resourceCounts: [
        { resourceType: 'script', budget: 10 },       // ≤ 10 JS files
        { resourceType: 'stylesheet', budget: 5 },    // ≤ 5 CSS files
        { resourceType: 'image', budget: 20 },        // ≤ 20 images
        { resourceType: 'font', budget: 5 },          // ≤ 5 fonts
        { resourceType: 'total', budget: 50 },        // ≤ 50 total resources
      ],
      timings: [
        { metric: 'first-contentful-paint', budget: 1800 },
        { metric: 'largest-contentful-paint', budget: 2500 },
        { metric: 'cumulative-layout-shift', budget: 0.1 },
        { metric: 'speed-index', budget: 3000 },
        { metric: 'interactive', budget: 3500 },
      ],
    };
  }

  async launchChrome() {
    return await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
      logLevel: 'error',
    });
  }

  async runLighthouseAudit(url, device = 'mobile') {
    const chrome = await this.launchChrome();
    
    try {
      const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
        port: chrome.port,
      };

      const config = this.deviceConfigs[device];
      const runnerResult = await lighthouse(url, options, config);
      
      return {
        lhr: runnerResult.lhr,
        artifacts: runnerResult.artifacts,
        report: runnerResult.report,
      };
    } finally {
      await chrome.kill();
    }
  }

  async runComprehensiveAudit() {
    console.log('🚀 Starting comprehensive Lighthouse audit...');
    
    const results = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      audits: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        totalScore: 0,
        budgetViolations: [],
        accessibilityIssues: [],
        performanceRecommendations: [],
      },
    };

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Run audits for each URL and device combination
    for (const testUrl of this.testUrls) {
      for (const device of ['mobile', 'desktop']) {
        console.log(`🔍 Auditing ${testUrl.name} (${device})...`);
        
        const fullUrl = `${this.baseUrl}${testUrl.url}`;
        
        try {
          const result = await this.runLighthouseAudit(fullUrl, device);
          const audit = this.analyzeAuditResult(result, testUrl, device);
          
          results.audits.push(audit);
          
          // Update summary
          if (audit.status === 'passed') {
            results.summary.passed++;
          } else if (audit.status === 'failed') {
            results.summary.failed++;
          } else {
            results.summary.warnings++;
          }
          
          results.summary.totalScore += audit.scores.performance;
          results.summary.budgetViolations.push(...audit.budgetViolations);
          results.summary.accessibilityIssues.push(...audit.accessibilityIssues);
          results.summary.performanceRecommendations.push(...audit.recommendations);
          
          // Save individual report
          const reportPath = path.join(
            this.outputDir,
            `${testUrl.name.toLowerCase().replace(/\s+/g, '-')}-${device}-report.json`
          );
          fs.writeFileSync(reportPath, JSON.stringify(result.lhr, null, 2));
          
        } catch (error) {
          console.error(`❌ Failed to audit ${testUrl.name} (${device}):`, error.message);
          
          results.audits.push({
            url: testUrl,
            device,
            status: 'failed',
            error: error.message,
            scores: {},
            budgetViolations: [],
            accessibilityIssues: [],
            recommendations: [],
          });
          
          results.summary.failed++;
        }
      }
    }

    // Calculate average scores
    const totalAudits = results.audits.length;
    results.summary.averageScore = results.summary.totalScore / totalAudits;
    
    // Generate comprehensive report
    const reportPath = path.join(this.outputDir, 'lighthouse-comprehensive-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    // Generate HTML report
    await this.generateHTMLReport(results);
    
    console.log('✅ Comprehensive Lighthouse audit completed');
    console.log(`📊 Results: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`);
    console.log(`📈 Average Performance Score: ${results.summary.averageScore.toFixed(1)}`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    return results;
  }

  analyzeAuditResult(result, testUrl, device) {
    const lhr = result.lhr;
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      pwa: Math.round((lhr.categories.pwa?.score || 0) * 100),
    };

    // Check performance budgets
    const budgetViolations = [];
    const coreWebVitals = {
      fcp: lhr.audits['first-contentful-paint']?.numericValue || 0,
      lcp: lhr.audits['largest-contentful-paint']?.numericValue || 0,
      cls: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
      si: lhr.audits['speed-index']?.numericValue || 0,
      tti: lhr.audits['interactive']?.numericValue || 0,
      tbt: lhr.audits['total-blocking-time']?.numericValue || 0,
    };

    // Check budget violations
    Object.entries(this.performanceBudgets).forEach(([metric, budget]) => {
      let actualValue;
      
      if (metric === 'performance') actualValue = scores.performance;
      else if (metric === 'accessibility') actualValue = scores.accessibility;
      else if (metric === 'best-practices') actualValue = scores.bestPractices;
      else if (metric === 'seo') actualValue = scores.seo;
      else if (metric === 'pwa') actualValue = scores.pwa;
      else if (metric === 'first-contentful-paint') actualValue = coreWebVitals.fcp;
      else if (metric === 'largest-contentful-paint') actualValue = coreWebVitals.lcp;
      else if (metric === 'cumulative-layout-shift') actualValue = coreWebVitals.cls;
      else if (metric === 'speed-index') actualValue = coreWebVitals.si;
      else if (metric === 'interactive') actualValue = coreWebVitals.tti;
      else if (metric === 'total-blocking-time') actualValue = coreWebVitals.tbt;

      if (actualValue !== undefined) {
        const isViolation = metric.includes('score') ? actualValue < budget : actualValue > budget;
        
        if (isViolation) {
          budgetViolations.push({
            metric,
            budget,
            actual: actualValue,
            url: testUrl.name,
            device,
            severity: this.getBudgetViolationSeverity(metric, actualValue, budget),
          });
        }
      }
    });

    // Analyze accessibility issues
    const accessibilityIssues = [];
    const accessibilityAudits = lhr.categories.accessibility.auditRefs;
    
    accessibilityAudits.forEach(auditRef => {
      const audit = lhr.audits[auditRef.id];
      if (audit && audit.score < 1) {
        accessibilityIssues.push({
          id: auditRef.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          impact: this.getAccessibilityImpact(audit),
          url: testUrl.name,
          device,
        });
      }
    });

    // Generate performance recommendations
    const recommendations = [];
    const performanceAudits = lhr.categories.performance.auditRefs;
    
    performanceAudits.forEach(auditRef => {
      const audit = lhr.audits[auditRef.id];
      if (audit && audit.score < 1 && audit.details?.items?.length > 0) {
        recommendations.push({
          id: auditRef.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          impact: audit.details.overallSavingsMs || 0,
          url: testUrl.name,
          device,
        });
      }
    });

    // Determine overall status
    const criticalViolations = budgetViolations.filter(v => v.severity === 'critical');
    const majorAccessibilityIssues = accessibilityIssues.filter(i => i.impact === 'serious');
    
    let status = 'passed';
    if (criticalViolations.length > 0 || majorAccessibilityIssues.length > 0) {
      status = 'failed';
    } else if (budgetViolations.length > 0 || accessibilityIssues.length > 0) {
      status = 'warning';
    }

    return {
      url: testUrl,
      device,
      status,
      scores,
      coreWebVitals,
      budgetViolations,
      accessibilityIssues,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  getBudgetViolationSeverity(metric, actual, budget) {
    const violation = metric.includes('score') ? budget - actual : actual - budget;
    const threshold = budget * 0.1; // 10% threshold
    
    if (violation > threshold * 2) return 'critical';
    if (violation > threshold) return 'major';
    return 'minor';
  }

  getAccessibilityImpact(audit) {
    if (audit.score === 0) return 'serious';
    if (audit.score < 0.5) return 'moderate';
    return 'minor';
  }

  async generateHTMLReport(results) {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MySetlist Lighthouse Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .card.success { border-left-color: #28a745; }
        .card.warning { border-left-color: #ffc107; }
        .card.danger { border-left-color: #dc3545; }
        .score { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .score.good { color: #28a745; }
        .score.needs-improvement { color: #ffc107; }
        .score.poor { color: #dc3545; }
        .audit-results { margin-top: 40px; }
        .audit-item { background: white; margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .audit-header { display: flex; justify-content: between; align-items: center; margin-bottom: 15px; }
        .device-badge { background: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-warning { background: #fff3cd; color: #856404; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; }
        .metric { text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .violations { margin-top: 15px; }
        .violation { background: #f8d7da; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #dc3545; }
        .recommendations { margin-top: 15px; }
        .recommendation { background: #d1ecf1; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #17a2b8; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MySetlist Lighthouse Performance Report</h1>
            <p>Generated on ${new Date(results.timestamp).toLocaleString()}</p>
            <p>Base URL: ${results.baseUrl}</p>
        </div>

        <div class="summary">
            <div class="card success">
                <div class="score good">${results.summary.passed}</div>
                <div>Tests Passed</div>
            </div>
            <div class="card danger">
                <div class="score poor">${results.summary.failed}</div>
                <div>Tests Failed</div>
            </div>
            <div class="card warning">
                <div class="score needs-improvement">${results.summary.warnings}</div>
                <div>Warnings</div>
            </div>
            <div class="card">
                <div class="score ${results.summary.averageScore >= 90 ? 'good' : results.summary.averageScore >= 70 ? 'needs-improvement' : 'poor'}">${results.summary.averageScore.toFixed(1)}</div>
                <div>Average Score</div>
            </div>
        </div>

        <div class="audit-results">
            <h2>Audit Results</h2>
            ${results.audits.map(audit => `
                <div class="audit-item">
                    <div class="audit-header">
                        <h3>${audit.url.name}</h3>
                        <div>
                            <span class="device-badge">${audit.device}</span>
                            <span class="status-badge status-${audit.status}">${audit.status.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    ${audit.scores ? `
                        <div class="metrics">
                            <div class="metric">
                                <div class="score ${audit.scores.performance >= 90 ? 'good' : audit.scores.performance >= 70 ? 'needs-improvement' : 'poor'}">${audit.scores.performance}</div>
                                <div>Performance</div>
                            </div>
                            <div class="metric">
                                <div class="score ${audit.scores.accessibility >= 95 ? 'good' : audit.scores.accessibility >= 80 ? 'needs-improvement' : 'poor'}">${audit.scores.accessibility}</div>
                                <div>Accessibility</div>
                            </div>
                            <div class="metric">
                                <div class="score ${audit.scores.bestPractices >= 90 ? 'good' : audit.scores.bestPractices >= 70 ? 'needs-improvement' : 'poor'}">${audit.scores.bestPractices}</div>
                                <div>Best Practices</div>
                            </div>
                            <div class="metric">
                                <div class="score ${audit.scores.seo >= 85 ? 'good' : audit.scores.seo >= 70 ? 'needs-improvement' : 'poor'}">${audit.scores.seo}</div>
                                <div>SEO</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${audit.budgetViolations && audit.budgetViolations.length > 0 ? `
                        <div class="violations">
                            <h4>Budget Violations</h4>
                            ${audit.budgetViolations.map(violation => `
                                <div class="violation">
                                    <strong>${violation.metric}:</strong> ${violation.actual} (budget: ${violation.budget})
                                    <span class="severity">[${violation.severity}]</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${audit.recommendations && audit.recommendations.length > 0 ? `
                        <div class="recommendations">
                            <h4>Performance Recommendations</h4>
                            ${audit.recommendations.slice(0, 5).map(rec => `
                                <div class="recommendation">
                                    <strong>${rec.title}</strong>
                                    <div>${rec.description}</div>
                                    ${rec.impact > 0 ? `<div>Potential savings: ${rec.impact.toFixed(0)}ms</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Report generated by MySetlist Lighthouse CI</p>
            <p>For detailed analysis, review the individual JSON reports</p>
        </div>
    </div>
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, 'lighthouse-report.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    console.log(`📄 HTML report generated: ${htmlPath}`);
  }

  async runContinuousMonitoring() {
    console.log('🔄 Starting continuous Lighthouse monitoring...');
    
    const runMonitoring = async () => {
      try {
        const results = await this.runComprehensiveAudit();
        
        // Check for critical issues
        const criticalIssues = results.summary.budgetViolations.filter(v => v.severity === 'critical');
        const majorAccessibilityIssues = results.summary.accessibilityIssues.filter(i => i.impact === 'serious');
        
        if (criticalIssues.length > 0 || majorAccessibilityIssues.length > 0) {
          console.log('🚨 Critical performance or accessibility issues detected!');
          console.log('Critical Issues:', criticalIssues.length);
          console.log('Major Accessibility Issues:', majorAccessibilityIssues.length);
          
          // In a real scenario, you would send alerts here
          // await this.sendAlert(criticalIssues, majorAccessibilityIssues);
        }
        
        // Check for performance regression
        const avgScore = results.summary.averageScore;
        if (avgScore < 85) {
          console.log(`⚠️ Performance regression detected: Average score ${avgScore.toFixed(1)}`);
        }
        
      } catch (error) {
        console.error('❌ Continuous monitoring failed:', error);
      }
    };

    // Run initial audit
    await runMonitoring();
    
    // Schedule regular monitoring (every 30 minutes)
    setInterval(runMonitoring, 30 * 60 * 1000);
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'audit';
  const baseUrl = args[1] || 'http://localhost:3000';
  
  const lighthouse = new LighthouseCI({
    baseUrl,
    outputDir: 'lighthouse-reports',
  });
  
  switch (command) {
    case 'audit':
      const results = await lighthouse.runComprehensiveAudit();
      const success = results.summary.failed === 0;
      process.exit(success ? 0 : 1);
      break;
      
    case 'monitor':
      await lighthouse.runContinuousMonitoring();
      break;
      
    default:
      console.log('Usage: node lighthouse-ci.js [audit|monitor] [baseUrl]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LighthouseCI;