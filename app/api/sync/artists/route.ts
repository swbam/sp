import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Verify cron secret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    let syncedCount = 0;
    let errorCount = 0;

    console.log('Starting artist sync from Spotify...');

    // Get popular artists from different genres
    const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'indie', 'country', 'r-n-b'];
    
    for (const genre of genres) {
      try {
        const spotifyArtists = await spotifyAPI.getPopularArtists(genre);
        
        for (const spotifyArtist of spotifyArtists.slice(0, 10)) { // Limit per genre
          try {
            const artistData = spotifyAPI.transformArtistForDB(spotifyArtist);
            
            // Upsert artist (insert or update if exists)
            const { data, error } = await supabase
              .from('artists')
              .upsert(artistData, { 
                onConflict: 'spotify_id',
                ignoreDuplicates: false 
              })
              .select('id, name');

            if (error) {
              console.error(`Error syncing artist ${artistData.name}:`, error);
              errorCount++;
              continue;
            }

            if (data?.[0]) {
              console.log(`Synced artist: ${data[0].name}`);
              syncedCount++;

              // Also sync their top tracks for setlist predictions
              try {
                const topTracks = await spotifyAPI.getArtistTopTracks(spotifyArtist.id);
                
                for (const track of topTracks.slice(0, 10)) { // Top 10 tracks
                  const songData = spotifyAPI.transformTrackForDB(track);
                  
                  await supabase
                    .from('songs')
                    .upsert(songData, {
                      onConflict: 'spotify_id',
                      ignoreDuplicates: true
                    });
                }
              } catch (trackError) {
                console.error(`Error syncing tracks for ${artistData.name}:`, trackError);
              }
            }

          } catch (artistError) {
            console.error(`Error processing artist:`, artistError);
            errorCount++;
          }
        }

        // Add delay between genres to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (genreError) {
        console.error(`Error fetching artists for genre ${genre}:`, genreError);
        errorCount++;
      }
    }

    console.log(`Artist sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`);

    return NextResponse.json({ 
      success: true,
      message: 'Artists synced successfully',
      syncedCount,
      errorCount 
    });

  } catch (error) {
    console.error('Artist sync failed:', error);
    return NextResponse.json({ 
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Manual trigger for testing
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger the same sync as POST
  return POST(request);
} 