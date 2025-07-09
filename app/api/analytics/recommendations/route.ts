import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Machine Learning Recommendations API
// Uses warehouse data and ML features to provide personalized recommendations

const RecommendationQuerySchema = z.object({
  type: z.enum(['artists', 'shows', 'songs', 'mixed']).default('mixed'),
  limit: z.number().min(1).max(50).default(10),
  diversity: z.number().min(0).max(1).default(0.7), // 0 = similar, 1 = diverse
  includeExplanations: z.boolean().default(true),
  excludeFollowed: z.boolean().default(false), // Exclude already followed artists
  timeframe: z.enum(['upcoming', 'this_week', 'this_month', 'all']).default('upcoming')
});

const SimilarUsersQuerySchema = z.object({
  limit: z.number().min(1).max(20).default(5),
  similarity_threshold: z.number().min(0).max(1).default(0.7)
});

// Get personalized recommendations for user
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = RecommendationQuerySchema.parse({
      type: searchParams.get('type') || 'mixed',
      limit: parseInt(searchParams.get('limit') || '10'),
      diversity: parseFloat(searchParams.get('diversity') || '0.7'),
      includeExplanations: searchParams.get('includeExplanations') !== 'false',
      excludeFollowed: searchParams.get('excludeFollowed') === 'true',
      timeframe: searchParams.get('timeframe') || 'upcoming'
    });

    // Get user's ML features and behavior data
    const userProfile = await getUserProfile(supabase, user.id);
    
    if (!userProfile) {
      // New user - provide popular/trending recommendations
      const recommendations = await getPopularRecommendations(supabase, params);
      return NextResponse.json({
        recommendations,
        type: 'popular',
        reason: 'New user - showing popular content',
        generatedAt: new Date().toISOString()
      });
    }

    // Generate personalized recommendations
    const recommendations = await generatePersonalizedRecommendations(
      supabase,
      user.id,
      userProfile,
      params
    );

    return NextResponse.json({
      recommendations,
      type: 'personalized',
      userProfile: {
        engagementScore: userProfile.engagement_score,
        activityLevel: userProfile.activity_level,
        preferences: userProfile.genre_preferences
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recommendations API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

// Get similar users for collaborative filtering insights
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const params = SimilarUsersQuerySchema.parse(body);

    // Find similar users based on ML features
    const similarUsers = await findSimilarUsers(supabase, user.id, params);
    
    return NextResponse.json({
      similarUsers,
      algorithm: 'cosine_similarity',
      threshold: params.similarity_threshold,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Similar users API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to find similar users' },
      { status: 500 }
    );
  }
}

// Core recommendation logic
async function getUserProfile(supabase: any, userId: string): Promise<UserProfile | null> {
  // Get comprehensive user profile from warehouse
  const [behaviorData, engagementData, mlFeatures, votingPatterns] = await Promise.all([
    supabase
      .from('user_behavior_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('user_engagement_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('user_recommendation_features')
      .select('*')
      .eq('user_id', userId)
      .single(),
    
    supabase
      .from('voting_patterns_warehouse')
      .select('*')
      .eq('user_id', userId)
      .single()
  ]);

  if (!behaviorData.data && !engagementData.data) {
    return null; // New user
  }

  return {
    user_id: userId,
    engagement_score: engagementData.data?.engagement_score || 0,
    activity_level: engagementData.data?.activity_level || 'low',
    genre_preferences: mlFeatures.data?.genre_preferences || {},
    voting_behavior: votingPatterns.data || {},
    behavior_features: behaviorData.data || {},
    prediction_confidence: mlFeatures.data?.prediction_confidence || 0.1
  };
}

async function generatePersonalizedRecommendations(
  supabase: any,
  userId: string,
  userProfile: UserProfile,
  params: any
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Content-based filtering
  const contentRecommendations = await getContentBasedRecommendations(
    supabase,
    userProfile,
    params
  );

  // Collaborative filtering
  const collaborativeRecommendations = await getCollaborativeRecommendations(
    supabase,
    userId,
    userProfile,
    params
  );

  // Hybrid approach: combine and rank recommendations
  const hybridRecommendations = combineRecommendations(
    contentRecommendations,
    collaborativeRecommendations,
    userProfile,
    params
  );

  return hybridRecommendations.slice(0, params.limit);
}

async function getContentBasedRecommendations(
  supabase: any,
  userProfile: UserProfile,
  params: any
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Artist recommendations based on genre preferences
  if (params.type === 'artists' || params.type === 'mixed') {
    const artistRecs = await getGenreBasedArtistRecommendations(
      supabase,
      userProfile.genre_preferences,
      params
    );
    recommendations.push(...artistRecs);
  }

  // Show recommendations based on followed artists and preferences
  if (params.type === 'shows' || params.type === 'mixed') {
    const showRecs = await getPersonalizedShowRecommendations(
      supabase,
      userProfile,
      params
    );
    recommendations.push(...showRecs);
  }

  return recommendations;
}

async function getGenreBasedArtistRecommendations(
  supabase: any,
  genrePreferences: Record<string, number>,
  params: any
): Promise<Recommendation[]> {
  if (Object.keys(genrePreferences).length === 0) {
    return [];
  }

  // Get top preferred genres
  const topGenres = Object.entries(genrePreferences)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);

  // Find artists in preferred genres
  const { data: artists } = await supabase
    .from('artist_popularity_view')
    .select('*')
    .overlaps('genres', topGenres)
    .order('trending_score', { ascending: false })
    .limit(params.limit * 2); // Get more than needed for diversity

  return (artists || []).map((artist: any) => ({
    id: artist.id,
    type: 'artist' as const,
    title: artist.name,
    subtitle: `${artist.total_followers} followers`,
    score: calculateGenreMatchScore(artist.genres, genrePreferences),
    confidence: 0.8,
    reason: `Matches your preference for ${topGenres.slice(0, 2).join(' and ')}`,
    metadata: {
      genres: artist.genres,
      popularity_score: artist.popularity_score,
      trending_score: artist.trending_score
    }
  }));
}

async function getPersonalizedShowRecommendations(
  supabase: any,
  userProfile: UserProfile,
  params: any
): Promise<Recommendation[]> {
  // Get user's followed artists
  const { data: followedArtists } = await supabase
    .from('user_artists')
    .select('artist_id')
    .eq('user_id', userProfile.user_id);

  const followedArtistIds = followedArtists?.map(fa => fa.artist_id) || [];

  // Get shows for followed artists
  let showQuery = supabase
    .from('show_engagement_view')
    .select('*')
    .eq('status', 'upcoming')
    .order('engagement_rate', { ascending: false });

  if (followedArtistIds.length > 0) {
    showQuery = showQuery.in('artist_id', followedArtistIds);
  }

  const { data: shows } = await showQuery.limit(params.limit * 2);

  return (shows || []).map((show: any) => ({
    id: show.id,
    type: 'show' as const,
    title: `${show.artist_name} at ${show.venue_name}`,
    subtitle: new Date(show.date).toLocaleDateString(),
    score: calculateShowRelevanceScore(show, userProfile),
    confidence: followedArtistIds.includes(show.artist_id) ? 0.9 : 0.6,
    reason: followedArtistIds.includes(show.artist_id) 
      ? `You follow ${show.artist_name}`
      : `High engagement show in your area`,
    metadata: {
      show_date: show.date,
      venue_name: show.venue_name,
      engagement_rate: show.engagement_rate,
      total_votes: show.total_votes
    }
  }));
}

async function getCollaborativeRecommendations(
  supabase: any,
  userId: string,
  userProfile: UserProfile,
  params: any
): Promise<Recommendation[]> {
  // Find similar users
  const similarUsers = await findSimilarUsers(supabase, userId, {
    limit: 10,
    similarity_threshold: 0.6
  });

  if (similarUsers.length === 0) {
    return [];
  }

  const similarUserIds = similarUsers.map(u => u.user_id);

  // Get artists followed by similar users but not by current user
  const { data: recommendations } = await supabase
    .from('user_artists')
    .select(`
      artist_id,
      artists!inner(
        id,
        name,
        genres,
        followers
      )
    `)
    .in('user_id', similarUserIds)
    .not('artist_id', 'in', `(${await getUserFollowedArtistIds(supabase, userId)})`)
    .limit(params.limit);

  // Group by artist and count occurrences
  const artistCounts = new Map<string, { artist: any; count: number }>();
  
  (recommendations || []).forEach(rec => {
    const artistId = rec.artist_id;
    if (artistCounts.has(artistId)) {
      artistCounts.get(artistId)!.count++;
    } else {
      artistCounts.set(artistId, { artist: rec.artists, count: 1 });
    }
  });

  // Convert to recommendation format
  return Array.from(artistCounts.values())
    .sort((a, b) => b.count - a.count)
    .map(({ artist, count }) => ({
      id: artist.id,
      type: 'artist' as const,
      title: artist.name,
      subtitle: `${artist.followers} followers`,
      score: count / similarUsers.length, // Proportion of similar users who follow
      confidence: 0.7,
      reason: `${count} users with similar taste follow this artist`,
      metadata: {
        genres: artist.genres,
        similar_user_count: count,
        total_similar_users: similarUsers.length
      }
    }));
}

async function findSimilarUsers(
  supabase: any,
  userId: string,
  params: { limit: number; similarity_threshold: number }
): Promise<SimilarUser[]> {
  // Get current user's ML features
  const { data: userFeatures } = await supabase
    .from('user_recommendation_features')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!userFeatures) {
    return [];
  }

  // Get all other users' features
  const { data: allUserFeatures } = await supabase
    .from('user_recommendation_features')
    .select('*')
    .neq('user_id', userId);

  if (!allUserFeatures || allUserFeatures.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const similarities = allUserFeatures
    .map(otherUser => ({
      user_id: otherUser.user_id,
      similarity: calculateCosineSimilarity(
        userFeatures.voting_behavior_vector || [],
        otherUser.voting_behavior_vector || []
      )
    }))
    .filter(sim => sim.similarity >= params.similarity_threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, params.limit);

  return similarities;
}

// Utility functions
function combineRecommendations(
  contentRecs: Recommendation[],
  collaborativeRecs: Recommendation[],
  userProfile: UserProfile,
  params: any
): Recommendation[] {
  // Weight recommendations based on user's prediction confidence and activity level
  const contentWeight = userProfile.prediction_confidence > 0.7 ? 0.6 : 0.8;
  const collaborativeWeight = 1 - contentWeight;

  // Combine and re-score
  const allRecs = [
    ...contentRecs.map(rec => ({ ...rec, score: rec.score * contentWeight })),
    ...collaborativeRecs.map(rec => ({ ...rec, score: rec.score * collaborativeWeight }))
  ];

  // Remove duplicates and apply diversity
  const uniqueRecs = removeDuplicates(allRecs);
  const diversifiedRecs = applyDiversityFilter(uniqueRecs, params.diversity);

  return diversifiedRecs.sort((a, b) => b.score - a.score);
}

function calculateGenreMatchScore(
  artistGenres: string[],
  userPreferences: Record<string, number>
): number {
  if (!artistGenres || artistGenres.length === 0) return 0;

  const matchingGenres = artistGenres.filter(genre => userPreferences[genre]);
  if (matchingGenres.length === 0) return 0;

  const totalPreferenceScore = matchingGenres.reduce(
    (sum, genre) => sum + (userPreferences[genre] || 0),
    0
  );

  return totalPreferenceScore / artistGenres.length;
}

function calculateShowRelevanceScore(show: any, userProfile: UserProfile): number {
  let score = 0;

  // Base engagement score
  score += (show.engagement_rate || 0) * 0.4;

  // Vote activity
  score += Math.min((show.total_votes || 0) / 100, 1) * 0.3;

  // User activity level bonus
  const activityMultiplier = {
    'high': 1.2,
    'medium': 1.0,
    'low': 0.8,
    'inactive': 0.5
  }[userProfile.activity_level] || 1.0;

  score *= activityMultiplier;

  return Math.min(score, 1);
}

function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length || vectorA.length === 0) {
    return 0;
  }

  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

function removeDuplicates(recommendations: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return recommendations.filter(rec => {
    const key = `${rec.type}-${rec.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function applyDiversityFilter(
  recommendations: Recommendation[],
  diversityFactor: number
): Recommendation[] {
  if (diversityFactor <= 0 || recommendations.length <= 1) {
    return recommendations;
  }

  const diversified: Recommendation[] = [];
  const remaining = [...recommendations];

  // Always add the top recommendation
  if (remaining.length > 0) {
    diversified.push(remaining.shift()!);
  }

  while (remaining.length > 0 && diversified.length < recommendations.length) {
    let bestRec = remaining[0];
    let bestScore = bestRec.score;

    // Apply diversity penalty based on similarity to already selected items
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const diversityPenalty = calculateDiversityPenalty(candidate, diversified);
      const adjustedScore = candidate.score * (1 - diversityFactor * diversityPenalty);

      if (adjustedScore > bestScore) {
        bestRec = candidate;
        bestScore = adjustedScore;
      }
    }

    diversified.push(bestRec);
    remaining.splice(remaining.indexOf(bestRec), 1);
  }

  return diversified;
}

function calculateDiversityPenalty(
  candidate: Recommendation,
  selected: Recommendation[]
): number {
  if (selected.length === 0) return 0;

  // Simple diversity penalty based on type
  const sameTypeCount = selected.filter(s => s.type === candidate.type).length;
  return sameTypeCount / selected.length;
}

async function getUserFollowedArtistIds(supabase: any, userId: string): Promise<string> {
  const { data: followed } = await supabase
    .from('user_artists')
    .select('artist_id')
    .eq('user_id', userId);

  return (followed || []).map(f => f.artist_id).join(',') || '';
}

async function getPopularRecommendations(
  supabase: any,
  params: any
): Promise<Recommendation[]> {
  // Fallback recommendations for new users
  const { data: trendingArtists } = await supabase
    .from('artist_popularity_view')
    .select('*')
    .order('trending_score', { ascending: false })
    .limit(params.limit);

  return (trendingArtists || []).map((artist: any) => ({
    id: artist.id,
    type: 'artist' as const,
    title: artist.name,
    subtitle: `${artist.total_followers} followers`,
    score: artist.trending_score / 100, // Normalize
    confidence: 0.5,
    reason: 'Trending artist',
    metadata: {
      genres: artist.genres,
      popularity_score: artist.popularity_score,
      trending_score: artist.trending_score
    }
  }));
}

// Type definitions
interface UserProfile {
  user_id: string;
  engagement_score: number;
  activity_level: string;
  genre_preferences: Record<string, number>;
  voting_behavior: any;
  behavior_features: any;
  prediction_confidence: number;
}

interface Recommendation {
  id: string;
  type: 'artist' | 'show' | 'song';
  title: string;
  subtitle: string;
  score: number;
  confidence: number;
  reason: string;
  metadata: Record<string, any>;
}

interface SimilarUser {
  user_id: string;
  similarity: number;
}