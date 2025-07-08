import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Cache configuration
const CACHE_DURATION = 300; // 5 minutes
const STALE_WHILE_REVALIDATE = 600; // 10 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'shows';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Cap at 50
  const timeframe = searchParams.get('timeframe') || 'week';

  // Set cache headers for performance
  const headers = new Headers({
    'Cache-Control': `s-maxage=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    'CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
    'Vercel-CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
  });

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Calculate date range for trending
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
        // Calculate trending score for each show
        const showsWithScore = (trendingShows || []).map(show => {
          const totalVotes = show.setlists?.reduce((acc: number, setlist: any) => {
            return acc + setlist.setlist_songs?.reduce((voteAcc: number, song: any) => {
              return voteAcc + (song.upvotes || 0) + (song.downvotes || 0);
            }, 0) || 0;
          }, 0) || 0;

          // Calculate days until show
          const daysUntilShow = Math.max(1, Math.ceil(
            (new Date(show.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ));

          // Trending score: more votes and sooner shows rank higher
          const trendingScore = totalVotes / Math.log(daysUntilShow + 1);

          return {
            ...show,
            trending_score: trendingScore,
            total_votes: totalVotes
          };
        });

        // Sort by trending score and take top results
        result.trending_shows = showsWithScore
          .sort((a, b) => b.trending_score - a.trending_score)
          .slice(0, limit);
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
        // Calculate trending score for artists
        const artistsWithScore = (trendingArtists || []).map(artist => {
          const upcomingShows = artist.shows?.filter((show: any) => 
            show.status === 'upcoming' && new Date(show.date) > now
          ).length || 0;

          // Trending score: followers + upcoming shows boost
          const trendingScore = (artist.followers || 0) + (upcomingShows * 1000);

          return {
            ...artist,
            trending_score: trendingScore,
            upcoming_shows_count: upcomingShows
          };
        });

        result.trending_artists = artistsWithScore
          .sort((a, b) => b.trending_score - a.trending_score)
          .slice(0, limit);
      }
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers }
    );
  }
}