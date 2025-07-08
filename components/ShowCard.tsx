'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ShowWithDetails } from '@/types';
import { format } from 'date-fns';

interface ShowCardProps {
  show: ShowWithDetails;
  onClick?: (show: ShowWithDetails) => void;
}

export const ShowCard: React.FC<ShowCardProps> = ({ 
  show, 
  onClick 
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick(show);
    } else {
      router.push(`/shows/${show.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd');
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    try {
      return format(new Date(`2000-01-01T${timeString}`), 'h:mm a');
    } catch {
      return timeString;
    }
  };

  return (
    <div
      onClick={handleClick}
      className="
        relative 
        group 
        flex 
        items-center
        rounded-md 
        overflow-hidden 
        gap-x-4 
        bg-neutral-400/5 
        cursor-pointer 
        hover:bg-neutral-400/10 
        transition 
        p-4
      "
    >
      {/* Artist Image */}
      <div className="
        relative 
        min-h-[64px] 
        min-w-[64px] 
        rounded-md 
        overflow-hidden
      ">
        <Image
          className="object-cover"
          src={show.artist?.image_url || "/images/music-placeholder.png"}
          fill
          alt={show.artist?.name || 'Artist'}
        />
      </div>
      
      {/* Show Details */}
      <div className="flex flex-col gap-y-1 overflow-hidden flex-1">
        <p className="text-white truncate font-semibold">
          {show.name}
        </p>
        
        <p className="text-neutral-400 text-sm truncate">
          {show.artist?.name}
        </p>

        <div className="flex items-center gap-x-2 text-sm">
          <span className="text-neutral-300">
            {formatDate(show.date)}
          </span>
          
          {show.start_time && (
            <>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-300">
                {formatTime(show.start_time)}
              </span>
            </>
          )}
        </div>

        {show.venue && (
          <p className="text-neutral-400 text-sm truncate">
            {show.venue.name} • {show.venue.city}, {show.venue.state || show.venue.country}
          </p>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex flex-col items-end gap-y-2">
        <div className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${show.status === 'upcoming' ? 'bg-green-600 text-white' : 
            show.status === 'ongoing' ? 'bg-yellow-600 text-white' :
            show.status === 'completed' ? 'bg-neutral-600 text-neutral-300' :
            'bg-red-600 text-white'}
        `}>
          {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
        </div>

        {show.ticket_url && show.status === 'upcoming' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(show.ticket_url, '_blank');
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition"
          >
            Tickets
          </button>
        )}
      </div>
    </div>
  );
}; 