/**
 * Real-Time Analytics System for MySetlist
 * Ultra-comprehensive analytics with real-time processing and notifications
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from './supabaseAdmin';
import { perfMonitor } from './performance';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/types_db';

// Core Analytics Interfaces
export interface RealTimeEvent {
  id: string;
  type: 'vote' | 'view' | 'search' | 'follow' | 'share' | 'session_start' | 'session_end';
  userId?: string;
  sessionId: string;
  entityId?: string;
  entityType?: 'show' | 'artist' | 'song' | 'setlist';
  metadata: Record<string, any>;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  pageUrl?: string;
  referrer?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

export interface RealTimeMetrics {
  timestamp: Date;
  activeUsers: number;
  totalVotes: number;
  votesPerSecond: number;
  topShows: Array<{
    id: string;
    name: string;
    artist: string;
    votes: number;
    velocity: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  trendingArtists: Array<{
    id: string;
    name: string;
    followers: number;
    growthRate: number;
    engagement: number;
  }>;
  systemHealth: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  userEngagement: {
    averageSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
    conversionRate: number;
  };
  contentPerformance: {
    mostViewedShows: Array<{ id: string; name: string; views: number }>;
    mostVotedSongs: Array<{ id: string; title: string; votes: number }>;
    topSearchTerms: Array<{ term: string; count: number }>;
  };
}

export interface AnalyticsAlert {
  id: string;
  type: 'performance' | 'engagement' | 'error' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  actionRequired: boolean;
  notificationsSent: string[];
}

export interface PredictionInsight {
  type: 'trend' | 'engagement' | 'content' | 'user_behavior';
  confidence: number;
  prediction: string;
  evidence: string[];
  timeframe: '1h' | '24h' | '7d' | '30d';
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// Real-Time Analytics Engine
export class RealTimeAnalyticsEngine {
  private static instance: RealTimeAnalyticsEngine;
  private supabase = createClientComponentClient<Database>();
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventBuffer: RealTimeEvent[] = [];
  private metricsCache: Map<string, any> = new Map();
  private alertsBuffer: AnalyticsAlert[] = [];
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  // Configuration
  private readonly BUFFER_SIZE = 500;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly METRICS_REFRESH_INTERVAL = 10000; // 10 seconds
  private readonly ALERT_CHECK_INTERVAL = 30000; // 30 seconds
  
  static getInstance(): RealTimeAnalyticsEngine {
    if (!RealTimeAnalyticsEngine.instance) {
      RealTimeAnalyticsEngine.instance = new RealTimeAnalyticsEngine();
      RealTimeAnalyticsEngine.instance.initialize();
    }
    return RealTimeAnalyticsEngine.instance;
  }

  private async initialize() {
    await this.setupRealtimeChannels();
    this.startProcessingLoop();
    this.startMetricsRefresh();
    this.startAlertMonitoring();
  }

  /**
   * Setup real-time channels for different data streams
   */
  private async setupRealtimeChannels() {
    // Votes channel for real-time voting updates
    const votesChannel = this.supabase
      .channel('votes_analytics')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'votes' },
        this.handleVoteChange.bind(this)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'setlist_songs' },
        this.handleSetlistChange.bind(this)
      )
      .subscribe();

    // User activity channel
    const userActivityChannel = this.supabase
      .channel('user_activity_analytics')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_artists' },
        this.handleUserActivityChange.bind(this)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_events' },
        this.handleUserEventChange.bind(this)
      )
      .subscribe();

    // Shows and artists channel
    const contentChannel = this.supabase
      .channel('content_analytics')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shows' },
        this.handleShowChange.bind(this)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'artists' },
        this.handleArtistChange.bind(this)
      )
      .subscribe();

    this.channels.set('votes', votesChannel);
    this.channels.set('user_activity', userActivityChannel);
    this.channels.set('content', contentChannel);
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: Omit<RealTimeEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: RealTimeEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    };

    // Add to buffer
    this.eventBuffer.push(fullEvent);

    // Process critical events immediately
    if (event.type === 'vote' || event.type === 'follow') {
      await this.processEventImmediate(fullEvent);
    }

    // Flush buffer if full
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      await this.flushEventBuffer();
    }
  }

  /**
   * Get current real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const cached = this.metricsCache.get('realtime_metrics');
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }

    const metrics = await this.calculateRealTimeMetrics();
    this.metricsCache.set('realtime_metrics', {
      data: metrics,
      timestamp: Date.now()
    });

    return metrics;
  }

  /**
   * Get analytics insights and predictions
   */
  async getInsights(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<PredictionInsight[]> {
    return perfMonitor.measure('generate_insights', async () => {
      const insights: PredictionInsight[] = [];

      // Voting pattern analysis
      const votingInsights = await this.analyzeVotingPatterns(timeframe);
      insights.push(...votingInsights);

      // User engagement predictions
      const engagementInsights = await this.analyzeUserEngagement(timeframe);
      insights.push(...engagementInsights);

      // Content performance predictions
      const contentInsights = await this.analyzeContentPerformance(timeframe);
      insights.push(...contentInsights);

      // System health predictions
      const systemInsights = await this.analyzeSystemHealth(timeframe);
      insights.push(...systemInsights);

      return insights.sort((a, b) => b.confidence - a.confidence);
    });
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<AnalyticsAlert[]> {
    const { data: alerts } = await supabaseAdmin
      .from('analytics_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    return alerts || [];
  }

  /**
   * Subscribe to real-time metrics updates
   */
  subscribeToMetrics(callback: (metrics: RealTimeMetrics) => void): () => void {
    const channel = this.supabase
      .channel('metrics_updates')
      .on('broadcast', { event: 'metrics_update' }, ({ payload }) => {
        callback(payload);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  // Private methods for event handling
  private async handleVoteChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: 'vote',
      timestamp: new Date(),
      sessionId: 'realtime',
      entityId: payload.new?.setlist_song_id,
      entityType: 'song',
      metadata: {
        voteType: payload.new?.vote_type,
        eventType: payload.eventType,
        userId: payload.new?.user_id
      }
    };

    await this.processEventImmediate(event);
  }

  private async handleSetlistChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: 'view',
      timestamp: new Date(),
      sessionId: 'realtime',
      entityId: payload.new?.id,
      entityType: 'setlist',
      metadata: {
        eventType: payload.eventType,
        upvotes: payload.new?.upvotes,
        downvotes: payload.new?.downvotes
      }
    };

    await this.processEventImmediate(event);
  }

  private async handleUserActivityChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: 'follow',
      timestamp: new Date(),
      sessionId: 'realtime',
      entityId: payload.new?.artist_id,
      entityType: 'artist',
      metadata: {
        eventType: payload.eventType,
        userId: payload.new?.user_id
      }
    };

    await this.processEventImmediate(event);
  }

  private async handleUserEventChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: payload.new?.event_type || 'view',
      timestamp: new Date(),
      sessionId: payload.new?.session_id || 'realtime',
      userId: payload.new?.user_id,
      metadata: {
        eventType: payload.eventType,
        eventData: payload.new?.event_data,
        pageUrl: payload.new?.page_url
      }
    };

    await this.processEventImmediate(event);
  }

  private async handleShowChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: 'view',
      timestamp: new Date(),
      sessionId: 'realtime',
      entityId: payload.new?.id,
      entityType: 'show',
      metadata: {
        eventType: payload.eventType,
        artistId: payload.new?.artist_id,
        showName: payload.new?.name
      }
    };

    await this.processEventImmediate(event);
  }

  private async handleArtistChange(payload: RealtimePostgresChangesPayload<any>) {
    const event: RealTimeEvent = {
      id: crypto.randomUUID(),
      type: 'view',
      timestamp: new Date(),
      sessionId: 'realtime',
      entityId: payload.new?.id,
      entityType: 'artist',
      metadata: {
        eventType: payload.eventType,
        artistName: payload.new?.name,
        verified: payload.new?.verified
      }
    };

    await this.processEventImmediate(event);
  }

  private async processEventImmediate(event: RealTimeEvent) {
    try {
      // Update real-time counters
      await this.updateRealTimeCounters(event);
      
      // Check for anomalies
      await this.checkAnomalies(event);
      
      // Trigger notifications if needed
      await this.triggerNotifications(event);
      
      // Broadcast to subscribers
      await this.broadcastMetricsUpdate();
    } catch (error) {
      console.error('Error processing immediate event:', error);
    }
  }

  private async updateRealTimeCounters(event: RealTimeEvent) {
    const timestamp = new Date();
    const minuteKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}-${timestamp.getMinutes()}`;
    
    // Update in-memory counters
    const counters = this.metricsCache.get('counters') || {};
    counters[minuteKey] = counters[minuteKey] || {
      votes: 0,
      views: 0,
      follows: 0,
      searches: 0,
      uniqueUsers: new Set()
    };
    
    counters[minuteKey][event.type + 's'] = (counters[minuteKey][event.type + 's'] || 0) + 1;
    if (event.userId) {
      counters[minuteKey].uniqueUsers.add(event.userId);
    }
    
    this.metricsCache.set('counters', counters);
  }

  private async checkAnomalies(event: RealTimeEvent) {
    // Check for voting anomalies
    if (event.type === 'vote') {
      const recentVotes = await this.getRecentVotesCount(event.entityId || '', 60000); // 1 minute
      if (recentVotes > 50) { // Threshold for anomaly
        await this.createAlert({
          type: 'anomaly',
          severity: 'high',
          title: 'High Voting Activity Detected',
          message: `Unusually high voting activity detected for entity ${event.entityId}`,
          data: { entityId: event.entityId, voteCount: recentVotes },
          actionRequired: true
        });
      }
    }
  }

  private async triggerNotifications(event: RealTimeEvent) {
    // Trigger notifications for significant events
    if (event.type === 'vote' && event.metadata.voteType) {
      // Notify about trending setlists
      const trendingScore = await this.calculateTrendingScore(event.entityId || '');
      if (trendingScore > 0.8) {
        // Trigger trending notification
        await this.createAlert({
          type: 'engagement',
          severity: 'medium',
          title: 'Trending Setlist Detected',
          message: `Setlist ${event.entityId} is trending with high engagement`,
          data: { entityId: event.entityId, trendingScore },
          actionRequired: false
        });
      }
    }
  }

  private async broadcastMetricsUpdate() {
    const metrics = await this.getRealTimeMetrics();
    
    // Broadcast to all subscribers
    await this.supabase
      .channel('metrics_updates')
      .send({
        type: 'broadcast',
        event: 'metrics_update',
        payload: metrics
      });
  }

  private async calculateRealTimeMetrics(): Promise<RealTimeMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get active users (unique users in last hour)
    const activeUsers = await this.getActiveUsersCount();
    
    // Get voting metrics
    const votingMetrics = await this.getVotingMetrics();
    
    // Get top shows
    const topShows = await this.getTopShows();
    
    // Get trending artists
    const trendingArtists = await this.getTrendingArtists();
    
    // Get system health
    const systemHealth = await this.getSystemHealth();
    
    // Get user engagement
    const userEngagement = await this.getUserEngagement();
    
    // Get content performance
    const contentPerformance = await this.getContentPerformance();
    
    return {
      timestamp: now,
      activeUsers,
      totalVotes: votingMetrics.total,
      votesPerSecond: votingMetrics.perSecond,
      topShows,
      trendingArtists,
      systemHealth,
      userEngagement,
      contentPerformance
    };
  }

  // Helper methods for metrics calculation
  private async getActiveUsersCount(): Promise<number> {
    const counters = this.metricsCache.get('counters') || {};
    const now = new Date();
    let uniqueUsers = new Set();
    
    // Count unique users in last hour
    for (let i = 0; i < 60; i++) {
      const checkTime = new Date(now.getTime() - i * 60 * 1000);
      const minuteKey = `${checkTime.getFullYear()}-${checkTime.getMonth()}-${checkTime.getDate()}-${checkTime.getHours()}-${checkTime.getMinutes()}`;
      
      if (counters[minuteKey]?.uniqueUsers) {
        counters[minuteKey].uniqueUsers.forEach((user: string) => uniqueUsers.add(user));
      }
    }
    
    return uniqueUsers.size;
  }

  private async getVotingMetrics(): Promise<{ total: number; perSecond: number }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    const { count } = await supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact' })
      .gte('created_at', oneMinuteAgo.toISOString());
    
    return {
      total: count || 0,
      perSecond: (count || 0) / 60
    };
  }

  private async getTopShows(): Promise<RealTimeMetrics['topShows']> {
    const { data } = await supabaseAdmin
      .from('shows')
      .select(`
        id,
        name,
        artist:artists(name),
        setlists(
          setlist_songs(
            upvotes,
            downvotes
          )
        )
      `)
      .order('date', { ascending: false })
      .limit(10);
    
    return (data || []).map(show => ({
      id: show.id,
      name: show.name,
      artist: show.artist?.name || 'Unknown',
      votes: show.setlists?.reduce((total, setlist) => 
        total + (setlist.setlist_songs?.reduce((votes, song) => 
          votes + (song.upvotes || 0) + (song.downvotes || 0), 0) || 0), 0) || 0,
      velocity: 0, // Would calculate based on recent voting activity
      trend: 'stable' as const
    }));
  }

  private async getTrendingArtists(): Promise<RealTimeMetrics['trendingArtists']> {
    const { data } = await supabaseAdmin
      .from('artists')
      .select(`
        id,
        name,
        user_artists(count)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return (data || []).map(artist => ({
      id: artist.id,
      name: artist.name,
      followers: artist.user_artists?.length || 0,
      growthRate: 0, // Would calculate based on recent follow activity
      engagement: 0 // Would calculate based on recent activity
    }));
  }

  private async getSystemHealth(): Promise<RealTimeMetrics['systemHealth']> {
    return {
      responseTime: perfMonitor.getAverageResponseTime(),
      errorRate: 0, // Would calculate from error logs
      throughput: 0, // Would calculate from request logs
      memoryUsage: 0, // Would get from system monitoring
      cpuUsage: 0 // Would get from system monitoring
    };
  }

  private async getUserEngagement(): Promise<RealTimeMetrics['userEngagement']> {
    return {
      averageSessionDuration: 0, // Would calculate from session data
      bounceRate: 0, // Would calculate from session data
      pagesPerSession: 0, // Would calculate from session data
      conversionRate: 0 // Would calculate from conversion events
    };
  }

  private async getContentPerformance(): Promise<RealTimeMetrics['contentPerformance']> {
    return {
      mostViewedShows: [],
      mostVotedSongs: [],
      topSearchTerms: []
    };
  }

  // Processing loops
  private startProcessingLoop() {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.eventBuffer.length > 0) {
        await this.flushEventBuffer();
      }
    }, this.FLUSH_INTERVAL);
  }

  private startMetricsRefresh() {
    setInterval(async () => {
      try {
        await this.broadcastMetricsUpdate();
      } catch (error) {
        console.error('Error refreshing metrics:', error);
      }
    }, this.METRICS_REFRESH_INTERVAL);
  }

  private startAlertMonitoring() {
    setInterval(async () => {
      try {
        await this.processAlerts();
      } catch (error) {
        console.error('Error processing alerts:', error);
      }
    }, this.ALERT_CHECK_INTERVAL);
  }

  private async flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;
    
    this.isProcessing = true;
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    try {
      // Store events in database
      await supabaseAdmin
        .from('user_events')
        .insert(events.map(event => ({
          user_id: event.userId,
          session_id: event.sessionId,
          event_type: event.type,
          event_data: event.metadata,
          page_url: event.pageUrl,
          user_agent: event.userAgent,
          ip_address: event.ipAddress,
          created_at: event.timestamp.toISOString()
        })));
      
      console.log(`Flushed ${events.length} analytics events`);
    } catch (error) {
      console.error('Error flushing event buffer:', error);
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processAlerts() {
    const alerts = await this.getActiveAlerts();
    
    for (const alert of alerts) {
      // Process each alert based on type and severity
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: AnalyticsAlert) {
    // Process alert based on type and severity
    if (alert.severity === 'critical' && !alert.notificationsSent.includes('email')) {
      // Send critical alert via email
      await this.sendAlertNotification(alert, 'email');
    }
  }

  private async sendAlertNotification(alert: AnalyticsAlert, channel: string) {
    // Implementation would send notification via specified channel
    console.log(`Sending ${channel} notification for alert:`, alert.title);
  }

  private async createAlert(alertData: Omit<AnalyticsAlert, 'id' | 'timestamp' | 'resolved' | 'notificationsSent'>) {
    const alert: AnalyticsAlert = {
      ...alertData,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false,
      notificationsSent: []
    };
    
    this.alertsBuffer.push(alert);
    
    // Store in database
    await supabaseAdmin
      .from('analytics_alerts')
      .insert({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        data: alert.data,
        action_required: alert.actionRequired,
        resolved: alert.resolved,
        created_at: alert.timestamp.toISOString()
      });
  }

  private async getRecentVotesCount(entityId: string, timeWindowMs: number): Promise<number> {
    const since = new Date(Date.now() - timeWindowMs);
    
    const { count } = await supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact' })
      .eq('setlist_song_id', entityId)
      .gte('created_at', since.toISOString());
    
    return count || 0;
  }

  private async calculateTrendingScore(entityId: string): Promise<number> {
    // Implementation would calculate trending score based on various factors
    return 0.5; // Placeholder
  }

  // Analytics analysis methods
  private async analyzeVotingPatterns(timeframe: string): Promise<PredictionInsight[]> {
    const insights: PredictionInsight[] = [];
    
    // Analyze voting velocity
    const votingVelocity = await this.getVotingVelocity(timeframe);
    if (votingVelocity > 100) { // Threshold for high activity
      insights.push({
        type: 'engagement',
        confidence: 0.85,
        prediction: 'High voting activity expected to continue',
        evidence: [`Current velocity: ${votingVelocity} votes/minute`],
        timeframe: '1h',
        impact: 'high',
        recommendations: ['Ensure infrastructure can handle increased load', 'Monitor for potential voting anomalies']
      });
    }
    
    return insights;
  }

  private async analyzeUserEngagement(timeframe: string): Promise<PredictionInsight[]> {
    const insights: PredictionInsight[] = [];
    
    // Analyze session patterns
    const avgSessionDuration = await this.getAverageSessionDuration(timeframe);
    if (avgSessionDuration < 60) { // Less than 1 minute
      insights.push({
        type: 'engagement',
        confidence: 0.75,
        prediction: 'User engagement may be declining',
        evidence: [`Average session duration: ${avgSessionDuration}s`],
        timeframe: '24h',
        impact: 'medium',
        recommendations: ['Improve onboarding flow', 'Add more engaging content', 'Optimize page load times']
      });
    }
    
    return insights;
  }

  private async analyzeContentPerformance(timeframe: string): Promise<PredictionInsight[]> {
    const insights: PredictionInsight[] = [];
    
    // Analyze show popularity trends
    const showTrends = await this.getShowTrends(timeframe);
    if (showTrends.length > 0) {
      insights.push({
        type: 'content',
        confidence: 0.8,
        prediction: 'Certain shows are gaining significant traction',
        evidence: showTrends.map(trend => `${trend.name}: ${trend.growth}% growth`),
        timeframe: '24h',
        impact: 'high',
        recommendations: ['Promote trending shows', 'Analyze successful show characteristics', 'Optimize content discovery']
      });
    }
    
    return insights;
  }

  private async analyzeSystemHealth(timeframe: string): Promise<PredictionInsight[]> {
    const insights: PredictionInsight[] = [];
    
    // Analyze response time trends
    const responseTimeTrend = await this.getResponseTimeTrend(timeframe);
    if (responseTimeTrend.isIncreasing) {
      insights.push({
        type: 'performance',
        confidence: 0.9,
        prediction: 'System performance may degrade if current trend continues',
        evidence: [`Response time increased by ${responseTimeTrend.percentageIncrease}%`],
        timeframe: '1h',
        impact: 'high',
        recommendations: ['Scale infrastructure', 'Optimize database queries', 'Add caching layers']
      });
    }
    
    return insights;
  }

  // Helper methods for analysis
  private async getVotingVelocity(timeframe: string): Promise<number> {
    // Implementation would calculate voting velocity
    return 0;
  }

  private async getAverageSessionDuration(timeframe: string): Promise<number> {
    // Implementation would calculate average session duration
    return 0;
  }

  private async getShowTrends(timeframe: string): Promise<Array<{ name: string; growth: number }>> {
    // Implementation would analyze show trends
    return [];
  }

  private async getResponseTimeTrend(timeframe: string): Promise<{ isIncreasing: boolean; percentageIncrease: number }> {
    // Implementation would analyze response time trends
    return { isIncreasing: false, percentageIncrease: 0 };
  }

  // Cleanup
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Unsubscribe from all channels
    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
    
    // Flush remaining events
    if (this.eventBuffer.length > 0) {
      this.flushEventBuffer();
    }
  }
}

// Export singleton instance
export const realTimeAnalytics = RealTimeAnalyticsEngine.getInstance();