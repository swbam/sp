import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Cache configuration for shows
const CACHE_DURATION = 600; // 10 minutes
const STALE_WHILE_REVALIDATE = 1800; // 30 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // Cap at 100
  const status = searchParams.get('status') || 'upcoming';
  const city = searchParams.get('city');
  const artistId = searchParams.get('artist_id');

  // Optimized cache headers
  const headers = new Headers({
    'Cache-Control': `s-maxage=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    'CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
    'Vercel-CDN-Cache-Control': `s-maxage=${CACHE_DURATION}`,
  });

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Build query with optimizations
    let query = supabase
      .from('shows')
      .select(`
        id,
        name,
        date,
        start_time,
        status,
        ticket_url,
        artist:artists!inner (
          id,
          name,
          slug,
          image_url,
          verified
        ),
        venue:venues!inner (
          id,
          name,
          city,
          state,
          country
        )
      `)
      .eq('status', status);

    // Add filters for better performance
    if (status === 'upcoming') {
      query = query.gte('date', new Date().toISOString().split('T')[0]);
    }

    if (city) {
      query = query.eq('venue.city', city);
    }

    if (artistId) {
      query = query.eq('artist_id', artistId);
    }

    // Execute optimized query
    const { data: shows, error } = await query
      .order('date', { ascending: status === 'upcoming' })
      .limit(limit);

    if (error) {
      console.error('Shows fetch error:', error);
      return NextResponse.json(
        { error: error.message }, 
        { status: 500, headers }
      );
    }

    return NextResponse.json({ 
      shows: shows || [],
      total: shows?.length || 0,
      cached_at: new Date().toISOString()
    }, { headers });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers }
    );
  }
} 