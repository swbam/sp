import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status') || 'upcoming';

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // First get the artist by slug
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (artistError) {
      if (artistError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
      }
      console.error('Artist fetch error:', artistError);
      return NextResponse.json({ error: artistError.message }, { status: 500 });
    }

    // Get shows for this artist
    let query = supabase
      .from('shows')
      .select(`
        id,
        name,
        date,
        start_time,
        status,
        ticket_url,
        created_at,
        updated_at,
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
          slug,
          city,
          state,
          country,
          capacity
        )
      `)
      .eq('artist_id', artist.id);

    // Filter by status if provided
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Only show future shows for upcoming status
    if (status === 'upcoming') {
      query = query.gte('date', new Date().toISOString().split('T')[0]);
    }

    const { data: shows, error } = await query
      .order('date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Shows fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shows: shows || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}