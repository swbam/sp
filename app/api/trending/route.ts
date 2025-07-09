import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { 
  sortShowsByTrending, 
  sortArtistsByTrending, 
  getTrendingTimeframeFilter,
  applySpecialEventBoost,
  getTrendingCategories
} from '@/libs/trending-algorithms';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cache configuration
const CACHE_DURATION = 300; // 5 minutes
const STALE_WHILE_REVALIDATE = 600; // 10 minutes

// In-memory cache for trending data
const cache = new Map();
const CACHE_KEY_PREFIX = 'trending';

function getCacheKey(type: string, timeframe: string, limit: number) {
  return `${CACHE_KEY_PREFIX}:${type}:${timeframe}:${limit}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'shows';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Cap at 50
  const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
  const category = searchParams.get('category'); // Optional category filter

  // Set cache headers for performance
  const headers = new Headers({
    'Cache-Control': `s-maxage=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    'CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
    'Vercel-CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
  });

  try {
    // Check in-memory cache first
    const cacheKey = getCacheKey(type, timeframe, limit);
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION * 1000) {
      return NextResponse.json(cachedData.data, { headers });
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Calculate date range for trending
    const startDate = getTrendingTimeframeFilter(timeframe);
    const result: any = {};

    if (type === 'shows' || type === 'all') {
      // Get trending shows based on upcoming shows with most votes and recent activity
      const { data: trendingShows, error: showsError } = await supabase
        .from('shows')
        .select(`
          id,
          name,
          date,
          start_time,
          status,
          ticket_url,
          created_at,
          artist:artists (
            id,
            name,
            slug,
            image_url,
            genres,
            followers,
            verified
          ),
          venue:venues (
            id,
            name,
            city,
            state,
            country
          ),
          setlists (
            id,
            setlist_songs (
              upvotes,
              downvotes
            )
          )
        `)
        .eq('status', 'upcoming')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(limit * 2); // Get more to filter and sort

      if (showsError) {
        console.error('Trending shows error:', showsError);
      } else {
        // Use advanced trending algorithm
        const sortedShows = sortShowsByTrending(trendingShows || []);
        
        // Apply special event boosts
        const showsWithBoosts = sortedShows.map(show => ({
          ...show,
          trending_score: applySpecialEventBoost(show, show.trending_score)
        }));

        // Take top results
        result.trending_shows = showsWithBoosts.slice(0, limit);
      }
    }

    if (type === 'artists' || type === 'all') {
      // Get trending artists based on followers and recent show activity
      const { data: trendingArtists, error: artistsError } = await supabase
        .from('artists')
        .select(`
          id,
          name,
          slug,
          image_url,
          genres,
          followers,
          verified,
          created_at,
          updated_at,
          shows!inner (
            id,
            date,
            status
          )
        `)
        .gte('shows.date', startDate.toISOString().split('T')[0])
        .order('followers', { ascending: false })
        .limit(limit * 2);

      if (artistsError) {
        console.error('Trending artists error:', artistsError);
      } else {
        // Calculate upcoming shows count
        const artistsWithUpcomingShows = (trendingArtists || []).map(artist => {
          const upcomingShows = artist.shows?.filter((show: any) => 
            show.status === 'upcoming' && new Date(show.date) > new Date()
          ).length || 0;

          return {
            ...artist,
            upcoming_shows_count: upcomingShows
          };
        });

        // Use advanced trending algorithm
        const sortedArtists = sortArtistsByTrending(artistsWithUpcomingShows);
        
        result.trending_artists = sortedArtists.slice(0, limit);
      }
    }

    // Add trending categories if requested
    if (category === 'categories' && type === 'all') {
      const categories = getTrendingCategories(
        result.trending_shows || [],
        result.trending_artists || []
      );
      result.categories = categories;
    }

    // Update cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers }
    );
  }
}