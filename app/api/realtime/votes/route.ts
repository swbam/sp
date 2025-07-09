import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setlistId = searchParams.get('setlist_id');

  if (!setlistId) {
    return NextResponse.json({ error: 'setlist_id is required' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current vote counts for all songs in the setlist
    const { data: setlistSongs, error } = await supabase
      .from('setlist_songs')
      .select(`
        id,
        position,
        upvotes,
        downvotes,
        song:songs (
          id,
          title,
          artist_name
        )
      `)
      .eq('setlist_id', setlistId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Realtime votes fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate vote statistics
    const voteStats = {
      total_songs: setlistSongs?.length || 0,
      total_votes: setlistSongs?.reduce((acc, song) => acc + song.upvotes + song.downvotes, 0) || 0,
      most_upvoted: setlistSongs?.length ? setlistSongs.reduce((max, song) => 
        song.upvotes > (max?.upvotes || 0) ? song : max
      ) : null,
      most_controversial: setlistSongs?.length ? setlistSongs.reduce((max, song) => {
        const votes = song.upvotes + song.downvotes;
        const maxVotes = (max?.upvotes || 0) + (max?.downvotes || 0);
        return votes > maxVotes ? song : max;
      }) : null
    };

    return NextResponse.json({ 
      setlist_songs: setlistSongs || [],
      vote_stats: voteStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// WebSocket endpoint info for real-time subscriptions
export async function POST(request: Request) {
  const { setlist_id, subscribe_to } = await request.json();

  if (!setlist_id) {
    return NextResponse.json({ error: 'setlist_id is required' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user for subscription authorization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return connection info for client-side Supabase Realtime
    return NextResponse.json({
      success: true,
      realtime_config: {
        channel: `setlist:${setlist_id}`,
        events: subscribe_to || ['postgres_changes'],
        table: 'setlist_songs',
        filter: `setlist_id=eq.${setlist_id}`,
        schema: 'public'
      },
      instructions: {
        setup: 'Use createClientComponentClient() on the frontend',
        subscribe: `supabase.channel('setlist:${setlist_id}').on('postgres_changes', ...)`,
        events_to_listen: ['UPDATE', 'INSERT', 'DELETE']
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}