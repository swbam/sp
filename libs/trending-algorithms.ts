// Trending algorithms for calculating hot shows and popular artists
import type { ShowWithDetails, Artist } from '@/types';

export interface TrendingConfig {
  recencyWeight: number;
  voteWeight: number;
  followersWeight: number;
  upcomingShowsWeight: number;
  timeDecayFactor: number;
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  recencyWeight: 0.3,
  voteWeight: 0.4,
  followersWeight: 0.2,
  upcomingShowsWeight: 0.1,
  timeDecayFactor: 0.1
};

/**
 * Calculate trending score for shows based on multiple factors
 */
export function calculateShowTrendingScore(
  show: any, // Accept any type since API returns different structure
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG
): number {
  const now = new Date();
  const showDate = new Date(show.date);
  
  // Base vote score
  const totalVotes = show.setlists?.reduce((acc: number, setlist: any) => {
    return acc + (setlist.setlist_songs?.reduce((voteAcc: number, song: any) => {
      return voteAcc + (song.upvotes || 0) + (song.downvotes || 0);
    }, 0) || 0);
  }, 0) || 0;

  // Positive vote ratio (upvotes / total votes)
  const positiveVotes = show.setlists?.reduce((acc: number, setlist: any) => {
    return acc + (setlist.setlist_songs?.reduce((voteAcc: number, song: any) => {
      return voteAcc + (song.upvotes || 0);
    }, 0) || 0);
  }, 0) || 0;

  const positiveRatio = totalVotes > 0 ? positiveVotes / totalVotes : 0.5;

  // Time factors
  const daysUntilShow = Math.max(1, (showDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const timeDecay = Math.exp(-config.timeDecayFactor * daysUntilShow);

  // Recency factor (how recently the show was created/updated)
  const createdDate = new Date(show.created_at);
  const daysSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.exp(-config.recencyWeight * daysSinceCreated);

  // Artist popularity boost (handle both object and array format)
  const artist = Array.isArray(show.artist) ? show.artist[0] : show.artist;
  const artistFollowers = artist?.followers || 0;
  const popularityBoost = Math.log(artistFollowers + 1) / Math.log(10); // Log scale

  // Venue capacity boost (if available)
  const venueBoost = 1; // Could be expanded with venue data

  // Calculate final score
  const voteScore = totalVotes * positiveRatio * config.voteWeight;
  const timeScore = timeDecay * config.recencyWeight * 100;
  const recencyScore = recencyFactor * config.recencyWeight * 50;
  const popularityScore = popularityBoost * config.followersWeight * 10;

  return voteScore + timeScore + recencyScore + popularityScore + venueBoost;
}

/**
 * Calculate trending score for artists based on multiple factors
 */
export function calculateArtistTrendingScore(
  artist: Artist & { shows?: any[]; upcoming_shows_count?: number },
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG
): number {
  const now = new Date();

  // Base followers score
  const followersScore = (artist.followers || 0) * config.followersWeight;

  // Upcoming shows boost
  const upcomingShows = artist.upcoming_shows_count || 0;
  const upcomingShowsScore = upcomingShows * config.upcomingShowsWeight * 1000;

  // Recent show activity
  const recentShows = artist.shows?.filter(show => {
    const showDate = new Date(show.date);
    const daysSinceShow = (now.getTime() - showDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceShow <= 30; // Shows in last 30 days
  }).length || 0;

  const recentActivityScore = recentShows * config.recencyWeight * 500;

  // Genre popularity boost (could be expanded)
  const genreBoost = artist.genres?.length || 0;

  // Verified artist boost
  const verifiedBoost = artist.verified ? 100 : 0;

  return followersScore + upcomingShowsScore + recentActivityScore + genreBoost + verifiedBoost;
}

/**
 * Sort shows by trending score
 */
export function sortShowsByTrending(
  shows: any[], // Accept any type since API returns different structure
  config?: TrendingConfig
): any[] {
  return shows
    .map(show => ({
      ...show,
      trending_score: calculateShowTrendingScore(show, config)
    }))
    .sort((a, b) => b.trending_score - a.trending_score);
}

/**
 * Sort artists by trending score
 */
export function sortArtistsByTrending(
  artists: (Artist & { shows?: any[]; upcoming_shows_count?: number })[],
  config?: TrendingConfig
): (Artist & { shows?: any[]; upcoming_shows_count?: number; trending_score: number })[] {
  return artists
    .map(artist => ({
      ...artist,
      trending_score: calculateArtistTrendingScore(artist, config)
    }))
    .sort((a, b) => b.trending_score - a.trending_score);
}

/**
 * Get trending shows for a specific timeframe
 */
export function getTrendingTimeframeFilter(timeframe: 'day' | 'week' | 'month' = 'week'): Date {
  const now = new Date();
  let startDate = new Date();
  
  switch (timeframe) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }
  
  return startDate;
}

/**
 * Calculate trending momentum (rate of change)
 */
export function calculateTrendingMomentum(
  currentScore: number,
  previousScore: number = 0
): number {
  if (previousScore === 0) return currentScore;
  return ((currentScore - previousScore) / previousScore) * 100;
}

/**
 * Apply trending boost for special events
 */
export function applySpecialEventBoost(
  show: any, // Accept any type since API returns different structure
  baseScore: number
): number {
  const showName = show.name.toLowerCase();
  const artist = Array.isArray(show.artist) ? show.artist[0] : show.artist;
  const artistName = artist?.name.toLowerCase() || '';
  
  // Festival boost
  if (showName.includes('festival') || showName.includes('fest')) {
    return baseScore * 1.5;
  }
  
  // Special venue boost
  if (showName.includes('madison square garden') || showName.includes('wembley')) {
    return baseScore * 1.3;
  }
  
  // Major artist boost
  const majorArtists = ['taylor swift', 'beyoncé', 'drake', 'adele', 'billie eilish'];
  if (majorArtists.some(artist => artistName.includes(artist))) {
    return baseScore * 1.4;
  }
  
  return baseScore;
}

/**
 * Get trending categories for display
 */
export function getTrendingCategories(
  shows: any[], // Accept any type since API returns different structure
  artists: any[]
): {
  hottest: any[];
  rising: any[];
  newAndNoteworthy: any[];
  popularArtists: any[];
  breakingOut: any[];
} {
  const sortedShows = sortShowsByTrending(shows);
  const sortedArtists = sortArtistsByTrending(artists);
  
  return {
    hottest: sortedShows.slice(0, 5),
    rising: sortedShows.slice(5, 10),
    newAndNoteworthy: sortedShows
      .filter(show => {
        const createdDate = new Date(show.created_at);
        const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated <= 7; // Created in last week
      })
      .slice(0, 5),
    popularArtists: sortedArtists.slice(0, 8),
    breakingOut: sortedArtists
      .filter(artist => (artist.followers || 0) < 100000) // Smaller artists
      .slice(0, 6)
  };
}