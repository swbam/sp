import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Event schema validation
const EventSchema = z.object({
  event_type: z.string().min(1).max(100),
  event_data: z.record(z.any()).optional(),
  page_url: z.string().url().optional(),
  session_id: z.string().min(1).max(255),
});

const BatchEventSchema = z.object({
  events: z.array(EventSchema).min(1).max(50), // Limit batch size for performance
});

// Real-time event tracking endpoint
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user (optional for some events)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Parse and validate request body
    const body = await request.json();
    const isBatch = Array.isArray(body.events);
    
    if (isBatch) {
      const { events } = BatchEventSchema.parse(body);
      await processBatchEvents(supabase, events, user, request);
    } else {
      const event = EventSchema.parse(body);
      await processSingleEvent(supabase, event, user, request);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Analytics event error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process event' },
      { status: 500 }
    );
  }
}

async function processSingleEvent(
  supabase: any,
  event: z.infer<typeof EventSchema>,
  user: any,
  request: Request
) {
  const eventData = await enrichEventData(event, user, request);
  
  const { error } = await supabase
    .from('user_events')
    .insert(eventData);
    
  if (error) throw error;
  
  // Trigger real-time aggregation for critical events
  if (isCriticalEvent(event.event_type)) {
    await triggerRealTimeAggregation(supabase, user?.id, event.event_type, event.event_data);
  }
}

async function processBatchEvents(
  supabase: any,
  events: z.infer<typeof EventSchema>[],
  user: any,
  request: Request
) {
  const enrichedEvents = await Promise.all(
    events.map(event => enrichEventData(event, user, request))
  );
  
  const { error } = await supabase
    .from('user_events')
    .insert(enrichedEvents);
    
  if (error) throw error;
  
  // Process critical events for real-time aggregation
  const criticalEvents = events.filter(event => isCriticalEvent(event.event_type));
  if (criticalEvents.length > 0 && user) {
    await Promise.all(
      criticalEvents.map(event => 
        triggerRealTimeAggregation(supabase, user.id, event.event_type, event.event_data)
      )
    );
  }
}

async function enrichEventData(
  event: z.infer<typeof EventSchema>,
  user: any,
  request: Request
) {
  const userAgent = request.headers.get('user-agent') || '';
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0] || realIp || '127.0.0.1';
  
  return {
    user_id: user?.id || null,
    session_id: event.session_id,
    event_type: event.event_type,
    event_data: event.event_data || {},
    page_url: event.page_url,
    user_agent: userAgent,
    ip_address: ipAddress,
  };
}

function isCriticalEvent(eventType: string): boolean {
  return [
    'vote_cast',
    'artist_followed',
    'show_viewed',
    'user_signup',
    'user_login'
  ].includes(eventType);
}

async function triggerRealTimeAggregation(
  supabase: any,
  userId: string,
  eventType: string,
  eventData: any
) {
  try {
    // Update real-time user stats based on event type
    switch (eventType) {
      case 'vote_cast':
        await updateDailyUserStats(supabase, userId, 'votes_cast', 1);
        await updateUserBehaviorFeatures(supabase, userId, 'voting_activity');
        break;
        
      case 'artist_followed':
        await updateDailyUserStats(supabase, userId, 'artists_followed', 1);
        await updateUserBehaviorFeatures(supabase, userId, 'follow_activity');
        break;
        
      case 'show_viewed':
        await updateDailyUserStats(supabase, userId, 'shows_viewed', 1);
        if (eventData?.show_id) {
          await trackShowPopularity(supabase, eventData.show_id);
        }
        break;
    }
  } catch (error) {
    console.error('Real-time aggregation error:', error);
    // Don't throw - event tracking should continue even if aggregation fails
  }
}

async function updateDailyUserStats(
  supabase: any,
  userId: string,
  metric: string,
  increment: number
) {
  const today = new Date().toISOString().split('T')[0];
  
  const { error } = await supabase.rpc('upsert_daily_user_stat', {
    p_user_id: userId,
    p_date: today,
    p_metric: metric,
    p_increment: increment
  });
  
  if (error) {
    console.error(`Failed to update daily stats for ${metric}:`, error);
  }
}

async function updateUserBehaviorFeatures(
  supabase: any,
  userId: string,
  activityType: string
) {
  // Queue ML feature calculation
  const { error } = await supabase
    .from('event_processing_queue')
    .insert({
      event_type: 'calculate_user_features',
      payload: {
        user_id: userId,
        activity_type: activityType,
        timestamp: new Date().toISOString()
      },
      priority: 5
    });
    
  if (error) {
    console.error('Failed to queue feature calculation:', error);
  }
}

async function trackShowPopularity(supabase: any, showId: string) {
  // Update show view count and popularity metrics
  const { error } = await supabase.rpc('increment_show_views', {
    p_show_id: showId
  });
  
  if (error) {
    console.error('Failed to track show popularity:', error);
  }
}

// GET endpoint for retrieving user analytics
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7d';
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];
    
    const analytics = await getUserAnalytics(supabase, user.id, timeframe, metrics);
    
    return NextResponse.json(analytics);
    
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}

async function getUserAnalytics(
  supabase: any,
  userId: string,
  timeframe: string,
  metrics: string[]
) {
  const days = parseTimeframe(timeframe);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const analytics: any = {};
  
  if (metrics.includes('all') || metrics.includes('daily_stats')) {
    const { data: dailyStats } = await supabase
      .from('daily_user_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });
      
    analytics.daily_stats = dailyStats || [];
  }
  
  if (metrics.includes('all') || metrics.includes('behavior_features')) {
    const { data: behaviorFeatures } = await supabase
      .from('user_behavior_features')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    analytics.behavior_features = behaviorFeatures;
  }
  
  if (metrics.includes('all') || metrics.includes('recent_activity')) {
    const { data: recentActivity } = await supabase
      .from('user_events')
      .select('event_type, event_data, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
      
    analytics.recent_activity = recentActivity || [];
  }
  
  return analytics;
}

function parseTimeframe(timeframe: string): number {
  const timeframes: Record<string, number> = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365
  };
  
  return timeframes[timeframe] || 7;
}