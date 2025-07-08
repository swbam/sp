import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get the predicted setlist for this show
    const { data: setlist } = await supabase
      .from('setlists')
      .select('id')
      .eq('show_id', params.id)
      .eq('type', 'predicted')
      .single();

    if (!setlist) {
      return NextResponse.json({
        totalPredictions: 0,
        totalVotes: 0,
        uniqueVoters: 0,
      });
    }

    // Get total predictions count
    const { count: totalPredictions } = await supabase
      .from('setlist_songs')
      .select('*', { count: 'exact', head: true })
      .eq('setlist_id', setlist.id);

    // Get vote data for calculating totals and unique voters
    const { data: voteData } = await supabase
      .from('setlist_songs')
      .select(`
        upvotes,
        downvotes,
        votes:votes (user_id)
      `)
      .eq('setlist_id', setlist.id);

    // Calculate total votes
    const totalVotes = voteData?.reduce((sum, song) => {
      return sum + (song.upvotes || 0) + (song.downvotes || 0);
    }, 0) || 0;

    // Calculate unique voters
    const allVoters = new Set();
    voteData?.forEach(song => {
      if (song.votes && Array.isArray(song.votes)) {
        song.votes.forEach((vote: any) => {
          if (vote.user_id) {
            allVoters.add(vote.user_id);
          }
        });
      }
    });

    return NextResponse.json({
      totalPredictions: totalPredictions || 0,
      totalVotes,
      uniqueVoters: allVoters.size,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}