import { NextRequest, NextResponse } from 'next/server';
import { APIOptimizer } from '@/libs/performance';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface WebVitalMetric {
  metric: string;
  value: number;
  id: string;
  timestamp?: number;
  url?: string;
  userAgent?: string;
  connectionType?: string;
}

interface PerformanceMetrics {
  lcp?: number;
  fcp?: number;
  cls?: number;
  fid?: number;
  ttfb?: number;
  apiResponseTimes?: Record<string, number>;
  memoryUsage?: number;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  pageUrl?: string;
  userAgent?: string;
  connectionType?: string;
}

// In-memory storage for performance metrics aggregation
const performanceCache = new Map<string, PerformanceMetrics[]>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Handle single Web Vital metric
    if (body.metric && body.value && body.id) {
      const webVital: WebVitalMetric = {
        metric: body.metric,
        value: body.value,
        id: body.id,
        timestamp: Date.now(),
        url: body.url || request.headers.get('referer') || 'unknown',
        userAgent,
        connectionType: body.connectionType || 'unknown'
      };
      
      await processWebVitalMetric(webVital);
      
      // Log performance thresholds
      const thresholds = {
        LCP: 2500,
        FCP: 1800,
        CLS: 0.1,
        FID: 100,
        TTFB: 800
      };
      
      const threshold = thresholds[body.metric as keyof typeof thresholds];
      const status = threshold && body.value > threshold ? '⚠️ SLOW' : '✅ GOOD';
      
      console.log(`📊 Web Vital: ${body.metric} = ${body.value}${body.metric === 'CLS' ? '' : 'ms'} (${status})`);
    }
    
    // Handle comprehensive performance metrics
    if (body.lcp || body.fcp || body.cls || body.fid || body.apiResponseTimes) {
      const metrics: PerformanceMetrics = {
        ...body,
        timestamp: Date.now(),
        userAgent,
        pageUrl: body.pageUrl || request.headers.get('referer') || 'unknown',
        connectionType: body.connectionType || 'unknown'
      };
      
      await processComprehensiveMetrics(metrics);
      
      // Log comprehensive metrics
      console.log(`📈 Performance Metrics:`, {
        lcp: metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : 'N/A',
        fcp: metrics.fcp ? `${metrics.fcp.toFixed(0)}ms` : 'N/A',
        cls: metrics.cls ? metrics.cls.toFixed(3) : 'N/A',
        fid: metrics.fid ? `${metrics.fid.toFixed(0)}ms` : 'N/A',
        apiCalls: metrics.apiResponseTimes ? Object.keys(metrics.apiResponseTimes).length : 0,
        memory: metrics.memoryUsage ? `${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'
      });
    }

    // Performance alert system
    await checkPerformanceAlerts(body);

    const processingTime = Date.now() - startTime;
    
    return NextResponse.json(
      { 
        success: true,
        processingTime,
        timestamp: Date.now()
      },
      { 
        status: 200,
        headers: {
          ...APIOptimizer.getPerformanceHeaders(60),
          'X-Processing-Time': `${processingTime}ms`
        }
      }
    );
  } catch (error) {
    console.error('❌ Error processing performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processWebVitalMetric(metric: WebVitalMetric) {
  try {
    // Store in production database
    if (process.env.NODE_ENV === 'production') {
      const supabase = createRouteHandlerClient({ cookies });
      
      const { error } = await supabase
        .from('performance_metrics')
        .insert({
          metric_type: metric.metric,
          value: metric.value,
          session_id: metric.id,
          url: metric.url,
          user_agent: metric.userAgent,
          connection_type: metric.connectionType,
          timestamp: new Date(metric.timestamp || Date.now()).toISOString()
        });
      
      if (error) {
        console.error('Failed to save web vital metric:', error);
      }
    }
    
    // Aggregate in memory for real-time monitoring
    const sessionKey = `${metric.id}_${metric.url}`;
    if (!performanceCache.has(sessionKey)) {
      performanceCache.set(sessionKey, []);
    }
    
    const sessionMetrics = performanceCache.get(sessionKey)!;
    const existingMetric = sessionMetrics.find(m => m[metric.metric as keyof PerformanceMetrics]);
    
    if (existingMetric) {
      (existingMetric as any)[metric.metric] = metric.value;
    } else {
      sessionMetrics.push({
        [metric.metric]: metric.value,
        timestamp: metric.timestamp || Date.now(),
        pageUrl: metric.url,
        userAgent: metric.userAgent
      } as PerformanceMetrics);
    }
    
    // Clean up old entries (keep last 100 per session)
    if (sessionMetrics.length > 100) {
      sessionMetrics.splice(0, sessionMetrics.length - 100);
    }
    
  } catch (error) {
    console.error('Error processing web vital metric:', error);
  }
}

async function processComprehensiveMetrics(metrics: PerformanceMetrics) {
  try {
    // Store in production database
    if (process.env.NODE_ENV === 'production') {
      const supabase = createRouteHandlerClient({ cookies });
      
      // Store core web vitals
      const webVitals = [
        { metric: 'LCP', value: metrics.lcp },
        { metric: 'FCP', value: metrics.fcp },
        { metric: 'CLS', value: metrics.cls },
        { metric: 'FID', value: metrics.fid },
        { metric: 'TTFB', value: metrics.ttfb }
      ].filter(m => m.value !== undefined);
      
      if (webVitals.length > 0) {
        const { error } = await supabase
          .from('performance_metrics')
          .insert(
            webVitals.map(wv => ({
              metric_type: wv.metric,
              value: wv.value,
              session_id: metrics.sessionId,
              url: metrics.pageUrl,
              user_agent: metrics.userAgent,
              connection_type: metrics.connectionType,
              timestamp: new Date(metrics.timestamp).toISOString()
            }))
          );
        
        if (error) {
          console.error('Failed to save comprehensive metrics:', error);
        }
      }
      
      // Store API response times
      if (metrics.apiResponseTimes) {
        const apiMetrics = Object.entries(metrics.apiResponseTimes).map(([endpoint, time]) => ({
          metric_type: 'API_RESPONSE_TIME',
          value: time,
          endpoint,
          session_id: metrics.sessionId,
          url: metrics.pageUrl,
          user_agent: metrics.userAgent,
          timestamp: new Date(metrics.timestamp).toISOString()
        }));
        
        const { error } = await supabase
          .from('performance_metrics')
          .insert(apiMetrics);
        
        if (error) {
          console.error('Failed to save API metrics:', error);
        }
      }
    }
    
    // Update in-memory cache
    const sessionKey = `${metrics.sessionId}_${metrics.pageUrl}`;
    if (!performanceCache.has(sessionKey)) {
      performanceCache.set(sessionKey, []);
    }
    
    performanceCache.get(sessionKey)!.push(metrics);
    
  } catch (error) {
    console.error('Error processing comprehensive metrics:', error);
  }
}

async function checkPerformanceAlerts(metrics: any) {
  try {
    const alerts = [];
    
    // Performance thresholds for alerts
    const thresholds = {
      LCP: 2500,
      FCP: 1800,
      CLS: 0.1,
      FID: 100,
      TTFB: 800,
      API_RESPONSE: 500,
      MEMORY: 100 * 1024 * 1024 // 100MB
    };
    
    // Check Web Vitals
    if (metrics.lcp && metrics.lcp > thresholds.LCP) {
      alerts.push({
        type: 'LCP_SLOW',
        severity: metrics.lcp > thresholds.LCP * 1.5 ? 'HIGH' : 'MEDIUM',
        value: metrics.lcp,
        threshold: thresholds.LCP,
        message: `LCP is ${metrics.lcp.toFixed(0)}ms, exceeding ${thresholds.LCP}ms threshold`
      });
    }
    
    if (metrics.fcp && metrics.fcp > thresholds.FCP) {
      alerts.push({
        type: 'FCP_SLOW',
        severity: metrics.fcp > thresholds.FCP * 1.5 ? 'HIGH' : 'MEDIUM',
        value: metrics.fcp,
        threshold: thresholds.FCP,
        message: `FCP is ${metrics.fcp.toFixed(0)}ms, exceeding ${thresholds.FCP}ms threshold`
      });
    }
    
    if (metrics.cls && metrics.cls > thresholds.CLS) {
      alerts.push({
        type: 'CLS_HIGH',
        severity: metrics.cls > thresholds.CLS * 2 ? 'HIGH' : 'MEDIUM',
        value: metrics.cls,
        threshold: thresholds.CLS,
        message: `CLS is ${metrics.cls.toFixed(3)}, exceeding ${thresholds.CLS} threshold`
      });
    }
    
    if (metrics.fid && metrics.fid > thresholds.FID) {
      alerts.push({
        type: 'FID_SLOW',
        severity: metrics.fid > thresholds.FID * 2 ? 'HIGH' : 'MEDIUM',
        value: metrics.fid,
        threshold: thresholds.FID,
        message: `FID is ${metrics.fid.toFixed(0)}ms, exceeding ${thresholds.FID}ms threshold`
      });
    }
    
    // Check API response times
    if (metrics.apiResponseTimes) {
      Object.entries(metrics.apiResponseTimes).forEach(([endpoint, time]) => {
        if (typeof time === 'number' && time > thresholds.API_RESPONSE) {
          alerts.push({
            type: 'API_SLOW',
            severity: time > thresholds.API_RESPONSE * 2 ? 'HIGH' : 'MEDIUM',
            value: time,
            threshold: thresholds.API_RESPONSE,
            endpoint,
            message: `API response time is ${time.toFixed(0)}ms for ${endpoint}`
          });
        }
      });
    }
    
    // Check memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > thresholds.MEMORY) {
      alerts.push({
        type: 'MEMORY_HIGH',
        severity: metrics.memoryUsage > thresholds.MEMORY * 1.5 ? 'HIGH' : 'MEDIUM',
        value: metrics.memoryUsage,
        threshold: thresholds.MEMORY,
        message: `Memory usage is ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`
      });
    }
    
    // Log alerts
    if (alerts.length > 0) {
      console.log(`🚨 Performance Alerts (${alerts.length}):`, alerts);
      
      // In production, send alerts to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to Slack, email, or monitoring service
        // await sendPerformanceAlerts(alerts);
      }
    }
    
    return alerts;
    
  } catch (error) {
    console.error('Error checking performance alerts:', error);
    return [];
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}