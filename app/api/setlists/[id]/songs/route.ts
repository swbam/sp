import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { song_id, position } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if setlist exists and is not locked
    const { data: setlist, error: setlistError } = await supabase
      .from('setlists')
      .select('id, is_locked')
      .eq('id', params.id)
      .single();

    if (setlistError) {
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    if (setlist.is_locked) {
      return NextResponse.json({ error: 'Setlist is locked' }, { status: 403 });
    }

    // Get next position if not provided
    let songPosition = position;
    if (!songPosition) {
      const { data: maxPosition } = await supabase
        .from('setlist_songs')
        .select('position')
        .eq('setlist_id', params.id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      songPosition = (maxPosition?.position || 0) + 1;
    }

    // Add song to setlist
    const { data: setlistSong, error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: params.id,
        song_id,
        position: songPosition,
        upvotes: 0,
        downvotes: 0
      })
      .select(`
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
      `)
      .single();

    if (error) {
      console.error('Add song to setlist error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ setlist_song: setlistSong });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get('song_id');
    
    if (!songId) {
      return NextResponse.json({ error: 'song_id is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if setlist exists and is not locked
    const { data: setlist, error: setlistError } = await supabase
      .from('setlists')
      .select('id, is_locked')
      .eq('id', params.id)
      .single();

    if (setlistError) {
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    if (setlist.is_locked) {
      return NextResponse.json({ error: 'Setlist is locked' }, { status: 403 });
    }

    // Remove song from setlist
    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', params.id)
      .eq('song_id', songId);

    if (error) {
      console.error('Remove song from setlist error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}