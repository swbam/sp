import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Type definitions for Ticketmaster API
interface TicketmasterEvent {
  name: string;
  url?: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
    };
  };
  _embedded?: {
    attractions?: Array<{
      name: string;
    }>;
    venues?: Array<{
      name: string;
      city?: { name: string };
      state?: { 
        stateCode?: string;
        name?: string;
      };
      country?: { countryCode?: string };
      capacity?: number;
    }>;
  };
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    let artistsSynced = 0;
    let venuesSynced = 0;
    let showsSynced = 0;
    let songsSynced = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log('Starting comprehensive sync for top 5 US artists with upcoming shows...');
    console.log('Ticketmaster API Key present:', !!process.env.TICKETMASTER_API_KEY);

    // Step 1: Get real music events from Ticketmaster for major US cities
    const majorCities = [
      { city: 'New York', stateCode: 'NY' },
      { city: 'Los Angeles', stateCode: 'CA' },
      { city: 'Chicago', stateCode: 'IL' },
      { city: 'Miami', stateCode: 'FL' },
      { city: 'Las Vegas', stateCode: 'NV' }
    ];

    const artistPopularityMap = new Map<string, number>();
    const allEvents: TicketmasterEvent[] = [];

    // Create a proper start date for the API (current date in correct format)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today
    const startDateString = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Remove milliseconds

    // Fetch events from multiple cities to get a good dataset
    for (const location of majorCities) {
      try {
        console.log(`Fetching events for ${location.city}, ${location.stateCode}...`);
        
        const apiUrl = `https://app.ticketmaster.com/discovery/v2/events.json?` +
          `apikey=${process.env.TICKETMASTER_API_KEY}&` +
          `city=${encodeURIComponent(location.city)}&` +
          `stateCode=${location.stateCode}&` +
          `countryCode=US&` +
          `classificationName=Music&` +
          `startDateTime=${startDateString}&` +
          `size=50`;
        
        console.log(`API URL: ${apiUrl.replace(process.env.TICKETMASTER_API_KEY || '', '[API_KEY]')}`);
        
        const response = await fetch(apiUrl);
        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Ticketmaster API error for ${location.city}: ${response.status} - ${errorText}`);
          errors.push(`${location.city}: ${response.status} - ${errorText.substring(0, 100)}...`);
          errorCount++;
          continue;
        }

        const data = await response.json();
        console.log(`Raw response for ${location.city}:`, JSON.stringify(data, null, 2).substring(0, 300));
        
        const events = data._embedded?.events || [];
        allEvents.push(...events);
        
        console.log(`Found ${events.length} events in ${location.city}`);

        // Track artist popularity by counting shows
        events.forEach((event: TicketmasterEvent) => {
          const artist = event._embedded?.attractions?.[0];
          if (artist) {
            const count = artistPopularityMap.get(artist.name) || 0;
            artistPopularityMap.set(artist.name, count + 1);
            console.log(`Artist: ${artist.name}, Show count: ${count + 1}`);
          }
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error fetching events for ${location.city}:`, error);
        errors.push(`${location.city}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    console.log(`Total events found: ${allEvents.length}`);
    console.log(`Artists found: ${artistPopularityMap.size}`);

    // Step 2: Get top 5 artists by number of upcoming shows
    let topArtists = Array.from(artistPopularityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, showCount]) => ({ name, showCount }));

    console.log('Top 5 artists by upcoming shows:', topArtists);

    // FALLBACK: If no artists found from API, create realistic test data
    if (topArtists.length === 0) {
      console.log('No artists found from Ticketmaster API, using fallback data...');
      topArtists = [
        { name: 'Taylor Swift', showCount: 15 },
        { name: 'Ed Sheeran', showCount: 12 },
        { name: 'Billie Eilish', showCount: 10 },
        { name: 'The Weeknd', showCount: 8 },
        { name: 'Ariana Grande', showCount: 7 }
      ];

      // Create fallback venues and shows for testing
      const fallbackVenues = [
        { name: 'Madison Square Garden', city: 'New York', state: 'NY', capacity: 20000 },
        { name: 'The Forum', city: 'Los Angeles', state: 'CA', capacity: 17500 },
        { name: 'United Center', city: 'Chicago', state: 'IL', capacity: 23500 },
        { name: 'American Airlines Arena', city: 'Miami', state: 'FL', capacity: 19600 },
        { name: 'T-Mobile Arena', city: 'Las Vegas', state: 'NV', capacity: 20000 }
      ];

      const fallbackShows = [];
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 30); // Start 30 days from now

      for (let i = 0; i < topArtists.length; i++) {
        const artist = topArtists[i];
        const venue = fallbackVenues[i];
        if (!artist || !venue) continue;
        
        const showDate = new Date(baseDate);
        showDate.setDate(showDate.getDate() + (i * 7)); // Space shows 7 days apart

        fallbackShows.push({
          name: `${artist.name} World Tour`,
          artist: artist.name,
          venue: venue,
          date: showDate.toISOString().split('T')[0],
          time: '20:00:00',
          url: `https://tickets.example.com/${artist.name.toLowerCase().replace(/\s+/g, '-')}`
        });
      }

      // Convert fallback data to match Ticketmaster format
      allEvents.push(...fallbackShows.map(show => ({
        name: show.name,
        url: show.url,
        dates: {
          start: {
            localDate: show.date,
            localTime: show.time
          }
        },
        _embedded: {
          attractions: [{ name: show.artist }],
          venues: [{
            name: show.venue.name,
            city: { name: show.venue.city },
            state: { stateCode: show.venue.state },
            country: { countryCode: 'US' },
            capacity: show.venue.capacity
          }]
        }
      })));
    }

    // Step 3: Process each top artist
    for (const { name: artistName } of topArtists) {
      try {
        console.log(`\n=== Processing artist: ${artistName} ===`);
        
        // Create artist record
        const artistData = {
          name: artistName,
          slug: artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          image_url: null, // Use null instead of placeholder path to avoid invalid URLs
          genres: ['Pop'], // Default genre - in real app would come from Spotify
          followers: Math.floor(Math.random() * 1000000) + 100000,
          verified: true
        };

        // Use INSERT with ON CONFLICT since we don't have a unique constraint on name
        const { data: existingArtist } = await supabase
          .from('artists')
          .select('id, name')
          .eq('name', artistName)
          .single();

        let artist;
        if (existingArtist) {
          console.log(`Artist ${artistName} already exists with ID: ${existingArtist.id}`);
          artist = existingArtist;
        } else {
          const { data: newArtist, error: artistError } = await supabase
            .from('artists')
            .insert(artistData)
            .select('id, name')
            .single();

          if (artistError) {
            console.error(`Error creating artist ${artistName}:`, artistError);
            errors.push(`Artist ${artistName}: ${artistError.message}`);
            errorCount++;
            continue;
          }
          artist = newArtist;
        }

        console.log(`✅ Created/found artist: ${artist.name} (ID: ${artist.id})`);
        artistsSynced++;

        // Step 4: Create sample songs for this artist
        const sampleSongs = [
          `Hit Song 1`,
          `Hit Song 2`, 
          `Hit Song 3`,
          `Popular Track`,
          `Fan Favorite`
        ];

        for (const songTitle of sampleSongs) {
          try {
            const songData = {
              title: songTitle,
              artist_name: artistName,
              spotify_id: `spotify_${Math.random().toString(36).substring(7)}`
            };

            const { data: existingSong } = await supabase
              .from('songs')
              .select('id')
              .eq('spotify_id', songData.spotify_id)
              .single();

            if (!existingSong) {
              await supabase
                .from('songs')
                .insert(songData);
              
              songsSynced++;
            }
          } catch (songError) {
            console.error(`Error creating song ${songTitle}:`, songError);
          }
        }

        // Step 5: Process shows for this artist
        const artistEvents = allEvents.filter(event => {
          const eventArtist = event._embedded?.attractions?.[0];
          return eventArtist && eventArtist.name === artistName;
        });

        console.log(`Found ${artistEvents.length} shows for ${artistName}`);

        for (const event of artistEvents.slice(0, 3)) { // Limit to 3 shows per artist
          try {
            const venue = event._embedded?.venues?.[0];
            if (!venue) continue;

            // Create venue
            const venueData = {
              name: venue.name,
              slug: venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
              city: venue.city?.name || 'Unknown',
              state: venue.state?.stateCode || venue.state?.name || '',
              country: venue.country?.countryCode || 'US',
              capacity: venue.capacity || Math.floor(Math.random() * 50000) + 5000
            };

            // Check for existing venue
            const { data: existingVenue } = await supabase
              .from('venues')
              .select('id, name')
              .eq('name', venue.name)
              .eq('city', venueData.city)
              .single();

            let venueRecord;
            if (existingVenue) {
              venueRecord = existingVenue;
            } else {
              const { data: newVenue, error: venueError } = await supabase
                .from('venues')
                .insert(venueData)
                .select('id, name')
                .single();

              if (venueError) {
                console.error(`Error creating venue ${venue.name}:`, venueError);
                continue;
              }
              venueRecord = newVenue;
            }

            if (venueRecord) {
              venuesSynced++;
              console.log(`  ✅ Created/found venue: ${venueRecord.name}`);
            }

            // Create show
            const showDate = event.dates?.start?.localDate;
            const showTime = event.dates?.start?.localTime;
            
            if (!showDate) continue;

            const showData = {
              artist_id: artist.id,
              venue_id: venueRecord.id,
              name: event.name,
              date: showDate,
              start_time: showTime || '20:00:00',
              status: 'upcoming' as const,
              ticket_url: event.url || `https://tickets.example.com/${artistData.slug}`
            };

            // Check for existing show
            const { data: existingShow } = await supabase
              .from('shows')
              .select('id, name')
              .eq('artist_id', artist.id)
              .eq('date', showDate)
              .eq('venue_id', venueRecord.id)
              .single();

            let show;
            if (existingShow) {
              show = existingShow;
            } else {
              const { data: newShow, error: showError } = await supabase
                .from('shows')
                .insert(showData)
                .select('id, name')
                .single();

              if (showError) {
                console.error(`Error creating show ${event.name}:`, showError);
                continue;
              }
              show = newShow;
            }

            console.log(`    ✅ Created/found show: ${show.name}`);
            showsSynced++;

            // Create predicted setlist for the show
            const { data: existingSetlist } = await supabase
              .from('setlists')
              .select('id')
              .eq('show_id', show.id)
              .eq('type', 'predicted')
              .single();

            let setlist;
            if (existingSetlist) {
              setlist = existingSetlist;
            } else {
              const { data: newSetlist } = await supabase
                .from('setlists')
                .insert({
                  show_id: show.id,
                  type: 'predicted',
                  is_locked: false
                })
                .select('id')
                .single();
              setlist = newSetlist;
            }

            // Add songs to setlist with realistic vote counts
            if (setlist) {
              const { data: artistSongs } = await supabase
                .from('songs')
                .select('id')
                .eq('artist_name', artistName)
                .limit(5);

              if (artistSongs) {
                for (let i = 0; i < artistSongs.length; i++) {
                  const song = artistSongs[i];
                  if (!song) continue;
                  
                  const { data: existingSetlistSong } = await supabase
                    .from('setlist_songs')
                    .select('id')
                    .eq('setlist_id', setlist.id)
                    .eq('position', i + 1)
                    .single();

                  if (!existingSetlistSong) {
                    await supabase
                      .from('setlist_songs')
                      .insert({
                        setlist_id: setlist.id,
                        song_id: song.id,
                        position: i + 1,
                        upvotes: Math.floor(Math.random() * 100) + 20,
                        downvotes: Math.floor(Math.random() * 15) + 2
                      });
                  }
                }
              }
            }

          } catch (showError) {
            console.error(`Error processing show for ${artistName}:`, showError);
            errorCount++;
          }
        }

        // Rate limiting between artists
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (artistError) {
        console.error(`Error processing artist ${artistName}:`, artistError);
        errors.push(`Artist ${artistName}: ${artistError instanceof Error ? artistError.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    const summary = {
      artistsSynced,
      venuesSynced,
      showsSynced,
      songsSynced,
      errorCount,
      topArtists: topArtists.map(a => a.name),
      errors: errors.slice(0, 10), // Limit error list
      usingFallbackData: topArtists.some(a => ['Taylor Swift', 'Ed Sheeran', 'Billie Eilish'].includes(a.name))
    };

    console.log('\n=== COMPREHENSIVE SYNC COMPLETED ===');
    console.log(`Artists synced: ${artistsSynced}`);
    console.log(`Venues synced: ${venuesSynced}`);
    console.log(`Shows synced: ${showsSynced}`);
    console.log(`Songs synced: ${songsSynced}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Top artists: ${topArtists.map(a => a.name).join(', ')}`);
    if (errors.length > 0) {
      console.log(`First few errors:`, errors.slice(0, 3));
    }

    return NextResponse.json({
      success: true,
      message: summary.usingFallbackData 
        ? 'Comprehensive sync completed with fallback test data (external APIs unavailable)'
        : 'Comprehensive sync completed with real Ticketmaster data',
      ...summary
    });

  } catch (error) {
    console.error('Comprehensive sync failed:', error);
    return NextResponse.json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Manual trigger for testing
export async function GET(request: Request) {
  return POST(request);
} 