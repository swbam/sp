'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ShowWithDetails } from '@/types';

interface ShowHeaderProps {
  show: ShowWithDetails;
}

export const ShowHeader: React.FC<ShowHeaderProps> = ({ show }) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    try {
      return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeString;
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-x-5">
      <div className="relative h-32 w-32 lg:h-44 lg:w-44">
        <Image
          className="object-cover"
          fill
          src={show.artist?.image_url || "/images/music-placeholder.png"}
          alt={`${show.artist?.name} image`}
        />
      </div>
      
      <div className="flex flex-col gap-y-2 mt-4 md:mt-0 flex-1">
        <p className="hidden md:block font-semibold text-sm">Concert</p>
        
        <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold">
          {show.name}
        </h1>
        
        <div className="flex flex-col gap-y-1 text-sm">
          <Link
            href={`/artists/${show.artist?.slug}`}
            className="text-neutral-300 hover:text-white transition font-medium"
          >
            {show.artist?.name}
          </Link>
          <p className="text-neutral-400">
            {formatDate(show.date)} • {formatTime(show.start_time)}
          </p>
          {show.venue && (
            <p className="text-neutral-400">
              {show.venue?.name} • {show.venue?.city}, {show.venue?.state || show.venue?.country}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4">
          {/* Status Badge */}
          <div className={`
            px-3 py-1 rounded-full text-sm font-medium
            ${show.status === 'upcoming' ? 'bg-green-600 text-white' : 
              show.status === 'ongoing' ? 'bg-yellow-600 text-white' :
              show.status === 'completed' ? 'bg-neutral-600 text-neutral-300' :
              'bg-red-600 text-white'}
          `}>
            {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
          </div>

          {/* Ticket Button */}
          {show.ticket_url && show.status === 'upcoming' && (
            <a
              href={show.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full transition"
            >
              Get Tickets
            </a>
          )}
        </div>
      </div>
    </div>
  );
};