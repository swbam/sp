'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import type { ShowWithDetails } from '@/types';

interface ShowsListProps {
  artistSlug: string;
  initialShows?: ShowWithDetails[];
}

export const ShowsList: React.FC<ShowsListProps> = ({ 
  artistSlug, 
  initialShows = [] 
}) => {
  const [shows, setShows] = useState<ShowWithDetails[]>(initialShows);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  useEffect(() => {
    const fetchShows = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/artists/${artistSlug}/shows?status=${filter}`);
        if (response.ok) {
          const data = await response.json();
          setShows(data.shows || []);
        }
      } catch (error) {
        console.error('Error fetching shows:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if filter changes and we don't have initial data for upcoming
    if (filter !== 'upcoming' || initialShows.length === 0) {
      fetchShows();
    }
  }, [artistSlug, filter, initialShows.length]);

  const filteredShows = filter === 'upcoming' && initialShows.length > 0 
    ? initialShows 
    : shows;

  return (
    <div className="mt-8">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-white text-2xl font-semibold">Shows</h2>
          <div className="flex bg-neutral-800 rounded-full p-1">
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                filter === 'upcoming'
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                filter === 'all'
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Shows
            </button>
          </div>
        </div>
        
        {filteredShows.length > 0 && (
          <p className="text-neutral-400 text-sm">
            {filteredShows.length} show{filteredShows.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-x-4 p-4 bg-neutral-800 rounded-md animate-pulse"
            >
              <div className="min-h-[64px] min-w-[64px] bg-neutral-700 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-neutral-700 rounded" />
                <div className="h-3 w-1/2 bg-neutral-700 rounded" />
                <div className="h-3 w-2/3 bg-neutral-700 rounded" />
              </div>
              <div className="h-6 w-16 bg-neutral-700 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Shows List */}
      {!isLoading && (
        <>
          {filteredShows.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎵</div>
              <p className="text-neutral-400 text-lg mb-2">
                {filter === 'upcoming' ? 'No upcoming shows' : 'No shows found'}
              </p>
              <p className="text-neutral-500 text-sm">
                {filter === 'upcoming' 
                  ? 'Check back later for tour dates!' 
                  : 'This artist hasn\'t performed any tracked shows yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredShows.map((show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};