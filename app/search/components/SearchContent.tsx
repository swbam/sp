'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketmasterArtist } from '@/libs/ticketmaster';
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
  const [artists, setArtists] = useState<TicketmasterArtist[]>([]);
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
        setArtists(data);
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

  return (
    <div className="flex flex-col gap-y-2 w-full px-6">
      {artists.map((artist) => (
        <div
          key={artist.id}
          className="flex items-center gap-x-4 w-full cursor-pointer hover:bg-neutral-800/50 rounded-md p-2"
          onClick={() => router.push(`/artists/${artist.id}`)}
        >
          <MediaItem
            data={{
              id: artist.id,
              title: artist.name,
              author: artist.genres.join(', ') || 'Music',
              image_path: artist.images[0]?.url || '/images/music-placeholder.png'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default SearchContent;
