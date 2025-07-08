'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

interface WebVitalsMetric {
  id: string;
  name: string;
  value: number;
  label: 'web-vital' | 'custom';
  startTime?: number;
  delta?: number;
}

/**
 * Web Vitals Monitoring Component
 * Tracks Core Web Vitals and reports them to analytics
 */
export default function WebVitalsMonitor() {
  // Track and report Web Vitals metrics
  useReportWebVitals((metric: WebVitalsMetric) => {
    // Log metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Web Vital: ${metric.name} = ${metric.value}`);
    }

    // Report to analytics in production
    if (process.env.NODE_ENV === 'production') {
      reportToAnalytics(metric);
    }

    // Check against thresholds
    checkThresholds(metric);
  });

  useEffect(() => {
    // Initialize performance monitoring
    initializePerformanceMonitoring();
  }, []);

  return null; // This component doesn't render anything
}

// Report metrics to analytics service
function reportToAnalytics(metric: WebVitalsMetric) {
  // Google Analytics 4 example
  if (typeof window !== 'undefined' && typeof (window as any).gtag !== 'undefined') {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.value),
      non_interaction: true,
    });
  }

  // Vercel Analytics example
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('track', 'Web Vitals', {
      metric: metric.name,
      value: metric.value,
      id: metric.id,
    });
  }

  // Send to custom analytics endpoint
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metric: metric.name,
      value: metric.value,
      id: metric.id,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch((error) => {
    console.error('Failed to report web vitals:', error);
  });
}

// Check metrics against performance thresholds
function checkThresholds(metric: WebVitalsMetric) {
  const thresholds = {
    CLS: 0.1,    // Good: < 0.1
    FCP: 1800,   // Good: < 1.8s
    FID: 100,    // Good: < 100ms
    LCP: 2500,   // Good: < 2.5s
    TTFB: 800,   // Good: < 800ms
    INP: 200,    // Good: < 200ms
  };

  const threshold = thresholds[metric.name as keyof typeof thresholds];
  if (threshold && metric.value > threshold) {
    console.warn(`⚠️ ${metric.name} exceeds threshold: ${metric.value} > ${threshold}`);
    
    // Report poor performance to monitoring service
    if (process.env.NODE_ENV === 'production') {
      reportPoorPerformance(metric, threshold);
    }
  }
}

// Report poor performance metrics
function reportPoorPerformance(metric: WebVitalsMetric, threshold: number) {
  fetch('/api/monitoring/performance-alert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metric: metric.name,
      value: metric.value,
      threshold,
      severity: metric.value > threshold * 2 ? 'high' : 'medium',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch((error) => {
    console.error('Failed to report performance alert:', error);
  });
}

// Initialize additional performance monitoring
function initializePerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`Long task detected: ${entry.duration}ms`);
            
            if (process.env.NODE_ENV === 'production') {
              fetch('/api/monitoring/long-task', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  duration: entry.duration,
                  startTime: entry.startTime,
                  timestamp: Date.now(),
                  url: window.location.href,
                }),
              }).catch(() => {
                // Silently fail to avoid impacting performance
              });
            }
          }
        });
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.error('Failed to initialize long task observer:', error);
    }
  }

  // Monitor memory usage (Chrome only)
  if ('memory' in performance) {
    const memoryInfo = (performance as any).memory;
    const memoryUsage = {
      usedJSHeapSize: memoryInfo.usedJSHeapSize,
      totalJSHeapSize: memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
    };

    console.log('📊 Memory usage:', memoryUsage);

    // Alert if memory usage is high
    const memoryUsagePercent = (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100;
    if (memoryUsagePercent > 80) {
      console.warn(`⚠️ High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }
  }

  // Monitor resource loading performance
  if ('PerformanceObserver' in window) {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          // Check for slow resources
          if (resourceEntry.duration > 1000) { // Slower than 1s
            console.warn(`Slow resource: ${resourceEntry.name} (${resourceEntry.duration}ms)`);
          }
          
          // Check for failed resources
          if (resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize === 0) {
            console.warn(`Failed resource: ${resourceEntry.name}`);
          }
        });
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.error('Failed to initialize resource observer:', error);
    }
  }

  // Monitor navigation timing
  if ('navigation' in performance) {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    const timings = {
      domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
      load: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
      domInteractive: navigationTiming.domInteractive - navigationTiming.fetchStart,
      domComplete: navigationTiming.domComplete - navigationTiming.fetchStart,
    };

    console.log('📊 Navigation timings:', timings);

    // Report navigation performance
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/analytics/navigation-timing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...timings,
          timestamp: Date.now(),
          url: window.location.href,
        }),
      }).catch(() => {
        // Silently fail
      });
    }
  }
}