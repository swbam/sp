import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export async function getSpotifyAccessToken() {
  const supabase = createClientComponentClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.provider_token;
}

export async function getFollowedArtists() {
  const accessToken = await getSpotifyAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${SPOTIFY_API_BASE}/me/following?type=artist`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getTopArtists() {
  const accessToken = await getSpotifyAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${SPOTIFY_API_BASE}/me/top/artists?limit=10`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return null;
  return response.json();
} 