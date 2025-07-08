import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all'; // 'artists', 'shows', 'venues', 'all'
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    return NextResponse.json({ 
      artists: [], 
      shows: [], 
      venues: [] 
    });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const result: any = {};

    if (type === 'artists' || type === 'all') {
      // Search artists
      const { data: artists, error: artistsError } = await supabase
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
          updated_at
        `)
        .ilike('name', `%${query}%`)
        .order('followers', { ascending: false })
        .limit(limit);

      if (!artistsError) {
        result.artists = artists || [];
      }
    }

    if (type === 'shows' || type === 'all') {
      // Search shows
      const { data: shows, error: showsError } = await supabase
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
            followers,
            verified
          ),
          venue:venues (
            id,
            name,
            city,
            state,
            country
          )
        `)
        .or(`name.ilike.%${query}%,artists.name.ilike.%${query}%`)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(limit);

      if (!showsError) {
        result.shows = shows || [];
      }
    }

    if (type === 'venues' || type === 'all') {
      // Search venues
      const { data: venues, error: venuesError } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          slug,
          city,
          state,
          country,
          capacity
        `)
        .or(`name.ilike.%${query}%,city.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(limit);

      if (!venuesError) {
        result.venues = venues || [];
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}