'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { perfMonitor, WebVitalsMonitor } from '@/libs/performance';

interface PerformanceMetrics {
  lcp: number;
  fcp: number;
  cls: number;
  fid: number;
  ttfb: number;
  apiResponseTimes: Record<string, number>;
  memoryUsage: number;
  timestamp: number;
}

interface PerformanceAlert {
  type: 'LCP' | 'FCP' | 'CLS' | 'FID' | 'TTFB' | 'API' | 'MEMORY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export default function ProductionPerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Performance thresholds
  const thresholds = {
    lcp: 2500, // ms
    fcp: 1800, // ms
    cls: 0.1,
    fid: 100, // ms
    ttfb: 800, // ms
    apiResponse: 500, // ms
    memory: 50 * 1024 * 1024, // 50MB
  };

  const updateMetrics = useCallback((key: string, value: number, url?: string) => {
    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        timestamp: Date.now()
      } as PerformanceMetrics;
      
      if (key === 'apiResponseTimes' && url) {
        newMetrics.apiResponseTimes = {
          ...prev?.apiResponseTimes,
          [url]: value
        };
      } else {
        (newMetrics as any)[key] = value;
      }
      
      return newMetrics;
    });
  }, []);

  const addAlert = useCallback((alert: PerformanceAlert) => {
    setAlerts(prev => [...prev, alert].slice(-10));
  }, []);

  // Initialize performance monitoring
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    setIsMonitoring(true);
    
    // Start Web Vitals monitoring
    WebVitalsMonitor.measureWebVitals();
    
    // Monitor Core Web Vitals
    const observePerformance = () => {
      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const lcp = lastEntry.startTime;
          updateMetrics('lcp', lcp);
          
          if (lcp > thresholds.lcp) {
            addAlert({
              type: 'LCP',
              severity: lcp > thresholds.lcp * 1.5 ? 'HIGH' : 'MEDIUM',
              message: `Largest Contentful Paint is ${lcp.toFixed(0)}ms`,
              value: lcp,
              threshold: thresholds.lcp,
              timestamp: Date.now()
            });
          }
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const fcp = lastEntry.startTime;
          updateMetrics('fcp', fcp);
          
          if (fcp > thresholds.fcp) {
            addAlert({
              type: 'FCP',
              severity: fcp > thresholds.fcp * 1.5 ? 'HIGH' : 'MEDIUM',
              message: `First Contentful Paint is ${fcp.toFixed(0)}ms`,
              value: fcp,
              threshold: thresholds.fcp,
              timestamp: Date.now()
            });
          }
        }
      }).observe({ entryTypes: ['first-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as any;
          if (fidEntry.processingStart) {
            const fid = fidEntry.processingStart - entry.startTime;
            updateMetrics('fid', fid);
            
            if (fid > thresholds.fid) {
              addAlert({
                type: 'FID',
                severity: fid > thresholds.fid * 2 ? 'HIGH' : 'MEDIUM',
                message: `First Input Delay is ${fid.toFixed(0)}ms`,
                value: fid,
                threshold: thresholds.fid,
                timestamp: Date.now()
              });
            }
          }
        });
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            updateMetrics('cls', clsValue);
            
            if (clsValue > thresholds.cls) {
              addAlert({
                type: 'CLS',
                severity: clsValue > thresholds.cls * 2 ? 'HIGH' : 'MEDIUM',
                message: `Cumulative Layout Shift is ${clsValue.toFixed(3)}`,
                value: clsValue,
                threshold: thresholds.cls,
                timestamp: Date.now()
              });
            }
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

      // Navigation Timing
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.entryType === 'navigation') {
            const ttfb = entry.responseStart - entry.requestStart;
            updateMetrics('ttfb', ttfb);
            
            if (ttfb > thresholds.ttfb) {
              addAlert({
                type: 'TTFB',
                severity: ttfb > thresholds.ttfb * 1.5 ? 'HIGH' : 'MEDIUM',
                message: `Time to First Byte is ${ttfb.toFixed(0)}ms`,
                value: ttfb,
                threshold: thresholds.ttfb,
                timestamp: Date.now()
              } as PerformanceAlert);
            }
          }
        });
      }).observe({ entryTypes: ['navigation'] });
    };

    observePerformance();

    // Monitor memory usage
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        if (memoryInfo) {
          const memoryUsage = memoryInfo.usedJSHeapSize;
          updateMetrics('memoryUsage', memoryUsage);
          
          if (memoryUsage > thresholds.memory) {
            addAlert({
              type: 'MEMORY',
              severity: memoryUsage > thresholds.memory * 1.5 ? 'HIGH' : 'MEDIUM',
              message: `Memory usage is ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`,
              value: memoryUsage,
              threshold: thresholds.memory,
              timestamp: Date.now()
            });
          }
        }
      }
    };

    // Monitor memory every 30 seconds
    const memoryInterval = setInterval(monitorMemory, 30000);

    // Monitor API responses
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const startTime = performance.now();
      const url = args[0] as string;
      
      return originalFetch.apply(this, args).then((response) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Track API response time
        if (url.includes('/api/')) {
          updateMetrics('apiResponseTimes', responseTime, url);
          
          if (responseTime > thresholds.apiResponse) {
            addAlert({
              type: 'API',
              severity: responseTime > thresholds.apiResponse * 2 ? 'HIGH' : 'MEDIUM',
              message: `API response time is ${responseTime.toFixed(0)}ms for ${url}`,
              value: responseTime,
              threshold: thresholds.apiResponse,
              timestamp: Date.now()
            });
          }
        }
        
        return response;
      });
    };

    // Cleanup
    return () => {
      clearInterval(memoryInterval);
      window.fetch = originalFetch;
      setIsMonitoring(false);
    };
  }, [updateMetrics, addAlert, thresholds]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const reportToAnalytics = useCallback(() => {
    if (metrics && process.env.NODE_ENV === 'production') {
      // Send metrics to analytics service
      fetch('/api/analytics/web-vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
      }).catch(error => {
        console.error('Failed to report metrics:', error);
      });
    }
  }, [metrics]);

  // Report metrics every 5 minutes
  useEffect(() => {
    const interval = setInterval(reportToAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [reportToAnalytics]);

  // Performance grade calculation
  const getPerformanceGrade = () => {
    if (!metrics) return 'N/A';
    
    const scores = {
      lcp: metrics.lcp <= thresholds.lcp ? 100 : Math.max(0, 100 - (metrics.lcp - thresholds.lcp) / 10),
      fcp: metrics.fcp <= thresholds.fcp ? 100 : Math.max(0, 100 - (metrics.fcp - thresholds.fcp) / 10),
      cls: metrics.cls <= thresholds.cls ? 100 : Math.max(0, 100 - (metrics.cls - thresholds.cls) * 1000),
      fid: metrics.fid <= thresholds.fid ? 100 : Math.max(0, 100 - (metrics.fid - thresholds.fid) / 2),
    };
    
    const average = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    if (average >= 90) return 'A';
    if (average >= 80) return 'B';
    if (average >= 70) return 'C';
    if (average >= 60) return 'D';
    return 'F';
  };

  // Don't render in development or if not monitoring
  if (process.env.NODE_ENV !== 'production' || !isMonitoring) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Performance Grade Badge */}
      <div
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium cursor-pointer
          transition-all duration-200 hover:scale-105
          ${alerts.length > 0 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        Grade: {getPerformanceGrade()}
        {alerts.length > 0 && (
          <span className="bg-white text-red-500 text-xs px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Detailed Performance Panel */}
      {showDetails && (
        <div className="absolute bottom-16 right-0 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Performance Monitor</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Core Web Vitals */}
            {metrics && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Core Web Vitals</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">LCP:</span>
                    <span className={`ml-2 ${metrics.lcp <= thresholds.lcp ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.lcp?.toFixed(0)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">FCP:</span>
                    <span className={`ml-2 ${metrics.fcp <= thresholds.fcp ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.fcp?.toFixed(0)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">CLS:</span>
                    <span className={`ml-2 ${metrics.cls <= thresholds.cls ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.cls?.toFixed(3)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">FID:</span>
                    <span className={`ml-2 ${metrics.fid <= thresholds.fid ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.fid?.toFixed(0)}ms
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Alerts */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Alerts</h4>
                  <button
                    onClick={clearAlerts}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${
                        alert.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <div className="font-medium">{alert.type}</div>
                      <div>{alert.message}</div>
                      <div className="text-xs opacity-75">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API Response Times */}
            {metrics?.apiResponseTimes && Object.keys(metrics.apiResponseTimes).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">API Response Times</h4>
                <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                  {Object.entries(metrics.apiResponseTimes).map(([url, time]) => (
                    <div key={url} className="flex justify-between">
                      <span className="text-gray-500 truncate">{url.split('/').pop()}</span>
                      <span className={time > thresholds.apiResponse ? 'text-red-600' : 'text-green-600'}>
                        {time.toFixed(0)}ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}