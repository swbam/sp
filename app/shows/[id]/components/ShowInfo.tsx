'use client';

import type { ShowWithDetails } from '@/types';
import { useState, useEffect } from 'react';

interface ShowInfoProps {
  show: ShowWithDetails;
}

interface ShowStats {
  totalPredictions: number;
  totalVotes: number;
  uniqueVoters: number;
}

export const ShowInfo: React.FC<ShowInfoProps> = ({ show }) => {
  const [stats, setStats] = useState<ShowStats>({
    totalPredictions: 0,
    totalVotes: 0,
    uniqueVoters: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/shows/${show.id}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching show stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [show.id]);

  return (
    <div className="space-y-6">
      {/* Show Details */}
      <div className="bg-neutral-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Show Details</h3>
        
        <div className="space-y-3">
          <div>
            <p className="text-neutral-400 text-sm">Status</p>
            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
              show.status === 'upcoming' ? 'bg-green-600 text-white' : 
              show.status === 'ongoing' ? 'bg-yellow-600 text-white' :
              show.status === 'completed' ? 'bg-neutral-600 text-neutral-300' :
              'bg-red-600 text-white'
            }`}>
              {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
            </div>
          </div>

          {show.venue && (
            <>
              <div>
                <p className="text-neutral-400 text-sm">Venue</p>
                <p className="text-white">{show.venue?.name}</p>
              </div>
              
              <div>
                <p className="text-neutral-400 text-sm">Location</p>
                <p className="text-white">
                  {show.venue?.city}, {show.venue?.state || show.venue?.country}
                </p>
              </div>

              {show.venue?.capacity && (
                <div>
                  <p className="text-neutral-400 text-sm">Capacity</p>
                  <p className="text-white">{show.venue?.capacity?.toLocaleString()}</p>
                </div>
              )}
            </>
          )}

          <div>
            <p className="text-neutral-400 text-sm">Show Added</p>
            <p className="text-white">
              {new Date(show.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Voting Stats */}
      <div className="bg-neutral-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Voting Stats</h3>
        
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 w-24 bg-neutral-700 rounded mb-1" />
                <div className="h-6 w-12 bg-neutral-700 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-neutral-400 text-sm">Total Predictions</p>
              <p className="text-white text-xl font-bold">{stats.totalPredictions}</p>
            </div>
            
            <div>
              <p className="text-neutral-400 text-sm">Total Votes</p>
              <p className="text-white text-xl font-bold">{stats.totalVotes}</p>
            </div>

            <div>
              <p className="text-neutral-400 text-sm">Unique Voters</p>
              <p className="text-white text-xl font-bold">{stats.uniqueVoters}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};