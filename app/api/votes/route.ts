import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { voteApiMiddleware, publicApiMiddleware, isValidUUID } from '@/libs/auth-middleware';
import { advancedCaching } from '@/libs/advanced-caching';

// Force edge runtime for maximum performance
export const runtime = 'edge';


export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Apply middleware (authentication, rate limiting, UUID validation)
    const middlewareResponse = await voteApiMiddleware(request);
    if (middlewareResponse) return middlewareResponse;
    
    // Get auth context from middleware
    const authContextHeader = request.headers.get('X-Auth-Context');
    const authContext = authContextHeader ? JSON.parse(authContextHeader) : null;
    
    if (!authContext?.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid request body',
        message: 'Request body must be valid JSON' 
      }, { status: 400 });
    }

    const { setlist_song_id, vote_type } = body;
    
    // Validate required fields
    if (!setlist_song_id || !vote_type) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Both setlist_song_id and vote_type are required',
        required_fields: ['setlist_song_id', 'vote_type']
      }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(setlist_song_id)) {
      return NextResponse.json({ 
        error: 'Invalid setlist_song_id format',
        message: 'setlist_song_id must be a valid UUID'
      }, { status: 400 });
    }

    // Validate vote type
    if (!['up', 'down'].includes(vote_type)) {
      return NextResponse.json({ 
        error: 'Invalid vote_type',
        message: 'vote_type must be either "up" or "down"',
        valid_values: ['up', 'down']
      }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const userId = authContext.userId;

    // Check if user has already voted on this song with caching
    const voteCheckCacheKey = `vote-check:${userId}:${setlist_song_id}`;
    const existingVote = await advancedCaching.get(
      voteCheckCacheKey,
      async () => {
        const { data, error } = await supabase
          .from('votes')
          .select('*')
          .eq('user_id', userId)
          .eq('setlist_song_id', setlist_song_id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data;
      },
      { ttl: 60000, priority: 'high', tags: ['votes', userId] }
    );

    let userVote = null;
    let voteOperation = '';
    
    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // User is clicking the same vote type - remove their vote
        const { error: deleteError } = await supabase
          .from('votes')
          .delete()
          .eq('id', existingVote.id);

        if (deleteError) {
          console.error('Delete vote error:', deleteError);
          return NextResponse.json({ 
            error: 'Failed to remove vote',
            message: deleteError.message 
          }, { status: 500 });
        }
        userVote = null;
        voteOperation = 'removed';
      } else {
        // User is switching their vote type
        const { error: updateError } = await supabase
          .from('votes')
          .update({ vote_type })
          .eq('id', existingVote.id);

        if (updateError) {
          console.error('Update vote error:', updateError);
          return NextResponse.json({ 
            error: 'Failed to update vote',
            message: updateError.message 
          }, { status: 500 });
        }
        userVote = vote_type;
        voteOperation = 'updated';
      }
    } else {
      // User hasn't voted yet - create new vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          user_id: userId,
          setlist_song_id,
          vote_type
        });

      if (insertError) {
        console.error('Insert vote error:', insertError);
        return NextResponse.json({ 
          error: 'Failed to create vote',
          message: insertError.message 
        }, { status: 500 });
      }
      userVote = vote_type;
      voteOperation = 'created';
    }

    // Get updated vote counts (triggers will have updated these automatically)
    const countsCacheKey = `vote-counts:${setlist_song_id}`;
    const updatedCounts = await advancedCaching.get(
      countsCacheKey,
      async () => {
        const { data, error } = await supabase
          .from('setlist_songs')
          .select('upvotes, downvotes')
          .eq('id', setlist_song_id)
          .single();

        if (error) {
          throw error;
        }

        return data;
      },
      { ttl: 30000, priority: 'high', tags: ['vote-counts', setlist_song_id] }
    );

    // Clear related caches
    await advancedCaching.clearByTags(['votes', userId]);
    await advancedCaching.clearByTags(['vote-counts', setlist_song_id]);

    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    return NextResponse.json({ 
      success: true, 
      upvotes: updatedCounts.upvotes,
      downvotes: updatedCounts.downvotes,
      userVote,
      operation: voteOperation,
      response_time_ms: responseTime
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
        'X-Vote-Operation': voteOperation
      }
    });

  } catch (error) {
    console.error('Vote error:', error);
    const responseTime = Math.round(performance.now() - startTime);
    
    return NextResponse.json({ 
      error: 'Failed to process vote',
      message: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: responseTime
    }, { 
      status: 500,
      headers: {
        'X-Error-Type': 'vote-processing-error',
        'X-Response-Time': `${responseTime}ms`
      }
    });
  }
}

// Get vote counts and user votes for setlist songs
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Apply middleware (optional auth, UUID validation)
    const middlewareResponse = await publicApiMiddleware(request);
    if (middlewareResponse) return middlewareResponse;
    
    const { searchParams } = new URL(request.url);
    const setlistSongIds = searchParams.get('setlist_song_ids')?.split(',') || [];
    
    if (setlistSongIds.length === 0) {
      return NextResponse.json({ 
        voteCounts: {}, 
        userVotes: {},
        response_time_ms: Math.round(performance.now() - startTime)
      });
    }

    // Filter out invalid UUIDs
    const validUUIDs = setlistSongIds.filter(id => isValidUUID(id));

    if (validUUIDs.length === 0) {
      return NextResponse.json({ 
        voteCounts: {}, 
        userVotes: {},
        error: 'No valid UUIDs provided',
        response_time_ms: Math.round(performance.now() - startTime)
      });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get vote counts (public data) with caching
    const voteCountsCacheKey = `vote-counts:batch:${validUUIDs.sort().join(',')}`;
    const voteCounts = await advancedCaching.get(
      voteCountsCacheKey,
      async () => {
        const { data: setlistSongs, error } = await supabase
          .from('setlist_songs')
          .select('id, upvotes, downvotes')
          .in('id', validUUIDs);

        if (error) {
          throw error;
        }

        return setlistSongs?.reduce((acc, song) => {
          acc[song.id] = {
            upvotes: song.upvotes || 0,
            downvotes: song.downvotes || 0
          };
          return acc;
        }, {} as Record<string, { upvotes: number; downvotes: number }>) || {};
      },
      { ttl: 60000, priority: 'high', tags: ['vote-counts'] }
    );

    // Get user votes (if authenticated)
    let userVotes = {};
    const authContextHeader = request.headers.get('X-Auth-Context');
    const authContext = authContextHeader ? JSON.parse(authContextHeader) : null;
    
    if (authContext?.isAuthenticated) {
      const userVotesCacheKey = `user-votes:${authContext.userId}:${validUUIDs.sort().join(',')}`;
      userVotes = await advancedCaching.get(
        userVotesCacheKey,
        async () => {
          const { data: votes, error } = await supabase
            .from('votes')
            .select('setlist_song_id, vote_type')
            .eq('user_id', authContext.userId)
            .in('setlist_song_id', validUUIDs);

          if (error) {
            console.error('Get user votes error:', error);
            return {};
          }

          return votes?.reduce((acc, vote) => {
            acc[vote.setlist_song_id] = vote.vote_type;
            return acc;
          }, {} as Record<string, string>) || {};
        },
        { ttl: 120000, priority: 'medium', tags: ['user-votes', authContext.userId] }
      );
    }

    const responseTime = Math.round(performance.now() - startTime);

    return NextResponse.json({ 
      voteCounts, 
      userVotes,
      total_songs: validUUIDs.length,
      response_time_ms: responseTime
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache-Status': 'optimized'
      }
    });

  } catch (error) {
    console.error('Get vote counts error:', error);
    const responseTime = Math.round(performance.now() - startTime);
    
    return NextResponse.json({ 
      error: 'Failed to fetch vote counts',
      message: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: responseTime
    }, { 
      status: 500,
      headers: {
        'X-Error-Type': 'vote-fetch-error',
        'X-Response-Time': `${responseTime}ms`
      }
    });
  }
} 