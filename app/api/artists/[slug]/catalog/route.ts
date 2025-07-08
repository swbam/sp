import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get artist from database
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, name, spotify_id')
      .eq('slug', params.slug)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // First, get all songs from our database for this artist
    const { data: dbSongs, error: songsError } = await supabase
      .from('songs')
      .select(`
        id,
        title,
        artist_name,
        spotify_id,
        created_at
      `)
      .ilike('artist_name', `%${artist.name}%`)
      .order('title', { ascending: true });

    if (songsError) {
      console.error('Database songs error:', songsError);
    }

    let allSongs = dbSongs || [];

    // If we have a Spotify ID and don't have many songs, fetch the complete catalog
    if (artist.spotify_id && allSongs.length < 20) {
      try {
        console.log(`Fetching complete catalog for ${artist.name} from Spotify...`);

        // Get all albums for the artist
        const albums = await spotifyAPI.getArtistAlbums(artist.spotify_id, 50);
        
        // Get tracks from all albums
        const allTracks = [];
        for (const album of albums) {
          try {
            const tracks = await spotifyAPI.getAlbumTracks(album.id);
            allTracks.push(...tracks);
          } catch (albumError) {
            console.error(`Error fetching tracks for album ${album.id}:`, albumError);
          }
        }

        // Also get top tracks
        const topTracks = await spotifyAPI.getArtistTopTracks(artist.spotify_id);
        allTracks.push(...topTracks);

        // Remove duplicates based on track name (case insensitive)
        const uniqueTracks = allTracks.filter((track, index, self) => 
          index === self.findIndex(t => 
            t.name.toLowerCase() === track.name.toLowerCase()
          )
        );

        console.log(`Found ${uniqueTracks.length} unique tracks for ${artist.name}`);

        // Add new tracks to database and our response
        for (const track of uniqueTracks) {
          // Check if song already exists
          const existingSong = allSongs.find(song => 
            song.spotify_id === track.id ||
            song.title.toLowerCase() === track.name.toLowerCase()
          );

          if (!existingSong) {
            try {
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
              } else {
                console.error('Error inserting song:', insertError);
              }
            } catch (songInsertError) {
              console.error('Error processing song:', songInsertError);
            }
          }
        }

        console.log(`Total songs for ${artist.name}: ${allSongs.length}`);

      } catch (spotifyError) {
        console.error('Spotify catalog error:', spotifyError);
        // Continue with database results only
      }
    }

    // Sort songs alphabetically
    allSongs.sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ 
      songs: allSongs,
      artist: {
        id: artist.id,
        name: artist.name,
        slug: params.slug
      },
      total: allSongs.length
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 