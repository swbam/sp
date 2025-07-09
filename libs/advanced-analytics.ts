/**
 * Advanced Analytics Service for MySetlist
 * Real-time analytics processing and insights generation
 */

import { supabaseAdmin } from './supabaseAdmin';
import { DatabaseOptimizer, perfMonitor } from './performance';
import { calculateShowTrendingScore, calculateArtistTrendingScore } from './trending-algorithms';

export interface AnalyticsEvent {
  type: 'vote' | 'view' | 'search' | 'follow' | 'share';
  userId?: string;
  entityId: string;
  entityType: 'show' | 'artist' | 'song' | 'setlist';
  metadata?: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RealTimeMetrics {
  activeUsers: number;
  totalVotes: number;
  votesPerMinute: number;
  popularShows: Array<{ id: string; name: string; votes: number; trend: number }>;
  trendingArtists: Array<{ id: string; name: string; followers: number; trend: number }>;
  searchTrends: Array<{ query: string; count: number; growth: number }>;
  systemHealth: {
    responseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

export interface UserEngagementMetrics {
  userId: string;
  sessionsCount: number;
  avgSessionDuration: number;
  votesCount: number;
  favoritedArtists: number;
  engagementScore: number;
  lastActivity: Date;
  preferredGenres: string[];
  mostActiveHour: number;
}

export interface ContentPerformanceMetrics {
  entityId: string;
  entityType: 'show' | 'artist' | 'song';
  views: number;
  votes: number;
  shares: number;
  engagementRate: number;
  conversionRate: number;
  trendingScore: number;
  demographics: {
    topRegions: Array<{ region: string; percentage: number }>;
    ageGroups: Array<{ group: string; percentage: number }>;
  };
}

export class AdvancedAnalyticsService {
  private static instance: AdvancedAnalyticsService;
  private eventBuffer: AnalyticsEvent[] = [];
  private bufferFlushInterval = 30000; // 30 seconds
  private maxBufferSize = 1000;

  static getInstance(): AdvancedAnalyticsService {
    if (!AdvancedAnalyticsService.instance) {
      AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
      AdvancedAnalyticsService.instance.startEventProcessing();
    }
    return AdvancedAnalyticsService.instance;
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date()
    };

    this.eventBuffer.push(fullEvent);

    // Flush buffer if it's getting full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      await this.flushEventBuffer();
    }

    // For critical events, process immediately
    if (event.type === 'vote') {
      await this.processVoteEventRealTime(fullEvent);
    }
  }

  /**
   * Get real-time metrics dashboard data
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    return perfMonitor.measure('realtime_metrics', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Get active users (sessions in last hour)
      const activeUsers = await this.getActiveUsersCount(oneHourAgo);

      // Get voting metrics
      const votingMetrics = await this.getVotingMetrics(oneMinuteAgo, now);

      // Get popular shows
      const popularShows = await this.getPopularShows();

      // Get trending artists
      const trendingArtists = await this.getTrendingArtists();

      // Get search trends
      const searchTrends = await this.getSearchTrends();

      // Get system health
      const systemHealth = await this.getSystemHealth();

      return {
        activeUsers,
        totalVotes: votingMetrics.total,
        votesPerMinute: votingMetrics.perMinute,
        popularShows,
        trendingArtists,
        searchTrends,
        systemHealth
      };
    });
  }

  /**
   * Get user engagement analytics
   */
  async getUserEngagementMetrics(userId: string): Promise<UserEngagementMetrics> {
    return DatabaseOptimizer.getCached(
      `user_engagement_${userId}`,
      async () => {
        // Get user activity data
        const { data: userActivity } = await supabaseAdmin
          .from('user_activity_log') // This would be a new table
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        // Get user votes
        const { data: userVotes } = await supabaseAdmin
          .from('votes')
          .select('created_at')
          .eq('user_id', userId);

        // Get user following data
        const { data: userFollowing } = await supabaseAdmin
          .from('user_artists')
          .select('artist:artists(genres)')
          .eq('user_id', userId);

        // Calculate metrics
        const sessionsCount = this.calculateSessionsCount(userActivity || []);
        const avgSessionDuration = this.calculateAvgSessionDuration(userActivity || []);
        const votesCount = userVotes?.length || 0;
        const favoritedArtists = userFollowing?.length || 0;
        const engagementScore = this.calculateEngagementScore({
          sessionsCount,
          avgSessionDuration,
          votesCount,
          favoritedArtists
        });

        // Extract preferred genres
        const preferredGenres = this.extractPreferredGenres(userFollowing || []);

        // Calculate most active hour
        const mostActiveHour = this.calculateMostActiveHour(userActivity || []);

        return {
          userId,
          sessionsCount,
          avgSessionDuration,
          votesCount,
          favoritedArtists,
          engagementScore,
          lastActivity: userActivity?.[0]?.created_at ? new Date(userActivity[0].created_at) : new Date(),
          preferredGenres,
          mostActiveHour
        };
      },
      10 // 10 minute cache
    );
  }

  /**
   * Get content performance metrics
   */
  async getContentPerformanceMetrics(
    entityId: string,
    entityType: 'show' | 'artist' | 'song'
  ): Promise<ContentPerformanceMetrics> {
    return DatabaseOptimizer.getCached(
      `content_performance_${entityType}_${entityId}`,
      async () => {
        let views = 0;
        let votes = 0;
        let shares = 0;

        switch (entityType) {
          case 'show':
            const showMetrics = await this.getShowPerformanceMetrics(entityId);
            views = showMetrics.views;
            votes = showMetrics.votes;
            shares = showMetrics.shares;
            break;
          case 'artist':
            const artistMetrics = await this.getArtistPerformanceMetrics(entityId);
            views = artistMetrics.views;
            votes = artistMetrics.votes;
            shares = artistMetrics.shares;
            break;
          case 'song':
            const songMetrics = await this.getSongPerformanceMetrics(entityId);
            views = songMetrics.views;
            votes = songMetrics.votes;
            shares = songMetrics.shares;
            break;
        }

        const engagementRate = this.calculateEngagementRate(views, votes + shares);
        const conversionRate = this.calculateConversionRate(views, votes);
        const trendingScore = await this.calculateTrendingScore(entityId, entityType);

        return {
          entityId,
          entityType,
          views,
          votes,
          shares,
          engagementRate,
          conversionRate,
          trendingScore,
          demographics: {
            topRegions: [], // Would be populated from user data
            ageGroups: []   // Would be populated from user data
          }
        };
      },
      15 // 15 minute cache
    );
  }

  /**
   * Generate insights and recommendations
   */
  async generateInsights(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    topInsights: string[];
    recommendations: string[];
    alerts: string[];
    predictions: string[];
  }> {
    const insights: string[] = [];
    const recommendations: string[] = [];
    const alerts: string[] = [];
    const predictions: string[] = [];

    // Analyze voting patterns
    const votingInsights = await this.analyzeVotingPatterns(timeframe);
    insights.push(...votingInsights.insights);
    recommendations.push(...votingInsights.recommendations);

    // Analyze user engagement
    const engagementInsights = await this.analyzeUserEngagement(timeframe);
    insights.push(...engagementInsights.insights);
    alerts.push(...engagementInsights.alerts);

    // Generate predictions
    const predictionInsights = await this.generatePredictions(timeframe);
    predictions.push(...predictionInsights);

    return {
      topInsights: insights.slice(0, 5),
      recommendations: recommendations.slice(0, 3),
      alerts: alerts.slice(0, 3),
      predictions: predictions.slice(0, 3)
    };
  }

  /**
   * Process vote events in real-time
   */
  private async processVoteEventRealTime(event: AnalyticsEvent): Promise<void> {
    try {
      // Update real-time vote counters
      await supabaseAdmin
        .from('realtime_vote_metrics')
        .upsert({
          setlist_song_id: event.entityId,
          last_vote_time: event.timestamp.toISOString(),
          vote_velocity: await this.calculateVoteVelocity(event.entityId)
        });

      // Trigger real-time updates to connected clients
      await supabaseAdmin
        .channel('votes_realtime')
        .send({
          type: 'broadcast',
          event: 'vote_update',
          payload: {
            setlist_song_id: event.entityId,
            timestamp: event.timestamp
          }
        });
    } catch (error) {
      console.error('Failed to process real-time vote event:', error);
    }
  }

  /**
   * Start background event processing
   */
  private startEventProcessing(): void {
    // Flush event buffer periodically
    setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.flushEventBuffer();
      }
    }, this.bufferFlushInterval);

    // Clean up old analytics data
    setInterval(async () => {
      await this.cleanupOldAnalyticsData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Flush buffered events to storage
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Store events in analytics table
      await supabaseAdmin
        .from('analytics_events')
        .insert(events.map(event => ({
          type: event.type,
          user_id: event.userId,
          entity_id: event.entityId,
          entity_type: event.entityType,
          metadata: event.metadata,
          timestamp: event.timestamp.toISOString(),
          session_id: event.sessionId,
          user_agent: event.userAgent,
          ip_address: event.ipAddress
        })));

      console.log(`Flushed ${events.length} analytics events`);
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...this.eventBuffer);
    }
  }

  // Helper methods for analytics calculations
  private async getActiveUsersCount(since: Date): Promise<number> {
    // Implementation would query session data
    return 0;
  }

  private async getVotingMetrics(since: Date, until: Date): Promise<{ total: number; perMinute: number }> {
    const { count } = await supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact' })
      .gte('created_at', since.toISOString())
      .lte('created_at', until.toISOString());

    const minutes = (until.getTime() - since.getTime()) / (1000 * 60);
    return {
      total: count || 0,
      perMinute: minutes > 0 ? (count || 0) / minutes : 0
    };
  }

  private async getPopularShows(): Promise<Array<{ id: string; name: string; votes: number; trend: number }>> {
    // Implementation would calculate show popularity
    return [];
  }

  private async getTrendingArtists(): Promise<Array<{ id: string; name: string; followers: number; trend: number }>> {
    // Implementation would calculate artist trends
    return [];
  }

  private async getSearchTrends(): Promise<Array<{ query: string; count: number; growth: number }>> {
    // Implementation would analyze search patterns
    return [];
  }

  private async getSystemHealth(): Promise<{ responseTime: number; errorRate: number; cacheHitRate: number }> {
    return {
      responseTime: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
  }

  private calculateSessionsCount(activities: any[]): number {
    // Implementation would analyze activity patterns to identify sessions
    return 0;
  }

  private calculateAvgSessionDuration(activities: any[]): number {
    // Implementation would calculate average session duration
    return 0;
  }

  private calculateEngagementScore(metrics: {
    sessionsCount: number;
    avgSessionDuration: number;
    votesCount: number;
    favoritedArtists: number;
  }): number {
    const weights = {
      sessions: 0.25,
      duration: 0.25,
      votes: 0.30,
      follows: 0.20
    };

    return (
      (metrics.sessionsCount * weights.sessions) +
      (metrics.avgSessionDuration * weights.duration) +
      (metrics.votesCount * weights.votes) +
      (metrics.favoritedArtists * weights.follows)
    );
  }

  private extractPreferredGenres(following: any[]): string[] {
    const genreCounts = new Map<string, number>();
    
    following.forEach(item => {
      if (item.artist?.genres) {
        item.artist.genres.forEach((genre: string) => {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        });
      }
    });

    return Array.from(genreCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre]) => genre);
  }

  private calculateMostActiveHour(activities: any[]): number {
    const hourCounts = new Array(24).fill(0);
    
    activities.forEach(activity => {
      const hour = new Date(activity.created_at).getHours();
      hourCounts[hour]++;
    });

    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private async getShowPerformanceMetrics(showId: string): Promise<{ views: number; votes: number; shares: number }> {
    // Implementation would query analytics data
    return { views: 0, votes: 0, shares: 0 };
  }

  private async getArtistPerformanceMetrics(artistId: string): Promise<{ views: number; votes: number; shares: number }> {
    // Implementation would query analytics data
    return { views: 0, votes: 0, shares: 0 };
  }

  private async getSongPerformanceMetrics(songId: string): Promise<{ views: number; votes: number; shares: number }> {
    // Implementation would query analytics data
    return { views: 0, votes: 0, shares: 0 };
  }

  private calculateEngagementRate(views: number, engagements: number): number {
    return views > 0 ? (engagements / views) * 100 : 0;
  }

  private calculateConversionRate(views: number, conversions: number): number {
    return views > 0 ? (conversions / views) * 100 : 0;
  }

  private async calculateTrendingScore(entityId: string, entityType: string): Promise<number> {
    // Implementation would use trending algorithms
    return 0;
  }

  private async calculateVoteVelocity(setlistSongId: string): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const { count } = await supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact' })
      .eq('setlist_song_id', setlistSongId)
      .gte('created_at', fiveMinutesAgo.toISOString());

    return (count || 0) / 5; // votes per minute
  }

  private async analyzeVotingPatterns(timeframe: string): Promise<{ insights: string[]; recommendations: string[] }> {
    return { insights: [], recommendations: [] };
  }

  private async analyzeUserEngagement(timeframe: string): Promise<{ insights: string[]; alerts: string[] }> {
    return { insights: [], alerts: [] };
  }

  private async generatePredictions(timeframe: string): Promise<string[]> {
    return [];
  }

  private async cleanupOldAnalyticsData(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      await supabaseAdmin
        .from('analytics_events')
        .delete()
        .lt('timestamp', thirtyDaysAgo.toISOString());
    } catch (error) {
      console.error('Failed to cleanup old analytics data:', error);
    }
  }
}

// Export singleton instance
export const advancedAnalytics = AdvancedAnalyticsService.getInstance();