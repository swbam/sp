import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get show with full details including setlists
    const { data: show, error } = await supabase
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
        ),
        setlists (
          id,
          type,
          is_locked,
          created_at,
          setlist_songs (
            id,
            position,
            upvotes,
            downvotes,
            song:songs (
              id,
              title,
              artist_name,
              spotify_id
            )
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Show not found' }, { status: 404 });
      }
      console.error('Show fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort setlist songs by position
    if (show.setlists) {
      show.setlists = show.setlists.map(setlist => ({
        ...setlist,
        setlist_songs: setlist.setlist_songs?.sort((a, b) => a.position - b.position) || []
      }));
    }

    return NextResponse.json({ show });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updateData = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user - only authenticated users can update shows
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: show, error } = await supabase
      .from('shows')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Show update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ show });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}