'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { twMerge } from 'tailwind-merge';

// Core Web Vitals monitoring
export const useWebVitals = () => {
  const [vitals, setVitals] = useState<{
    LCP: number | null;
    FID: number | null;
    CLS: number | null;
    FCP: number | null;
    TTFB: number | null;
    INP: number | null;
  }>({
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
    TTFB: null,
    INP: null
  });

  useEffect(() => {
    const measureWebVitals = async () => {
      if (typeof window === 'undefined') return;

      try {
        const { getCLS, getFID, getFCP, getLCP, getTTFB, getINP } = await import('web-vitals');

        getCLS((metric) => {
          setVitals(prev => ({ ...prev, CLS: metric.value }));
        });

        getFID((metric) => {
          setVitals(prev => ({ ...prev, FID: metric.value }));
        });

        getFCP((metric) => {
          setVitals(prev => ({ ...prev, FCP: metric.value }));
        });

        getLCP((metric) => {
          setVitals(prev => ({ ...prev, LCP: metric.value }));
        });

        getTTFB((metric) => {
          setVitals(prev => ({ ...prev, TTFB: metric.value }));
        });

        getINP((metric) => {
          setVitals(prev => ({ ...prev, INP: metric.value }));
        });
      } catch (error) {
        console.warn('Failed to load web-vitals:', error);
      }
    };

    measureWebVitals();
  }, []);

  return vitals;
};

// Performance budget monitor
export const usePerformanceBudget = () => {
  const [budget, setBudget] = useState({
    bundleSize: 0,
    imageSize: 0,
    requestCount: 0,
    loadTime: 0
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    const measureBudget = () => {
      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      let totalSize = 0;
      let imageSize = 0;
      let requestCount = resources.length;

      resources.forEach(resource => {
        if (resource.transferSize) {
          totalSize += resource.transferSize;
          if (resource.initiatorType === 'img') {
            imageSize += resource.transferSize;
          }
        }
      });

      setBudget({
        bundleSize: totalSize,
        imageSize,
        requestCount,
        loadTime: navigation.loadEventEnd - navigation.navigationStart
      });
    };

    // Measure after page load
    if (document.readyState === 'complete') {
      measureBudget();
    } else {
      window.addEventListener('load', measureBudget);
    }

    return () => {
      window.removeEventListener('load', measureBudget);
    };
  }, []);

  return budget;
};

// Critical CSS inliner
export const CriticalCSS: React.FC<{ css: string }> = ({ css }) => {
  return (
    <style
      dangerouslySetInnerHTML={{ __html: css }}
      data-critical="true"
    />
  );
};

// Resource hints component
export const ResourceHints: React.FC<{
  preload?: string[];
  prefetch?: string[];
  preconnect?: string[];
  dnsPrefetch?: string[];
}> = ({ preload = [], prefetch = [], preconnect = [], dnsPrefetch = [] }) => {
  return (
    <>
      {preload.map((href, index) => (
        <link key={`preload-${index}`} rel="preload" href={href} as="script" />
      ))}
      {prefetch.map((href, index) => (
        <link key={`prefetch-${index}`} rel="prefetch" href={href} />
      ))}
      {preconnect.map((href, index) => (
        <link key={`preconnect-${index}`} rel="preconnect" href={href} />
      ))}
      {dnsPrefetch.map((href, index) => (
        <link key={`dns-prefetch-${index}`} rel="dns-prefetch" href={href} />
      ))}
    </>
  );
};

// Optimized list component with virtualization
export const VirtualizedList: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
}> = ({ items, renderItem, itemHeight, containerHeight, overscan = 5, className }) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, scrollTop, itemHeight, containerHeight, overscan]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      className={twMerge("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  targetRef: React.RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, options]);

  return isIntersecting;
};

// Optimized debounce hook
export const useOptimizedDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Throttle hook for performance-sensitive operations
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const [lastCall, setLastCall] = useState(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        setLastCall(now);
        return callback(...args);
      }
    },
    [callback, delay, lastCall]
  ) as T;
};

// Memory leak detector
export const useMemoryLeakDetector = () => {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  }>({ used: 0, total: 0, percentage: 0 });

  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const percentage = (used / total) * 100;

        setMemoryUsage({ used, total, percentage });

        // Warn if memory usage is high
        if (percentage > 80) {
          console.warn('High memory usage detected:', percentage.toFixed(2) + '%');
        }
      }
    };

    const interval = setInterval(checkMemory, 10000); // Check every 10 seconds
    checkMemory(); // Initial check

    return () => clearInterval(interval);
  }, []);

  return memoryUsage;
};

// Performance monitoring component
export const PerformanceMonitor: React.FC<{
  enabled?: boolean;
  showAlert?: boolean;
  className?: string;
}> = ({ enabled = true, showAlert = true, className }) => {
  const vitals = useWebVitals();
  const budget = usePerformanceBudget();
  const memory = useMemoryLeakDetector();
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const newAlerts: string[] = [];

    // Check Core Web Vitals thresholds
    if (vitals.LCP && vitals.LCP > 2500) {
      newAlerts.push('LCP is poor (over 2.5s)');
    }
    if (vitals.FID && vitals.FID > 100) {
      newAlerts.push('FID is poor (over 100ms)');
    }
    if (vitals.CLS && vitals.CLS > 0.1) {
      newAlerts.push('CLS is poor (over 0.1)');
    }
    if (vitals.INP && vitals.INP > 200) {
      newAlerts.push('INP is poor (over 200ms)');
    }

    // Check performance budget
    if (budget.bundleSize > 1000000) { // 1MB
      newAlerts.push('Bundle size exceeds 1MB');
    }
    if (budget.requestCount > 50) {
      newAlerts.push('Too many requests (over 50)');
    }
    if (budget.loadTime > 3000) {
      newAlerts.push('Load time exceeds 3s');
    }

    // Check memory usage
    if (memory.percentage > 80) {
      newAlerts.push('High memory usage');
    }

    setAlerts(newAlerts);
  }, [vitals, budget, memory, enabled]);

  if (!enabled) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getScoreColor = (score: number, thresholds: { good: number; poor: number }, reverse = false) => {
    if (!score) return 'text-neutral-400';
    
    if (reverse) {
      return score <= thresholds.good ? 'text-green-400' : 
             score <= thresholds.poor ? 'text-yellow-400' : 'text-red-400';
    } else {
      return score >= thresholds.good ? 'text-green-400' : 
             score >= thresholds.poor ? 'text-yellow-400' : 'text-red-400';
    }
  };

  return (
    <div className={twMerge("bg-neutral-900 rounded-lg p-4", className)}>
      <h3 className="text-lg font-semibold text-white mb-4">Performance Monitor</h3>
      
      {/* Alerts */}
      {showAlert && alerts.length > 0 && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
          <h4 className="text-red-400 font-medium mb-2">Performance Alerts</h4>
          <ul className="text-sm text-red-300 space-y-1">
            {alerts.map((alert, index) => (
              <li key={index}>• {alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Core Web Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">LCP</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.LCP || 0, { good: 2500, poor: 4000 }, true))}>
            {vitals.LCP ? `${vitals.LCP.toFixed(0)}ms` : 'N/A'}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">FID</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.FID || 0, { good: 100, poor: 300 }, true))}>
            {vitals.FID ? `${vitals.FID.toFixed(0)}ms` : 'N/A'}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">CLS</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.CLS || 0, { good: 0.1, poor: 0.25 }, true))}>
            {vitals.CLS ? vitals.CLS.toFixed(3) : 'N/A'}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">FCP</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.FCP || 0, { good: 1800, poor: 3000 }, true))}>
            {vitals.FCP ? `${vitals.FCP.toFixed(0)}ms` : 'N/A'}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">TTFB</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.TTFB || 0, { good: 800, poor: 1800 }, true))}>
            {vitals.TTFB ? `${vitals.TTFB.toFixed(0)}ms` : 'N/A'}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">INP</div>
          <div className={twMerge("text-lg font-semibold", getScoreColor(vitals.INP || 0, { good: 200, poor: 500 }, true))}>
            {vitals.INP ? `${vitals.INP.toFixed(0)}ms` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Performance Budget */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">Bundle Size</div>
          <div className="text-lg font-semibold text-white">
            {formatBytes(budget.bundleSize)}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">Requests</div>
          <div className="text-lg font-semibold text-white">
            {budget.requestCount}
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">Load Time</div>
          <div className="text-lg font-semibold text-white">
            {budget.loadTime.toFixed(0)}ms
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-sm text-neutral-400">Memory Usage</div>
          <div className={twMerge("text-lg font-semibold", memory.percentage > 80 ? 'text-red-400' : 'text-green-400')}>
            {memory.percentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Performance Score */}
      <div className="bg-neutral-800 rounded-lg p-3">
        <div className="text-sm text-neutral-400 mb-2">Overall Performance Score</div>
        <div className="w-full bg-neutral-700 rounded-full h-2">
          <div
            className={twMerge(
              "h-2 rounded-full transition-all duration-300",
              alerts.length === 0 ? "bg-green-500" :
              alerts.length <= 2 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${Math.max(0, 100 - alerts.length * 20)}%` }}
          />
        </div>
        <div className="text-xs text-neutral-400 mt-1">
          {alerts.length === 0 ? 'Excellent' :
           alerts.length <= 2 ? 'Good' : 'Needs Improvement'}
        </div>
      </div>
    </div>
  );
};