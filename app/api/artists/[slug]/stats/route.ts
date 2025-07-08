import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
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

    // Get total shows count
    const { count: totalShows } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artist.id);

    // Get upcoming shows count
    const { count: upcomingShows } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artist.id)
      .eq('status', 'upcoming')
      .gte('date', new Date().toISOString().split('T')[0]);

    // Get total votes for this artist's shows
    const { data: voteData } = await supabase
      .from('setlist_songs')
      .select(`
        upvotes,
        downvotes,
        setlist:setlists!inner (
          show:shows!inner (
            artist_id
          )
        )
      `)
      .eq('setlist.show.artist_id', artist.id);

    const totalVotes = voteData?.reduce((sum, song) => {
      return sum + (song.upvotes || 0) + (song.downvotes || 0);
    }, 0) || 0;

    return NextResponse.json({
      totalShows: totalShows || 0,
      upcomingShows: upcomingShows || 0,
      totalVotes,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}