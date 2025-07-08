import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    return NextResponse.json({ artists: [] });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Search artists by name and genres
    const { data: artists, error } = await supabase
      .from('artists')
      .select(`
        id,
        name,
        slug,
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
      console.error('Search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let allArtists = artists || [];

    // If we don't have enough results, search Spotify and sync new artists
    if (allArtists.length < 5) {
      try {
        const spotifyArtists = await spotifyAPI.searchArtists(query, 10);
        
        for (const spotifyArtist of spotifyArtists) {
          // Check if artist already exists in our DB
          const { data: existingArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('spotify_id', spotifyArtist.id)
            .single();

          if (!existingArtist) {
            // Transform and insert new artist
            const artistData = spotifyAPI.transformArtistForDB(spotifyArtist);
            
            const { data: newArtist, error: insertError } = await supabase
              .from('artists')
              .insert(artistData)
              .select(`
                id,
                name,
                slug,
                image_url,
                genres,
                followers,
                verified,
                created_at,
                updated_at
              `)
              .single();

            if (!insertError && newArtist) {
              allArtists.push(newArtist);
            }
          }
        }
      } catch (spotifyError) {
        console.error('Spotify search error:', spotifyError);
        // Continue with database results only
      }
    }

    return NextResponse.json({ artists: allArtists });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 