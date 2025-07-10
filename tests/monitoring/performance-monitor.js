#!/usr/bin/env node

/**
 * MySetlist Production Performance Monitoring & Alerting System
 * 
 * Continuous monitoring of Core Web Vitals, API performance, and system health
 * with intelligent alerting and automated regression detection
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ProductionPerformanceMonitor {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://mysetlist.vercel.app';
    this.alertThresholds = options.alertThresholds || this.getDefaultAlertThresholds();
    this.monitoringInterval = options.monitoringInterval || 5 * 60 * 1000; // 5 minutes
    this.retentionPeriod = options.retentionPeriod || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.outputDir = options.outputDir || 'performance-monitoring';
    
    this.metrics = {
      coreWebVitals: [],
      apiPerformance: [],
      systemHealth: [],
      userExperience: [],
      errorRates: []
    };
    
    this.alertHistory = [];
    this.isMonitoring = false;
    
    // Performance regression detection
    this.baselineMetrics = null;
    this.regressionThreshold = 0.2; // 20% regression threshold
  }

  getDefaultAlertThresholds() {
    return {
      // Core Web Vitals thresholds
      lcp: { good: 2500, poor: 4000 },           // Largest Contentful Paint
      fcp: { good: 1800, poor: 3000 },           // First Contentful Paint
      cls: { good: 0.1, poor: 0.25 },            // Cumulative Layout Shift
      fid: { good: 100, poor: 300 },             // First Input Delay
      inp: { good: 200, poor: 500 },             // Interaction to Next Paint
      ttfb: { good: 800, poor: 1800 },           // Time to First Byte
      
      // API Performance thresholds
      apiResponse: { good: 500, poor: 2000 },     // API response time
      apiError: { good: 0.01, poor: 0.05 },      // API error rate
      
      // System Health thresholds
      uptime: { good: 99.9, poor: 99.0 },        // Uptime percentage
      memoryUsage: { good: 70, poor: 90 },        // Memory usage percentage
      cpuUsage: { good: 70, poor: 90 },           // CPU usage percentage
      
      // User Experience thresholds
      bounceRate: { good: 30, poor: 60 },         // Bounce rate percentage
      sessionDuration: { good: 180, poor: 60 },   // Session duration seconds
      
      // Voting System specific
      votingLatency: { good: 200, poor: 500 },    // Voting response time
      votingErrors: { good: 0.005, poor: 0.02 },  // Voting error rate
      
      // Real-time features
      realtimeLatency: { good: 100, poor: 300 },  // Real-time update latency
      connectionErrors: { good: 0.01, poor: 0.05 } // WebSocket connection errors
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting MySetlist production performance monitoring...');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Load baseline metrics if they exist
    await this.loadBaselineMetrics();

    // Start monitoring loops
    this.startCoreWebVitalsMonitoring();
    this.startAPIPerformanceMonitoring();
    this.startSystemHealthMonitoring();
    this.startUserExperienceMonitoring();
    this.startRegressionDetection();

    // Setup cleanup interval
    setInterval(() => this.cleanupOldData(), 60 * 60 * 1000); // Cleanup every hour

    console.log('✅ Performance monitoring started');
    console.log(`📊 Monitoring: ${this.baseUrl}`);
    console.log(`⏱️ Interval: ${this.monitoringInterval / 1000}s`);
  }

  async stopMonitoring() {
    this.isMonitoring = false;
    console.log('🛑 Performance monitoring stopped');
  }

  async startCoreWebVitalsMonitoring() {
    const monitorCoreWebVitals = async () => {
      if (!this.isMonitoring) return;

      console.log('📊 Monitoring Core Web Vitals...');
      
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });

      try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Test critical pages
        const testPages = [
          { name: 'Homepage', url: '/' },
          { name: 'Search', url: '/search' },
          { name: 'Artist', url: '/artists/radiohead' },
          { name: 'Show', url: '/shows/1' },
          { name: 'Trending', url: '/trending' }
        ];

        for (const testPage of testPages) {
          try {
            const startTime = Date.now();
            
            // Navigate to page
            await page.goto(`${this.baseUrl}${testPage.url}`, {
              waitUntil: 'networkidle',
              timeout: 30000
            });

            // Collect Core Web Vitals
            const webVitals = await page.evaluate(() => {
              return new Promise((resolve) => {
                const vitals = {};
                
                // Get First Contentful Paint
                const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
                if (fcpEntry) {
                  vitals.fcp = fcpEntry.startTime;
                }

                // Get Largest Contentful Paint
                const observer = new PerformanceObserver((list) => {
                  const entries = list.getEntries();
                  if (entries.length > 0) {
                    vitals.lcp = entries[entries.length - 1].startTime;
                  }
                });

                observer.observe({ entryTypes: ['largest-contentful-paint'] });

                // Get Time to First Byte
                const navigationEntry = performance.getEntriesByType('navigation')[0];
                if (navigationEntry) {
                  vitals.ttfb = navigationEntry.responseStart;
                }

                // Get Cumulative Layout Shift
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

                // Get First Input Delay (if available)
                const fidObserver = new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    vitals.fid = entry.processingStart - entry.startTime;
                  }
                });

                fidObserver.observe({ entryTypes: ['first-input'] });

                // Wait for metrics to be collected
                setTimeout(() => {
                  resolve(vitals);
                }, 2000);
              });
            });

            const endTime = Date.now();
            const totalLoadTime = endTime - startTime;

            const metric = {
              timestamp: new Date().toISOString(),
              page: testPage.name,
              url: testPage.url,
              totalLoadTime,
              ...webVitals
            };

            this.metrics.coreWebVitals.push(metric);

            // Check for alerts
            await this.checkCoreWebVitalsAlerts(metric);

            console.log(`  ✅ ${testPage.name}: LCP=${webVitals.lcp?.toFixed(0)}ms, FCP=${webVitals.fcp?.toFixed(0)}ms, CLS=${webVitals.cls?.toFixed(3)}`);

          } catch (error) {
            console.error(`  ❌ Failed to monitor ${testPage.name}:`, error.message);
            
            // Record error metric
            this.metrics.coreWebVitals.push({
              timestamp: new Date().toISOString(),
              page: testPage.name,
              url: testPage.url,
              error: error.message,
              totalLoadTime: -1
            });
          }
        }

        await context.close();
      } finally {
        await browser.close();
      }

      // Schedule next monitoring cycle
      setTimeout(monitorCoreWebVitals, this.monitoringInterval);
    };

    // Start monitoring
    monitorCoreWebVitals();
  }

  async startAPIPerformanceMonitoring() {
    const monitorAPIPerformance = async () => {
      if (!this.isMonitoring) return;

      console.log('🔧 Monitoring API Performance...');

      const apiEndpoints = [
        { name: 'Artists Search', url: '/api/search/artists?q=radiohead' },
        { name: 'Shows List', url: '/api/shows' },
        { name: 'Trending', url: '/api/trending' },
        { name: 'Featured', url: '/api/featured' },
        { name: 'Stats', url: '/api/stats' },
        { name: 'Vote Submission', url: '/api/votes', method: 'POST' },
        { name: 'Health Check', url: '/api/sync/health' }
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const startTime = Date.now();
          
          const options = {
            method: endpoint.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MySetlist-Performance-Monitor/1.0'
            }
          };

          if (endpoint.method === 'POST') {
            options.body = JSON.stringify({
              setlist_song_id: 'test-song-id',
              vote_type: 'up'
            });
          }

          const response = await fetch(`${this.baseUrl}${endpoint.url}`, options);
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          const metric = {
            timestamp: new Date().toISOString(),
            endpoint: endpoint.name,
            url: endpoint.url,
            method: endpoint.method || 'GET',
            responseTime,
            status: response.status,
            ok: response.ok,
            contentLength: response.headers.get('content-length'),
            cacheControl: response.headers.get('cache-control')
          };

          this.metrics.apiPerformance.push(metric);

          // Check for alerts
          await this.checkAPIPerformanceAlerts(metric);

          console.log(`  ✅ ${endpoint.name}: ${responseTime}ms (${response.status})`);

        } catch (error) {
          console.error(`  ❌ Failed to monitor ${endpoint.name}:`, error.message);
          
          // Record error metric
          this.metrics.apiPerformance.push({
            timestamp: new Date().toISOString(),
            endpoint: endpoint.name,
            url: endpoint.url,
            method: endpoint.method || 'GET',
            error: error.message,
            responseTime: -1,
            status: 0,
            ok: false
          });

          // API error is a critical alert
          await this.sendAlert('critical', `API Endpoint Down: ${endpoint.name}`, {
            endpoint: endpoint.name,
            error: error.message,
            url: endpoint.url
          });
        }
      }

      // Schedule next monitoring cycle
      setTimeout(monitorAPIPerformance, this.monitoringInterval);
    };

    // Start monitoring
    monitorAPIPerformance();
  }

  async startSystemHealthMonitoring() {
    const monitorSystemHealth = async () => {
      if (!this.isMonitoring) return;

      console.log('🏥 Monitoring System Health...');

      try {
        // Monitor health endpoint
        const healthResponse = await fetch(`${this.baseUrl}/api/sync/health`);
        const healthData = await healthResponse.json();

        const metric = {
          timestamp: new Date().toISOString(),
          uptime: healthData.uptime || 0,
          memoryUsage: healthData.memoryUsage || 0,
          cpuUsage: healthData.cpuUsage || 0,
          activeConnections: healthData.activeConnections || 0,
          databaseConnections: healthData.databaseConnections || 0,
          responseTime: healthData.responseTime || 0
        };

        this.metrics.systemHealth.push(metric);

        // Check for system health alerts
        await this.checkSystemHealthAlerts(metric);

        console.log(`  ✅ System Health: Memory=${metric.memoryUsage}%, CPU=${metric.cpuUsage}%`);

      } catch (error) {
        console.error(`  ❌ Failed to monitor system health:`, error.message);
        
        // System health check failure is critical
        await this.sendAlert('critical', 'System Health Check Failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Schedule next monitoring cycle
      setTimeout(monitorSystemHealth, this.monitoringInterval);
    };

    // Start monitoring
    monitorSystemHealth();
  }

  async startUserExperienceMonitoring() {
    const monitorUserExperience = async () => {
      if (!this.isMonitoring) return;

      console.log('👥 Monitoring User Experience...');

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });

      try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Simulate user journey
        const userJourney = [
          { action: 'homepage', url: '/' },
          { action: 'search', url: '/search?q=radiohead' },
          { action: 'artist', url: '/artists/radiohead' },
          { action: 'show', url: '/shows/1' },
          { action: 'vote', url: '/shows/1', interaction: 'vote' }
        ];

        const journeyStartTime = Date.now();
        let stepTimes = [];

        for (const step of userJourney) {
          try {
            const stepStartTime = Date.now();
            
            await page.goto(`${this.baseUrl}${step.url}`, {
              waitUntil: 'networkidle',
              timeout: 30000
            });

            // Perform interaction if specified
            if (step.interaction === 'vote') {
              const voteButton = page.locator('[class*="vote"], [data-testid*="vote"]').first();
              const hasVoteButton = await voteButton.isVisible().catch(() => false);
              
              if (hasVoteButton) {
                await voteButton.click();
                await page.waitForTimeout(1000);
              }
            }

            const stepEndTime = Date.now();
            const stepDuration = stepEndTime - stepStartTime;
            
            stepTimes.push({
              action: step.action,
              duration: stepDuration,
              timestamp: new Date().toISOString()
            });

            console.log(`  ✅ ${step.action}: ${stepDuration}ms`);

          } catch (error) {
            console.error(`  ❌ Failed user journey step ${step.action}:`, error.message);
            
            stepTimes.push({
              action: step.action,
              duration: -1,
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        }

        const journeyEndTime = Date.now();
        const totalJourneyTime = journeyEndTime - journeyStartTime;

        const metric = {
          timestamp: new Date().toISOString(),
          totalJourneyTime,
          stepTimes,
          completionRate: stepTimes.filter(s => s.duration > 0).length / stepTimes.length
        };

        this.metrics.userExperience.push(metric);

        // Check for user experience alerts
        await this.checkUserExperienceAlerts(metric);

        console.log(`  ✅ User Journey: ${totalJourneyTime}ms total, ${(metric.completionRate * 100).toFixed(1)}% completion`);

        await context.close();
      } finally {
        await browser.close();
      }

      // Schedule next monitoring cycle
      setTimeout(monitorUserExperience, this.monitoringInterval * 2); // Less frequent
    };

    // Start monitoring
    monitorUserExperience();
  }

  async startRegressionDetection() {
    const detectRegressions = async () => {
      if (!this.isMonitoring) return;

      console.log('🔍 Detecting Performance Regressions...');

      try {
        // Analyze recent metrics for regressions
        const recentMetrics = this.getRecentMetrics(30 * 60 * 1000); // Last 30 minutes
        
        if (this.baselineMetrics && recentMetrics.length > 0) {
          const regressions = this.analyzeForRegressions(recentMetrics);
          
          for (const regression of regressions) {
            await this.sendAlert('warning', `Performance Regression Detected: ${regression.metric}`, regression);
          }
        }

        // Update baseline metrics periodically
        if (this.shouldUpdateBaseline()) {
          await this.updateBaselineMetrics();
        }

      } catch (error) {
        console.error('  ❌ Failed to detect regressions:', error.message);
      }

      // Schedule next regression detection
      setTimeout(detectRegressions, this.monitoringInterval);
    };

    // Start regression detection
    detectRegressions();
  }

  async checkCoreWebVitalsAlerts(metric) {
    const thresholds = this.alertThresholds;
    
    // Check LCP
    if (metric.lcp && metric.lcp > thresholds.lcp.poor) {
      await this.sendAlert('warning', `Poor LCP on ${metric.page}`, {
        page: metric.page,
        lcp: metric.lcp,
        threshold: thresholds.lcp.poor
      });
    }

    // Check FCP
    if (metric.fcp && metric.fcp > thresholds.fcp.poor) {
      await this.sendAlert('warning', `Poor FCP on ${metric.page}`, {
        page: metric.page,
        fcp: metric.fcp,
        threshold: thresholds.fcp.poor
      });
    }

    // Check CLS
    if (metric.cls && metric.cls > thresholds.cls.poor) {
      await this.sendAlert('warning', `Poor CLS on ${metric.page}`, {
        page: metric.page,
        cls: metric.cls,
        threshold: thresholds.cls.poor
      });
    }
  }

  async checkAPIPerformanceAlerts(metric) {
    const thresholds = this.alertThresholds;
    
    // Check response time
    if (metric.responseTime > thresholds.apiResponse.poor) {
      await this.sendAlert('warning', `Slow API Response: ${metric.endpoint}`, {
        endpoint: metric.endpoint,
        responseTime: metric.responseTime,
        threshold: thresholds.apiResponse.poor
      });
    }

    // Check for errors
    if (!metric.ok) {
      await this.sendAlert('critical', `API Error: ${metric.endpoint}`, {
        endpoint: metric.endpoint,
        status: metric.status,
        responseTime: metric.responseTime
      });
    }
  }

  async checkSystemHealthAlerts(metric) {
    const thresholds = this.alertThresholds;
    
    // Check memory usage
    if (metric.memoryUsage > thresholds.memoryUsage.poor) {
      await this.sendAlert('warning', 'High Memory Usage', {
        memoryUsage: metric.memoryUsage,
        threshold: thresholds.memoryUsage.poor
      });
    }

    // Check CPU usage
    if (metric.cpuUsage > thresholds.cpuUsage.poor) {
      await this.sendAlert('warning', 'High CPU Usage', {
        cpuUsage: metric.cpuUsage,
        threshold: thresholds.cpuUsage.poor
      });
    }
  }

  async checkUserExperienceAlerts(metric) {
    // Check completion rate
    if (metric.completionRate < 0.8) {
      await this.sendAlert('warning', 'Low User Journey Completion Rate', {
        completionRate: metric.completionRate,
        totalJourneyTime: metric.totalJourneyTime
      });
    }

    // Check total journey time
    if (metric.totalJourneyTime > 30000) { // 30 seconds
      await this.sendAlert('warning', 'Slow User Journey', {
        totalJourneyTime: metric.totalJourneyTime,
        completionRate: metric.completionRate
      });
    }
  }

  async sendAlert(level, message, details = {}) {
    const alert = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.alertHistory.push(alert);
    
    // Log alert
    const levelEmoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${levelEmoji} ALERT [${level.toUpperCase()}]: ${message}`);
    console.log(`   Details:`, details);

    // Save alert to file
    const alertsFile = path.join(this.outputDir, 'alerts.json');
    fs.writeFileSync(alertsFile, JSON.stringify(this.alertHistory, null, 2));

    // In production, you would send alerts to:
    // - Slack/Discord webhook
    // - Email notifications
    // - PagerDuty/Opsgenie
    // - Custom alerting system
    
    return alert;
  }

  getRecentMetrics(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.coreWebVitals.filter(m => 
      new Date(m.timestamp).getTime() > cutoff
    );
  }

  analyzeForRegressions(recentMetrics) {
    const regressions = [];
    
    if (!this.baselineMetrics) return regressions;

    // Analyze LCP regression
    const recentLCP = recentMetrics.filter(m => m.lcp).map(m => m.lcp);
    if (recentLCP.length > 0) {
      const avgLCP = recentLCP.reduce((a, b) => a + b, 0) / recentLCP.length;
      const baselineLCP = this.baselineMetrics.lcp;
      
      if (baselineLCP && avgLCP > baselineLCP * (1 + this.regressionThreshold)) {
        regressions.push({
          metric: 'LCP',
          baseline: baselineLCP,
          current: avgLCP,
          regression: ((avgLCP - baselineLCP) / baselineLCP * 100).toFixed(1) + '%'
        });
      }
    }

    // Analyze FCP regression
    const recentFCP = recentMetrics.filter(m => m.fcp).map(m => m.fcp);
    if (recentFCP.length > 0) {
      const avgFCP = recentFCP.reduce((a, b) => a + b, 0) / recentFCP.length;
      const baselineFCP = this.baselineMetrics.fcp;
      
      if (baselineFCP && avgFCP > baselineFCP * (1 + this.regressionThreshold)) {
        regressions.push({
          metric: 'FCP',
          baseline: baselineFCP,
          current: avgFCP,
          regression: ((avgFCP - baselineFCP) / baselineFCP * 100).toFixed(1) + '%'
        });
      }
    }

    return regressions;
  }

  shouldUpdateBaseline() {
    // Update baseline every 24 hours
    const lastUpdate = this.baselineMetrics?.timestamp || 0;
    return Date.now() - lastUpdate > 24 * 60 * 60 * 1000;
  }

  async updateBaselineMetrics() {
    console.log('📊 Updating baseline metrics...');
    
    const recentMetrics = this.getRecentMetrics(60 * 60 * 1000); // Last hour
    
    if (recentMetrics.length > 0) {
      const lcpValues = recentMetrics.filter(m => m.lcp).map(m => m.lcp);
      const fcpValues = recentMetrics.filter(m => m.fcp).map(m => m.fcp);
      const clsValues = recentMetrics.filter(m => m.cls).map(m => m.cls);
      
      this.baselineMetrics = {
        timestamp: Date.now(),
        lcp: lcpValues.length > 0 ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length : null,
        fcp: fcpValues.length > 0 ? fcpValues.reduce((a, b) => a + b, 0) / fcpValues.length : null,
        cls: clsValues.length > 0 ? clsValues.reduce((a, b) => a + b, 0) / clsValues.length : null
      };
      
      await this.saveBaselineMetrics();
      console.log('✅ Baseline metrics updated');
    }
  }

  async loadBaselineMetrics() {
    const baselineFile = path.join(this.outputDir, 'baseline-metrics.json');
    
    if (fs.existsSync(baselineFile)) {
      try {
        const data = fs.readFileSync(baselineFile, 'utf8');
        this.baselineMetrics = JSON.parse(data);
        console.log('📊 Loaded baseline metrics');
      } catch (error) {
        console.warn('⚠️ Failed to load baseline metrics:', error.message);
      }
    }
  }

  async saveBaselineMetrics() {
    const baselineFile = path.join(this.outputDir, 'baseline-metrics.json');
    fs.writeFileSync(baselineFile, JSON.stringify(this.baselineMetrics, null, 2));
  }

  cleanupOldData() {
    const cutoff = Date.now() - this.retentionPeriod;
    
    // Clean up old metrics
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = this.metrics[key].filter(m => 
        new Date(m.timestamp).getTime() > cutoff
      );
    });
    
    // Clean up old alerts
    this.alertHistory = this.alertHistory.filter(a => 
      new Date(a.timestamp).getTime() > cutoff
    );
    
    console.log('🧹 Cleaned up old monitoring data');
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      monitoringPeriod: this.monitoringInterval,
      metrics: {
        coreWebVitals: this.metrics.coreWebVitals.slice(-100), // Last 100 measurements
        apiPerformance: this.metrics.apiPerformance.slice(-100),
        systemHealth: this.metrics.systemHealth.slice(-100),
        userExperience: this.metrics.userExperience.slice(-20)
      },
      alerts: this.alertHistory.slice(-50), // Last 50 alerts
      baselineMetrics: this.baselineMetrics
    };

    const reportFile = path.join(this.outputDir, `monitoring-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Monitoring report generated: ${reportFile}`);
    return report;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  const baseUrl = args[1] || 'https://mysetlist.vercel.app';
  
  const monitor = new ProductionPerformanceMonitor({
    baseUrl,
    monitoringInterval: 5 * 60 * 1000, // 5 minutes
    outputDir: 'performance-monitoring'
  });
  
  switch (command) {
    case 'start':
      await monitor.startMonitoring();
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down monitoring...');
        await monitor.stopMonitoring();
        process.exit(0);
      });
      
      break;
      
    case 'report':
      const report = await monitor.generateReport();
      console.log('📊 Report generated successfully');
      break;
      
    default:
      console.log('Usage: node performance-monitor.js [start|report] [baseUrl]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProductionPerformanceMonitor;