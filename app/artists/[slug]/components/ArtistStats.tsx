'use client';

import type { Artist } from '@/types';
import { useState, useEffect } from 'react';

interface ArtistStatsProps {
  artist: Artist;
}

interface Stats {
  totalShows: number;
  upcomingShows: number;
  totalFollowers: number;
  totalVotes: number;
}

export const ArtistStats: React.FC<ArtistStatsProps> = ({ artist }) => {
  const [stats, setStats] = useState<Stats>({
    totalShows: 0,
    upcomingShows: 0,
    totalFollowers: artist.followers,
    totalVotes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/artists/${artist.slug}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats({
            ...data,
            totalFollowers: artist.followers,
          });
        }
      } catch (error) {
        console.error('Error fetching artist stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [artist.slug, artist.followers]);

  if (isLoading) {
    return (
      <div className="bg-neutral-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Artist Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-6 w-16 bg-neutral-700 rounded animate-pulse mx-auto mb-2" />
              <div className="h-4 w-20 bg-neutral-700 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Total Shows',
      value: stats.totalShows.toLocaleString(),
      color: 'text-blue-400',
    },
    {
      label: 'Upcoming',
      value: stats.upcomingShows.toLocaleString(),
      color: 'text-green-400',
    },
    {
      label: 'Followers',
      value: stats.totalFollowers.toLocaleString(),
      color: 'text-purple-400',
    },
    {
      label: 'Total Votes',
      value: stats.totalVotes.toLocaleString(),
      color: 'text-yellow-400',
    },
  ];

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Artist Stats</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-neutral-400 text-sm mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};