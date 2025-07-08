/**
 * Performance monitoring and optimization utilities for MySetlist
 */

// Performance measurement helper
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private marks: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start timing an operation
  start(name: string): void {
    this.marks.set(name, performance.now());
  }

  // End timing and return duration
  end(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`Performance mark "${name}" not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(name);

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Measure async function execution time
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }
}

// Database query optimization helpers
export const DatabaseOptimizer = {
  // Cache for frequently accessed data
  cache: new Map<string, { data: any; timestamp: number; ttl: number }>(),

  // Get cached data or execute query
  async getCached<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlMinutes: number = 5
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Execute query and cache result
    const data = await queryFn();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttlMinutes * 60 * 1000,
    });

    return data;
  },

  // Clear cache for specific key or all
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  },

  // Clean expired cache entries
  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= value.ttl) {
        this.cache.delete(key);
      }
    }
  },
};

// Image optimization helpers
export const ImageOptimizer = {
  // Generate optimized image URL with Next.js Image
  getOptimizedUrl(
    src: string,
    width: number,
    quality: number = 75
  ): string {
    if (!src) return '/images/placeholder.png';
    
    // For Spotify images, we can use their resizing
    if (src.includes('i.scdn.co')) {
      return src; // Spotify already optimizes
    }

    // For other images, let Next.js handle optimization
    return src;
  },

  // Preload critical images
  preloadImage(src: string): void {
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    }
  },

  // Lazy load image with intersection observer
  lazyLoadImage(img: HTMLImageElement, src: string): void {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            img.src = src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      });
      observer.observe(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      img.src = src;
    }
  },
};

// Bundle optimization helpers
export const BundleOptimizer = {
  // Dynamic import wrapper with error handling
  async loadComponent<T>(
    importFn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    try {
      return await importFn();
    } catch (error) {
      console.error('Dynamic import failed:', error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  },

  // Check if feature should be loaded based on viewport/device
  shouldLoadFeature(feature: string): boolean {
    if (typeof window === 'undefined') return true;

    switch (feature) {
      case 'animations':
        return !window.matchMedia('(prefers-reduced-motion)').matches;
      case 'advanced-features':
        return window.innerWidth > 768; // Desktop only
      case 'heavy-components':
        return navigator.hardwareConcurrency > 2; // Multi-core devices
      default:
        return true;
    }
  },
};

// API response optimization
export const APIOptimizer = {
  // Add performance headers to API responses
  getPerformanceHeaders(cacheSeconds: number = 300): HeadersInit {
    return {
      'Cache-Control': `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      'CDN-Cache-Control': `s-maxage=${cacheSeconds}`,
      'Vercel-CDN-Cache-Control': `s-maxage=${cacheSeconds}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    };
  },

  // Compress JSON responses
  compressResponse(data: any): string {
    return JSON.stringify(data, null, process.env.NODE_ENV === 'development' ? 2 : 0);
  },

  // Rate limiting helper
  rateLimiter: new Map<string, { count: number; resetTime: number }>(),

  checkRateLimit(
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 60000
  ): boolean {
    const now = Date.now();
    const record = this.rateLimiter.get(identifier);

    if (!record || now > record.resetTime) {
      this.rateLimiter.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (record.count >= maxRequests) {
      return false;
    }

    record.count++;
    return true;
  },
};

// Core Web Vitals monitoring
export const WebVitalsMonitor = {
  // Measure and report Core Web Vitals
  measureWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        console.log('LCP:', lastEntry.startTime);
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fidEntry = entry as any;
        if (fidEntry.processingStart) {
          console.log('FID:', fidEntry.processingStart - entry.startTime);
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
          console.log('CLS:', clsValue);
        }
      });
    }).observe({ entryTypes: ['layout-shift'] });
  },

  // Report performance metrics to analytics
  reportMetrics(metrics: Record<string, number>): void {
    if (process.env.NODE_ENV === 'production') {
      // Send to analytics service
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      }).catch((error) => {
        console.error('Failed to report metrics:', error);
      });
    }
  },
};

// Performance optimization hooks for React components
export const usePerformanceOptimization = () => {
  // Debounce function for search inputs
  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): T => {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  };

  // Throttle function for scroll events
  const throttle = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): T => {
    let lastCall = 0;
    return ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    }) as T;
  };

  return { debounce, throttle };
};

// Export singleton instance
export const perfMonitor = PerformanceMonitor.getInstance();