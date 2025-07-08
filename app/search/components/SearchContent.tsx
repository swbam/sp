'use client';

import { useState, useEffect } from 'react';
import { ArtistCard } from '@/components/ArtistCard';
import type { Artist } from '@/types';

interface SearchContentProps {
  searchQuery?: string;
}

export const SearchContent: React.FC<SearchContentProps> = ({ searchQuery }) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setArtists([]);
      setHasSearched(false);
      return;
    }

    const searchArtists = async () => {
      setIsLoading(true);
      setHasSearched(true);
      
      try {
        // Use real API call
        const response = await fetch(`/api/search/artists?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }
        
        setArtists(data.artists || []);
        setIsLoading(false);
        
      } catch (error) {
        console.error('Search failed:', error);
        setArtists([]);
        setIsLoading(false);
      }
    };

    searchArtists();
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6">
        <div className="text-neutral-400 text-center py-8">
          Searching for artists...
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6">
        <div className="text-neutral-400 text-center py-8">
          <div className="text-lg mb-2">🎵</div>
          <p>Search for your favorite artists to see their upcoming shows</p>
        </div>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6">
        <div className="text-neutral-400 text-center py-8">
          <p>No artists found for &ldquo;{searchQuery}&rdquo;</p>
          <p className="text-sm mt-2">Try a different search term</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-6 w-full px-6 pb-6">
      <div>
        <h2 className="text-white text-xl font-semibold mb-4">
          Artists ({artists.length})
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </div>
    </div>
  );
};
