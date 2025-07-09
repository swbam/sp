'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Artist } from '@/types';
import MediaItem from '@/components/MediaItem';

interface SearchContentProps {
  searchParams: {
    q?: string;
  };
}

const SearchContent: React.FC<SearchContentProps> = ({
  searchParams
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchArtists = async () => {
      if (!searchParams.q) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/search/artists?q=${encodeURIComponent(searchParams.q)}`);
        if (!response.ok) {
          throw new Error('Failed to search artists');
        }

        const data = await response.json();
        setArtists(data || []);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to load search results');
      } finally {
        setIsLoading(false);
      }
    };

    searchArtists();
  }, [searchParams.q]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6 text-neutral-400">
        {error}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6 text-neutral-400">
        No artists found.
      </div>
    );
  }

  const handleArtistClick = async (artist: Artist) => {
    try {
      // Create artist in database if it doesn't exist
      const response = await fetch(`/api/artists/${artist.slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: artist.name,
          image_url: artist.image_url,
          genres: artist.genres,
          ticketmaster_id: artist.id
        })
      });

      if (response.ok) {
        // Navigate to artist page
        router.push(`/artists/${artist.slug}`);
      } else {
        console.error('Failed to create artist');
      }
    } catch (error) {
      console.error('Error creating artist:', error);
    }
  };

  return (
    <div className="flex flex-col gap-y-2 w-full px-6">
      {artists.map((artist) => (
        <div key={artist.id} className="w-full">
          <MediaItem
            data={{
              id: artist.id,
              name: artist.name,
              title: artist.name,
              artist_name: artist.genres.join(', ') || 'Music',
              image_url: artist.image_url || '/images/music-placeholder.png'
            }}
            onClick={() => handleArtistClick(artist)}
          />
        </div>
      ))}
    </div>
  );
};

export default SearchContent;
