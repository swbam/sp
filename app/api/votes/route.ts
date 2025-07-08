import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { setlist_song_id, vote_type } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    if (!setlist_song_id || !vote_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (vote_type !== 'upvote' && vote_type !== 'downvote') {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    // Get current vote counts
    const { data: setlistSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select('upvotes, downvotes')
      .eq('id', setlist_song_id)
      .single();

    if (fetchError || !setlistSong) {
      return NextResponse.json({ error: 'Setlist song not found' }, { status: 404 });
    }

    // Update vote counts directly (anonymous voting)
    const currentUpvotes = setlistSong.upvotes || 0;
    const currentDownvotes = setlistSong.downvotes || 0;

    const updates = vote_type === 'upvote' 
      ? { upvotes: currentUpvotes + 1 }
      : { downvotes: currentDownvotes + 1 };

    const { error: updateError } = await supabase
      .from('setlist_songs')
      .update(updates)
      .eq('id', setlist_song_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
    }

    // Return updated counts
    const newUpvotes = vote_type === 'upvote' ? currentUpvotes + 1 : currentUpvotes;
    const newDownvotes = vote_type === 'downvote' ? currentDownvotes + 1 : currentDownvotes;

    return NextResponse.json({ 
      success: true, 
      upvotes: newUpvotes,
      downvotes: newDownvotes
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
      .select('id, upvotes, downvotes')
      .in('id', setlistSongIds);

    if (error) {
      console.error('Get vote counts error:', error);
      return NextResponse.json({ error: 'Failed to fetch vote counts' }, { status: 500 });
    }

    // Convert to object for easy lookup
    const voteCounts = setlistSongs?.reduce((acc, song) => {
      acc[song.id] = {
        upvotes: song.upvotes || 0,
        downvotes: song.downvotes || 0
      };
      return acc;
    }, {} as Record<string, { upvotes: number; downvotes: number }>) || {};

    return NextResponse.json({ voteCounts });

  } catch (error) {
    console.error('Get vote counts error:', error);
    return NextResponse.json({ error: 'Failed to fetch vote counts' }, { status: 500 });
  }
} 