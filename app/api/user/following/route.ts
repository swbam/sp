import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const withUpcomingShows = searchParams.get('with_shows') === 'true';

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's followed artists
    const { data: following, error } = await supabase
      .from('user_artist_follows')
      .select(`
        created_at,
        artist:artists (
          id,
          name,
          slug,
          image_url,
          genres,
          followers,
          verified
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Following fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data
    const followedArtists = (following || []).map((follow: any) => {
      return {
        ...follow.artist,
        followed_at: follow.created_at
      };
    });

    // If user wants upcoming shows, fetch them separately
    if (withUpcomingShows && followedArtists.length > 0) {
      const artistIds = followedArtists.map(artist => artist.id);
      
      const { data: upcomingShows } = await supabase
        .from('shows')
        .select(`
          id,
          name,
          date,
          start_time,
          status,
          artist_id,
          venue:venues (
            name,
            city,
            state
          )
        `)
        .in('artist_id', artistIds)
        .eq('status', 'upcoming')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Add upcoming shows to each artist
      followedArtists.forEach(artist => {
        const artistShows = upcomingShows?.filter(show => show.artist_id === artist.id) || [];
        artist.upcoming_shows = artistShows;
      });
    }

    return NextResponse.json({ 
      following: followedArtists,
      count: followedArtists.length 
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}