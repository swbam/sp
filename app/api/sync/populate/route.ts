import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';
import { ticketmasterAPI } from '@/libs/ticketmaster-api';

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
    let artistsSynced = 0;
    let showsSynced = 0;
    let errorCount = 0;

    console.log('Starting comprehensive data population...');

    // Step 1: Populate popular artists from different genres
    const genres = ['pop', 'rock', 'hip hop', 'country', 'electronic', 'indie', 'jazz', 'classical'];
    const popularArtists = [
      'Taylor Swift', 'The Beatles', 'Drake', 'Ariana Grande', 'Ed Sheeran',
      'Billie Eilish', 'Post Malone', 'Dua Lipa', 'The Weeknd', 'Adele',
      'Harry Styles', 'Olivia Rodrigo', 'Bad Bunny', 'Travis Scott', 'Doja Cat',
      'Coldplay', 'Bruno Mars', 'Rihanna', 'Kendrick Lamar', 'SZA'
    ];

    // Sync specific popular artists first
    for (const artistName of popularArtists) {
      try {
        console.log(`Searching for ${artistName}...`);
        const spotifyResults = await spotifyAPI.searchArtists(artistName, 1);
        
        if (spotifyResults.length > 0) {
          const spotifyArtist = spotifyResults[0];
          
          // Check if artist already exists
          const { data: existingArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('spotify_id', spotifyArtist.id)
            .single();

          if (!existingArtist) {
            const artistData = spotifyAPI.transformArtistForDB(spotifyArtist);
            
            const { data: newArtist, error } = await supabase
              .from('artists')
              .insert(artistData)
              .select('id, name')
              .single();

            if (!error && newArtist) {
              console.log(`✓ Synced artist: ${newArtist.name}`);
              artistsSynced++;

              // Also sync their top tracks
              try {
                const topTracks = await spotifyAPI.getArtistTopTracks(spotifyArtist.id);
                
                for (const track of topTracks.slice(0, 10)) {
                  const songData = spotifyAPI.transformTrackForDB(track);
                  
                  await supabase
                    .from('songs')
                    .upsert(songData, {
                      onConflict: 'spotify_id',
                      ignoreDuplicates: true
                    });
                }
              } catch (trackError) {
                console.error(`Error syncing tracks for ${artistName}:`, trackError);
              }
            } else {
              console.error(`Error syncing ${artistName}:`, error);
              errorCount++;
            }
          } else {
            console.log(`→ ${artistName} already exists`);
          }
        } else {
          console.log(`✗ No Spotify results for ${artistName}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing ${artistName}:`, error);
        errorCount++;
      }
    }

    // Step 2: Populate venues from major cities
    const majorVenues = [
      { name: 'Madison Square Garden', city: 'New York', state: 'NY' },
      { name: 'Hollywood Bowl', city: 'Los Angeles', state: 'CA' },
      { name: 'Red Rocks Amphitheatre', city: 'Morrison', state: 'CO' },
      { name: 'The Forum', city: 'Inglewood', state: 'CA' },
      { name: 'Fenway Park', city: 'Boston', state: 'MA' },
      { name: 'Wembley Stadium', city: 'London', state: '', country: 'UK' },
      { name: 'O2 Arena', city: 'London', state: '', country: 'UK' },
      { name: 'United Center', city: 'Chicago', state: 'IL' },
      { name: 'Staples Center', city: 'Los Angeles', state: 'CA' },
      { name: 'Barclays Center', city: 'Brooklyn', state: 'NY' }
    ];

    for (const venueInfo of majorVenues) {
      try {
        const { data: existingVenue } = await supabase
          .from('venues')
          .select('id')
          .eq('name', venueInfo.name)
          .single();

        if (!existingVenue) {
          const venueData = {
            name: venueInfo.name,
            slug: venueInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            city: venueInfo.city,
            state: venueInfo.state,
            country: venueInfo.country || 'USA',
            capacity: Math.floor(Math.random() * 50000) + 5000 // Random capacity
          };

          await supabase.from('venues').insert(venueData);
          console.log(`✓ Added venue: ${venueInfo.name}`);
        }
      } catch (error) {
        console.error(`Error adding venue ${venueInfo.name}:`, error);
      }
    }

    // Step 3: Create some upcoming shows
    const { data: allArtists } = await supabase
      .from('artists')
      .select('id, name')
      .limit(15);

    const { data: allVenues } = await supabase
      .from('venues')
      .select('id, name, city')
      .limit(10);

    if (allArtists && allVenues && allArtists.length > 0 && allVenues.length > 0) {
      const currentDate = new Date();
      
      for (let i = 0; i < 10; i++) {
        try {
          const artist = allArtists[Math.floor(Math.random() * allArtists.length)];
          const venue = allVenues[Math.floor(Math.random() * allVenues.length)];
          
          if (!artist || !venue) continue;
          
          // Generate a random future date (next 6 months)
          const futureDate = new Date(currentDate);
          futureDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 180) + 30);
          
          const showData = {
            artist_id: artist.id,
            venue_id: venue.id,
            name: `${artist.name} Live at ${venue.name}`,
            date: futureDate.toISOString().split('T')[0],
            start_time: ['19:00:00', '19:30:00', '20:00:00', '20:30:00'][Math.floor(Math.random() * 4)],
            status: 'upcoming',
            ticket_url: `https://tickets.example.com/${artist.name.toLowerCase().replace(/\s+/g, '-')}`
          };

          const { data: newShow, error: showError } = await supabase
            .from('shows')
            .upsert(showData, {
              onConflict: 'artist_id,date,venue_id',
              ignoreDuplicates: true
            })
            .select('id, name')
            .single();

          if (!showError && newShow) {
            console.log(`✓ Created show: ${newShow.name}`);
            showsSynced++;

            // Create a predicted setlist
            const { data: setlist } = await supabase
              .from('setlists')
              .upsert({
                show_id: newShow.id,
                type: 'predicted',
                is_locked: false
              }, {
                onConflict: 'show_id,type',
                ignoreDuplicates: true
              })
              .select('id')
              .single();

            // Add some songs to the setlist
            if (setlist) {
              const { data: artistSongs } = await supabase
                .from('songs')
                .select('id')
                .eq('artist_name', artist.name)
                .limit(8);

              if (artistSongs && artistSongs.length > 0) {
                for (let j = 0; j < Math.min(artistSongs.length, 5); j++) {
                  const song = artistSongs[j];
                  if (!song) continue;
                  
                  await supabase
                    .from('setlist_songs')
                    .upsert({
                      setlist_id: setlist.id,
                      song_id: song.id,
                      position: j + 1,
                      upvotes: Math.floor(Math.random() * 50) + 10,
                      downvotes: Math.floor(Math.random() * 10)
                    }, {
                      onConflict: 'setlist_id,position',
                      ignoreDuplicates: true
                    });
                }
              }
            }
          }
        } catch (showError) {
          console.error('Error creating show:', showError);
          errorCount++;
        }
      }
    }

    console.log(`Data population completed!`);
    console.log(`Artists synced: ${artistsSynced}`);
    console.log(`Shows created: ${showsSynced}`);
    console.log(`Errors: ${errorCount}`);

    return NextResponse.json({ 
      success: true,
      message: 'Database populated with real data',
      artistsSynced,
      showsSynced,
      errorCount 
    });

  } catch (error) {
    console.error('Population failed:', error);
    return NextResponse.json({ 
      error: 'Population failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Manual trigger for testing
export async function GET(request: Request) {
  return POST(request);
} 