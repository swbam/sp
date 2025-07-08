import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { setlist_song_id } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    if (!setlist_song_id) {
      return NextResponse.json({ error: 'Missing setlist_song_id' }, { status: 400 });
    }

    // Get current vote count
    const { data: setlistSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select('upvotes')
      .eq('id', setlist_song_id)
      .single();

    if (fetchError || !setlistSong) {
      return NextResponse.json({ error: 'Setlist song not found' }, { status: 404 });
    }

    // Increment upvotes (anonymous voting)
    const currentUpvotes = setlistSong.upvotes || 0;
    const newUpvotes = currentUpvotes + 1;

    const { error: updateError } = await supabase
      .from('setlist_songs')
      .update({ upvotes: newUpvotes })
      .eq('id', setlist_song_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      upvotes: newUpvotes
    });

  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Failed to process vote' }, { status: 500 });
  }
}

// Get vote counts for setlist songs (no authentication needed)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setlistSongIds = searchParams.get('setlist_song_ids')?.split(',') || [];
    
    if (setlistSongIds.length === 0) {
      return NextResponse.json({ voteCounts: {} });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const { data: setlistSongs, error } = await supabase
      .from('setlist_songs')
      .select('id, upvotes')
      .in('id', setlistSongIds);

    if (error) {
      console.error('Get vote counts error:', error);
      return NextResponse.json({ error: 'Failed to fetch vote counts' }, { status: 500 });
    }

    // Convert to object for easy lookup
    const voteCounts = setlistSongs?.reduce((acc, song) => {
      acc[song.id] = {
        upvotes: song.upvotes || 0
      };
      return acc;
    }, {} as Record<string, { upvotes: number }>) || {};

    return NextResponse.json({ voteCounts });

  } catch (error) {
    console.error('Get vote counts error:', error);
    return NextResponse.json({ error: 'Failed to fetch vote counts' }, { status: 500 });
  }
} 