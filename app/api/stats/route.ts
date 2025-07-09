import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all'; // 'artists', 'shows', 'votes', 'all'
  const timeframe = searchParams.get('timeframe') || 'week'; // 'day', 'week', 'month', 'all'

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Calculate date range for stats
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        startDate = new Date('2024-01-01'); // App start date
        break;
    }

    const result: any = {};

    if (type === 'artists' || type === 'all') {
      // Artist statistics
      const { data: artistStats } = await supabase
        .from('artists')
        .select('id')
        .gte('created_at', startDate.toISOString());

      const { data: topArtists } = await supabase
        .from('artists')
        .select(`
          id,
          name,
          slug,
          followers,
          shows:shows(count)
        `)
        .order('followers', { ascending: false })
        .limit(10);

      result.artists = {
        total_count: artistStats?.length || 0,
        top_by_followers: topArtists || [],
        growth_period: timeframe
      };
    }

    if (type === 'shows' || type === 'all') {
      // Show statistics
      const { data: showStats } = await supabase
        .from('shows')
        .select('id, status')
        .gte('created_at', startDate.toISOString());

      const { data: upcomingShows } = await supabase
        .from('shows')
        .select('id')
        .eq('status', 'upcoming')
        .gte('date', now.toISOString().split('T')[0]);

      const { data: topVotedShows } = await supabase
        .from('shows')
        .select(`
          id,
          name,
          date,
          artist:artists(name, slug),
          setlists(
            setlist_songs(
              upvotes,
              downvotes
            )
          )
        `)
        .eq('status', 'upcoming')
        .gte('date', now.toISOString().split('T')[0])
        .limit(20);

      // Calculate vote totals for each show
      const showsWithVotes = (topVotedShows || []).map(show => {
        const totalVotes = show.setlists?.reduce((acc: number, setlist: any) => {
          return acc + setlist.setlist_songs?.reduce((voteAcc: number, song: any) => {
            return voteAcc + (song.upvotes || 0) + (song.downvotes || 0);
          }, 0) || 0;
        }, 0) || 0;

        return {
          ...show,
          total_votes: totalVotes
        };
      }).sort((a, b) => b.total_votes - a.total_votes).slice(0, 10);

      result.shows = {
        total_count: showStats?.length || 0,
        upcoming_count: upcomingShows?.length || 0,
        completed_count: showStats?.filter(s => s.status === 'completed').length || 0,
        cancelled_count: showStats?.filter(s => s.status === 'cancelled').length || 0,
        top_by_votes: showsWithVotes,
        growth_period: timeframe
      };
    }

    if (type === 'votes' || type === 'all') {
      // Vote statistics
      const { data: voteStats } = await supabase
        .from('votes')
        .select('vote_type')
        .gte('created_at', startDate.toISOString());

      const { data: totalVotes } = await supabase
        .from('votes')
        .select('id');

      const upvotes = voteStats?.filter(v => v.vote_type === 'up').length || 0;
      const downvotes = voteStats?.filter(v => v.vote_type === 'down').length || 0;

      // Most voted songs
      const { data: topVotedSongs } = await supabase
        .from('setlist_songs')
        .select(`
          id,
          upvotes,
          downvotes,
          song:songs(title, artist_name),
          setlist:setlists(
            show:shows(
              name,
              date,
              artist:artists(name, slug)
            )
          )
        `)
        .order('upvotes', { ascending: false })
        .limit(10);

      result.votes = {
        total_votes: totalVotes?.length || 0,
        period_votes: voteStats?.length || 0,
        upvotes_in_period: upvotes,
        downvotes_in_period: downvotes,
        positivity_ratio: upvotes + downvotes > 0 ? (upvotes / (upvotes + downvotes) * 100).toFixed(1) : 0,
        top_voted_songs: topVotedSongs || [],
        growth_period: timeframe
      };
    }

    if (type === 'engagement' || type === 'all') {
      // User engagement stats
      const { data: users } = await supabase
        .from('user_artist_follows')
        .select('user_id')
        .gte('created_at', startDate.toISOString());

      const uniqueUsers = new Set(users?.map(u => u.user_id)).size;

      const { data: totalFollows } = await supabase
        .from('user_artist_follows')
        .select('id');

      result.engagement = {
        active_users_period: uniqueUsers,
        total_follows: totalFollows?.length || 0,
        new_follows_period: users?.length || 0,
        growth_period: timeframe
      };
    }

    // Overall platform stats
    if (type === 'all') {
      result.platform_summary = {
        timestamp: now.toISOString(),
        period: timeframe,
        health_score: calculateHealthScore(result),
        trending_algorithm_version: '1.0'
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateHealthScore(stats: any): number {
  // Simple health score based on activity levels
  const votes = stats.votes?.period_votes || 0;
  const shows = stats.shows?.upcoming_count || 0;
  const engagement = stats.engagement?.active_users_period || 0;
  
  // Weighted score out of 100
  const voteScore = Math.min(votes / 100 * 40, 40); // 40 points max for votes
  const showScore = Math.min(shows / 50 * 30, 30);  // 30 points max for shows
  const userScore = Math.min(engagement / 25 * 30, 30); // 30 points max for users
  
  return Math.round(voteScore + showScore + userScore);
}