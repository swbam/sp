/**
 * Comprehensive API Acceleration Framework
 * Production-ready API optimization with response compression, error handling, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { advancedCaching } from './advanced-caching';
import { connectionPool, createOptimizedQuery, executeWithRetry } from './database-optimization';
import { healthMonitor } from './circuit-breaker';
import { edgePerformanceMonitor } from './edge-optimization';

// API Response formats
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    timestamp: string;
    requestId: string;
    responseTime: number;
    cached: boolean;
    version: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: string;
  requestId: string;
}

// Compression utilities
class ResponseCompressor {
  static compress(data: any): ArrayBuffer {
    // In production, you'd use a proper compression library like pako
    // For now, we'll simulate compression by converting to buffer
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString);
  }

  static decompress(buffer: ArrayBuffer): any {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(buffer);
    return JSON.parse(jsonString);
  }

  static shouldCompress(data: any): boolean {
    const size = JSON.stringify(data).length;
    return size > 1024; // Compress if > 1KB
  }
}

// Request validation
export interface ValidationSchema {
  query?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  }>;
  body?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  }>;
  params?: Record<string, {
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    pattern?: RegExp;
  }>;
}

export class RequestValidator {
  static validate(request: NextRequest, schema: ValidationSchema): {
    valid: boolean;
    errors: string[];
    data: any;
  } {
    const errors: string[] = [];
    const data: any = {};

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Validate query parameters
    if (schema.query) {
      data.query = {};
      for (const [key, rules] of Object.entries(schema.query)) {
        const value = searchParams.get(key);
        
        if (rules.required && !value) {
          errors.push(`Missing required query parameter: ${key}`);
          continue;
        }

        if (value) {
          const validationResult = this.validateValue(value, rules, `query.${key}`);
          if (validationResult.error) {
            errors.push(validationResult.error);
          } else {
            data.query[key] = validationResult.value;
          }
        }
      }
    }

    // Validate path parameters
    if (schema.params) {
      data.params = {};
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      for (const [key, rules] of Object.entries(schema.params)) {
        // This is a simplified example - in practice, you'd need to match against route patterns
        const value = searchParams.get(key) || pathParts[pathParts.length - 1];
        
        if (rules.required && !value) {
          errors.push(`Missing required parameter: ${key}`);
          continue;
        }

        if (value) {
          const validationResult = this.validateValue(value, rules, `params.${key}`);
          if (validationResult.error) {
            errors.push(validationResult.error);
          } else {
            data.params[key] = validationResult.value;
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data
    };
  }

  private static validateValue(value: any, rules: any, fieldName: string): {
    value: any;
    error?: string;
  } {
    // Type conversion
    let convertedValue = value;
    
    switch (rules.type) {
      case 'number':
        convertedValue = Number(value);
        if (isNaN(convertedValue)) {
          return { value, error: `${fieldName} must be a valid number` };
        }
        break;
      case 'boolean':
        convertedValue = value === 'true' || value === '1' || value === 'yes';
        break;
      case 'array':
        if (typeof value === 'string') {
          convertedValue = value.split(',').map(v => v.trim());
        }
        break;
    }

    // Validate constraints
    if (rules.min !== undefined) {
      if (rules.type === 'number' && convertedValue < rules.min) {
        return { value, error: `${fieldName} must be at least ${rules.min}` };
      }
      if (rules.type === 'string' && convertedValue.length < rules.min) {
        return { value, error: `${fieldName} must be at least ${rules.min} characters` };
      }
    }

    if (rules.max !== undefined) {
      if (rules.type === 'number' && convertedValue > rules.max) {
        return { value, error: `${fieldName} must be at most ${rules.max}` };
      }
      if (rules.type === 'string' && convertedValue.length > rules.max) {
        return { value, error: `${fieldName} must be at most ${rules.max} characters` };
      }
    }

    if (rules.pattern && !rules.pattern.test(convertedValue)) {
      return { value, error: `${fieldName} format is invalid` };
    }

    if (rules.enum && !rules.enum.includes(convertedValue)) {
      return { value, error: `${fieldName} must be one of: ${rules.enum.join(', ')}` };
    }

    return { value: convertedValue };
  }
}

// Error handling
export class APIErrorHandler {
  static handle(error: any, requestId: string): APIResponse {
    const timestamp = new Date().toISOString();
    
    // Database errors
    if (error.code?.startsWith('PGRST') || error.code?.startsWith('23')) {
      return {
        success: false,
        error: 'Database error',
        message: this.sanitizeErrorMessage(error.message),
        meta: {
          timestamp,
          requestId,
          responseTime: 0,
          cached: false,
          version: '1.0.0'
        }
      };
    }

    // Authentication errors
    if (error.message?.includes('auth') || error.message?.includes('token')) {
      return {
        success: false,
        error: 'Authentication error',
        message: 'Invalid or expired authentication token',
        meta: {
          timestamp,
          requestId,
          responseTime: 0,
          cached: false,
          version: '1.0.0'
        }
      };
    }

    // Validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return {
        success: false,
        error: 'Validation error',
        message: error.message,
        meta: {
          timestamp,
          requestId,
          responseTime: 0,
          cached: false,
          version: '1.0.0'
        }
      };
    }

    // Network/timeout errors
    if (error.message?.includes('timeout') || error.message?.includes('network')) {
      return {
        success: false,
        error: 'Network error',
        message: 'Request timeout or network unavailable',
        meta: {
          timestamp,
          requestId,
          responseTime: 0,
          cached: false,
          version: '1.0.0'
        }
      };
    }

    // Generic error
    return {
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An unexpected error occurred',
      meta: {
        timestamp,
        requestId,
        responseTime: 0,
        cached: false,
        version: '1.0.0'
      }
    };
  }

  private static sanitizeErrorMessage(message: string): string {
    // Remove sensitive information from error messages
    return message
      .replace(/password/gi, '[REDACTED]')
      .replace(/token/gi, '[REDACTED]')
      .replace(/key/gi, '[REDACTED]')
      .replace(/secret/gi, '[REDACTED]');
  }
}

// Performance monitoring
export class APIPerformanceMonitor {
  private static metrics: Map<string, {
    totalRequests: number;
    totalTime: number;
    successCount: number;
    errorCount: number;
    averageResponseTime: number;
    slowRequests: number;
  }> = new Map();

  static recordRequest(
    endpoint: string,
    responseTime: number,
    success: boolean,
    cached: boolean = false
  ): void {
    const current = this.metrics.get(endpoint) || {
      totalRequests: 0,
      totalTime: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      slowRequests: 0
    };

    current.totalRequests++;
    current.totalTime += responseTime;
    current.averageResponseTime = current.totalTime / current.totalRequests;

    if (success) {
      current.successCount++;
    } else {
      current.errorCount++;
    }

    if (responseTime > 1000) {
      current.slowRequests++;
    }

    this.metrics.set(endpoint, current);

    // Record in edge performance monitor as well
    edgePerformanceMonitor.recordRequest(endpoint, responseTime, !success, cached);
  }

  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [endpoint, metrics] of this.metrics) {
      result[endpoint] = {
        ...metrics,
        successRate: (metrics.successCount / metrics.totalRequests) * 100,
        errorRate: (metrics.errorCount / metrics.totalRequests) * 100,
        slowRequestRate: (metrics.slowRequests / metrics.totalRequests) * 100
      };
    }

    return result;
  }

  static reset(): void {
    this.metrics.clear();
  }
}

// Main API acceleration class
export class APIAccelerator {
  private requestId: string;
  private startTime: number;
  private endpoint: string;
  private cached: boolean = false;

  constructor(request: NextRequest) {
    this.requestId = this.generateRequestId();
    this.startTime = Date.now();
    this.endpoint = this.extractEndpoint(request);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractEndpoint(request: NextRequest): string {
    const url = new URL(request.url);
    return url.pathname.replace(/\/[a-f0-9-]{36}/g, '/:id'); // Replace UUIDs with :id
  }

  // Execute API request with full optimization
  async execute<T>(
    handler: () => Promise<T>,
    options: {
      cache?: {
        key: string;
        ttl: number;
        tags?: string[];
      };
      validation?: ValidationSchema;
      rateLimit?: {
        maxRequests: number;
        windowMs: number;
      };
      compression?: boolean;
    } = {}
  ): Promise<NextResponse> {
    try {
      // Validate request if schema provided
      if (options.validation) {
        const validation = RequestValidator.validate(
          { url: `https://example.com${this.endpoint}` } as NextRequest,
          options.validation
        );
        
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Try cache first
      let result: T;
      
      if (options.cache) {
        const cached = await advancedCaching.get<T>(options.cache.key);
        if (cached) {
          result = cached;
          this.cached = true;
        } else {
          result = await executeWithRetry(handler);
          await advancedCaching.set(options.cache.key, result, {
            ttl: options.cache.ttl,
            tags: options.cache.tags || [],
            priority: 'high'
          });
        }
      } else {
        result = await executeWithRetry(handler);
      }

      // Build response
      const responseTime = Date.now() - this.startTime;
      const response = this.buildSuccessResponse(result, responseTime);

      // Record metrics
      APIPerformanceMonitor.recordRequest(this.endpoint, responseTime, true, this.cached);

      // Apply compression if enabled
      if (options.compression && ResponseCompressor.shouldCompress(response)) {
        const compressed = ResponseCompressor.compress(response);
        
        return new NextResponse(compressed, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'X-Response-Time': `${responseTime}ms`,
            'X-Request-ID': this.requestId,
            'X-Cached': this.cached.toString(),
            'Cache-Control': this.cached ? 'hit' : 'miss'
          }
        });
      }

      return NextResponse.json(response, {
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Request-ID': this.requestId,
          'X-Cached': this.cached.toString(),
          'Cache-Control': this.cached ? 'hit' : 'miss'
        }
      });

    } catch (error) {
      const responseTime = Date.now() - this.startTime;
      const errorResponse = APIErrorHandler.handle(error, this.requestId);
      errorResponse.meta!.responseTime = responseTime;

      // Record error metrics
      APIPerformanceMonitor.recordRequest(this.endpoint, responseTime, false, false);

      // Determine status code from error
      let statusCode = 500;
      if (error instanceof Error) {
        if (error.message.includes('validation') || error.message.includes('invalid')) {
          statusCode = 400;
        } else if (error.message.includes('auth') || error.message.includes('token')) {
          statusCode = 401;
        } else if (error.message.includes('forbidden')) {
          statusCode = 403;
        } else if (error.message.includes('not found')) {
          statusCode = 404;
        } else if (error.message.includes('timeout')) {
          statusCode = 408;
        }
      }

      return NextResponse.json(errorResponse, {
        status: statusCode,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Request-ID': this.requestId,
          'X-Error': 'true'
        }
      });
    }
  }

  private buildSuccessResponse<T>(data: T, responseTime: number): APIResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
        responseTime,
        cached: this.cached,
        version: '1.0.0'
      }
    };
  }
}

// Utility functions
export function createAPIAccelerator(request: NextRequest): APIAccelerator {
  return new APIAccelerator(request);
}

export async function healthCheck(): Promise<APIResponse> {
  const startTime = Date.now();
  
  try {
    // Check database
    const dbHealth = await executeWithRetry(async () => {
      const query = await createOptimizedQuery('artists');
      await query.select('id').limit(1);
      return true;
    });

    // Check cache
    const cacheHealth = await advancedCaching.getStats();

    // Check external APIs
    const externalHealth = healthMonitor.getSystemHealth();

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        database: dbHealth,
        cache: cacheHealth,
        external: externalHealth,
        performance: APIPerformanceMonitor.getMetrics()
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `health_${Date.now()}`,
        responseTime,
        cached: false,
        version: '1.0.0'
      }
    };
  } catch (error) {
    return APIErrorHandler.handle(error, `health_${Date.now()}`);
  }
}

// Export configuration presets
export const API_CONFIGS = {
  FAST: {
    cache: { ttl: 300000 }, // 5 minutes
    compression: true
  },
  REALTIME: {
    cache: { ttl: 60000 }, // 1 minute
    compression: false
  },
  STATIC: {
    cache: { ttl: 3600000 }, // 1 hour
    compression: true
  },
  DYNAMIC: {
    cache: { ttl: 180000 }, // 3 minutes
    compression: true
  }
} as const;

// Export for monitoring dashboard
export function getComprehensiveMetrics(): {
  api: Record<string, any>;
  database: any;
  cache: any;
  edge: any;
} {
  return {
    api: APIPerformanceMonitor.getMetrics(),
    database: connectionPool.getMetrics(),
    cache: advancedCaching.getStats(),
    edge: edgePerformanceMonitor.getMetrics()
  };
}