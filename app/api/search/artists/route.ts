import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ticketmasterAPI } from '@/libs/ticketmaster-api';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    return NextResponse.json({ artists: [] });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // First: Search Ticketmaster for live events with this artist
    let ticketmasterArtists: any[] = [];
    try {
      const eventsResponse = await ticketmasterAPI.searchEvents({ 
        keyword: query, 
        size: 20,
        classificationName: 'Music'
      });
      
      const events = eventsResponse._embedded?.events || [];
      
      // Extract unique artists from events
      const artistsFromEvents = new Map();
      events.forEach((event: any) => {
        const attractions = event._embedded?.attractions || [];
        attractions.forEach((attraction: any) => {
          if (attraction.name && attraction.name.toLowerCase().includes(query.toLowerCase())) {
            const artistKey = attraction.name.toLowerCase();
            if (!artistsFromEvents.has(artistKey)) {
              artistsFromEvents.set(artistKey, {
                name: attraction.name,
                upcoming_shows: events.filter((e: any) => 
                  e._embedded?.attractions?.some((a: any) => 
                    a.name.toLowerCase() === artistKey
                  )
                ).length,
                has_live_events: true,
                ticketmaster_data: attraction
              });
            }
          }
        });
      });
      
      ticketmasterArtists = Array.from(artistsFromEvents.values());
    } catch (tmError) {
      console.error('Ticketmaster search error:', tmError);
    }

    // Second: Search our database for existing artists
    const { data: dbArtists, error } = await supabase
      .from('artists')
      .select(`
        id,
        name,
        slug,
        spotify_id,
        image_url,
        genres,
        followers,
        verified,
        created_at,
        updated_at
      `)
      .ilike('name', `%${query}%`)
      .order('followers', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Database search error:', error);
    }

    let allArtists = [];

    // Combine Ticketmaster results with database artists
    for (const tmArtist of ticketmasterArtists) {
      // Check if this artist exists in our database
      const existingArtist = (dbArtists || []).find(
        db => db.name.toLowerCase() === tmArtist.name.toLowerCase()
      );

      if (existingArtist) {
        // Use database version but mark as having live events
        allArtists.push({
          ...existingArtist,
          upcoming_shows_count: tmArtist.upcoming_shows,
          has_live_events: true
        });
      } else {
        // Create new artist from Ticketmaster data + Spotify lookup
        try {
          // Try to get more artist data from Spotify
          const spotifyArtists = await spotifyAPI.searchArtists(tmArtist.name, 1);
          let artistData;

          if (spotifyArtists.length > 0) {
            // Use Spotify data for rich artist profile
            const spotifyArtist = spotifyArtists[0];
            artistData = spotifyAPI.transformArtistForDB(spotifyArtist);
            
            // Insert into database
            const { data: newArtist } = await supabase
              .from('artists')
              .insert(artistData)
              .select(`
                id,
                name,
                slug,
                spotify_id,
                image_url,
                genres,
                followers,
                verified,
                created_at,
                updated_at
              `)
              .single();

            if (newArtist) {
              allArtists.push({
                ...newArtist,
                upcoming_shows_count: tmArtist.upcoming_shows,
                has_live_events: true
              });
            }
          } else {
            // Create minimal artist record from Ticketmaster data
            const minimalArtistData = {
              name: tmArtist.name,
              slug: tmArtist.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
              spotify_id: null,
              image_url: null,
              genres: [],
              followers: 0,
              verified: false
            };

            const { data: newArtist } = await supabase
              .from('artists')
              .insert(minimalArtistData)
              .select(`
                id,
                name,
                slug,
                spotify_id,
                image_url,
                genres,
                followers,
                verified,
                created_at,
                updated_at
              `)
              .single();

            if (newArtist) {
              allArtists.push({
                ...newArtist,
                upcoming_shows_count: tmArtist.upcoming_shows,
                has_live_events: true
              });
            }
          }
        } catch (createError) {
          console.error('Error creating artist from Ticketmaster data:', createError);
        }
      }
    }

    // Add remaining database artists that weren't found in Ticketmaster
    const tmArtistNames = new Set(ticketmasterArtists.map(a => a.name.toLowerCase()));
    const remainingDbArtists = (dbArtists || []).filter(
      db => !tmArtistNames.has(db.name.toLowerCase())
    );

    allArtists.push(...remainingDbArtists);

         // Sort by live events first, then by followers
     allArtists.sort((a: any, b: any) => {
       if (a.has_live_events && !b.has_live_events) return -1;
       if (!a.has_live_events && b.has_live_events) return 1;
       return (b.followers || 0) - (a.followers || 0);
     });

    return NextResponse.json({ 
      artists: allArtists.slice(0, limit),
      live_events_found: ticketmasterArtists.length
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 