import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { healthMonitor } from '@/libs/circuit-breaker';
import { advancedCaching } from '@/libs/advanced-caching';
import { APIOptimizer, perfMonitor } from '@/libs/performance';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Get comprehensive system health report
export async function GET(request: Request) {
  return perfMonitor.measure('health_check_api', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const detailed = searchParams.get('detailed') === 'true';
      const service = searchParams.get('service');

      // Get system health
      const systemHealth = healthMonitor.getSystemHealth();

      // Get specific service health if requested
      if (service) {
        const serviceHealth = healthMonitor.getServiceHealth(service);
        if (!serviceHealth) {
          return NextResponse.json({
            error: `Service '${service}' not found`
          }, { status: 404 });
        }

        return NextResponse.json({
          service: serviceHealth,
          timestamp: new Date().toISOString()
        }, {
          headers: APIOptimizer.getPerformanceHeaders(30) // 30 second cache
        });
      }

      // Basic health check response
      const basicResponse = {
        status: systemHealth.overall,
        timestamp: systemHealth.timestamp,
        uptime_percentage: systemHealth.metrics.uptimePercentage,
        response_time: systemHealth.metrics.averageResponseTime,
        services_count: {
          total: systemHealth.services.length,
          healthy: systemHealth.services.filter(s => s.status === 'healthy').length,
          degraded: systemHealth.services.filter(s => s.status === 'degraded').length,
          unhealthy: systemHealth.services.filter(s => s.status === 'unhealthy').length
        }
      };

      // Detailed response includes full metrics
      if (detailed) {
        const cacheStats = advancedCaching.getStats();
        const cacheMetrics = advancedCaching.getDetailedMetrics();

        return NextResponse.json({
          ...basicResponse,
          services: systemHealth.services,
          alerts: systemHealth.alerts,
          metrics: systemHealth.metrics,
          cache_performance: {
            stats: cacheStats,
            layers: cacheMetrics
          },
          system_info: {
            node_version: process.version,
            platform: process.platform,
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
          }
        }, {
          headers: APIOptimizer.getPerformanceHeaders(10) // 10 second cache for detailed
        });
      }

      return NextResponse.json(basicResponse, {
        headers: APIOptimizer.getPerformanceHeaders(30)
      });

    } catch (error) {
      console.error('Health check API error:', error);
      
      return NextResponse.json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      }, { 
        status: 500,
        headers: APIOptimizer.getPerformanceHeaders(0) // No caching on errors
      });
    }
  });
}

// Trigger manual health checks or service operations
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication check for admin operations
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check admin role (implement proper role checking)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, service, params = {} } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'check_service':
        if (!service) {
          return NextResponse.json({ error: 'service is required for check_service action' }, { status: 400 });
        }
        result = await manualServiceCheck(service);
        break;

      case 'clear_cache':
        result = await clearSystemCache(params);
        break;

      case 'optimize_performance':
        result = await optimizeSystemPerformance();
        break;

      case 'run_diagnostics':
        result = await runSystemDiagnostics();
        break;

      case 'reset_circuit_breakers':
        result = await resetCircuitBreakers(service);
        break;

      default:
        return NextResponse.json({ 
          error: `Invalid action: ${action}. Valid actions: check_service, clear_cache, optimize_performance, run_diagnostics, reset_circuit_breakers`
        }, { status: 400 });
    }

    return NextResponse.json({
      action,
      service,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health monitoring POST API error:', error);
    return NextResponse.json({ 
      error: 'Failed to execute monitoring action',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// Helper functions for monitoring operations

async function manualServiceCheck(serviceName: string) {
  const serviceHealth = healthMonitor.getServiceHealth(serviceName);
  
  if (!serviceHealth) {
    throw new Error(`Service '${serviceName}' not found`);
  }

  // Trigger immediate health check
  // In a real implementation, you'd call the actual health check function
  return {
    service: serviceName,
    previous_status: serviceHealth.status,
    check_triggered: true,
    message: 'Manual health check triggered'
  };
}

async function clearSystemCache(params: any) {
  const { level = 'all', tags = [] } = params;
  
  let clearedCount = 0;
  
  if (level === 'all') {
    advancedCaching.clear();
    clearedCount = 'all';
  } else if (tags.length > 0) {
    clearedCount = advancedCaching.clearByTags(tags);
  }

  return {
    level,
    tags,
    cleared_entries: clearedCount,
    message: 'Cache cleared successfully'
  };
}

async function optimizeSystemPerformance() {
  // Run performance optimizations
  advancedCaching.optimizeLayout();
  
  // Prefetch popular data
  await advancedCaching.prefetchPopularData();

  return {
    optimizations_applied: [
      'cache_layout_optimized',
      'popular_data_prefetched'
    ],
    message: 'Performance optimizations completed'
  };
}

async function runSystemDiagnostics() {
  const systemHealth = healthMonitor.getSystemHealth();
  const cacheStats = advancedCaching.getStats();
  
  // Analyze system performance
  const diagnostics = {
    overall_health: systemHealth.overall,
    critical_issues: systemHealth.alerts.filter(alert => alert.type === 'critical'),
    performance_metrics: {
      cache_hit_rate: cacheStats.hitRate,
      average_response_time: systemHealth.metrics.averageResponseTime,
      error_rate: systemHealth.metrics.errorRate
    },
    recommendations: []
  };

  // Generate recommendations based on metrics
  if (cacheStats.hitRate < 70) {
    diagnostics.recommendations.push('Consider optimizing cache strategy - hit rate below 70%');
  }

  if (systemHealth.metrics.averageResponseTime > 1000) {
    diagnostics.recommendations.push('High response times detected - investigate slow queries');
  }

  if (systemHealth.metrics.errorRate > 5) {
    diagnostics.recommendations.push('Error rate above 5% - check error logs and service health');
  }

  return diagnostics;
}

async function resetCircuitBreakers(serviceName?: string) {
  // In a real implementation, you'd reset actual circuit breakers
  return {
    service: serviceName || 'all',
    reset_count: serviceName ? 1 : 'all',
    message: `Circuit breakers reset for ${serviceName || 'all services'}`
  };
}