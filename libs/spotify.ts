import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Re-export optimized functions
export { 
  searchSpotifyArtists as searchArtists,
  getSpotifyArtistTopTracks as getArtistTopTracks,
  getSpotifyArtistAlbums as getArtistAlbums,
  spotifyClient,
  type SpotifyArtist,
  type SpotifyTrack
} from './external-api-optimizer';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Legacy functions for user-specific data (require user authentication)
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

// Enhanced functions using the optimized client
export async function searchArtistsEnhanced(
  query: string,
  options: {
    limit?: number;
    market?: string;
    offset?: number;
  } = {}
): Promise<any[]> {
  const { searchSpotifyArtists } = await import('./external-api-optimizer');
  
  return searchSpotifyArtists(query, {
    limit: options.limit || 20,
    market: options.market || 'US',
    offset: options.offset || 0
  });
}

export async function getArtistDetails(artistId: string): Promise<any> {
  const { spotifyClient } = await import('./external-api-optimizer');
  
  try {
    return await spotifyClient.request(`/artists/${artistId}`, {}, {
      ttl: 3600000, // 1 hour
      priority: 'medium',
      tags: ['spotify', 'artist', 'details']
    });
  } catch (error) {
    console.error('Spotify artist details error:', error);
    return null;
  }
}

export async function getArtistRelatedArtists(artistId: string): Promise<any[]> {
  const { spotifyClient } = await import('./external-api-optimizer');
  
  try {
    const response = await spotifyClient.request(`/artists/${artistId}/related-artists`, {}, {
      ttl: 7200000, // 2 hours
      priority: 'low',
      tags: ['spotify', 'artist', 'related']
    });
    
    return response.artists || [];
  } catch (error) {
    console.error('Spotify related artists error:', error);
    return [];
  }
}

// User library functions with caching
export async function getUserSavedTracks(
  options: {
    limit?: number;
    offset?: number;
    market?: string;
  } = {}
): Promise<any[]> {
  const { limit = 50, offset = 0, market = 'US' } = options;
  const accessToken = await getSpotifyAccessToken();
  
  if (!accessToken) return [];

  try {
    const response = await fetch(
      `${SPOTIFY_API_BASE}/me/tracks?limit=${limit}&offset=${offset}&market=${market}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) return [];
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Spotify saved tracks error:', error);
    return [];
  }
}

export async function getUserPlaylists(
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const { limit = 50, offset = 0 } = options;
  const accessToken = await getSpotifyAccessToken();
  
  if (!accessToken) return [];

  try {
    const response = await fetch(
      `${SPOTIFY_API_BASE}/me/playlists?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) return [];
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Spotify playlists error:', error);
    return [];
  }
}

// Types for backward compatibility
export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  genres: string[];
  popularity: number;
  followers: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
    release_date: string;
  };
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
} 