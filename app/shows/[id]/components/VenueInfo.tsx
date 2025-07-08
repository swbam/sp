'use client';

import type { Venue } from '@/types';

interface VenueInfoProps {
  venue: Venue;
}

export const VenueInfo: React.FC<VenueInfoProps> = ({ venue }) => {
  if (!venue) return null;

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Venue Information</h3>
      
      <div className="space-y-3">
        <div>
          <p className="text-neutral-400 text-sm">Venue</p>
          <p className="text-white font-medium">{venue.name}</p>
        </div>
        
        <div>
          <p className="text-neutral-400 text-sm">Location</p>
          <p className="text-white">
            {venue.city}{venue.state && `, ${venue.state}`}
          </p>
          <p className="text-neutral-300 text-sm">{venue.country}</p>
        </div>

        {venue.capacity && (
          <div>
            <p className="text-neutral-400 text-sm">Capacity</p>
            <p className="text-white">{venue.capacity.toLocaleString()}</p>
          </div>
        )}

        {/* Additional venue features could be added here */}
        <div className="pt-2 border-t border-neutral-700">
          <p className="text-neutral-400 text-xs">
            Venue details are sourced from venue databases and may not be complete.
          </p>
        </div>
      </div>
    </div>
  );
};