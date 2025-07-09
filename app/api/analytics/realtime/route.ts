import { NextRequest, NextResponse } from 'next/server';
import { realTimeAnalytics } from '@/libs/real-time-analytics';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Real-time analytics API endpoint
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '1h' | '24h' | '7d' | '30d' || '24h';
    
    // Get real-time metrics
    const metrics = await realTimeAnalytics.getRealTimeMetrics();
    
    // Get insights for the specified timeframe
    const insights = await realTimeAnalytics.getInsights(timeframe);
    
    // Get active alerts
    const alerts = await realTimeAnalytics.getActiveAlerts();
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: {
        metrics,
        insights,
        alerts,
        timestamp: new Date().toISOString(),
        processingTime
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch real-time analytics' },
      { status: 500 }
    );
  }
}

// Track analytics event
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    const { type, entityId, entityType, metadata } = body;
    
    // Extract session information
    const sessionId = request.headers.get('x-session-id') || 'anonymous';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const pageUrl = request.headers.get('referer') || 'unknown';
    
    // Track the event
    await realTimeAnalytics.trackEvent({
      type: type as any,
      userId: user?.id,
      sessionId,
      entityId,
      entityType,
      metadata: metadata || {},
      userAgent,
      ipAddress,
      pageUrl
    });
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      processingTime,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('Error tracking analytics event:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics event' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID'
    }
  });
}