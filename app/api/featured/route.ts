import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ticketmasterAPI } from '@/libs/ticketmaster-api';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get top US cities for major shows
    const majorUSCities = [
      { city: 'New York', state: 'NY' },
      { city: 'Los Angeles', state: 'CA' },
      { city: 'Chicago', state: 'IL' },
      { city: 'Las Vegas', state: 'NV' },
      { city: 'Miami', state: 'FL' },
      { city: 'Atlanta', state: 'GA' },
      { city: 'Boston', state: 'MA' },
      { city: 'Seattle', state: 'WA' }
    ];

    // 1. Get real stadium and arena shows from Ticketmaster
    console.log('Fetching major venue shows from Ticketmaster...');
    let stadiumShows: any[] = [];
    
    try {
      // Check if Ticketmaster API is available
      if (!process.env.TICKETMASTER_API_KEY) {
        console.log('⚠️ Ticketmaster API key not found, using fallback data');
        stadiumShows = createFallbackShows();
      } else {
        for (const location of majorUSCities.slice(0, 4)) { // Limit to prevent rate limits
          try {
            const events = await ticketmasterAPI.getMusicEvents({
              city: location.city,
              stateCode: location.state,
              countryCode: 'US',
              size: 25
            });

            const musicEvents = events._embedded?.events || [];
            
            // Filter for large venues (stadiums, arenas)
            const largeVenueEvents = musicEvents.filter((event: any) => {
              const venue = event._embedded?.venues?.[0];
              const venueName = venue?.name?.toLowerCase() || '';
              const capacity = venue?.capacity || 0;
              
              return capacity > 5000 || 
                venueName.includes('stadium') || 
                venueName.includes('arena') || 
                venueName.includes('amphitheater') ||
                venueName.includes('center') ||
                venueName.includes('garden');
            });

            stadiumShows.push(...largeVenueEvents);
          } catch (cityError) {
            console.error(`Error fetching events for ${location.city}:`, cityError);
          }
        }

        // Remove duplicates and limit
        stadiumShows = stadiumShows
          .filter((show, index, self) => 
            index === self.findIndex(s => s.id === show.id)
          )
          .slice(0, 12)
          .sort((a, b) => new Date(a.dates?.start?.localDate || '').getTime() - new Date(b.dates?.start?.localDate || '').getTime());
        
        // If no shows found, use fallback
        if (stadiumShows.length === 0) {
          console.log('⚠️ No Ticketmaster shows found, using fallback data');
          stadiumShows = createFallbackShows();
        }
      }

    } catch (tmError) {
      console.error('Ticketmaster error:', tmError);
      stadiumShows = createFallbackShows();
    }

    // 2. Get actual top US artists from Spotify
    console.log('Fetching top US artists from Spotify...');
    let topUSArtists: any[] = [];
    
    try {
      // Check if Spotify API is available
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.log('⚠️ Spotify API credentials not found, using fallback data');
        topUSArtists = createFallbackArtists();
      } else {
        // Search for popular US artists across different genres
        const topGenres = ['pop', 'hip-hop', 'rock', 'country', 'r&b'];
        const allTopArtists = [];

        for (const genre of topGenres) {
          try {
            const artists = await spotifyAPI.searchArtists(`genre:${genre} country:US`, 20);
            // Filter for artists with high popularity and followers
            const popularArtists = artists.filter((artist: any) => 
              artist.popularity > 70 && artist.followers?.total > 1000000
            );
            allTopArtists.push(...popularArtists);
          } catch (genreError) {
            console.error(`Error fetching ${genre} artists:`, genreError);
          }
        }

        // Remove duplicates and get top artists by followers
        const uniqueArtists = allTopArtists.filter((artist, index, self) => 
          index === self.findIndex(a => a.id === artist.id)
        );

        topUSArtists = uniqueArtists
          .sort((a, b) => b.followers.total - a.followers.total)
          .slice(0, 16);

        // If no artists found, use fallback
        if (topUSArtists.length === 0) {
          console.log('⚠️ No Spotify artists found, using fallback data');
          topUSArtists = createFallbackArtists();
        }
      }

    } catch (spotifyError) {
      console.error('Spotify error:', spotifyError);
      topUSArtists = createFallbackArtists();
    }

    // 3. Sync artists and shows to database
    const syncedShows = [];
    const syncedArtists = [];

    // Sync stadium shows
    for (const show of stadiumShows) {
      try {
        const venue = show._embedded?.venues?.[0];
        const attractions = show._embedded?.attractions || [];
        
        if (venue && attractions.length > 0) {
          const artist = attractions[0];
          
          // Check if artist exists, if not create
          let dbArtist = null;
          const { data: existingArtist } = await supabase
            .from('artists')
            .select('*')
            .ilike('name', artist.name)
            .single();

          if (existingArtist) {
            dbArtist = existingArtist;
          } else {
            // Create artist
            const artistData = {
              name: artist.name,
              slug: artist.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
              spotify_id: null,
              image_url: artist.images?.[0]?.url || null,
              genres: artist.classifications?.[0]?.genre?.name ? [artist.classifications[0].genre.name] : [],
              followers: 0,
              verified: true // Major venue artists are considered verified
            };

            const { data: newArtist } = await supabase
              .from('artists')
              .insert(artistData)
              .select('*')
              .single();

            dbArtist = newArtist;
          }

          // Check if venue exists, if not create
          let dbVenue = null;
          const { data: existingVenue } = await supabase
            .from('venues')
            .select('*')
            .eq('name', venue.name)
            .single();

          if (existingVenue) {
            dbVenue = existingVenue;
          } else {
            // Create venue
            const venueData = ticketmasterAPI.transformVenueForDB(venue);
            const { data: newVenue } = await supabase
              .from('venues')
              .insert(venueData)
              .select('*')
              .single();

            dbVenue = newVenue;
          }

          // Create show if all data is available
          if (dbArtist && dbVenue) {
            const showData = {
              artist_id: dbArtist.id,
              venue_id: dbVenue.id,
              name: show.name,
              slug: show.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
              date: show.dates?.start?.localDate,
              start_time: show.dates?.start?.localTime,
              status: 'upcoming' as const,
              ticket_url: show.url
            };

            const { data: newShow } = await supabase
              .from('shows')
              .insert(showData)
              .select('*, artist:artists(*), venue:venues(*)')
              .single();

            if (newShow) {
              syncedShows.push(newShow);
            }
          }
        }
      } catch (showError) {
        console.error('Error syncing show:', showError);
      }
    }

    // Sync top artists
    for (const artist of topUSArtists) {
      try {
        const { data: existingArtist } = await supabase
          .from('artists')
          .select('*')
          .eq('spotify_id', artist.id)
          .single();

        if (!existingArtist) {
          const artistData = spotifyAPI.transformArtistForDB(artist);
          const { data: newArtist } = await supabase
            .from('artists')
            .insert(artistData)
            .select('*')
            .single();

          if (newArtist) {
            syncedArtists.push(newArtist);
          }
        } else {
          syncedArtists.push(existingArtist);
        }
      } catch (artistError) {
        console.error('Error syncing artist:', artistError);
      }
    }

    // 4. Get final featured content from database
    const { data: featuredShows } = await supabase
      .from('shows')
      .select(`
        *,
        artist:artists(*),
        venue:venues(*)
      `)
      .eq('status', 'upcoming')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(8);

    const { data: featuredArtists } = await supabase
      .from('artists')
      .select('*')
      .order('followers', { ascending: false })
      .limit(12);

    return NextResponse.json({
      featured_shows: featuredShows || [],
      featured_artists: featuredArtists || [],
      sync_stats: {
        shows_synced: syncedShows.length,
        artists_synced: syncedArtists.length,
        stadium_shows_found: stadiumShows.length,
        top_artists_found: topUSArtists.length
      }
    });

  } catch (error) {
    console.error('Featured content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fallback data functions for when external APIs are unavailable
function createFallbackShows() {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 30);

  return [
    {
      id: 'fallback-1',
      name: 'Taylor Swift | The Eras Tour',
      dates: {
        start: {
          localDate: baseDate.toISOString().split('T')[0],
          localTime: '20:00:00'
        }
      },
      url: 'https://ticketmaster.com/taylor-swift-tickets',
      _embedded: {
        attractions: [{ name: 'Taylor Swift' }],
        venues: [{
          name: 'MetLife Stadium',
          capacity: 82500,
          city: { name: 'East Rutherford' },
          state: { stateCode: 'NJ' },
          country: { countryCode: 'US' }
        }]
      }
    },
    {
      id: 'fallback-2',
      name: 'Beyoncé Renaissance World Tour',
      dates: {
        start: {
          localDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          localTime: '20:00:00'
        }
      },
      url: 'https://ticketmaster.com/beyonce-tickets',
      _embedded: {
        attractions: [{ name: 'Beyoncé' }],
        venues: [{
          name: 'SoFi Stadium',
          capacity: 70000,
          city: { name: 'Los Angeles' },
          state: { stateCode: 'CA' },
          country: { countryCode: 'US' }
        }]
      }
    },
    {
      id: 'fallback-3',
      name: 'Drake: It\'s All A Blur Tour',
      dates: {
        start: {
          localDate: new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          localTime: '20:00:00'
        }
      },
      url: 'https://ticketmaster.com/drake-tickets',
      _embedded: {
        attractions: [{ name: 'Drake' }],
        venues: [{
          name: 'United Center',
          capacity: 23500,
          city: { name: 'Chicago' },
          state: { stateCode: 'IL' },
          country: { countryCode: 'US' }
        }]
      }
    }
  ];
}

function createFallbackArtists() {
  return [
    {
      id: 'fallback-artist-1',
      name: 'Taylor Swift',
      popularity: 100,
      followers: { total: 50000000 },
      genres: ['pop', 'country'],
      images: [{ url: null }]
    },
    {
      id: 'fallback-artist-2',
      name: 'Drake',
      popularity: 98,
      followers: { total: 45000000 },
      genres: ['hip-hop', 'rap'],
      images: [{ url: null }]
    },
    {
      id: 'fallback-artist-3',
      name: 'Beyoncé',
      popularity: 97,
      followers: { total: 40000000 },
      genres: ['pop', 'r&b'],
      images: [{ url: null }]
    },
    {
      id: 'fallback-artist-4',
      name: 'Ed Sheeran',
      popularity: 95,
      followers: { total: 35000000 },
      genres: ['pop', 'folk'],
      images: [{ url: null }]
    },
    {
      id: 'fallback-artist-5',
      name: 'Ariana Grande',
      popularity: 94,
      followers: { total: 30000000 },
      genres: ['pop', 'r&b'],
      images: [{ url: null }]
    },
    {
      id: 'fallback-artist-6',
      name: 'The Weeknd',
      popularity: 93,
      followers: { total: 28000000 },
      genres: ['pop', 'r&b'],
      images: [{ url: null }]
    }
  ];
} 