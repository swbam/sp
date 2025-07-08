'use client';

import Image from 'next/image';
import type { Artist } from '@/types';

interface ArtistHeaderProps {
  artist: Artist;
}

export const ArtistHeader: React.FC<ArtistHeaderProps> = ({ artist }) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-x-5">
      <div className="relative h-32 w-32 lg:h-44 lg:w-44">
        <Image
          className="object-cover rounded-full"
          fill
          src={artist.image_url || "/images/music-placeholder.png"}
          alt={`${artist.name} image`}
        />
      </div>
      
      <div className="flex flex-col gap-y-2 mt-4 md:mt-0 flex-1">
        <p className="hidden md:block font-semibold text-sm">Artist</p>
        
        <div className="flex items-center gap-x-2">
          <h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-bold">
            {artist.name}
          </h1>
          {artist.verified && (
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-x-2 text-sm">
          <p className="text-neutral-400">
            {artist.followers.toLocaleString()} followers
          </p>
        </div>

        {artist.genres && artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {artist.genres.map((genre: string) => (
              <span 
                key={genre}
                className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>
        )}


      </div>
    </div>
  );
};