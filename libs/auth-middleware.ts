/**
 * Advanced Authentication and UUID Validation Middleware
 * Comprehensive security layer for MySetlist production deployment
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { advancedCaching } from './advanced-caching';
import { healthMonitor } from './circuit-breaker';

// UUID validation regex (RFC 4122 compliant)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // per window
  authMaxRequests: 1000, // higher limit for authenticated users
  skipSuccessfulRequests: true,
  skipFailedRequests: false
};

// Security headers configuration
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
};

// Authentication context
export interface AuthContext {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
  userId: string | null;
  roles: string[];
  permissions: string[];
}

// Rate limiting store
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (now > value.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
  
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      const entry = { count: 1, resetTime: now + windowMs };
      this.store.set(key, entry);
      return entry;
    }
    
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }
  
  get(key: string): { count: number; resetTime: number } | undefined {
    return this.store.get(key);
  }
  
  reset(key: string): void {
    this.store.delete(key);
  }
}

const rateLimitStore = new RateLimitStore();

// UUID validation utilities
export function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export function validateUUIDs(uuids: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const uuid of uuids) {
    if (isValidUUID(uuid)) {
      valid.push(uuid);
    } else {
      invalid.push(uuid);
    }
  }
  
  return { valid, invalid };
}

export function sanitizeUUID(uuid: string): string | null {
  if (!uuid || typeof uuid !== 'string') return null;
  
  // Remove any whitespace and convert to lowercase
  const cleaned = uuid.trim().toLowerCase();
  
  // Validate format
  if (!isValidUUID(cleaned)) return null;
  
  return cleaned;
}

// Authentication utilities
export async function createAuthContext(request: NextRequest): Promise<AuthContext> {
  const cacheKey = `auth:${request.headers.get('authorization') || 'anonymous'}`;
  
  return await advancedCaching.get(
    cacheKey,
    async () => {
      try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (userError || sessionError) {
          return {
            user: null,
            session: null,
            isAuthenticated: false,
            userId: null,
            roles: [],
            permissions: []
          };
        }
        
        // Get user roles and permissions (if implemented)
        let roles: string[] = [];
        let permissions: string[] = [];
        
        if (user) {
          // Query user_roles table if it exists
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .catch(() => ({ data: null }));
          
          if (userRoles) {
            roles = userRoles.map(r => r.role);
          }
          
          // Default permissions based on authentication
          permissions = ['read:public', 'vote:setlists'];
          
          if (roles.includes('admin')) {
            permissions.push('write:all', 'delete:all', 'admin:system');
          }
          
          if (roles.includes('moderator')) {
            permissions.push('write:setlists', 'moderate:votes');
          }
        }
        
        return {
          user,
          session,
          isAuthenticated: !!user,
          userId: user?.id || null,
          roles,
          permissions
        };
      } catch (error) {
        console.error('Auth context creation error:', error);
        return {
          user: null,
          session: null,
          isAuthenticated: false,
          userId: null,
          roles: [],
          permissions: []
        };
      }
    },
    {
      ttl: 300000, // 5 minutes
      priority: 'high',
      tags: ['auth', 'session']
    }
  );
}

// Rate limiting middleware
export function createRateLimitMiddleware(
  options: Partial<typeof RATE_LIMIT_CONFIG> = {}
) {
  const config = { ...RATE_LIMIT_CONFIG, ...options };
  
  return async (request: NextRequest, authContext: AuthContext): Promise<NextResponse | null> => {
    // Get client identifier
    const clientId = getClientIdentifier(request);
    
    // Determine rate limit based on authentication
    const maxRequests = authContext.isAuthenticated 
      ? config.authMaxRequests 
      : config.maxRequests;
    
    // Check rate limit
    const { count, resetTime } = rateLimitStore.increment(clientId, config.windowMs);
    
    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
          limit: maxRequests,
          windowMs: config.windowMs
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': Math.max(0, maxRequests - count).toString(),
            'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
            'Retry-After': retryAfter.toString(),
            ...SECURITY_HEADERS
          }
        }
      );
    }
    
    // Add rate limit headers to successful responses
    request.headers.set('X-RateLimit-Limit', maxRequests.toString());
    request.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
    request.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
    
    return null; // Continue processing
  };
}

// Permission middleware
export function createPermissionMiddleware(requiredPermissions: string[]) {
  return async (request: NextRequest, authContext: AuthContext): Promise<NextResponse | null> => {
    if (requiredPermissions.length === 0) {
      return null; // No permissions required
    }
    
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'This endpoint requires authentication',
          required_permissions: requiredPermissions
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
            ...SECURITY_HEADERS
          }
        }
      );
    }
    
    // Check if user has required permissions
    const hasPermission = requiredPermissions.some(permission => 
      authContext.permissions.includes(permission) ||
      authContext.permissions.includes('admin:system')
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          message: 'You do not have permission to access this resource',
          required_permissions: requiredPermissions,
          user_permissions: authContext.permissions
        },
        {
          status: 403,
          headers: SECURITY_HEADERS
        }
      );
    }
    
    return null; // Continue processing
  };
}

// UUID validation middleware
export function createUUIDValidationMiddleware(uuidParams: string[]) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    if (uuidParams.length === 0) {
      return null; // No UUID validation required
    }
    
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    const errors: string[] = [];
    
    // Validate UUID parameters
    for (const paramName of uuidParams) {
      let value: string | null = null;
      
      // Check query parameters
      if (params.has(paramName)) {
        value = params.get(paramName);
      }
      // Check path parameters (assuming they're in order)
      else if (paramName === 'id' && pathParts.length > 0) {
        value = pathParts[pathParts.length - 1];
      }
      
      if (value && !isValidUUID(value)) {
        errors.push(`Invalid UUID format for parameter: ${paramName}`);
      }
    }
    
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid UUID format',
          message: 'One or more UUID parameters are invalid',
          details: errors,
          uuid_format: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        },
        {
          status: 400,
          headers: SECURITY_HEADERS
        }
      );
    }
    
    return null; // Continue processing
  };
}

// Security headers middleware
export function createSecurityHeadersMiddleware() {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /javascript:/i,  // JavaScript injection
      /vbscript:/i,  // VBScript injection
      /onload=/i,  // Event handler injection
      /onerror=/i,  // Error handler injection
    ];
    
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const url = request.url;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(userAgent) || pattern.test(referer)) {
        return NextResponse.json(
          {
            error: 'Suspicious request detected',
            message: 'Request blocked by security filter',
            timestamp: new Date().toISOString()
          },
          {
            status: 400,
            headers: {
              ...SECURITY_HEADERS,
              'X-Security-Block': 'suspicious-pattern'
            }
          }
        );
      }
    }
    
    return null; // Continue processing
  };
}

// Health check middleware
export function createHealthCheckMiddleware() {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/health') {
      const healthReport = healthMonitor.getSystemHealth();
      
      return NextResponse.json(
        {
          status: healthReport.overall,
          timestamp: new Date().toISOString(),
          services: healthReport.services,
          metrics: healthReport.metrics
        },
        {
          status: healthReport.overall === 'healthy' ? 200 : 503,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS
          }
        }
      );
    }
    
    return null; // Continue processing
  };
}

// Comprehensive middleware composer
export function createApiMiddleware(config: {
  requiredPermissions?: string[];
  validateUUIDs?: string[];
  enableRateLimit?: boolean;
  rateLimitOptions?: Partial<typeof RATE_LIMIT_CONFIG>;
}) {
  const {
    requiredPermissions = [],
    validateUUIDs = [],
    enableRateLimit = true,
    rateLimitOptions = {}
  } = config;
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const startTime = performance.now();
    
    try {
      // Health check (always first)
      const healthCheck = await createHealthCheckMiddleware()(request);
      if (healthCheck) return healthCheck;
      
      // Security headers
      const securityCheck = await createSecurityHeadersMiddleware()(request);
      if (securityCheck) return securityCheck;
      
      // UUID validation
      const uuidCheck = await createUUIDValidationMiddleware(validateUUIDs)(request);
      if (uuidCheck) return uuidCheck;
      
      // Create auth context
      const authContext = await createAuthContext(request);
      
      // Rate limiting
      if (enableRateLimit) {
        const rateLimitCheck = await createRateLimitMiddleware(rateLimitOptions)(request, authContext);
        if (rateLimitCheck) return rateLimitCheck;
      }
      
      // Permission check
      const permissionCheck = await createPermissionMiddleware(requiredPermissions)(request, authContext);
      if (permissionCheck) return permissionCheck;
      
      // Add auth context to request headers for downstream use
      request.headers.set('X-Auth-Context', JSON.stringify({
        userId: authContext.userId,
        isAuthenticated: authContext.isAuthenticated,
        roles: authContext.roles,
        permissions: authContext.permissions
      }));
      
      // Add performance timing
      const processingTime = Math.round(performance.now() - startTime);
      request.headers.set('X-Middleware-Time', `${processingTime}ms`);
      
      return null; // Continue processing
      
    } catch (error) {
      console.error('Middleware error:', error);
      
      return NextResponse.json(
        {
          error: 'Middleware error',
          message: 'An error occurred while processing your request',
          timestamp: new Date().toISOString()
        },
        {
          status: 500,
          headers: {
            ...SECURITY_HEADERS,
            'X-Error-Type': 'middleware-error'
          }
        }
      );
    }
  };
}

// Utility functions
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIP || 'unknown';
  
  // Include user agent for more specific identification
  const userAgent = request.headers.get('user-agent') || '';
  const userAgentHash = hashString(userAgent);
  
  return `${ip}:${userAgentHash}`;
}

function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

// Export middleware instances for common use cases
export const publicApiMiddleware = createApiMiddleware({
  enableRateLimit: true,
  rateLimitOptions: { maxRequests: 100, authMaxRequests: 500 }
});

export const protectedApiMiddleware = createApiMiddleware({
  requiredPermissions: ['read:public'],
  enableRateLimit: true,
  rateLimitOptions: { maxRequests: 200, authMaxRequests: 1000 }
});

export const adminApiMiddleware = createApiMiddleware({
  requiredPermissions: ['admin:system'],
  enableRateLimit: true,
  rateLimitOptions: { maxRequests: 50, authMaxRequests: 200 }
});

export const voteApiMiddleware = createApiMiddleware({
  requiredPermissions: ['vote:setlists'],
  validateUUIDs: ['setlist_song_id'],
  enableRateLimit: true,
  rateLimitOptions: { maxRequests: 300, authMaxRequests: 1000 }
});

export const showApiMiddleware = createApiMiddleware({
  validateUUIDs: ['id'],
  enableRateLimit: true,
  rateLimitOptions: { maxRequests: 200, authMaxRequests: 800 }
});

export { SECURITY_HEADERS, UUID_REGEX, AuthContext };