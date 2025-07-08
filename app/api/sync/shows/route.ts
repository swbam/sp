import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ticketmasterAPI } from '@/libs/ticketmaster-api';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';

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

    console.log('Starting shows sync from Ticketmaster...');

    // Get upcoming music events from major US cities
    const cities = [
      { city: 'New York', stateCode: 'NY' },
      { city: 'Los Angeles', stateCode: 'CA' },
      { city: 'Chicago', stateCode: 'IL' },
      { city: 'Houston', stateCode: 'TX' },
      { city: 'Philadelphia', stateCode: 'PA' },
      { city: 'Phoenix', stateCode: 'AZ' },
      { city: 'San Antonio', stateCode: 'TX' },
      { city: 'San Diego', stateCode: 'CA' },
      { city: 'Dallas', stateCode: 'TX' },
      { city: 'San Jose', stateCode: 'CA' }
    ];

    for (const location of cities.slice(0, 5)) { // Limit to avoid rate limits
      try {
        const events = await ticketmasterAPI.getMusicEvents({
          city: location.city,
          stateCode: location.stateCode,
          countryCode: 'US',
          startDate: new Date().toISOString(),
          size: 50
        });

        if (events._embedded?.events) {
          for (const event of events._embedded.events) {
            try {
              const eventData = ticketmasterAPI.transformEventForDB(event);
              
              // Skip events without artist or venue data
              if (!eventData.artist_name || !eventData.venue_data) {
                continue;
              }

              // First, sync/find the venue
              let venueId = null;
              if (eventData.venue_data) {
                const { data: existingVenue } = await supabase
                  .from('venues')
                  .select('id')
                  .eq('name', eventData.venue_data.name)
                  .eq('city', eventData.venue_data.city)
                  .single();

                if (existingVenue) {
                  venueId = existingVenue.id;
                } else {
                  const { data: newVenue, error: venueError } = await supabase
                    .from('venues')
                    .insert(eventData.venue_data)
                    .select('id')
                    .single();

                  if (!venueError && newVenue) {
                    venueId = newVenue.id;
                  }
                }
              }

              // Find or sync the artist
              let artistId = null;
              
              // First check if we have this artist in our database
              const { data: existingArtist } = await supabase
                .from('artists')
                .select('id')
                .eq('name', eventData.artist_name)
                .single();

              if (existingArtist) {
                artistId = existingArtist.id;
              } else {
                // Try to find artist on Spotify and sync
                try {
                  const spotifyArtists = await spotifyAPI.searchArtists(eventData.artist_name, 1);
                  
                  if (spotifyArtists.length > 0) {
                    const artistData = spotifyAPI.transformArtistForDB(spotifyArtists[0]);
                    
                    const { data: newArtist, error: artistError } = await supabase
                      .from('artists')
                      .upsert(artistData, { onConflict: 'spotify_id' })
                      .select('id')
                      .single();

                    if (!artistError && newArtist) {
                      artistId = newArtist.id;
                    }
                  }
                } catch (spotifyError) {
                  console.error(`Could not find artist ${eventData.artist_name} on Spotify:`, spotifyError);
                }

                // If still no artist, create a basic one
                if (!artistId) {
                  const basicArtist = {
                    name: eventData.artist_name,
                    slug: eventData.artist_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    genres: [],
                    followers: 0,
                    verified: false
                  };

                  const { data: newArtist, error: artistError } = await supabase
                    .from('artists')
                    .insert(basicArtist)
                    .select('id')
                    .single();

                  if (!artistError && newArtist) {
                    artistId = newArtist.id;
                  }
                }
              }

              // Skip if we couldn't create/find the artist
              if (!artistId) {
                continue;
              }

              // Now sync the show
              const showData = {
                artist_id: artistId,
                venue_id: venueId,
                name: eventData.name,
                date: eventData.date,
                start_time: eventData.start_time,
                status: eventData.status,
                ticket_url: eventData.ticket_url
              };

              const { data: show, error: showError } = await supabase
                .from('shows')
                .upsert(showData, { 
                  onConflict: 'artist_id,date,venue_id',
                  ignoreDuplicates: true 
                })
                .select('id, name')
                .single();

              if (!showError && show) {
                console.log(`Synced show: ${show.name}`);
                syncedCount++;

                // Create a predicted setlist for the show
                const { data: setlist } = await supabase
                  .from('setlists')
                  .upsert({
                    show_id: show.id,
                    type: 'predicted',
                    is_locked: false
                  }, {
                    onConflict: 'show_id,type',
                    ignoreDuplicates: true
                  })
                  .select('id')
                  .single();

                // Add some popular songs to the setlist if we have them
                if (setlist) {
                  const { data: artistSongs } = await supabase
                    .from('songs')
                    .select('id')
                    .eq('artist_name', eventData.artist_name)
                    .limit(5);

                  if (artistSongs && artistSongs.length > 0) {
                    for (let i = 0; i < artistSongs.length; i++) {
                      const song = artistSongs[i];
                      if (!song) continue;
                      
                      await supabase
                        .from('setlist_songs')
                        .upsert({
                          setlist_id: setlist.id,
                          song_id: song.id,
                          position: i + 1,
                          upvotes: Math.floor(Math.random() * 20) + 5,
                          downvotes: Math.floor(Math.random() * 5)
                        }, {
                          onConflict: 'setlist_id,position',
                          ignoreDuplicates: true
                        });
                    }
                  }
                }
              }

            } catch (eventError) {
              console.error(`Error processing event ${event.name}:`, eventError);
              errorCount++;
            }
          }
        }

        // Add delay between cities to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (cityError) {
        console.error(`Error fetching events for ${location.city}:`, cityError);
        errorCount++;
      }
    }

    console.log(`Shows sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`);

    return NextResponse.json({ 
      success: true,
      message: 'Shows synced successfully',
      syncedCount,
      errorCount 
    });

  } catch (error) {
    console.error('Shows sync failed:', error);
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