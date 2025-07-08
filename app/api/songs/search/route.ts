import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const artist = searchParams.get('artist');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    return NextResponse.json({ songs: [] });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Search songs in our database first
    let dbQuery = supabase
      .from('songs')
      .select(`
        id,
        title,
        artist_name,
        spotify_id,
        created_at
      `)
      .ilike('title', `%${query}%`);

    // Filter by artist if provided
    if (artist) {
      dbQuery = dbQuery.ilike('artist_name', `%${artist}%`);
    }

    const { data: songs, error } = await dbQuery
      .order('title', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Song search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let allSongs = songs || [];

    // If we don't have enough results, search Spotify and sync new songs
    if (allSongs.length < 5) {
      try {
        const spotifyTracks = await spotifyAPI.searchTracks(query, artist || undefined, 10);
        
        for (const track of spotifyTracks) {
          // Check if song already exists in our DB
          const { data: existingSong } = await supabase
            .from('songs')
            .select('id')
            .eq('spotify_id', track.id)
            .single();

          if (!existingSong) {
            // Transform and insert new song
            const songData = spotifyAPI.transformTrackForDB(track);
            
            const { data: newSong, error: insertError } = await supabase
              .from('songs')
              .insert(songData)
              .select(`
                id,
                title,
                artist_name,
                spotify_id,
                created_at
              `)
              .single();

            if (!insertError && newSong) {
              allSongs.push(newSong);
            }
          }
        }
      } catch (spotifyError) {
        console.error('Spotify search error:', spotifyError);
        // Continue with database results only
      }
    }

    return NextResponse.json({ songs: allSongs });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}