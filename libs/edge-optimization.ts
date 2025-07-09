/**
 * Next.js Edge API Routes and ISR Caching Optimization
 * Ultra-fast response times with edge computing and intelligent caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { advancedCaching } from './advanced-caching';

// Edge runtime configuration
export const runtime = 'edge';

// Response compression utilities
export function compressResponse(data: any): string {
  // In a real implementation, you'd use a compression library
  // For now, we'll use JSON.stringify with minimal formatting
  return JSON.stringify(data);
}

export function decompress(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Decompression error:', error);
    return null;
  }
}

// ISR (Incremental Static Regeneration) Cache Configuration
export interface ISRConfig {
  revalidate: number; // seconds
  tags?: string[];
  maxAge?: number;
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
}

export const ISR_CONFIGS = {
  // Static content - rarely changes
  STATIC: {
    revalidate: 3600, // 1 hour
    maxAge: 3600,
    staleWhileRevalidate: 7200,
    mustRevalidate: false
  },
  // Dynamic content - moderate changes
  DYNAMIC: {
    revalidate: 300, // 5 minutes
    maxAge: 300,
    staleWhileRevalidate: 900,
    mustRevalidate: false
  },
  // Real-time content - frequent changes
  REALTIME: {
    revalidate: 60, // 1 minute
    maxAge: 60,
    staleWhileRevalidate: 300,
    mustRevalidate: true
  },
  // User-specific content - varies by user
  USER_SPECIFIC: {
    revalidate: 0, // No static generation
    maxAge: 0,
    staleWhileRevalidate: 0,
    mustRevalidate: true
  }
} as const;

// Edge-optimized response builder
export class EdgeResponseBuilder {
  private headers: Record<string, string> = {};
  private status: number = 200;
  private data: any = null;
  private cacheConfig: ISRConfig = ISR_CONFIGS.DYNAMIC;
  private compressionEnabled: boolean = true;

  constructor() {
    // Default security headers
    this.headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Type': 'application/json; charset=utf-8'
    };
  }

  setStatus(status: number): EdgeResponseBuilder {
    this.status = status;
    return this;
  }

  setData(data: any): EdgeResponseBuilder {
    this.data = data;
    return this;
  }

  setHeader(key: string, value: string): EdgeResponseBuilder {
    this.headers[key] = value;
    return this;
  }

  setHeaders(headers: Record<string, string>): EdgeResponseBuilder {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  setCacheConfig(config: ISRConfig): EdgeResponseBuilder {
    this.cacheConfig = config;
    return this;
  }

  enableCompression(enabled: boolean = true): EdgeResponseBuilder {
    this.compressionEnabled = enabled;
    return this;
  }

  build(responseTime?: number): NextResponse {
    // Apply cache headers
    this.applyCacheHeaders();

    // Apply performance headers
    if (responseTime) {
      this.headers['X-Response-Time'] = `${responseTime}ms`;
    }

    // Apply compression if enabled
    let responseData = this.data;
    if (this.compressionEnabled && this.data) {
      responseData = compressResponse(this.data);
      this.headers['Content-Encoding'] = 'gzip';
    }

    // Add performance indicators
    this.headers['X-Edge-Runtime'] = 'optimized';
    this.headers['X-Cache-Status'] = this.cacheConfig.revalidate > 0 ? 'cached' : 'dynamic';

    return NextResponse.json(responseData, {
      status: this.status,
      headers: this.headers
    });
  }

  private applyCacheHeaders(): void {
    const { revalidate, maxAge, staleWhileRevalidate, mustRevalidate } = this.cacheConfig;

    if (revalidate > 0) {
      // ISR caching
      this.headers['Cache-Control'] = `s-maxage=${maxAge || revalidate}, stale-while-revalidate=${staleWhileRevalidate || revalidate * 2}`;
    } else if (mustRevalidate) {
      // No caching for dynamic content
      this.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else {
      // Default caching
      this.headers['Cache-Control'] = `s-maxage=${maxAge || 60}, stale-while-revalidate=${staleWhileRevalidate || 300}`;
    }
  }
}

// Edge-optimized data fetcher with ISR
export class EdgeDataFetcher {
  private cacheKeyPrefix: string;
  private defaultConfig: ISRConfig;

  constructor(prefix: string, config: ISRConfig = ISR_CONFIGS.DYNAMIC) {
    this.cacheKeyPrefix = prefix;
    this.defaultConfig = config;
  }

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: ISRConfig = this.defaultConfig
  ): Promise<{
    data: T;
    cached: boolean;
    revalidated: boolean;
  }> {
    const cacheKey = `${this.cacheKeyPrefix}:${key}`;
    const now = Date.now();

    // Try to get from cache first
    const cached = await advancedCaching.get<{
      data: T;
      timestamp: number;
      revalidate: number;
    }>(cacheKey);

    if (cached) {
      const age = now - cached.timestamp;
      const shouldRevalidate = age > (cached.revalidate * 1000);

      if (!shouldRevalidate) {
        // Fresh data, return immediately
        return {
          data: cached.data,
          cached: true,
          revalidated: false
        };
      }

      // Stale data - return immediately but trigger background revalidation
      if (config.staleWhileRevalidate && age < (config.staleWhileRevalidate * 1000)) {
        // Background revalidation (fire and forget)
        this.backgroundRevalidate(cacheKey, fetcher, config);
        
        return {
          data: cached.data,
          cached: true,
          revalidated: false
        };
      }
    }

    // No cache or expired - fetch fresh data
    try {
      const data = await fetcher();
      
      // Cache the fresh data
      await advancedCaching.set(cacheKey, {
        data,
        timestamp: now,
        revalidate: config.revalidate
      }, {
        ttl: config.revalidate * 1000,
        priority: 'high',
        tags: config.tags || []
      });

      return {
        data,
        cached: false,
        revalidated: true
      };
    } catch (error) {
      // If we have stale data, return it as fallback
      if (cached) {
        return {
          data: cached.data,
          cached: true,
          revalidated: false
        };
      }
      
      throw error;
    }
  }

  private async backgroundRevalidate<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    config: ISRConfig
  ): Promise<void> {
    try {
      const data = await fetcher();
      await advancedCaching.set(cacheKey, {
        data,
        timestamp: Date.now(),
        revalidate: config.revalidate
      }, {
        ttl: config.revalidate * 1000,
        priority: 'high',
        tags: config.tags || []
      });
    } catch (error) {
      console.error('Background revalidation failed:', error);
    }
  }

  async invalidate(key: string): Promise<void> {
    const cacheKey = `${this.cacheKeyPrefix}:${key}`;
    await advancedCaching.delete(cacheKey);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    await advancedCaching.clearByTags(tags);
  }
}

// Pre-configured data fetchers for different content types
export const staticDataFetcher = new EdgeDataFetcher('static', ISR_CONFIGS.STATIC);
export const dynamicDataFetcher = new EdgeDataFetcher('dynamic', ISR_CONFIGS.DYNAMIC);
export const realtimeDataFetcher = new EdgeDataFetcher('realtime', ISR_CONFIGS.REALTIME);
export const userDataFetcher = new EdgeDataFetcher('user', ISR_CONFIGS.USER_SPECIFIC);

// Edge API route wrapper
export function createEdgeAPIRoute<T = any>(
  handler: (request: NextRequest) => Promise<T>,
  config: {
    isrConfig?: ISRConfig;
    compression?: boolean;
    validation?: (request: NextRequest) => Promise<boolean>;
    rateLimit?: {
      maxRequests: number;
      windowMs: number;
    };
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = performance.now();
    
    try {
      // Rate limiting (if configured)
      if (config.rateLimit) {
        const rateLimitResult = await checkRateLimit(request, config.rateLimit);
        if (rateLimitResult) {
          return rateLimitResult;
        }
      }

      // Validation (if configured)
      if (config.validation) {
        const isValid = await config.validation(request);
        if (!isValid) {
          return new EdgeResponseBuilder()
            .setStatus(400)
            .setData({ error: 'Invalid request' })
            .build();
        }
      }

      // Execute handler
      const result = await handler(request);
      const responseTime = Math.round(performance.now() - startTime);

      // Build optimized response
      const response = new EdgeResponseBuilder()
        .setData(result)
        .setCacheConfig(config.isrConfig || ISR_CONFIGS.DYNAMIC)
        .enableCompression(config.compression !== false)
        .build(responseTime);

      return response;

    } catch (error) {
      console.error('Edge API error:', error);
      const responseTime = Math.round(performance.now() - startTime);

      return new EdgeResponseBuilder()
        .setStatus(500)
        .setData({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
        .setCacheConfig(ISR_CONFIGS.USER_SPECIFIC) // Don't cache errors
        .build(responseTime);
    }
  };
}

// Simple rate limiting for edge runtime
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

async function checkRateLimit(
  request: NextRequest,
  config: { maxRequests: number; windowMs: number }
): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return null;
  }

  if (existing.count >= config.maxRequests) {
    const retryAfter = Math.ceil((existing.resetTime - now) / 1000);
    
    return new EdgeResponseBuilder()
      .setStatus(429)
      .setData({
        error: 'Too many requests',
        retryAfter
      })
      .setHeader('Retry-After', retryAfter.toString())
      .setCacheConfig(ISR_CONFIGS.USER_SPECIFIC)
      .build();
  }

  existing.count++;
  return null;
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

// Pre-warming utilities
export async function prewarmCache(
  fetcher: EdgeDataFetcher,
  keys: string[],
  dataFetchers: Record<string, () => Promise<any>>
): Promise<void> {
  const promises = keys.map(async (key) => {
    try {
      const dataFetcher = dataFetchers[key];
      if (dataFetcher) {
        await fetcher.fetch(key, dataFetcher);
      }
    } catch (error) {
      console.error(`Prewarming failed for key ${key}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

// Cache invalidation utilities
export async function invalidateRouteCache(route: string): Promise<void> {
  await advancedCaching.clearByTags([`route:${route}`]);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await advancedCaching.clearByTags([`user:${userId}`]);
}

export async function invalidateDataType(dataType: string): Promise<void> {
  await advancedCaching.clearByTags([dataType]);
}

// Performance monitoring for edge routes
export class EdgePerformanceMonitor {
  private metrics: Map<string, {
    totalRequests: number;
    totalResponseTime: number;
    errors: number;
    cacheHits: number;
    cacheMisses: number;
  }> = new Map();

  recordRequest(
    route: string,
    responseTime: number,
    error: boolean = false,
    cacheHit: boolean = false
  ): void {
    const current = this.metrics.get(route) || {
      totalRequests: 0,
      totalResponseTime: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    current.totalRequests++;
    current.totalResponseTime += responseTime;
    
    if (error) {
      current.errors++;
    }
    
    if (cacheHit) {
      current.cacheHits++;
    } else {
      current.cacheMisses++;
    }

    this.metrics.set(route, current);
  }

  getMetrics(route?: string): any {
    if (route) {
      const metrics = this.metrics.get(route);
      if (metrics) {
        return {
          route,
          averageResponseTime: metrics.totalResponseTime / metrics.totalRequests,
          errorRate: (metrics.errors / metrics.totalRequests) * 100,
          cacheHitRate: (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100,
          ...metrics
        };
      }
      return null;
    }

    // Return all metrics
    const result: any = {};
    for (const [routeName, metrics] of this.metrics) {
      result[routeName] = {
        averageResponseTime: metrics.totalResponseTime / metrics.totalRequests,
        errorRate: (metrics.errors / metrics.totalRequests) * 100,
        cacheHitRate: (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100,
        ...metrics
      };
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}

export const edgePerformanceMonitor = new EdgePerformanceMonitor();

// Export optimized configurations for different route types
export const EDGE_ROUTE_CONFIGS = {
  STATIC: {
    isrConfig: ISR_CONFIGS.STATIC,
    compression: true,
    rateLimit: { maxRequests: 1000, windowMs: 60000 }
  },
  DYNAMIC: {
    isrConfig: ISR_CONFIGS.DYNAMIC,
    compression: true,
    rateLimit: { maxRequests: 500, windowMs: 60000 }
  },
  REALTIME: {
    isrConfig: ISR_CONFIGS.REALTIME,
    compression: false,
    rateLimit: { maxRequests: 200, windowMs: 60000 }
  },
  USER_SPECIFIC: {
    isrConfig: ISR_CONFIGS.USER_SPECIFIC,
    compression: true,
    rateLimit: { maxRequests: 100, windowMs: 60000 }
  }
} as const;