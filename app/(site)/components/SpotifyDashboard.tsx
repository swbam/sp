'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import MediaItem from '@/components/MediaItem';
import { getFollowedArtists, getTopArtists } from '@/libs/spotify';
import { twMerge } from 'tailwind-merge';

interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
}

interface ArtistSectionProps {
  title: string;
  artists: SpotifyArtist[];
  className?: string;
}

const ArtistSection = ({ title, artists, className }: ArtistSectionProps) => (
  <div className={twMerge("space-y-4", className)}>
    <h2 className="text-2xl font-bold">{title}</h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {artists.map((artist) => (
        <MediaItem
          key={artist.id}
          data={{
            id: artist.id,
            title: artist.name,
            author: artist.genres.slice(0, 2).join(', '),
            image_path: artist.images[0]?.url
          }}
        />
      ))}
    </div>
  </div>
);

export const SpotifyDashboard = () => {
  const { user } = useUser();
  const [followedArtists, setFollowedArtists] = useState<SpotifyArtist[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSpotifyData = async () => {
      if (!user) return;

      try {
        const [followedData, topData] = await Promise.all([
          getFollowedArtists(),
          getTopArtists()
        ]);

        if (followedData?.artists?.items) {
          setFollowedArtists(followedData.artists.items);
        }

        if (topData?.items) {
          setTopArtists(topData.items);
        }
      } catch (error) {
        console.error('Error fetching Spotify data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpotifyData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!followedArtists.length && !topArtists.length) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold mb-2">Welcome to MySetlist!</h2>
        <p className="text-neutral-400">
          Start following artists on Spotify to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {followedArtists.length > 0 && (
        <ArtistSection
          title="Artists You Follow"
          artists={followedArtists}
        />
      )}
      {topArtists.length > 0 && (
        <ArtistSection
          title="Your Top Artists"
          artists={topArtists}
          className="mt-8"
        />
      )}
    </div>
  );
}; 