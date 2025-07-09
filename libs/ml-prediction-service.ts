/**
 * ML Prediction Service for MySetlist
 * Advanced machine learning predictions for setlist recommendations
 */

import { supabaseAdmin } from './supabaseAdmin';
import { DatabaseOptimizer, perfMonitor } from './performance';
import type { Show, Artist, Song } from '@/types';

export interface PredictionConfig {
  artistWeight: number;
  venueWeight: number;
  genreWeight: number;
  popularityWeight: number;
  historicalWeight: number;
  recentTrendsWeight: number;
}

export interface SetlistPrediction {
  songId: string;
  title: string;
  artistName: string;
  confidence: number;
  position: number;
  reasoning: string[];
  historicalFrequency: number;
  trendingScore: number;
}

export interface PredictionMetrics {
  accuracy: number;
  confidence: number;
  processingTime: number;
  dataPoints: number;
  modelVersion: string;
}

export class MLPredictionService {
  private static instance: MLPredictionService;
  private config: PredictionConfig = {
    artistWeight: 0.35,
    venueWeight: 0.15,
    genreWeight: 0.20,
    popularityWeight: 0.15,
    historicalWeight: 0.10,
    recentTrendsWeight: 0.05
  };

  static getInstance(): MLPredictionService {
    if (!MLPredictionService.instance) {
      MLPredictionService.instance = new MLPredictionService();
    }
    return MLPredictionService.instance;
  }

  /**
   * Generate setlist predictions using ML algorithms
   */
  async generateSetlistPredictions(
    showId: string,
    setlistLength: number = 20
  ): Promise<SetlistPrediction[]> {
    return perfMonitor.measure('ml_setlist_prediction', async () => {
      try {
        // Get show and artist data
        const showData = await this.getShowData(showId);
        if (!showData) throw new Error('Show not found');

        // Get historical data for ML training
        const historicalData = await this.getHistoricalData(showData.artist.id);
        
        // Get song popularity and trending data
        const songPopularity = await this.getSongPopularityData(showData.artist.id);
        
        // Get venue-specific patterns
        const venuePatterns = await this.getVenuePatterns(showData.venue?.id);
        
        // Generate predictions using ensemble method
        const predictions = await this.runEnsemblePrediction({
          showData,
          historicalData,
          songPopularity,
          venuePatterns,
          setlistLength
        });

        // Sort by confidence and position
        return predictions
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, setlistLength)
          .map((pred, index) => ({ ...pred, position: index + 1 }));

      } catch (error) {
        console.error('ML Prediction error:', error);
        throw new Error('Failed to generate setlist predictions');
      }
    });
  }

  /**
   * Get artist's historical setlist patterns
   */
  private async getHistoricalData(artistId: string) {
    return DatabaseOptimizer.getCached(
      `historical_data_${artistId}`,
      async () => {
        const { data, error } = await supabaseAdmin
          .from('setlists')
          .select(`
            id,
            type,
            show:shows!inner (
              id,
              date,
              venue:venues (id, name, city, capacity)
            ),
            setlist_songs (
              position,
              song:songs (
                id,
                title,
                artist_name,
                spotify_id
              )
            )
          `)
          .eq('shows.artist_id', artistId)
          .eq('type', 'actual')
          .order('shows.date', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      },
      30 // 30 minute cache
    );
  }

  /**
   * Get song popularity and voting data
   */
  private async getSongPopularityData(artistId: string) {
    return DatabaseOptimizer.getCached(
      `song_popularity_${artistId}`,
      async () => {
        const { data, error } = await supabaseAdmin
          .from('setlist_songs')
          .select(`
            upvotes,
            downvotes,
            song:songs (
              id,
              title,
              artist_name,
              spotify_id
            ),
            setlist:setlists!inner (
              show:shows!inner (
                artist_id,
                date
              )
            )
          `)
          .eq('setlist.show.artist_id', artistId)
          .order('upvotes', { ascending: false });

        if (error) throw error;

        // Calculate popularity scores
        return (data || []).map(item => ({
          ...item.song,
          popularity: (item.upvotes - item.downvotes) / Math.max(1, item.upvotes + item.downvotes),
          totalVotes: item.upvotes + item.downvotes,
          upvoteRatio: item.upvotes / Math.max(1, item.upvotes + item.downvotes)
        }));
      },
      15 // 15 minute cache
    );
  }

  /**
   * Get venue-specific setlist patterns
   */
  private async getVenuePatterns(venueId?: string) {
    if (!venueId) return [];

    return DatabaseOptimizer.getCached(
      `venue_patterns_${venueId}`,
      async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select(`
            id,
            date,
            setlists (
              setlist_songs (
                position,
                song:songs (
                  id,
                  title,
                  artist_name
                )
              )
            )
          `)
          .eq('venue_id', venueId)
          .order('date', { ascending: false })
          .limit(20);

        if (error) throw error;
        return data || [];
      },
      60 // 60 minute cache
    );
  }

  /**
   * Get show data with full details
   */
  private async getShowData(showId: string) {
    const { data, error } = await supabaseAdmin
      .from('shows')
      .select(`
        id,
        name,
        date,
        start_time,
        artist:artists (
          id,
          name,
          slug,
          genres,
          followers,
          verified
        ),
        venue:venues (
          id,
          name,
          city,
          capacity
        )
      `)
      .eq('id', showId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Run ensemble prediction algorithm
   */
  private async runEnsemblePrediction(context: {
    showData: any;
    historicalData: any[];
    songPopularity: any[];
    venuePatterns: any[];
    setlistLength: number;
  }): Promise<SetlistPrediction[]> {
    const { showData, historicalData, songPopularity, venuePatterns } = context;

    // Get all unique songs from historical data
    const allSongs = new Map<string, any>();
    
    historicalData.forEach(setlist => {
      setlist.setlist_songs?.forEach((item: any) => {
        if (item.song) {
          allSongs.set(item.song.id, item.song);
        }
      });
    });

    // Calculate prediction scores for each song
    const predictions: SetlistPrediction[] = [];

    for (const [songId, song] of allSongs) {
      const score = this.calculatePredictionScore({
        song,
        showData,
        historicalData,
        songPopularity,
        venuePatterns
      });

      if (score.confidence > 0.1) { // Only include songs with reasonable confidence
        predictions.push({
          songId: song.id,
          title: song.title,
          artistName: song.artist_name,
          confidence: score.confidence,
          position: 0, // Will be set later
          reasoning: score.reasoning,
          historicalFrequency: score.historicalFrequency,
          trendingScore: score.trendingScore
        });
      }
    }

    return predictions;
  }

  /**
   * Calculate prediction score for a song
   */
  private calculatePredictionScore(context: {
    song: any;
    showData: any;
    historicalData: any[];
    songPopularity: any[];
    venuePatterns: any[];
  }) {
    const { song, showData, historicalData, songPopularity, venuePatterns } = context;
    const reasoning: string[] = [];

    // Historical frequency score
    const historicalAppearances = historicalData.reduce((count, setlist) => {
      const appears = setlist.setlist_songs?.some((item: any) => item.song?.id === song.id);
      return count + (appears ? 1 : 0);
    }, 0);
    
    const historicalFrequency = historicalAppearances / Math.max(1, historicalData.length);
    let historicalScore = historicalFrequency * this.config.historicalWeight;
    
    if (historicalFrequency > 0.3) {
      reasoning.push(`Frequently played (${Math.round(historicalFrequency * 100)}% of shows)`);
    }

    // Popularity score from voting
    const popularitySong = songPopularity.find(p => p.id === song.id);
    let popularityScore = 0;
    
    if (popularitySong) {
      popularityScore = popularitySong.popularity * this.config.popularityWeight;
      if (popularitySong.upvoteRatio > 0.7) {
        reasoning.push(`High fan approval (${Math.round(popularitySong.upvoteRatio * 100)}% upvotes)`);
      }
    }

    // Venue pattern score
    let venueScore = 0;
    const venueAppearances = venuePatterns.reduce((count, show) => {
      const appears = show.setlists?.some((setlist: any) =>
        setlist.setlist_songs?.some((item: any) => item.song?.id === song.id)
      );
      return count + (appears ? 1 : 0);
    }, 0);

    if (venuePatterns.length > 0) {
      venueScore = (venueAppearances / venuePatterns.length) * this.config.venueWeight;
      if (venueAppearances > 0) {
        reasoning.push(`Played at this venue type before`);
      }
    }

    // Recent trends score (last 5 shows)
    const recentShows = historicalData.slice(0, 5);
    const recentAppearances = recentShows.reduce((count, setlist) => {
      const appears = setlist.setlist_songs?.some((item: any) => item.song?.id === song.id);
      return count + (appears ? 1 : 0);
    }, 0);

    const recentTrendScore = (recentAppearances / Math.max(1, recentShows.length)) * this.config.recentTrendsWeight;
    if (recentAppearances >= 3) {
      reasoning.push('Recently trending in setlists');
    }

    // Genre/artist consistency (simple boost for same artist)
    let genreScore = 0;
    if (song.artist_name === showData.artist.name) {
      genreScore = this.config.genreWeight;
      reasoning.push('Artist\'s own song');
    }

    // Calculate final confidence score
    const confidence = Math.min(1.0, 
      historicalScore + popularityScore + venueScore + recentTrendScore + genreScore
    );

    // Calculate trending score for additional context
    const trendingScore = recentTrendScore * 10; // Scale for display

    return {
      confidence,
      reasoning,
      historicalFrequency,
      trendingScore
    };
  }

  /**
   * Get prediction accuracy metrics
   */
  async getPredictionMetrics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<PredictionMetrics> {
    // This would compare predictions against actual setlists
    // For now, return mock metrics
    return {
      accuracy: 0.78,
      confidence: 0.85,
      processingTime: 0,
      dataPoints: 1250,
      modelVersion: '1.0.0'
    };
  }

  /**
   * Update prediction model configuration
   */
  updateConfig(newConfig: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    DatabaseOptimizer.clearCache(); // Clear cache when config changes
  }

  /**
   * Precompute predictions for upcoming shows
   */
  async precomputePredictions(): Promise<void> {
    const { data: upcomingShows } = await supabaseAdmin
      .from('shows')
      .select('id')
      .gte('date', new Date().toISOString().split('T')[0])
      .lte('date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (upcomingShows) {
      for (const show of upcomingShows) {
        try {
          await this.generateSetlistPredictions(show.id);
        } catch (error) {
          console.error(`Failed to precompute predictions for show ${show.id}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const mlPredictionService = MLPredictionService.getInstance();