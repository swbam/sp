'use client';

import Image from "next/image";
import { useState } from "react";

import { useLoadImage } from "@/hooks/useLoadImage";

interface MediaItemProps {
  data: any;
  onClick?: (id: string) => void;
}

const MediaItem: React.FC<MediaItemProps> = ({
  data,
  onClick
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = useLoadImage(data);

  const handleClick = () => {
    if (onClick) {
      return onClick(data.id);
    }
  };

  // Determine the best image source with fallbacks
  const getImageSrc = () => {
    if (imageError) {
      return "/images/music-placeholder.png";
    }
    
    // Check if we have a valid imageUrl from the hook
    if (imageUrl && !imageUrl.includes('undefined') && !imageUrl.includes('null')) {
      return imageUrl;
    }
    
    // Check if data has image_url (for artists)
    if (data.image_url && 
        !data.image_url.includes('undefined') && 
        !data.image_url.includes('null') &&
        data.image_url !== '/images/music-placeholder.png') {
      return data.image_url;
    }
    
    // Fallback to placeholder
    return "/images/music-placeholder.png";
  };

  return ( 
    <div
      onClick={handleClick}
      className="
        flex 
        items-center 
        gap-x-3 
        cursor-pointer 
        hover:bg-neutral-800/50 
        w-full 
        p-2 
        rounded-md
      "
    >
      <div 
        className="
          relative 
          rounded-md 
          min-h-[48px] 
          min-w-[48px] 
          overflow-hidden
        "
      >
        <Image
          fill
          src={getImageSrc()}
          alt="MediaItem"
          className="object-cover"
          onError={() => setImageError(true)}
          sizes="48px"
        />
      </div>
      <div className="flex flex-col gap-y-1 overflow-hidden">
        <p className="text-white truncate">{data.title || data.name}</p>
        <p className="text-neutral-400 text-sm truncate">
          {data.artist_name || data.author || 'Unknown Artist'}
        </p>
      </div>
    </div>
  );
};

export default MediaItem; 