'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useUser } from '@/hooks/useUser';
import MediaItem from '@/components/MediaItem';

interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
}

export const SpotifyDashboard = () => {
  const supabaseClient = useSupabaseClient();
  const { user } = useUser();
  const [followedArtists, setFollowedArtists] = useState<SpotifyArtist[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSpotifyData = async () => {
      if (!user) return;

      try {
        // Get the user's Spotify access token from Supabase auth
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const providerToken = sessionData?.session?.provider_token;
        
        if (!providerToken) {
          throw new Error('No Spotify access token found');
        }

        // Fetch followed artists
        const followedResponse = await fetch('https://api.spotify.com/v1/me/following?type=artist', {
          headers: {
            'Authorization': `Bearer ${providerToken}`
          }
        });
        
        const followedData = await followedResponse.json();
        setFollowedArtists(followedData.artists.items);

        // Fetch top artists
        const topResponse = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term', {
          headers: {
            'Authorization': `Bearer ${providerToken}`
          }
        });
        
        const topData = await topResponse.json();
        setTopArtists(topData.items);

      } catch (error) {
        console.error('Error fetching Spotify data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpotifyData();
  }, [user, supabaseClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-neutral-400">Loading your music profile...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Artists You Follow</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {followedArtists.map((artist) => (
            <MediaItem
              key={artist.id}
              data={{
                id: artist.id,
                title: artist.name,
                image_url: artist.images[0]?.url
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Your Top Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {topArtists.map((artist) => (
            <MediaItem
              key={artist.id}
              data={{
                id: artist.id,
                title: artist.name,
                image_url: artist.images[0]?.url
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 