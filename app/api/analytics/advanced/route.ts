import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { advancedAnalytics } from '@/libs/advanced-analytics';
import { APIOptimizer, perfMonitor } from '@/libs/performance';
import { advancedCaching } from '@/libs/advanced-caching';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Track analytics events
export async function POST(request: Request) {
  return perfMonitor.measure('analytics_track_event', async () => {
    try {
      const supabase = createRouteHandlerClient({ cookies });

      // Parse request body
      let body;
      try {
        body = await request.json();
      } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }

      const { 
        type, 
        entity_id, 
        entity_type, 
        metadata = {},
        session_id 
      } = body;

      // Validate required fields
      if (!type || !entity_id || !entity_type) {
        return NextResponse.json({ 
          error: 'Missing required fields: type, entity_id, entity_type' 
        }, { status: 400 });
      }

      // Validate event type
      const validTypes = ['vote', 'view', 'search', 'follow', 'share'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ 
          error: `Invalid event type. Valid types: ${validTypes.join(', ')}` 
        }, { status: 400 });
      }

      // Validate entity type
      const validEntityTypes = ['show', 'artist', 'song', 'setlist'];
      if (!validEntityTypes.includes(entity_type)) {
        return NextResponse.json({ 
          error: `Invalid entity type. Valid types: ${validEntityTypes.join(', ')}` 
        }, { status: 400 });
      }

      // Get user info (optional for anonymous tracking)
      const { data: { user } } = await supabase.auth.getUser();

      // Get client information
      const userAgent = request.headers.get('user-agent');
      const forwardedFor = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

      // Rate limiting for event tracking
      const rateLimitKey = `analytics_${ipAddress}`;
      if (!APIOptimizer.checkRateLimit(rateLimitKey, 100, 60000)) { // 100 events per minute per IP
        return NextResponse.json({ 
          error: 'Rate limit exceeded for analytics events' 
        }, { status: 429 });
      }

      // Track the event
      await advancedAnalytics.trackEvent({
        type,
        userId: user?.id,
        entityId: entity_id,
        entityType: entity_type,
        metadata,
        sessionId: session_id,
        userAgent,
        ipAddress
      });

      return NextResponse.json({ 
        success: true,
        message: 'Event tracked successfully'
      }, {
        status: 201,
        headers: APIOptimizer.getPerformanceHeaders(0) // No caching for tracking
      });

    } catch (error) {
      console.error('Analytics tracking error:', error);
      return NextResponse.json({ 
        error: 'Failed to track event',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  });
}

// Get real-time analytics dashboard
export async function GET(request: Request) {
  return perfMonitor.measure('analytics_dashboard', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const dashboard = searchParams.get('dashboard') || 'realtime';
      const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
      const userId = searchParams.get('user_id');
      const entityId = searchParams.get('entity_id');
      const entityType = searchParams.get('entity_type') as 'show' | 'artist' | 'song';

      const supabase = createRouteHandlerClient({ cookies });
      
      // Authentication check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Rate limiting
      const rateLimitKey = `analytics_dashboard_${user.id}`;
      if (!APIOptimizer.checkRateLimit(rateLimitKey, 30, 60000)) { // 30 requests per minute
        return NextResponse.json({ 
          error: 'Rate limit exceeded for analytics dashboard' 
        }, { status: 429 });
      }

      let result;
      let cacheKey;
      let cacheTTL = 30000; // 30 seconds default

      switch (dashboard) {
        case 'realtime':
          cacheKey = `analytics_realtime_${timeframe}`;
          result = await advancedCaching.get(
            cacheKey,
            () => advancedAnalytics.getRealTimeMetrics(),
            { ttl: cacheTTL, priority: 'high', tags: ['analytics', 'realtime'] }
          );
          break;

        case 'user_engagement':
          if (!userId) {
            return NextResponse.json({ 
              error: 'user_id is required for user engagement dashboard' 
            }, { status: 400 });
          }
          
          cacheKey = `analytics_user_engagement_${userId}`;
          cacheTTL = 300000; // 5 minutes for user data
          result = await advancedCaching.get(
            cacheKey,
            () => advancedAnalytics.getUserEngagementMetrics(userId),
            { ttl: cacheTTL, priority: 'medium', tags: ['analytics', 'user_engagement'] }
          );
          break;

        case 'content_performance':
          if (!entityId || !entityType) {
            return NextResponse.json({ 
              error: 'entity_id and entity_type are required for content performance dashboard' 
            }, { status: 400 });
          }
          
          cacheKey = `analytics_content_${entityType}_${entityId}`;
          cacheTTL = 600000; // 10 minutes for content data
          result = await advancedCaching.get(
            cacheKey,
            () => advancedAnalytics.getContentPerformanceMetrics(entityId, entityType),
            { ttl: cacheTTL, priority: 'medium', tags: ['analytics', 'content_performance'] }
          );
          break;

        case 'insights':
          cacheKey = `analytics_insights_${timeframe}`;
          cacheTTL = 1800000; // 30 minutes for insights
          result = await advancedCaching.get(
            cacheKey,
            () => advancedAnalytics.generateInsights(timeframe),
            { ttl: cacheTTL, priority: 'low', tags: ['analytics', 'insights'] }
          );
          break;

        default:
          return NextResponse.json({ 
            error: 'Invalid dashboard type. Valid types: realtime, user_engagement, content_performance, insights' 
          }, { status: 400 });
      }

      return NextResponse.json({
        dashboard,
        timeframe,
        data: result,
        timestamp: new Date().toISOString()
      }, {
        headers: APIOptimizer.getPerformanceHeaders(Math.floor(cacheTTL / 1000))
      });

    } catch (error) {
      console.error('Analytics dashboard error:', error);
      return NextResponse.json({ 
        error: 'Failed to retrieve analytics data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  });
}