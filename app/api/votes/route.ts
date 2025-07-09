import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: Request) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { setlist_song_id, vote_type } = body;
    const supabase = createRouteHandlerClient({ cookies });

    // Check authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!setlist_song_id || !vote_type) {
      return NextResponse.json({ error: 'Missing setlist_song_id or vote_type' }, { status: 400 });
    }

    if (!['up', 'down'].includes(vote_type)) {
      return NextResponse.json({ error: 'Invalid vote_type. Must be "up" or "down"' }, { status: 400 });
    }

    // Check if user has already voted on this song
    const { data: existingVote, error: voteCheckError } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('setlist_song_id', setlist_song_id)
      .single();

    if (voteCheckError && voteCheckError.code !== 'PGRST116') {
      console.error('Vote check error:', voteCheckError);
      return NextResponse.json({ error: 'Failed to check existing vote' }, { status: 500 });
    }

    let userVote = null;
    
    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // User is clicking the same vote type - remove their vote
        const { error: deleteError } = await supabase
          .from('votes')
          .delete()
          .eq('id', existingVote.id);

        if (deleteError) {
          console.error('Delete vote error:', deleteError);
          return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 });
        }
        userVote = null;
      } else {
        // User is switching their vote type
        const { error: updateError } = await supabase
          .from('votes')
          .update({ vote_type })
          .eq('id', existingVote.id);

        if (updateError) {
          console.error('Update vote error:', updateError);
          return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
        }
        userVote = vote_type;
      }
    } else {
      // User hasn't voted yet - create new vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          user_id: user.id,
          setlist_song_id,
          vote_type
        });

      if (insertError) {
        console.error('Insert vote error:', insertError);
        return NextResponse.json({ error: 'Failed to create vote' }, { status: 500 });
      }
      userVote = vote_type;
    }

    // Get updated vote counts (triggers will have updated these automatically)
    const { data: updatedSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select('upvotes, downvotes')
      .eq('id', setlist_song_id)
      .single();

    if (fetchError) {
      console.error('Fetch updated counts error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch updated counts' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      upvotes: updatedSong.upvotes,
      downvotes: updatedSong.downvotes,
      userVote
    });

  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Failed to process vote' }, { status: 500 });
  }
}

// Get vote counts and user votes for setlist songs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setlistSongIds = searchParams.get('setlist_song_ids')?.split(',') || [];
    
    if (setlistSongIds.length === 0) {
      return NextResponse.json({ voteCounts: {}, userVotes: {} });
    }

    // Filter out invalid UUIDs
    const validUUIDs = setlistSongIds.filter(id => {
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    });

    if (validUUIDs.length === 0) {
      return NextResponse.json({ voteCounts: {}, userVotes: {} });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get vote counts (public data)
    const { data: setlistSongs, error } = await supabase
      .from('setlist_songs')
      .select('id, upvotes, downvotes')
      .in('id', validUUIDs);

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

    // Get user votes (if authenticated)
    let userVotes = {};
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('setlist_song_id, vote_type')
        .eq('user_id', user.id)
        .in('setlist_song_id', validUUIDs);

      if (votesError) {
        console.error('Get user votes error:', votesError);
        // Don't fail the request, just return empty user votes
      } else {
        userVotes = votes?.reduce((acc, vote) => {
          acc[vote.setlist_song_id] = vote.vote_type;
          return acc;
        }, {} as Record<string, string>) || {};
      }
    }

    return NextResponse.json({ voteCounts, userVotes });

  } catch (error) {
    console.error('Get vote counts error:', error);
    return NextResponse.json({ error: 'Failed to fetch vote counts' }, { status: 500 });
  }
} 