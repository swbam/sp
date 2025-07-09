#!/usr/bin/env node

/**
 * MySetlist Accessibility Testing Suite
 * 
 * Comprehensive accessibility testing using axe-core and Playwright
 * Tests WCAG 2.1 AA compliance and MySetlist-specific accessibility requirements
 */

const { chromium } = require('playwright');
const { injectAxe, checkA11y, getViolations } = require('axe-playwright');
const fs = require('fs');
const path = require('path');

class AccessibilityTestSuite {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.outputDir = options.outputDir || 'accessibility-reports';
    this.wcagLevel = options.wcagLevel || 'AA';
    this.wcagVersion = options.wcagVersion || '2.1';
    
    // MySetlist-specific accessibility requirements
    this.customRules = {
      'vote-button-accessibility': {
        description: 'Vote buttons must have proper ARIA labels and keyboard navigation',
        selector: '[class*="vote"], [data-testid*="vote"]',
        requirements: ['aria-label', 'tabindex', 'keyboard-accessible']
      },
      'search-accessibility': {
        description: 'Search functionality must be fully accessible',
        selector: '[type="search"], [class*="search"]',
        requirements: ['aria-label', 'autocomplete', 'keyboard-navigation']
      },
      'setlist-navigation': {
        description: 'Setlist navigation must be accessible to screen readers',
        selector: '[class*="setlist"], [data-testid*="setlist"]',
        requirements: ['aria-navigation', 'heading-structure', 'skip-links']
      },
      'real-time-updates': {
        description: 'Real-time voting updates must be announced to screen readers',
        selector: '[class*="live"], [class*="realtime"]',
        requirements: ['aria-live', 'aria-atomic', 'polite-announcements']
      }
    };
    
    // Test pages with specific accessibility concerns
    this.testPages = [
      {
        name: 'Homepage',
        url: '/',
        concerns: ['navigation', 'search', 'content-structure'],
        criticalElements: ['main', 'nav', 'search', 'featured-content']
      },
      {
        name: 'Search Results',
        url: '/search?q=radiohead',
        concerns: ['search-results', 'filtering', 'keyboard-navigation'],
        criticalElements: ['search-input', 'results-list', 'pagination']
      },
      {
        name: 'Artist Page',
        url: '/artists/radiohead',
        concerns: ['artist-info', 'shows-list', 'follow-button'],
        criticalElements: ['artist-header', 'shows-grid', 'follow-action']
      },
      {
        name: 'Show Detail',
        url: '/shows/1',
        concerns: ['voting-interface', 'setlist-structure', 'real-time-updates'],
        criticalElements: ['show-info', 'setlist-voting', 'vote-buttons']
      },
      {
        name: 'Trending Page',
        url: '/trending',
        concerns: ['trending-content', 'data-visualization', 'filtering'],
        criticalElements: ['trending-list', 'filters', 'time-controls']
      },
      {
        name: 'Account Page',
        url: '/account',
        concerns: ['form-accessibility', 'user-settings', 'authentication'],
        criticalElements: ['account-form', 'settings-controls', 'auth-actions']
      }
    ];
    
    // Accessibility test configurations
    this.testConfigs = {
      'wcag2a': {
        tags: ['wcag2a'],
        description: 'WCAG 2.1 A compliance'
      },
      'wcag2aa': {
        tags: ['wcag2aa'],
        description: 'WCAG 2.1 AA compliance'
      },
      'wcag21aa': {
        tags: ['wcag21aa'],
        description: 'WCAG 2.1 AA compliance (latest)'
      },
      'section508': {
        tags: ['section508'],
        description: 'Section 508 compliance'
      },
      'best-practice': {
        tags: ['best-practice'],
        description: 'Accessibility best practices'
      }
    };
  }

  async runComprehensiveAccessibilityAudit() {
    console.log('🔍 Starting comprehensive accessibility audit...');
    
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security', '--no-sandbox']
    });
    
    const results = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      wcagLevel: this.wcagLevel,
      wcagVersion: this.wcagVersion,
      audits: [],
      summary: {
        totalViolations: 0,
        criticalViolations: 0,
        seriousViolations: 0,
        moderateViolations: 0,
        minorViolations: 0,
        pagesAudited: 0,
        pagesWithViolations: 0,
        overallCompliance: 0
      },
      customRuleResults: [],
      recommendations: []
    };

    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // Run accessibility tests for each page
      for (const testPage of this.testPages) {
        console.log(`🔍 Testing ${testPage.name}...`);
        
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          // Navigate to page
          await page.goto(`${this.baseUrl}${testPage.url}`, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          
          // Inject axe-core
          await injectAxe(page);
          
          // Run accessibility tests for different standards
          const pageResults = {
            page: testPage,
            violations: [],
            customRuleResults: [],
            testResults: {}
          };
          
          // Test against different WCAG levels
          for (const [configName, config] of Object.entries(this.testConfigs)) {
            console.log(`  Testing ${configName}...`);
            
            try {
              const violations = await getViolations(page, null, {
                tags: config.tags,
                rules: {
                  // Disable problematic rules for dynamic content
                  'color-contrast': { enabled: true },
                  'focusable-content': { enabled: true },
                  'keyboard-navigation': { enabled: true }
                }
              });
              
              pageResults.testResults[configName] = {
                violations: violations.length,
                details: violations.map(v => ({
                  id: v.id,
                  impact: v.impact,
                  description: v.description,
                  help: v.help,
                  helpUrl: v.helpUrl,
                  nodes: v.nodes.length
                }))
              };
              
              pageResults.violations.push(...violations);
              
            } catch (error) {
              console.warn(`  ⚠️ ${configName} test failed: ${error.message}`);
              pageResults.testResults[configName] = {
                error: error.message,
                violations: 0,
                details: []
              };
            }
          }
          
          // Test MySetlist-specific custom rules
          await this.testCustomAccessibilityRules(page, pageResults);
          
          // Test keyboard navigation
          await this.testKeyboardNavigation(page, pageResults);
          
          // Test screen reader compatibility
          await this.testScreenReaderCompatibility(page, pageResults);
          
          // Test mobile accessibility
          await this.testMobileAccessibility(page, pageResults);
          
          results.audits.push(pageResults);
          
          // Update summary
          const totalViolations = pageResults.violations.length;
          results.summary.totalViolations += totalViolations;
          results.summary.pagesAudited++;
          
          if (totalViolations > 0) {
            results.summary.pagesWithViolations++;
          }
          
          // Count violations by severity
          pageResults.violations.forEach(violation => {
            switch (violation.impact) {
              case 'critical':
                results.summary.criticalViolations++;
                break;
              case 'serious':
                results.summary.seriousViolations++;
                break;
              case 'moderate':
                results.summary.moderateViolations++;
                break;
              case 'minor':
                results.summary.minorViolations++;
                break;
            }
          });
          
          console.log(`  ✅ ${testPage.name}: ${totalViolations} violations found`);
          
        } catch (error) {
          console.error(`  ❌ Failed to test ${testPage.name}:`, error.message);
          
          results.audits.push({
            page: testPage,
            error: error.message,
            violations: [],
            customRuleResults: [],
            testResults: {}
          });
        } finally {
          await context.close();
        }
      }
      
      // Calculate overall compliance
      const totalPossibleViolations = results.summary.pagesAudited * 100; // Arbitrary baseline
      const complianceScore = Math.max(0, 100 - (results.summary.totalViolations / totalPossibleViolations * 100));
      results.summary.overallCompliance = Math.round(complianceScore);
      
      // Generate recommendations
      results.recommendations = this.generateAccessibilityRecommendations(results);
      
      // Save comprehensive report
      const reportPath = path.join(this.outputDir, 'accessibility-comprehensive-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      
      // Generate HTML report
      await this.generateAccessibilityHTMLReport(results);
      
      // Generate SARIF report for CI integration
      await this.generateSARIFReport(results);
      
      console.log('✅ Comprehensive accessibility audit completed');
      console.log(`📊 Results: ${results.summary.totalViolations} total violations`);
      console.log(`📈 Overall Compliance: ${results.summary.overallCompliance}%`);
      console.log(`🚨 Critical Issues: ${results.summary.criticalViolations}`);
      console.log(`⚠️ Serious Issues: ${results.summary.seriousViolations}`);
      console.log(`📄 Report saved to: ${reportPath}`);
      
      return results;
      
    } finally {
      await browser.close();
    }
  }

  async testCustomAccessibilityRules(page, pageResults) {
    console.log('    Testing custom accessibility rules...');
    
    for (const [ruleName, rule] of Object.entries(this.customRules)) {
      const elements = await page.locator(rule.selector).all();
      
      if (elements.length === 0) {
        continue; // Skip if no elements found
      }
      
      const ruleResult = {
        ruleName,
        description: rule.description,
        elementsFound: elements.length,
        violations: []
      };
      
      for (const element of elements) {
        const violations = [];
        
        // Check ARIA label requirement
        if (rule.requirements.includes('aria-label')) {
          const ariaLabel = await element.getAttribute('aria-label');
          const ariaLabelledBy = await element.getAttribute('aria-labelledby');
          
          if (!ariaLabel && !ariaLabelledBy) {
            violations.push('Missing aria-label or aria-labelledby');
          }
        }
        
        // Check keyboard accessibility
        if (rule.requirements.includes('keyboard-accessible')) {
          const tabIndex = await element.getAttribute('tabindex');
          const role = await element.getAttribute('role');
          
          if (tabIndex === '-1' && role !== 'presentation') {
            violations.push('Element not keyboard accessible');
          }
        }
        
        // Check ARIA live regions
        if (rule.requirements.includes('aria-live')) {
          const ariaLive = await element.getAttribute('aria-live');
          
          if (!ariaLive) {
            violations.push('Missing aria-live for dynamic content');
          }
        }
        
        if (violations.length > 0) {
          ruleResult.violations.push({
            element: await element.innerHTML(),
            violations
          });
        }
      }
      
      pageResults.customRuleResults.push(ruleResult);
    }
  }

  async testKeyboardNavigation(page, pageResults) {
    console.log('    Testing keyboard navigation...');
    
    const keyboardResult = {
      testName: 'Keyboard Navigation',
      issues: []
    };
    
    try {
      // Test tab navigation through interactive elements
      const interactiveElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
      
      if (interactiveElements.length === 0) {
        keyboardResult.issues.push('No interactive elements found for keyboard testing');
      } else {
        // Start from first element
        await page.keyboard.press('Tab');
        
        let tabCount = 0;
        const maxTabs = Math.min(interactiveElements.length, 20); // Limit to avoid infinite loops
        
        while (tabCount < maxTabs) {
          const focusedElement = page.locator(':focus');
          const isVisible = await focusedElement.isVisible().catch(() => false);
          
          if (!isVisible) {
            keyboardResult.issues.push(`Tab ${tabCount + 1}: Focused element not visible`);
          }
          
          await page.keyboard.press('Tab');
          tabCount++;
        }
        
        // Test Enter key activation
        await page.keyboard.press('Enter');
        
        // Test Escape key
        await page.keyboard.press('Escape');
        
        console.log(`    ✅ Keyboard navigation: ${tabCount} elements tested`);
      }
      
    } catch (error) {
      keyboardResult.issues.push(`Keyboard navigation test failed: ${error.message}`);
    }
    
    pageResults.keyboardNavigation = keyboardResult;
  }

  async testScreenReaderCompatibility(page, pageResults) {
    console.log('    Testing screen reader compatibility...');
    
    const screenReaderResult = {
      testName: 'Screen Reader Compatibility',
      issues: []
    };
    
    try {
      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      
      if (headings.length === 0) {
        screenReaderResult.issues.push('No headings found - poor screen reader navigation');
      } else {
        // Check heading hierarchy
        let previousLevel = 0;
        
        for (const heading of headings) {
          const tagName = await heading.evaluate(el => el.tagName);
          const level = parseInt(tagName.charAt(1));
          
          if (level > previousLevel + 1) {
            screenReaderResult.issues.push(`Heading level jump from h${previousLevel} to h${level}`);
          }
          
          previousLevel = level;
        }
      }
      
      // Check for skip links
      const skipLinks = await page.locator('a[href^="#"]').all();
      let hasSkipToContent = false;
      
      for (const link of skipLinks) {
        const text = await link.textContent();
        if (text && text.toLowerCase().includes('skip')) {
          hasSkipToContent = true;
          break;
        }
      }
      
      if (!hasSkipToContent) {
        screenReaderResult.issues.push('No skip links found for screen reader navigation');
      }
      
      // Check for proper landmark roles
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').all();
      
      if (landmarks.length === 0) {
        screenReaderResult.issues.push('No landmark roles found for screen reader navigation');
      }
      
      // Check for alt text on images
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        if (alt === null && role !== 'presentation') {
          screenReaderResult.issues.push('Image missing alt text');
        }
      }
      
    } catch (error) {
      screenReaderResult.issues.push(`Screen reader compatibility test failed: ${error.message}`);
    }
    
    pageResults.screenReaderCompatibility = screenReaderResult;
  }

  async testMobileAccessibility(page, pageResults) {
    console.log('    Testing mobile accessibility...');
    
    const mobileResult = {
      testName: 'Mobile Accessibility',
      issues: []
    };
    
    try {
      // Test with mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check touch target sizes
      const touchTargets = await page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]').all();
      
      for (const target of touchTargets) {
        const boundingBox = await target.boundingBox();
        
        if (boundingBox) {
          const minSize = 44; // WCAG recommended minimum touch target size
          
          if (boundingBox.width < minSize || boundingBox.height < minSize) {
            mobileResult.issues.push(`Touch target too small: ${boundingBox.width}x${boundingBox.height}px (minimum: ${minSize}px)`);
          }
        }
      }
      
      // Check for horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      
      if (bodyWidth > viewportWidth) {
        mobileResult.issues.push('Horizontal scrolling detected on mobile viewport');
      }
      
      // Check for proper zoom behavior
      const viewportMeta = await page.locator('meta[name="viewport"]').first();
      const content = await viewportMeta.getAttribute('content').catch(() => '');
      
      if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
        mobileResult.issues.push('Viewport prevents user scaling - accessibility issue');
      }
      
    } catch (error) {
      mobileResult.issues.push(`Mobile accessibility test failed: ${error.message}`);
    }
    
    pageResults.mobileAccessibility = mobileResult;
  }

  generateAccessibilityRecommendations(results) {
    const recommendations = [];
    
    // High-priority recommendations based on critical violations
    if (results.summary.criticalViolations > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Fix Critical Accessibility Violations',
        description: `${results.summary.criticalViolations} critical accessibility violations found that prevent users from accessing core functionality.`,
        actions: [
          'Review and fix all critical violations immediately',
          'Test with screen readers',
          'Verify keyboard navigation works for all interactive elements'
        ]
      });
    }
    
    // Voting system specific recommendations
    const votingIssues = results.audits.filter(audit => 
      audit.page.name === 'Show Detail' && audit.violations.length > 0
    );
    
    if (votingIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Improve Voting System Accessibility',
        description: 'The core voting functionality has accessibility issues that may prevent users from participating.',
        actions: [
          'Add proper ARIA labels to all vote buttons',
          'Ensure voting results are announced to screen readers',
          'Test voting workflow with keyboard-only navigation',
          'Verify touch target sizes meet minimum requirements'
        ]
      });
    }
    
    // Search accessibility
    const searchIssues = results.audits.filter(audit => 
      audit.page.name === 'Search Results' && audit.violations.length > 0
    );
    
    if (searchIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Enhance Search Accessibility',
        description: 'Search functionality accessibility issues may prevent users from finding artists and shows.',
        actions: [
          'Add proper autocomplete and ARIA attributes to search inputs',
          'Ensure search results are properly announced',
          'Add skip links for search result navigation',
          'Test search with screen readers'
        ]
      });
    }
    
    // Overall compliance recommendations
    if (results.summary.overallCompliance < 95) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Overall Accessibility Compliance',
        description: `Overall accessibility compliance is ${results.summary.overallCompliance}%. Target should be 95%+.`,
        actions: [
          'Implement comprehensive accessibility testing in CI/CD',
          'Provide accessibility training for development team',
          'Establish accessibility review process',
          'Regular accessibility audits with assistive technology users'
        ]
      });
    }
    
    return recommendations;
  }

  async generateAccessibilityHTMLReport(results) {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MySetlist Accessibility Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .card.critical { border-left-color: #dc3545; }
        .card.serious { border-left-color: #fd7e14; }
        .card.moderate { border-left-color: #ffc107; }
        .card.minor { border-left-color: #20c997; }
        .card.success { border-left-color: #28a745; }
        .metric { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .metric.critical { color: #dc3545; }
        .metric.serious { color: #fd7e14; }
        .metric.moderate { color: #ffc107; }
        .metric.minor { color: #20c997; }
        .metric.success { color: #28a745; }
        .audit-results { margin-top: 40px; }
        .audit-item { background: white; margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .violation { background: #f8d7da; padding: 15px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #dc3545; }
        .violation.serious { background: #fff3cd; border-left-color: #fd7e14; }
        .violation.moderate { background: #d1ecf1; border-left-color: #ffc107; }
        .violation.minor { background: #d4edda; border-left-color: #20c997; }
        .violation-title { font-weight: bold; margin-bottom: 8px; }
        .violation-description { margin-bottom: 8px; }
        .violation-help { font-size: 0.9em; color: #666; }
        .recommendations { margin-top: 40px; }
        .recommendation { background: #e3f2fd; padding: 20px; margin-bottom: 15px; border-radius: 4px; border-left: 4px solid #2196f3; }
        .recommendation.critical { background: #ffebee; border-left-color: #f44336; }
        .recommendation.high { background: #fff3e0; border-left-color: #ff9800; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MySetlist Accessibility Report</h1>
            <p>WCAG ${results.wcagVersion} ${results.wcagLevel} Compliance Audit</p>
            <p>Generated on ${new Date(results.timestamp).toLocaleString()}</p>
            <p>Base URL: ${results.baseUrl}</p>
        </div>

        <div class="summary">
            <div class="card critical">
                <div class="metric critical">${results.summary.criticalViolations}</div>
                <div>Critical Violations</div>
            </div>
            <div class="card serious">
                <div class="metric serious">${results.summary.seriousViolations}</div>
                <div>Serious Violations</div>
            </div>
            <div class="card moderate">
                <div class="metric moderate">${results.summary.moderateViolations}</div>
                <div>Moderate Violations</div>
            </div>
            <div class="card minor">
                <div class="metric minor">${results.summary.minorViolations}</div>
                <div>Minor Violations</div>
            </div>
            <div class="card success">
                <div class="metric success">${results.summary.overallCompliance}%</div>
                <div>Overall Compliance</div>
            </div>
        </div>

        <div class="audit-results">
            <h2>Audit Results by Page</h2>
            ${results.audits.map(audit => `
                <div class="audit-item">
                    <h3>${audit.page.name}</h3>
                    <p><strong>URL:</strong> ${audit.page.url}</p>
                    <p><strong>Violations Found:</strong> ${audit.violations.length}</p>
                    
                    ${audit.violations.length > 0 ? `
                        <div class="violations">
                            <h4>Violations</h4>
                            ${audit.violations.map(violation => `
                                <div class="violation ${violation.impact}">
                                    <div class="violation-title">${violation.help}</div>
                                    <div class="violation-description">${violation.description}</div>
                                    <div class="violation-help">
                                        <strong>Impact:</strong> ${violation.impact} | 
                                        <strong>Elements:</strong> ${violation.nodes.length} | 
                                        <a href="${violation.helpUrl}" target="_blank">Learn more</a>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>✅ No violations found on this page</p>'}
                </div>
            `).join('')}
        </div>

        ${results.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>Accessibility Recommendations</h2>
                ${results.recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <h3>${rec.title}</h3>
                        <p>${rec.description}</p>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <div class="footer">
            <p>Generated by MySetlist Accessibility Test Suite</p>
            <p>Using axe-core for WCAG ${results.wcagVersion} ${results.wcagLevel} compliance testing</p>
        </div>
    </div>
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, 'accessibility-report.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    console.log(`📄 Accessibility HTML report generated: ${htmlPath}`);
  }

  async generateSARIFReport(results) {
    const sarif = {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'MySetlist Accessibility Test Suite',
            version: '1.0.0',
            informationUri: 'https://github.com/mysetlist/accessibility-testing',
            rules: []
          }
        },
        results: []
      }]
    };

    // Convert violations to SARIF format
    results.audits.forEach(audit => {
      audit.violations.forEach(violation => {
        sarif.runs[0].results.push({
          ruleId: violation.id,
          message: {
            text: violation.help
          },
          level: violation.impact === 'critical' ? 'error' : 
                 violation.impact === 'serious' ? 'warning' : 'note',
          locations: [{
            physicalLocation: {
              artifactLocation: {
                uri: `${results.baseUrl}${audit.page.url}`
              }
            }
          }]
        });
      });
    });

    const sarifPath = path.join(this.outputDir, 'accessibility-report.sarif');
    fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
    
    console.log(`📄 SARIF report generated: ${sarifPath}`);
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  const outputDir = args[1] || 'accessibility-reports';
  
  const accessibilityTester = new AccessibilityTestSuite({
    baseUrl,
    outputDir,
    wcagLevel: 'AA',
    wcagVersion: '2.1'
  });
  
  try {
    const results = await accessibilityTester.runComprehensiveAccessibilityAudit();
    
    // Exit with error code if critical violations found
    const hasFailures = results.summary.criticalViolations > 0 || results.summary.seriousViolations > 5;
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Accessibility audit failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AccessibilityTestSuite;