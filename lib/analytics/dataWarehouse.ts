import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types_db';

export class DataWarehouse {
  private supabase;
  private readonly BATCH_SIZE = 1000;
  private readonly ETL_LOCK_KEY = 'etl_process_lock';

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ETL Pipeline Orchestrator
  async runETLPipeline(pipelineType: ETLPipelineType = 'daily'): Promise<ETLResult> {
    const lockAcquired = await this.acquireETLLock();
    if (!lockAcquired) {
      return {
        success: false,
        error: 'ETL pipeline already running',
        duration: 0,
        recordsProcessed: 0
      };
    }

    const startTime = Date.now();
    let totalRecordsProcessed = 0;

    try {
      console.log(`Starting ${pipelineType} ETL pipeline...`);

      // 1. Extract phase
      const extractedData = await this.extractPhase(pipelineType);
      console.log(`Extracted ${extractedData.totalRecords} records`);

      // 2. Transform phase
      const transformedData = await this.transformPhase(extractedData);
      console.log(`Transformed ${transformedData.recordsProcessed} records`);
      totalRecordsProcessed += transformedData.recordsProcessed;

      // 3. Load phase
      const loadResult = await this.loadPhase(transformedData);
      console.log(`Loaded ${loadResult.recordsLoaded} records`);
      totalRecordsProcessed += loadResult.recordsLoaded;

      // 4. Post-processing (indexes, aggregations, ML features)
      await this.postProcessingPhase(pipelineType);

      const duration = Date.now() - startTime;
      
      await this.logETLRun({
        pipeline_type: pipelineType,
        status: 'completed',
        duration,
        records_processed: totalRecordsProcessed,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });

      return {
        success: true,
        duration,
        recordsProcessed: totalRecordsProcessed,
        phases: {
          extract: extractedData,
          transform: transformedData,
          load: loadResult
        }
      };

    } catch (error) {
      console.error('ETL Pipeline error:', error);
      
      await this.logETLRun({
        pipeline_type: pipelineType,
        status: 'failed',
        duration: Date.now() - startTime,
        records_processed: totalRecordsProcessed,
        error_message: (error as Error).message,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });

      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        recordsProcessed: totalRecordsProcessed
      };
    } finally {
      await this.releaseETLLock();
    }
  }

  // Extract Phase: Pull data from operational tables
  private async extractPhase(pipelineType: ETLPipelineType): Promise<ExtractResult> {
    const cutoffDate = this.getCutoffDate(pipelineType);
    
    const [
      userEvents,
      votes,
      follows,
      showViews
    ] = await Promise.all([
      this.extractUserEvents(cutoffDate),
      this.extractVotes(cutoffDate),
      this.extractFollows(cutoffDate),
      this.extractShowViews(cutoffDate)
    ]);

    return {
      totalRecords: userEvents.length + votes.length + follows.length + showViews.length,
      userEvents,
      votes,
      follows,
      showViews,
      extractedAt: new Date().toISOString()
    };
  }

  private async extractUserEvents(cutoffDate: Date): Promise<UserEventData[]> {
    const { data, error } = await this.supabase
      .from('user_events')
      .select(`
        id,
        user_id,
        session_id,
        event_type,
        event_data,
        page_url,
        created_at
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private async extractVotes(cutoffDate: Date): Promise<VoteData[]> {
    const { data, error } = await this.supabase
      .from('votes')
      .select(`
        id,
        user_id,
        setlist_song_id,
        vote_type,
        created_at,
        setlist_songs!inner(
          setlist_id,
          song_id,
          position,
          setlists!inner(
            show_id,
            type,
            shows!inner(
              artist_id,
              venue_id,
              date
            )
          ),
          songs!inner(
            title,
            artist_name
          )
        )
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private async extractFollows(cutoffDate: Date): Promise<FollowData[]> {
    const { data, error } = await this.supabase
      .from('user_artists')
      .select(`
        user_id,
        artist_id,
        created_at,
        artists!inner(
          name,
          genres,
          followers
        )
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private async extractShowViews(cutoffDate: Date): Promise<ShowViewData[]> {
    const { data, error } = await this.supabase
      .from('user_events')
      .select(`
        user_id,
        event_data,
        created_at
      `)
      .eq('event_type', 'show_viewed')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(event => ({
      user_id: event.user_id,
      show_id: event.event_data?.show_id,
      created_at: event.created_at
    })).filter(view => view.show_id);
  }

  // Transform Phase: Clean, aggregate, and enrich data
  private async transformPhase(extractedData: ExtractResult): Promise<TransformResult> {
    const transformations = await Promise.all([
      this.transformUserBehaviorMetrics(extractedData),
      this.transformVotingPatterns(extractedData),
      this.transformEngagementScores(extractedData),
      this.transformRecommendationFeatures(extractedData)
    ]);

    const totalProcessed = transformations.reduce((sum, t) => sum + t.recordsProcessed, 0);

    return {
      recordsProcessed: totalProcessed,
      userBehaviorMetrics: transformations[0].data,
      votingPatterns: transformations[1].data,
      engagementScores: transformations[2].data,
      recommendationFeatures: transformations[3].data,
      transformedAt: new Date().toISOString()
    };
  }

  private async transformUserBehaviorMetrics(data: ExtractResult): Promise<TransformationStep> {
    const userMetrics = new Map<string, UserBehaviorMetric>();

    // Process events to build user behavior profiles
    data.userEvents.forEach(event => {
      if (!event.user_id) return;

      if (!userMetrics.has(event.user_id)) {
        userMetrics.set(event.user_id, {
          user_id: event.user_id,
          total_sessions: new Set(),
          page_views: 0,
          unique_pages: new Set(),
          session_durations: [],
          event_types: new Map(),
          time_of_day_activity: new Array(24).fill(0),
          day_of_week_activity: new Array(7).fill(0)
        });
      }

      const metric = userMetrics.get(event.user_id)!;
      
      // Track session
      if (event.session_id) {
        metric.total_sessions.add(event.session_id);
      }

      // Track page views
      if (event.event_type === 'page_view') {
        metric.page_views++;
        if (event.page_url) {
          metric.unique_pages.add(event.page_url);
        }
      }

      // Track event types
      const count = metric.event_types.get(event.event_type) || 0;
      metric.event_types.set(event.event_type, count + 1);

      // Track time patterns
      const hour = new Date(event.created_at).getHours();
      const dayOfWeek = new Date(event.created_at).getDay();
      metric.time_of_day_activity[hour]++;
      metric.day_of_week_activity[dayOfWeek]++;
    });

    // Convert to final format
    const transformedMetrics = Array.from(userMetrics.values()).map(metric => ({
      user_id: metric.user_id,
      total_sessions: metric.total_sessions.size,
      page_views: metric.page_views,
      unique_pages_visited: metric.unique_pages.size,
      avg_session_duration: metric.session_durations.length > 0 
        ? metric.session_durations.reduce((a, b) => a + b, 0) / metric.session_durations.length 
        : 0,
      most_active_hour: this.getMostActiveHour(metric.time_of_day_activity),
      most_active_day: this.getMostActiveDay(metric.day_of_week_activity),
      engagement_score: this.calculateEngagementScore(metric),
      behavior_summary: Object.fromEntries(metric.event_types)
    }));

    return {
      recordsProcessed: transformedMetrics.length,
      data: transformedMetrics
    };
  }

  private async transformVotingPatterns(data: ExtractResult): Promise<TransformationStep> {
    const votingPatterns = new Map<string, VotingPattern>();

    data.votes.forEach(vote => {
      if (!votingPatterns.has(vote.user_id)) {
        votingPatterns.set(vote.user_id, {
          user_id: vote.user_id,
          total_votes: 0,
          upvotes: 0,
          downvotes: 0,
          artists_voted_on: new Set(),
          genres_voted_on: new Set(),
          voting_time_distribution: new Array(24).fill(0),
          average_confidence: 0,
          voting_streak: 0
        });
      }

      const pattern = votingPatterns.get(vote.user_id)!;
      pattern.total_votes++;
      
      if (vote.vote_type === 'up') {
        pattern.upvotes++;
      } else {
        pattern.downvotes++;
      }

      // Track artists and genres
      if (vote.setlist_songs?.setlists?.shows?.artist_id) {
        pattern.artists_voted_on.add(vote.setlist_songs.setlists.shows.artist_id);
      }

      // Track voting time
      const hour = new Date(vote.created_at).getHours();
      pattern.voting_time_distribution[hour]++;
    });

    const transformedPatterns = Array.from(votingPatterns.values()).map(pattern => ({
      user_id: pattern.user_id,
      total_votes: pattern.total_votes,
      upvote_ratio: pattern.total_votes > 0 ? pattern.upvotes / pattern.total_votes : 0,
      artists_diversity: pattern.artists_voted_on.size,
      most_active_voting_hour: this.getMostActiveHour(pattern.voting_time_distribution),
      voting_consistency: this.calculateVotingConsistency(pattern)
    }));

    return {
      recordsProcessed: transformedPatterns.length,
      data: transformedPatterns
    };
  }

  private async transformEngagementScores(data: ExtractResult): Promise<TransformationStep> {
    // Calculate comprehensive engagement scores combining multiple signals
    const engagementData = new Map<string, EngagementData>();

    // Process all user activities
    const allUserIds = new Set([
      ...data.userEvents.map(e => e.user_id).filter(Boolean),
      ...data.votes.map(v => v.user_id),
      ...data.follows.map(f => f.user_id)
    ]);

    for (const userId of allUserIds) {
      const userEvents = data.userEvents.filter(e => e.user_id === userId);
      const userVotes = data.votes.filter(v => v.user_id === userId);
      const userFollows = data.follows.filter(f => f.user_id === userId);

      const engagement = this.calculateComprehensiveEngagement({
        events: userEvents,
        votes: userVotes,
        follows: userFollows
      });

      engagementData.set(userId, engagement);
    }

    return {
      recordsProcessed: engagementData.size,
      data: Array.from(engagementData.values())
    };
  }

  private async transformRecommendationFeatures(data: ExtractResult): Promise<TransformationStep> {
    const features = new Map<string, RecommendationFeature>();

    // Build recommendation features for each user
    for (const userId of new Set(data.userEvents.map(e => e.user_id).filter(Boolean))) {
      const userEvents = data.userEvents.filter(e => e.user_id === userId);
      const userVotes = data.votes.filter(v => v.user_id === userId);
      const userFollows = data.follows.filter(f => f.user_id === userId);

      const feature = await this.buildRecommendationFeature(userId, {
        events: userEvents,
        votes: userVotes,
        follows: userFollows
      });

      features.set(userId, feature);
    }

    return {
      recordsProcessed: features.size,
      data: Array.from(features.values())
    };
  }

  // Load Phase: Write transformed data to warehouse tables
  private async loadPhase(transformedData: TransformResult): Promise<LoadResult> {
    let totalLoaded = 0;

    const loadOperations = await Promise.allSettled([
      this.loadUserBehaviorMetrics(transformedData.userBehaviorMetrics),
      this.loadVotingPatterns(transformedData.votingPatterns),
      this.loadEngagementScores(transformedData.engagementScores),
      this.loadRecommendationFeatures(transformedData.recommendationFeatures)
    ]);

    loadOperations.forEach(result => {
      if (result.status === 'fulfilled') {
        totalLoaded += result.value;
      }
    });

    return {
      recordsLoaded: totalLoaded,
      loadedAt: new Date().toISOString(),
      operations: loadOperations.map(op => ({
        success: op.status === 'fulfilled',
        error: op.status === 'rejected' ? op.reason.message : undefined
      }))
    };
  }

  private async loadUserBehaviorMetrics(metrics: any[]): Promise<number> {
    if (metrics.length === 0) return 0;

    // Batch insert user behavior metrics
    const { error } = await this.supabase
      .from('user_behavior_warehouse')
      .upsert(
        metrics.map(metric => ({
          ...metric,
          calculated_at: new Date().toISOString()
        })),
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return metrics.length;
  }

  private async loadVotingPatterns(patterns: any[]): Promise<number> {
    if (patterns.length === 0) return 0;

    const { error } = await this.supabase
      .from('voting_patterns_warehouse')
      .upsert(
        patterns.map(pattern => ({
          ...pattern,
          calculated_at: new Date().toISOString()
        })),
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return patterns.length;
  }

  private async loadEngagementScores(scores: any[]): Promise<number> {
    if (scores.length === 0) return 0;

    const { error } = await this.supabase
      .from('user_engagement_warehouse')
      .upsert(
        scores.map(score => ({
          ...score,
          calculated_at: new Date().toISOString()
        })),
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return scores.length;
  }

  private async loadRecommendationFeatures(features: any[]): Promise<number> {
    if (features.length === 0) return 0;

    const { error } = await this.supabase
      .from('user_recommendation_features')
      .upsert(
        features.map(feature => ({
          ...feature,
          calculated_at: new Date().toISOString()
        })),
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return features.length;
  }

  // Post-processing: Create indexes, aggregations, ML features
  private async postProcessingPhase(pipelineType: ETLPipelineType): Promise<void> {
    await Promise.all([
      this.updateMaterializedViews(),
      this.calculatePlatformAggregations(),
      this.generateMLFeatures(),
      this.optimizeIndexes()
    ]);
  }

  // Utility methods
  private getCutoffDate(pipelineType: ETLPipelineType): Date {
    const now = new Date();
    switch (pipelineType) {
      case 'hourly':
        return new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
      case 'full':
        return new Date('2020-01-01'); // All data
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private getMostActiveHour(hourlyActivity: number[]): number {
    return hourlyActivity.indexOf(Math.max(...hourlyActivity));
  }

  private getMostActiveDay(dailyActivity: number[]): number {
    return dailyActivity.indexOf(Math.max(...dailyActivity));
  }

  private calculateEngagementScore(metric: UserBehaviorMetric): number {
    // Proprietary engagement scoring algorithm
    const sessionScore = Math.min(metric.total_sessions.size / 10, 1) * 0.3;
    const pageViewScore = Math.min(metric.page_views / 100, 1) * 0.3;
    const diversityScore = Math.min(metric.unique_pages.size / 20, 1) * 0.2;
    const eventTypeScore = Math.min(metric.event_types.size / 10, 1) * 0.2;
    
    return Math.round((sessionScore + pageViewScore + diversityScore + eventTypeScore) * 100) / 100;
  }

  private calculateVotingConsistency(pattern: VotingPattern): number {
    // Calculate how consistent the user's voting patterns are
    const timeConsistency = this.calculateTimeConsistency(pattern.voting_time_distribution);
    const ratioConsistency = Math.abs(0.7 - (pattern.upvotes / pattern.total_votes)) < 0.2 ? 1 : 0.5;
    
    return (timeConsistency + ratioConsistency) / 2;
  }

  private calculateTimeConsistency(distribution: number[]): number {
    const totalVotes = distribution.reduce((sum, count) => sum + count, 0);
    if (totalVotes === 0) return 0;
    
    // Calculate entropy to measure consistency
    const entropy = distribution.reduce((h, count) => {
      if (count === 0) return h;
      const p = count / totalVotes;
      return h - p * Math.log2(p);
    }, 0);
    
    const maxEntropy = Math.log2(24); // 24 hours
    return 1 - (entropy / maxEntropy);
  }

  private calculateComprehensiveEngagement(userData: {
    events: any[];
    votes: any[];
    follows: any[];
  }): EngagementData {
    const eventScore = Math.min(userData.events.length / 100, 1) * 0.4;
    const votingScore = Math.min(userData.votes.length / 50, 1) * 0.4;
    const followScore = Math.min(userData.follows.length / 10, 1) * 0.2;
    
    const totalScore = eventScore + votingScore + followScore;
    
    return {
      user_id: userData.events[0]?.user_id || userData.votes[0]?.user_id || userData.follows[0]?.user_id,
      engagement_score: Math.round(totalScore * 100) / 100,
      activity_level: this.classifyActivityLevel(totalScore),
      last_activity: this.getLastActivity(userData),
      retention_risk: this.calculateRetentionRisk(userData)
    };
  }

  private classifyActivityLevel(score: number): string {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.2) return 'low';
    return 'inactive';
  }

  private getLastActivity(userData: any): string {
    const allDates = [
      ...userData.events.map((e: any) => e.created_at),
      ...userData.votes.map((v: any) => v.created_at),
      ...userData.follows.map((f: any) => f.created_at)
    ].filter(Boolean);
    
    return allDates.length > 0 ? Math.max(...allDates.map(d => new Date(d).getTime())).toString() : '';
  }

  private calculateRetentionRisk(userData: any): number {
    const daysSinceLastActivity = this.getDaysSinceLastActivity(userData);
    
    if (daysSinceLastActivity <= 1) return 0.1;
    if (daysSinceLastActivity <= 7) return 0.3;
    if (daysSinceLastActivity <= 30) return 0.6;
    return 0.9;
  }

  private getDaysSinceLastActivity(userData: any): number {
    const lastActivity = this.getLastActivity(userData);
    if (!lastActivity) return 999;
    
    const daysDiff = (Date.now() - parseInt(lastActivity)) / (1000 * 60 * 60 * 24);
    return Math.floor(daysDiff);
  }

  private async buildRecommendationFeature(userId: string, userData: any): Promise<RecommendationFeature> {
    // Build ML features for recommendations
    const genres = userData.follows.flatMap((f: any) => f.artists?.genres || []);
    const genrePreferences = this.calculateGenrePreferences(genres);
    
    const votingBehavior = this.analyzeVotingBehavior(userData.votes);
    const browsingPatterns = this.analyzeBrowsingPatterns(userData.events);
    
    return {
      user_id: userId,
      genre_preferences: genrePreferences,
      voting_behavior_vector: votingBehavior,
      browsing_pattern_vector: browsingPatterns,
      similarity_features: await this.calculateSimilarityFeatures(userId),
      prediction_confidence: this.calculatePredictionConfidence(userData)
    };
  }

  private calculateGenrePreferences(genres: string[]): Record<string, number> {
    const genreCount = genres.reduce((acc, genre) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const total = genres.length;
    const preferences: Record<string, number> = {};
    
    for (const [genre, count] of Object.entries(genreCount)) {
      preferences[genre] = count / total;
    }
    
    return preferences;
  }

  private analyzeVotingBehavior(votes: any[]): number[] {
    // Create a feature vector representing voting behavior
    return [
      votes.filter(v => v.vote_type === 'up').length / Math.max(votes.length, 1),
      votes.filter(v => v.vote_type === 'down').length / Math.max(votes.length, 1),
      this.calculateVotingTiming(votes),
      this.calculateVotingDiversity(votes)
    ];
  }

  private analyzeBrowsingPatterns(events: any[]): number[] {
    // Create a feature vector representing browsing behavior
    const pageViews = events.filter(e => e.event_type === 'page_view').length;
    const searches = events.filter(e => e.event_type === 'search').length;
    const showViews = events.filter(e => e.event_type === 'show_viewed').length;
    
    return [
      pageViews / Math.max(events.length, 1),
      searches / Math.max(events.length, 1),
      showViews / Math.max(events.length, 1),
      this.calculateBrowsingDiversity(events)
    ];
  }

  private calculateVotingTiming(votes: any[]): number {
    // Calculate how quickly user votes after show announcement
    // Returns normalized score between 0-1
    return 0.5; // Placeholder implementation
  }

  private calculateVotingDiversity(votes: any[]): number {
    // Calculate diversity of artists/genres voted on
    const uniqueShows = new Set(votes.map(v => v.setlist_songs?.setlist_id));
    return Math.min(uniqueShows.size / 10, 1);
  }

  private calculateBrowsingDiversity(events: any[]): number {
    // Calculate diversity of pages browsed
    const uniquePages = new Set(events.map(e => e.page_url).filter(Boolean));
    return Math.min(uniquePages.size / 20, 1);
  }

  private async calculateSimilarityFeatures(userId: string): Promise<number[]> {
    // Calculate similarity to other users based on behavior
    // This would involve more complex calculations in production
    return [0.5, 0.3, 0.8, 0.2]; // Placeholder
  }

  private calculatePredictionConfidence(userData: any): number {
    // Calculate how confident we are in our predictions for this user
    const dataPoints = userData.events.length + userData.votes.length + userData.follows.length;
    return Math.min(dataPoints / 100, 1);
  }

  // ETL Management
  private async acquireETLLock(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('etl_locks')
        .insert({
          lock_key: this.ETL_LOCK_KEY,
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        });
      
      return !error;
    } catch (error) {
      return false; // Lock already exists
    }
  }

  private async releaseETLLock(): Promise<void> {
    await this.supabase
      .from('etl_locks')
      .delete()
      .eq('lock_key', this.ETL_LOCK_KEY);
  }

  private async logETLRun(runData: any): Promise<void> {
    await this.supabase
      .from('etl_runs')
      .insert(runData);
  }

  // Additional utility methods for materialized views, aggregations, etc.
  private async updateMaterializedViews(): Promise<void> {
    // Refresh materialized views
    await this.supabase.rpc('refresh_user_summary_view');
    await this.supabase.rpc('refresh_artist_popularity_view');
    await this.supabase.rpc('refresh_show_engagement_view');
  }

  private async calculatePlatformAggregations(): Promise<void> {
    // Calculate platform-wide statistics
    const today = new Date().toISOString().split('T')[0];
    await this.supabase.rpc('calculate_platform_metrics', { target_date: today });
  }

  private async generateMLFeatures(): Promise<void> {
    // Trigger ML feature generation
    await this.supabase.rpc('generate_ml_features');
  }

  private async optimizeIndexes(): Promise<void> {
    // Run index optimization
    await this.supabase.rpc('optimize_warehouse_indexes');
  }
}

// Type definitions
export type ETLPipelineType = 'hourly' | 'daily' | 'weekly' | 'full';

export interface ETLResult {
  success: boolean;
  error?: string;
  duration: number;
  recordsProcessed: number;
  phases?: {
    extract: ExtractResult;
    transform: TransformResult;
    load: LoadResult;
  };
}

export interface ExtractResult {
  totalRecords: number;
  userEvents: UserEventData[];
  votes: VoteData[];
  follows: FollowData[];
  showViews: ShowViewData[];
  extractedAt: string;
}

export interface TransformResult {
  recordsProcessed: number;
  userBehaviorMetrics: any[];
  votingPatterns: any[];
  engagementScores: any[];
  recommendationFeatures: any[];
  transformedAt: string;
}

export interface LoadResult {
  recordsLoaded: number;
  loadedAt: string;
  operations: Array<{
    success: boolean;
    error?: string;
  }>;
}

export interface TransformationStep {
  recordsProcessed: number;
  data: any[];
}

// Data interfaces
export interface UserEventData {
  id: string;
  user_id: string;
  session_id: string;
  event_type: string;
  event_data: any;
  page_url?: string;
  created_at: string;
}

export interface VoteData {
  id: string;
  user_id: string;
  setlist_song_id: string;
  vote_type: string;
  created_at: string;
  setlist_songs?: any;
}

export interface FollowData {
  user_id: string;
  artist_id: string;
  created_at: string;
  artists?: any;
}

export interface ShowViewData {
  user_id: string;
  show_id: string;
  created_at: string;
}

export interface UserBehaviorMetric {
  user_id: string;
  total_sessions: Set<string>;
  page_views: number;
  unique_pages: Set<string>;
  session_durations: number[];
  event_types: Map<string, number>;
  time_of_day_activity: number[];
  day_of_week_activity: number[];
}

export interface VotingPattern {
  user_id: string;
  total_votes: number;
  upvotes: number;
  downvotes: number;
  artists_voted_on: Set<string>;
  genres_voted_on: Set<string>;
  voting_time_distribution: number[];
  average_confidence: number;
  voting_streak: number;
}

export interface EngagementData {
  user_id: string;
  engagement_score: number;
  activity_level: string;
  last_activity: string;
  retention_risk: number;
}

export interface RecommendationFeature {
  user_id: string;
  genre_preferences: Record<string, number>;
  voting_behavior_vector: number[];
  browsing_pattern_vector: number[];
  similarity_features: number[];
  prediction_confidence: number;
}

// Singleton instance
export const dataWarehouse = new DataWarehouse();