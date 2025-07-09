import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';



export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/spotify`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get user's Spotify profile
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get Spotify profile');
    }

    const profile = await profileResponse.json();

    // Update user with Spotify ID
    await supabase
      .from('users')
      .update({ spotify_id: profile.id })
      .eq('id', user.id);

    // Get user's followed artists from Spotify
    let allFollowedArtists: any[] = [];
    let nextUrl = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';

    while (nextUrl) {
      const followingResponse = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!followingResponse.ok) {
        console.error('Failed to fetch followed artists');
        break;
      }

      const followingData = await followingResponse.json();
      allFollowedArtists.push(...followingData.artists.items);
      
      nextUrl = followingData.artists.next;
    }

    console.log(`Found ${allFollowedArtists.length} followed artists on Spotify`);

    // Correlate with our database artists
    let correlatedCount = 0;
    for (const spotifyArtist of allFollowedArtists) {
      try {
        // Find artist in our database by Spotify ID or name
        let { data: dbArtist } = await supabase
          .from('artists')
          .select('id')
          .eq('spotify_id', spotifyArtist.id)
          .single();

        if (!dbArtist) {
          // Try by name if Spotify ID doesn't match
          const { data: nameMatch } = await supabase
            .from('artists')
            .select('id')
            .ilike('name', spotifyArtist.name)
            .single();
          
          dbArtist = nameMatch;
        }

        if (dbArtist) {
          // Create follow relationship if it doesn't exist
          const { error: followError } = await supabase
            .from('user_artists')
            .upsert({
              user_id: user.id,
              artist_id: dbArtist.id
            }, {
              onConflict: 'user_id,artist_id'
            });

          if (!followError) {
            correlatedCount++;
          }
        } else {
          // Create artist if they don't exist and have shows
          const { data: newArtist, error: artistError } = await supabase
            .from('artists')
            .insert({
              spotify_id: spotifyArtist.id,
              name: spotifyArtist.name,
              slug: spotifyArtist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              image_url: spotifyArtist.images?.[0]?.url,
              genres: spotifyArtist.genres || [],
              followers: spotifyArtist.followers?.total || 0,
              verified: spotifyArtist.followers?.total > 1000000
            })
            .select('id')
            .single();

          if (!artistError && newArtist) {
            // Follow the newly created artist
            await supabase
              .from('user_artists')
              .insert({
                user_id: user.id,
                artist_id: newArtist.id
              });
            
            correlatedCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing artist ${spotifyArtist.name}:`, error);
      }
    }

    // Redirect back to account page with success
    const redirectUrl = new URL('/account', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('spotify_connected', 'true');
    redirectUrl.searchParams.set('artists_synced', correlatedCount.toString());

    return NextResponse.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Spotify OAuth error:', error);
    
    // Redirect back with error
    const redirectUrl = new URL('/account', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('spotify_error', 'true');
    
    return NextResponse.redirect(redirectUrl.toString());
  }
}

// Initiate Spotify OAuth flow
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // Check if user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  // Generate Spotify OAuth URL
  const scopes = [
    'user-follow-read',
    'user-read-private'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: scopes,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/spotify`,
    state: user.id // Use user ID as state for security
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  return NextResponse.json({ auth_url: authUrl });
} 