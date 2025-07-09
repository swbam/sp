import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Dashboard API for analytics data visualization
// Supports real-time metrics, user analytics, platform insights

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DashboardQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d']).default('24h'),
  metrics: z.array(z.string()).default(['all']),
  granularity: z.enum(['hour', 'day', 'week']).default('hour'),
  userId: z.string().uuid().optional() // For user-specific analytics
});

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = DashboardQuerySchema.parse({
      timeframe: searchParams.get('timeframe') || '24h',
      metrics: searchParams.get('metrics')?.split(',') || ['all'],
      granularity: searchParams.get('granularity') || 'hour',
      userId: searchParams.get('userId') || undefined
    });

    // Get current user for permission checking
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // If requesting user-specific data, verify permission
    if (query.userId && (!user || user.id !== query.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dashboard = await generateDashboard(supabase, query, user);
    
    return NextResponse.json(dashboard);
    
  } catch (error) {
    console.error('Dashboard API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}

async function generateDashboard(
  supabase: any,
  query: z.infer<typeof DashboardQuerySchema>,
  user: any
): Promise<DashboardData> {
  const timeRange = getTimeRange(query.timeframe);
  const metrics = query.metrics.includes('all') 
    ? ['platform', 'users', 'content', 'engagement'] 
    : query.metrics;

  const dashboard: DashboardData = {
    timeframe: query.timeframe,
    generatedAt: new Date().toISOString(),
    realTimeStats: await getRealTimeStats(supabase),
    sections: {}
  };

  // Generate requested sections
  if (metrics.includes('platform')) {
    dashboard.sections.platform = await getPlatformMetrics(supabase, timeRange, query.granularity);
  }

  if (metrics.includes('users')) {
    dashboard.sections.users = await getUserMetrics(supabase, timeRange, query.granularity);
  }

  if (metrics.includes('content')) {
    dashboard.sections.content = await getContentMetrics(supabase, timeRange);
  }

  if (metrics.includes('engagement')) {
    dashboard.sections.engagement = await getEngagementMetrics(supabase, timeRange);
  }

  // User-specific analytics if requested
  if (query.userId && user) {
    dashboard.sections.personal = await getPersonalAnalytics(supabase, query.userId, timeRange);
  }

  return dashboard;
}

async function getRealTimeStats(supabase: any): Promise<RealTimeStats> {
  // Get current real-time platform statistics
  const { data: platformStats } = await supabase
    .from('real_time_platform_stats')
    .select('*')
    .eq('id', 1)
    .single();

  // Get recent activity (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const { data: recentActivity } = await supabase
    .from('user_events')
    .select('event_type, created_at')
    .gte('created_at', fiveMinutesAgo.toISOString());

  // Get active users count
  const { data: activeUsers } = await supabase
    .from('real_time_user_stats')
    .select('user_id', { count: 'exact' })
    .eq('online_status', true)
    .gte('last_activity', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  return {
    concurrentUsers: platformStats?.concurrent_users || 0,
    votesLastHour: platformStats?.votes_last_hour || 0,
    activeShows: platformStats?.active_shows || 0,
    systemLoad: platformStats?.system_load || 0,
    recentActivityCount: recentActivity?.length || 0,
    onlineUsers: activeUsers?.length || 0,
    lastUpdated: platformStats?.last_updated || new Date().toISOString()
  };
}

async function getPlatformMetrics(
  supabase: any,
  timeRange: { start: Date; end: Date },
  granularity: string
): Promise<PlatformMetrics> {
  // Get platform metrics over time
  const { data: dailyMetrics } = await supabase
    .from('daily_platform_metrics')
    .select('*')
    .gte('metric_date', timeRange.start.toISOString().split('T')[0])
    .lte('metric_date', timeRange.end.toISOString().split('T')[0])
    .order('metric_date', { ascending: true });

  // Get hourly metrics if needed
  let hourlyData = null;
  if (granularity === 'hour') {
    const { data: hourlyMetrics } = await supabase
      .from('hourly_real_time_metrics')
      .select('*')
      .gte('metric_hour', timeRange.start.toISOString())
      .lte('metric_hour', timeRange.end.toISOString())
      .order('metric_hour', { ascending: true });
    
    hourlyData = hourlyMetrics;
  }

  // Calculate aggregated metrics
  const totalUsers = dailyMetrics?.reduce((sum: number, day: any) => 
    Math.max(sum, day.active_users), 0) || 0;
  
  const totalVotes = dailyMetrics?.reduce((sum: number, day: any) => 
    sum + (day.total_votes || 0), 0) || 0;

  const avgSessionDuration = dailyMetrics?.reduce((sum: number, day: any) => 
    sum + (day.avg_session_duration || 0), 0) / (dailyMetrics?.length || 1) || 0;

  return {
    summary: {
      totalUsers,
      totalVotes,
      avgSessionDuration: Math.round(avgSessionDuration * 100) / 100,
      bounceRate: dailyMetrics?.[dailyMetrics.length - 1]?.bounce_rate || 0
    },
    timeSeries: {
      daily: dailyMetrics || [],
      hourly: hourlyData || []
    },
    trends: {
      userGrowth: calculateGrowthRate(dailyMetrics, 'active_users'),
      voteGrowth: calculateGrowthRate(dailyMetrics, 'total_votes'),
      retentionTrend: calculateGrowthRate(dailyMetrics, 'user_retention_rate')
    }
  };
}

async function getUserMetrics(
  supabase: any,
  timeRange: { start: Date; end: Date },
  granularity: string
): Promise<UserMetrics> {
  // User engagement distribution
  const { data: engagementDistribution } = await supabase
    .from('user_engagement_warehouse')
    .select('activity_level, engagement_score')
    .gte('updated_at', timeRange.start.toISOString());

  // User behavior patterns
  const { data: behaviorPatterns } = await supabase
    .from('user_behavior_warehouse')
    .select('most_active_hour, most_active_day, engagement_score')
    .gte('updated_at', timeRange.start.toISOString());

  // Cohort analysis
  const { data: cohortData } = await supabase
    .from('cohort_retention')
    .select('*')
    .gte('cohort_date', timeRange.start.toISOString().split('T')[0])
    .order('cohort_date', { ascending: false })
    .limit(10);

  // Top users by engagement
  const { data: topUsers } = await supabase
    .from('user_summary_view')
    .select('*')
    .order('engagement_score', { ascending: false })
    .limit(10);

  return {
    distribution: {
      byActivity: groupBy(engagementDistribution || [], 'activity_level'),
      byEngagement: createEngagementBuckets(engagementDistribution || [])
    },
    patterns: {
      hourlyActivity: aggregateByHour(behaviorPatterns || []),
      dailyActivity: aggregateByDay(behaviorPatterns || [])
    },
    cohorts: cohortData || [],
    topUsers: (topUsers || []).map(user => ({
      id: user.id,
      name: user.full_name || 'Anonymous',
      engagementScore: user.engagement_score,
      totalVotes: user.total_votes,
      followedArtists: user.followed_artists_count
    }))
  };
}

async function getContentMetrics(
  supabase: any,
  timeRange: { start: Date; end: Date }
): Promise<ContentMetrics> {
  // Artist popularity
  const { data: topArtists } = await supabase
    .from('artist_popularity_view')
    .select('*')
    .order('trending_score', { ascending: false })
    .limit(20);

  // Show engagement
  const { data: topShows } = await supabase
    .from('show_engagement_view')
    .select('*')
    .eq('status', 'upcoming')
    .order('engagement_rate', { ascending: false })
    .limit(20);

  // Genre trends
  const { data: genreTrends } = await supabase
    .from('daily_platform_metrics')
    .select('trending_genres')
    .gte('metric_date', timeRange.start.toISOString().split('T')[0])
    .order('metric_date', { ascending: false })
    .limit(7);

  return {
    artists: {
      trending: topArtists?.slice(0, 10) || [],
      popular: topArtists?.sort((a: any, b: any) => b.total_followers - a.total_followers).slice(0, 10) || []
    },
    shows: {
      mostEngaged: topShows?.slice(0, 10) || [],
      upcoming: topShows?.filter((show: any) => show.status === 'upcoming').slice(0, 10) || []
    },
    genres: {
      trending: extractTrendingGenres(genreTrends || []),
      distribution: await getGenreDistribution(supabase)
    }
  };
}

async function getEngagementMetrics(
  supabase: any,
  timeRange: { start: Date; end: Date }
): Promise<EngagementMetrics> {
  // Voting patterns
  const { data: votingStats } = await supabase
    .from('votes')
    .select('vote_type, created_at')
    .gte('created_at', timeRange.start.toISOString());

  // Session metrics
  const { data: sessionStats } = await supabase
    .from('user_events')
    .select('session_id, event_type, created_at')
    .gte('created_at', timeRange.start.toISOString());

  // Page performance
  const { data: pageViews } = await supabase
    .from('user_events')
    .select('page_url, created_at')
    .eq('event_type', 'page_view')
    .gte('created_at', timeRange.start.toISOString());

  return {
    voting: {
      totalVotes: votingStats?.length || 0,
      upvoteRatio: calculateUpvoteRatio(votingStats || []),
      votesOverTime: aggregateVotesByTime(votingStats || [])
    },
    sessions: {
      totalSessions: new Set(sessionStats?.map(s => s.session_id)).size,
      avgSessionLength: calculateAvgSessionLength(sessionStats || []),
      bounceRate: calculateBounceRate(sessionStats || [])
    },
    content: {
      topPages: getTopPages(pageViews || []),
      pageViews: pageViews?.length || 0
    }
  };
}

async function getPersonalAnalytics(
  supabase: any,
  userId: string,
  timeRange: { start: Date; end: Date }
): Promise<PersonalAnalytics> {
  // User's personal metrics
  const [behaviorData, votingData, engagementData, recentActivity] = await Promise.all([
    supabase
      .from('user_behavior_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('voting_patterns_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('user_engagement_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('user_events')
      .select('event_type, event_data, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  // User's votes in timeframe
  const { data: userVotes } = await supabase
    .from('votes')
    .select(`
      vote_type,
      created_at,
      setlist_songs!inner(
        songs!inner(title, artist_name),
        setlists!inner(
          shows!inner(
            name,
            date,
            artists!inner(name)
          )
        )
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', timeRange.start.toISOString())
    .order('created_at', { ascending: false });

  return {
    summary: {
      engagementScore: engagementData.data?.engagement_score || 0,
      activityLevel: engagementData.data?.activity_level || 'low',
      totalVotes: votingData.data?.total_votes || 0,
      upvoteRatio: votingData.data?.upvote_ratio || 0,
      artistsDiversity: votingData.data?.artists_diversity || 0
    },
    activity: {
      recentEvents: recentActivity.data || [],
      recentVotes: userVotes || [],
      patterns: behaviorData.data?.behavior_summary || {}
    },
    insights: {
      mostActiveHour: behaviorData.data?.most_active_hour || 0,
      mostActiveDay: behaviorData.data?.most_active_day || 0,
      votingConsistency: votingData.data?.voting_consistency || 0
    }
  };
}

// Utility functions
function getTimeRange(timeframe: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (timeframe) {
    case '1h':
      start.setHours(end.getHours() - 1);
      break;
    case '24h':
      start.setDate(end.getDate() - 1);
      break;
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
  }
  
  return { start, end };
}

function calculateGrowthRate(data: any[], field: string): number {
  if (!data || data.length < 2) return 0;
  
  const latest = data[data.length - 1]?.[field] || 0;
  const previous = data[data.length - 2]?.[field] || 0;
  
  if (previous === 0) return 0;
  return Math.round(((latest - previous) / previous) * 100 * 100) / 100;
}

function groupBy(array: any[], key: string): Record<string, number> {
  return array.reduce((result, item) => {
    const group = item[key] || 'unknown';
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {});
}

function createEngagementBuckets(data: any[]): Record<string, number> {
  const buckets = { 'low': 0, 'medium': 0, 'high': 0 };
  
  data.forEach(item => {
    const score = item.engagement_score || 0;
    if (score < 0.3) buckets.low++;
    else if (score < 0.7) buckets.medium++;
    else buckets.high++;
  });
  
  return buckets;
}

function aggregateByHour(data: any[]): number[] {
  const hourly = new Array(24).fill(0);
  data.forEach(item => {
    const hour = item.most_active_hour;
    if (hour >= 0 && hour < 24) {
      hourly[hour]++;
    }
  });
  return hourly;
}

function aggregateByDay(data: any[]): number[] {
  const daily = new Array(7).fill(0);
  data.forEach(item => {
    const day = item.most_active_day;
    if (day >= 0 && day < 7) {
      daily[day]++;
    }
  });
  return daily;
}

function calculateUpvoteRatio(votes: any[]): number {
  if (votes.length === 0) return 0;
  const upvotes = votes.filter(v => v.vote_type === 'up').length;
  return Math.round((upvotes / votes.length) * 100 * 100) / 100;
}

function aggregateVotesByTime(votes: any[]): any[] {
  // Group votes by hour
  const hourlyVotes: Record<string, number> = {};
  
  votes.forEach(vote => {
    const hour = new Date(vote.created_at).toISOString().slice(0, 13) + ':00:00.000Z';
    hourlyVotes[hour] = (hourlyVotes[hour] || 0) + 1;
  });
  
  return Object.entries(hourlyVotes).map(([time, count]) => ({
    time,
    count
  })).sort((a, b) => a.time.localeCompare(b.time));
}

function calculateAvgSessionLength(events: any[]): number {
  // Simplified session length calculation
  const sessions: Record<string, Date[]> = {};
  
  events.forEach(event => {
    if (!sessions[event.session_id]) {
      sessions[event.session_id] = [];
    }
    sessions[event.session_id].push(new Date(event.created_at));
  });
  
  const sessionLengths = Object.values(sessions).map(times => {
    times.sort((a, b) => a.getTime() - b.getTime());
    return (times[times.length - 1].getTime() - times[0].getTime()) / (1000 * 60); // minutes
  });
  
  return sessionLengths.length > 0 
    ? sessionLengths.reduce((sum, length) => sum + length, 0) / sessionLengths.length 
    : 0;
}

function calculateBounceRate(events: any[]): number {
  const sessions: Record<string, number> = {};
  
  events.forEach(event => {
    sessions[event.session_id] = (sessions[event.session_id] || 0) + 1;
  });
  
  const sessionCounts = Object.values(sessions);
  const bouncedSessions = sessionCounts.filter(count => count === 1).length;
  
  return sessionCounts.length > 0 
    ? Math.round((bouncedSessions / sessionCounts.length) * 100 * 100) / 100 
    : 0;
}

function getTopPages(pageViews: any[]): Array<{ page: string; views: number }> {
  const pageCounts: Record<string, number> = {};
  
  pageViews.forEach(view => {
    const page = view.page_url || 'unknown';
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  });
  
  return Object.entries(pageCounts)
    .map(([page, views]) => ({ page, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
}

async function getGenreDistribution(supabase: any): Promise<Record<string, number>> {
  const { data: artists } = await supabase
    .from('artists')
    .select('genres');
  
  const genreCount: Record<string, number> = {};
  
  (artists || []).forEach((artist: any) => {
    const genres = artist.genres || [];
    genres.forEach((genre: string) => {
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    });
  });
  
  return genreCount;
}

function extractTrendingGenres(genreData: any[]): string[] {
  if (!genreData.length) return [];
  
  const latestData = genreData[0]?.trending_genres || [];
  return Array.isArray(latestData) ? latestData.slice(0, 10) : [];
}

// Type definitions
interface DashboardData {
  timeframe: string;
  generatedAt: string;
  realTimeStats: RealTimeStats;
  sections: {
    platform?: PlatformMetrics;
    users?: UserMetrics;
    content?: ContentMetrics;
    engagement?: EngagementMetrics;
    personal?: PersonalAnalytics;
  };
}

interface RealTimeStats {
  concurrentUsers: number;
  votesLastHour: number;
  activeShows: number;
  systemLoad: number;
  recentActivityCount: number;
  onlineUsers: number;
  lastUpdated: string;
}

interface PlatformMetrics {
  summary: {
    totalUsers: number;
    totalVotes: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  timeSeries: {
    daily: any[];
    hourly: any[];
  };
  trends: {
    userGrowth: number;
    voteGrowth: number;
    retentionTrend: number;
  };
}

interface UserMetrics {
  distribution: {
    byActivity: Record<string, number>;
    byEngagement: Record<string, number>;
  };
  patterns: {
    hourlyActivity: number[];
    dailyActivity: number[];
  };
  cohorts: any[];
  topUsers: Array<{
    id: string;
    name: string;
    engagementScore: number;
    totalVotes: number;
    followedArtists: number;
  }>;
}

interface ContentMetrics {
  artists: {
    trending: any[];
    popular: any[];
  };
  shows: {
    mostEngaged: any[];
    upcoming: any[];
  };
  genres: {
    trending: string[];
    distribution: Record<string, number>;
  };
}

interface EngagementMetrics {
  voting: {
    totalVotes: number;
    upvoteRatio: number;
    votesOverTime: Array<{ time: string; count: number }>;
  };
  sessions: {
    totalSessions: number;
    avgSessionLength: number;
    bounceRate: number;
  };
  content: {
    topPages: Array<{ page: string; views: number }>;
    pageViews: number;
  };
}

interface PersonalAnalytics {
  summary: {
    engagementScore: number;
    activityLevel: string;
    totalVotes: number;
    upvoteRatio: number;
    artistsDiversity: number;
  };
  activity: {
    recentEvents: any[];
    recentVotes: any[];
    patterns: any;
  };
  insights: {
    mostActiveHour: number;
    mostActiveDay: number;
    votingConsistency: number;
  };
}