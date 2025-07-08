import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's followed artists with upcoming shows
    const { data: follows, error } = await supabase
      .from('user_artists')
      .select(`
        artist_id,
        created_at,
        artist:artists(
          id,
          name,
          slug,
          image_url,
          verified,
          followers,
          genres
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching followed artists:', error);
      return NextResponse.json({ error: 'Failed to fetch followed artists' }, { status: 500 });
    }

    // Get upcoming shows for followed artists
    const artistIds = follows?.map(f => f.artist_id) || [];
    
    if (artistIds.length === 0) {
      return NextResponse.json({ artists: [] });
    }

    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select(`
        id,
        artist_id,
        name,
        date,
        venue:venues(name, city, state)
      `)
      .in('artist_id', artistIds)
      .gte('date', new Date().toISOString().split('T')[0])
      .eq('status', 'upcoming')
      .order('date', { ascending: true });

    if (showsError) {
      console.error('Error fetching shows:', showsError);
      // Continue without shows data
    }

    // Combine artists with their upcoming shows
    const artistsWithShows = follows?.map(follow => ({
      ...follow.artist,
      upcoming_shows: shows?.filter(show => show.artist_id === follow.artist_id) || []
    })) || [];

    return NextResponse.json({ 
      artists: artistsWithShows,
      total: follows?.length || 0
    });

  } catch (error) {
    console.error('Error in following API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}