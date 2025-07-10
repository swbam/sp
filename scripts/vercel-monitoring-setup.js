#!/usr/bin/env node

/**
 * Vercel Analytics & Monitoring Setup Script
 * Configures comprehensive monitoring with Vercel Analytics and Speed Insights
 */

const fs = require('fs');
const path = require('path');

// Generate Vercel Analytics configuration
function generateVercelAnalyticsConfig() {
  console.log('🔧 Generating Vercel Analytics configuration...');

  const analyticsConfigPath = path.join(__dirname, '..', 'lib', 'vercel-analytics.js');
  const analyticsConfig = `
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Vercel Analytics Configuration
 */
export const VercelAnalyticsConfig = {
  // Analytics settings
  analytics: {
    enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production',
    debug: process.env.NODE_ENV === 'development',
    beforeSend: (event) => {
      // Filter out internal events
      if (event.url?.includes('/_next/') || event.url?.includes('/api/internal/')) {
        return null;
      }
      return event;
    },
  },
  
  // Speed Insights settings
  speedInsights: {
    enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production',
    debug: process.env.NODE_ENV === 'development',
    sampleRate: 1.0, // 100% sampling in production
  },
};

/**
 * Analytics Provider Component
 */
export function AnalyticsProvider({ children }) {
  return (
    <>
      {children}
      {VercelAnalyticsConfig.analytics.enabled && (
        <Analytics
          debug={VercelAnalyticsConfig.analytics.debug}
          beforeSend={VercelAnalyticsConfig.analytics.beforeSend}
        />
      )}
      {VercelAnalyticsConfig.speedInsights.enabled && (
        <SpeedInsights
          debug={VercelAnalyticsConfig.speedInsights.debug}
          sampleRate={VercelAnalyticsConfig.speedInsights.sampleRate}
        />
      )}
    </>
  );
}

/**
 * Custom Analytics Tracking
 */
export const track = (event, properties = {}) => {
  if (typeof window !== 'undefined' && window.va) {
    window.va('track', event, {
      ...properties,
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer,
    });
  }
};

/**
 * Page view tracking
 */
export const trackPageView = (path, properties = {}) => {
  track('pageview', {
    path,
    title: document.title,
    ...properties,
  });
};

/**
 * User interaction tracking
 */
export const trackInteraction = (element, action, properties = {}) => {
  track('interaction', {
    element,
    action,
    ...properties,
  });
};

/**
 * Search tracking
 */
export const trackSearch = (query, results = 0, properties = {}) => {
  track('search', {
    query,
    results,
    ...properties,
  });
};

/**
 * Vote tracking
 */
export const trackVote = (action, showId, songId, properties = {}) => {
  track('vote', {
    action,
    showId,
    songId,
    ...properties,
  });
};

/**
 * Error tracking
 */
export const trackError = (error, properties = {}) => {
  track('error', {
    message: error.message,
    stack: error.stack,
    ...properties,
  });
};

/**
 * Performance tracking
 */
export const trackPerformance = (metric, value, properties = {}) => {
  track('performance', {
    metric,
    value,
    ...properties,
  });
};

/**
 * Conversion tracking
 */
export const trackConversion = (event, value, properties = {}) => {
  track('conversion', {
    event,
    value,
    ...properties,
  });
};

export default {
  AnalyticsProvider,
  track,
  trackPageView,
  trackInteraction,
  trackSearch,
  trackVote,
  trackError,
  trackPerformance,
  trackConversion,
};
`;

  // Ensure lib directory exists
  const libDir = path.join(__dirname, '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  fs.writeFileSync(analyticsConfigPath, analyticsConfig.trim());
  console.log('✅ Vercel Analytics configuration generated successfully');
}

// Generate monitoring dashboard configuration
function generateMonitoringDashboard() {
  console.log('🔧 Generating monitoring dashboard configuration...');

  const dashboardConfigPath = path.join(__dirname, '..', 'lib', 'monitoring-dashboard.js');
  const dashboardConfig = `
import { useState, useEffect } from 'react';

/**
 * Monitoring Dashboard Hook
 */
export function useMonitoringDashboard() {
  const [metrics, setMetrics] = useState({
    pageViews: 0,
    uniqueVisitors: 0,
    avgResponseTime: 0,
    errorRate: 0,
    conversionRate: 0,
    topPages: [],
    topErrors: [],
    performanceMetrics: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, error, refresh: fetchMetrics };
}

/**
 * Real-time Metrics Hook
 */
export function useRealTimeMetrics() {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    currentPageViews: 0,
    responseTime: 0,
    errorCount: 0,
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/monitoring/realtime');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data);
    };

    return () => eventSource.close();
  }, []);

  return metrics;
}

/**
 * Performance Metrics Hook
 */
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState({
    cls: 0,
    fcp: 0,
    fid: 0,
    lcp: 0,
    ttfb: 0,
    vitals: {},
  });

  useEffect(() => {
    // Collect Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          setMetrics(prev => ({ ...prev, lcp: entry.startTime }));
        }
        if (entry.entryType === 'first-input') {
          setMetrics(prev => ({ ...prev, fid: entry.processingStart - entry.startTime }));
        }
        if (entry.entryType === 'first-contentful-paint') {
          setMetrics(prev => ({ ...prev, fcp: entry.startTime }));
        }
        if (entry.entryType === 'layout-shift') {
          setMetrics(prev => ({ ...prev, cls: prev.cls + entry.value }));
        }
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'first-contentful-paint', 'layout-shift'] });

    return () => observer.disconnect();
  }, []);

  return metrics;
}

/**
 * Alert Configuration
 */
export const AlertConfig = {
  thresholds: {
    errorRate: 5, // 5% error rate
    responseTime: 2000, // 2 seconds
    conversionDrop: 20, // 20% drop in conversion
    availabilityDrop: 99, // Below 99% availability
  },
  
  channels: {
    email: {
      enabled: true,
      recipients: ['admin@mysetlist.com'],
    },
    slack: {
      enabled: true,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#alerts',
    },
    sms: {
      enabled: false,
      numbers: [],
    },
  },
  
  schedules: {
    maintenanceWindow: {
      start: '02:00',
      end: '04:00',
      timezone: 'UTC',
      days: ['sunday'],
    },
  },
};

/**
 * Custom Dashboard Components
 */
export function MetricCard({ title, value, change, trend, color = 'blue' }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={\`text-right text-sm text-\${color}-600\`}>
          <p>{change}</p>
          <p className="text-xs text-gray-500">{trend}</p>
        </div>
      </div>
    </div>
  );
}

export function AlertsBanner({ alerts = [] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="space-y-1">
              {alerts.map((alert, index) => (
                <li key={index}>• {alert.message}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PerformanceChart({ data, metric, timeRange = '24h' }) {
  // This would integrate with a charting library like Chart.js or D3
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {metric} - Last {timeRange}
      </h3>
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
        <p className="text-gray-500">Chart would render here</p>
      </div>
    </div>
  );
}

export default {
  useMonitoringDashboard,
  useRealTimeMetrics,
  usePerformanceMetrics,
  AlertConfig,
  MetricCard,
  AlertsBanner,
  PerformanceChart,
};
`;

  fs.writeFileSync(dashboardConfigPath, dashboardConfig.trim());
  console.log('✅ Monitoring dashboard configuration generated successfully');
}

// Generate monitoring API endpoints
function generateMonitoringAPI() {
  console.log('🔧 Generating monitoring API endpoints...');

  const apiDir = path.join(__dirname, '..', 'app', 'api', 'monitoring');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Metrics endpoint
  const metricsEndpoint = path.join(apiDir, 'metrics', 'route.ts');
  const metricsDir = path.join(apiDir, 'metrics');
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const metricsContent = `
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Monitoring Metrics API Endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');
    
    // Validate authorization
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Collect metrics from various sources
    const metrics = await collectMetrics();
    
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function collectMetrics() {
  // This would integrate with your actual metrics collection system
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  return {
    timestamp: now,
    pageViews: {
      total: 15420,
      unique: 8750,
      change: '+5.2%',
      trend: 'up',
    },
    performance: {
      avgResponseTime: 245,
      p95ResponseTime: 850,
      p99ResponseTime: 1200,
      change: '-12ms',
      trend: 'down',
    },
    errors: {
      total: 23,
      rate: 0.15,
      change: '-0.03%',
      trend: 'down',
    },
    availability: {
      uptime: 99.97,
      downtime: 2.7,
      change: '+0.01%',
      trend: 'up',
    },
    database: {
      connections: 45,
      queryTime: 12.5,
      slowQueries: 3,
    },
    api: {
      requests: 45230,
      errors: 67,
      rateLimit: 150,
    },
    topPages: [
      { path: '/', views: 5420, change: '+8.2%' },
      { path: '/search', views: 3210, change: '+12.1%' },
      { path: '/trending', views: 2890, change: '+3.4%' },
    ],
    topErrors: [
      { message: 'Database connection timeout', count: 15 },
      { message: 'API rate limit exceeded', count: 8 },
      { message: 'Validation error', count: 5 },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metric, value, timestamp, tags } = body;
    
    // Store custom metric
    await storeCustomMetric(metric, value, timestamp, tags);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing metric:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function storeCustomMetric(metric: string, value: number, timestamp: number, tags: any) {
  // This would integrate with your metrics storage system
  console.log('Storing metric:', { metric, value, timestamp, tags });
}
`;

  fs.writeFileSync(metricsEndpoint, metricsContent.trim());

  // Real-time endpoint
  const realtimeEndpoint = path.join(apiDir, 'realtime', 'route.ts');
  const realtimeDir = path.join(apiDir, 'realtime');
  if (!fs.existsSync(realtimeDir)) {
    fs.mkdirSync(realtimeDir, { recursive: true });
  }

  const realtimeContent = `
import { NextRequest } from 'next/server';

/**
 * Real-time Monitoring Stream
 */
export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const sendData = () => {
        const data = {
          activeUsers: Math.floor(Math.random() * 100) + 50,
          currentPageViews: Math.floor(Math.random() * 20) + 10,
          responseTime: Math.floor(Math.random() * 200) + 100,
          errorCount: Math.floor(Math.random() * 5),
          timestamp: Date.now(),
        };
        
        const message = \`data: \${JSON.stringify(data)}\\n\\n\`;
        controller.enqueue(encoder.encode(message));
      };
      
      // Send initial data
      sendData();
      
      // Send updates every 5 seconds
      const interval = setInterval(sendData, 5000);
      
      // Clean up on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
`;

  fs.writeFileSync(realtimeEndpoint, realtimeContent.trim());

  // Health check endpoint
  const healthEndpoint = path.join(apiDir, 'health', 'route.ts');
  const healthDir = path.join(apiDir, 'health');
  if (!fs.existsSync(healthDir)) {
    fs.mkdirSync(healthDir, { recursive: true });
  }

  const healthContent = `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Health Check Endpoint
 */
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: false,
      redis: false,
      external_apis: false,
      disk_space: false,
      memory: false,
    },
    details: {},
  };

  try {
    // Database check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('artists')
      .select('id')
      .limit(1);
    
    checks.checks.database = !error;
    checks.details.database = {
      status: error ? 'error' : 'healthy',
      message: error?.message || 'Connected successfully',
      responseTime: Date.now() - new Date().getTime(),
    };

    // External API checks
    const spotifyCheck = await checkSpotifyAPI();
    checks.checks.external_apis = spotifyCheck.status === 'healthy';
    checks.details.external_apis = {
      spotify: spotifyCheck,
    };

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryCheck = {
      status: memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB threshold
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
    };
    checks.checks.memory = memoryCheck.status === 'healthy';
    checks.details.memory = memoryCheck;

    // Overall status
    const allHealthy = Object.values(checks.checks).every(check => check);
    checks.status = allHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(checks, {
      status: allHealthy ? 200 : 503,
    });
  } catch (error) {
    checks.status = 'unhealthy';
    checks.details.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    return NextResponse.json(checks, { status: 500 });
  }
}

async function checkSpotifyAPI() {
  try {
    const response = await fetch('https://api.spotify.com/v1/search?q=test&type=artist&limit=1', {
      headers: {
        'Authorization': \`Bearer \${await getSpotifyToken()}\`,
      },
    });

    return {
      status: response.ok ? 'healthy' : 'error',
      responseTime: response.headers.get('x-response-time'),
      statusCode: response.status,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getSpotifyToken() {
  // This would implement your Spotify token refresh logic
  return 'mock_token';
}
`;

  fs.writeFileSync(healthEndpoint, healthContent.trim());

  console.log('✅ Monitoring API endpoints generated successfully');
}

// Generate alerting system
function generateAlertingSystem() {
  console.log('🔧 Generating alerting system...');

  const alertingPath = path.join(__dirname, '..', 'lib', 'alerting.js');
  const alertingContent = `
/**
 * Alerting System for MySetlist
 */

class AlertingSystem {
  constructor(config = {}) {
    this.config = {
      thresholds: {
        errorRate: 5,
        responseTime: 2000,
        availability: 99,
        ...config.thresholds,
      },
      channels: {
        email: true,
        slack: true,
        sms: false,
        ...config.channels,
      },
      cooldown: 300000, // 5 minutes
      ...config,
    };
    
    this.activeAlerts = new Map();
    this.alertHistory = [];
  }

  async checkMetrics(metrics) {
    const alerts = [];

    // Error rate check
    if (metrics.errors?.rate > this.config.thresholds.errorRate) {
      alerts.push({
        id: 'high-error-rate',
        severity: 'critical',
        title: 'High Error Rate Detected',
        message: \`Error rate (\${metrics.errors.rate}%) exceeds threshold (\${this.config.thresholds.errorRate}%)\`,
        value: metrics.errors.rate,
        threshold: this.config.thresholds.errorRate,
        timestamp: Date.now(),
      });
    }

    // Response time check
    if (metrics.performance?.avgResponseTime > this.config.thresholds.responseTime) {
      alerts.push({
        id: 'slow-response-time',
        severity: 'warning',
        title: 'Slow Response Time',
        message: \`Average response time (\${metrics.performance.avgResponseTime}ms) exceeds threshold (\${this.config.thresholds.responseTime}ms)\`,
        value: metrics.performance.avgResponseTime,
        threshold: this.config.thresholds.responseTime,
        timestamp: Date.now(),
      });
    }

    // Availability check
    if (metrics.availability?.uptime < this.config.thresholds.availability) {
      alerts.push({
        id: 'low-availability',
        severity: 'critical',
        title: 'Low Availability',
        message: \`Availability (\${metrics.availability.uptime}%) below threshold (\${this.config.thresholds.availability}%)\`,
        value: metrics.availability.uptime,
        threshold: this.config.thresholds.availability,
        timestamp: Date.now(),
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    return alerts;
  }

  async processAlert(alert) {
    const existingAlert = this.activeAlerts.get(alert.id);
    
    // Check cooldown
    if (existingAlert && Date.now() - existingAlert.lastSent < this.config.cooldown) {
      return;
    }

    // Send alert
    await this.sendAlert(alert);
    
    // Update active alerts
    this.activeAlerts.set(alert.id, {
      ...alert,
      lastSent: Date.now(),
    });
    
    // Add to history
    this.alertHistory.push(alert);
    
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }
  }

  async sendAlert(alert) {
    const promises = [];

    // Email notification
    if (this.config.channels.email) {
      promises.push(this.sendEmailAlert(alert));
    }

    // Slack notification
    if (this.config.channels.slack) {
      promises.push(this.sendSlackAlert(alert));
    }

    // SMS notification
    if (this.config.channels.sms && alert.severity === 'critical') {
      promises.push(this.sendSMSAlert(alert));
    }

    await Promise.allSettled(promises);
  }

  async sendEmailAlert(alert) {
    try {
      const response = await fetch('/api/alerts/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: \`[MySetlist] \${alert.title}\`,
          message: alert.message,
          severity: alert.severity,
          timestamp: alert.timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email alert');
      }
    } catch (error) {
      console.error('Error sending email alert:', error);
    }
  }

  async sendSlackAlert(alert) {
    try {
      const webhook = process.env.SLACK_WEBHOOK_URL;
      if (!webhook) return;

      const color = alert.severity === 'critical' ? 'danger' : 'warning';
      const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: \`\${emoji} MySetlist Alert: \${alert.title}\`,
          attachments: [{
            color,
            fields: [
              {
                title: 'Severity',
                value: alert.severity,
                short: true,
              },
              {
                title: 'Current Value',
                value: alert.value,
                short: true,
              },
              {
                title: 'Threshold',
                value: alert.threshold,
                short: true,
              },
              {
                title: 'Time',
                value: new Date(alert.timestamp).toISOString(),
                short: true,
              },
            ],
            text: alert.message,
          }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send Slack alert');
      }
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
  }

  async sendSMSAlert(alert) {
    try {
      // This would integrate with a SMS service like Twilio
      console.log('SMS alert would be sent:', alert);
    } catch (error) {
      console.error('Error sending SMS alert:', error);
    }
  }

  resolveAlert(alertId) {
    this.activeAlerts.delete(alertId);
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory() {
    return this.alertHistory;
  }
}

export default AlertingSystem;
`;

  fs.writeFileSync(alertingPath, alertingContent.trim());
  console.log('✅ Alerting system generated successfully');
}

// Main execution
function main() {
  console.log('🚀 Setting up Vercel monitoring and analytics...');

  try {
    generateVercelAnalyticsConfig();
    generateMonitoringDashboard();
    generateMonitoringAPI();
    generateAlertingSystem();
    
    console.log('✅ Vercel monitoring setup completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Install Vercel Analytics: npm install @vercel/analytics @vercel/speed-insights');
    console.log('2. Add AnalyticsProvider to your layout');
    console.log('3. Configure monitoring dashboard');
    console.log('4. Set up alerting channels');
    console.log('5. Test monitoring endpoints');
    console.log('');
  } catch (error) {
    console.error('❌ Error setting up Vercel monitoring:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateVercelAnalyticsConfig,
  generateMonitoringDashboard,
  generateMonitoringAPI,
  generateAlertingSystem,
};