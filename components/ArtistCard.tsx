'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Artist } from '@/types';

interface ArtistCardProps {
  artist: Artist;
  onClick?: (artist: Artist) => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ 
  artist, 
  onClick 
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick(artist);
    } else {
      router.push(`/artists/${artist.slug}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="
        relative 
        group 
        flex 
        flex-col 
        items-center 
        justify-center 
        rounded-md 
        overflow-hidden 
        gap-x-4 
        bg-neutral-400/5 
        cursor-pointer 
        hover:bg-neutral-400/10 
        transition 
        p-3
      "
    >
      <div className="
        relative 
        aspect-square 
        w-full
        h-full 
        rounded-md 
        overflow-hidden
      ">
        <Image
          className="object-cover"
          src={artist.image_url || "/images/music-placeholder.png"}
          fill
          alt={artist.name}
        />
      </div>
      
      <div className="flex flex-col items-start w-full pt-4 gap-y-1">
        <p className="font-semibold truncate w-full text-white">
          {artist.name}
        </p>
        
        <div className="flex items-center gap-x-2">
          {artist.verified && (
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          )}
          <p className="text-neutral-400 text-sm truncate">
            {artist.followers.toLocaleString()} followers
          </p>
        </div>

        {artist.genres && artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {artist.genres.slice(0, 2).map((genre) => (
              <span 
                key={genre}
                className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-full"
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