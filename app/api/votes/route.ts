import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { setlistSongId, voteType } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already voted on this song
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, vote_type')
      .eq('user_id', user.id)
      .eq('setlist_song_id', setlistSongId)
      .single();

    let operation = null;

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote if clicking same button
        const { error: deleteError } = await supabase
          .from('votes')
          .delete()
          .eq('id', existingVote.id);
        
        if (deleteError) throw deleteError;
        operation = 'removed';
      } else {
        // Update vote type
        const { error: updateError } = await supabase
          .from('votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);
        
        if (updateError) throw updateError;
        operation = 'updated';
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          user_id: user.id,
          setlist_song_id: setlistSongId,
          vote_type: voteType
        });
      
      if (insertError) throw insertError;
      operation = 'created';
    }

    // Update vote counts on setlist_songs
    const { data: votes } = await supabase
      .from('votes')
      .select('vote_type')
      .eq('setlist_song_id', setlistSongId);

    const upvotes = votes?.filter(v => v.vote_type === 'up').length || 0;
    const downvotes = votes?.filter(v => v.vote_type === 'down').length || 0;

    const { error: updateCountsError } = await supabase
      .from('setlist_songs')
      .update({ upvotes, downvotes })
      .eq('id', setlistSongId);

    if (updateCountsError) throw updateCountsError;

    return NextResponse.json({ 
      success: true, 
      operation,
      upvotes,
      downvotes 
    });

  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Failed to process vote' }, { status: 500 });
  }
}

// Get votes for a user on specific setlist songs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setlistSongIds = searchParams.get('setlist_song_ids')?.split(',') || [];
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ userVotes: {} });
    }

    const { data: votes, error } = await supabase
      .from('votes')
      .select('setlist_song_id, vote_type')
      .eq('user_id', user.id)
      .in('setlist_song_id', setlistSongIds);

    if (error) throw error;

    // Convert to object for easy lookup
    const userVotes = votes?.reduce((acc, vote) => {
      acc[vote.setlist_song_id] = vote.vote_type;
      return acc;
    }, {} as Record<string, string>) || {};

    return NextResponse.json({ userVotes });

  } catch (error) {
    console.error('Get votes error:', error);
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }
} 