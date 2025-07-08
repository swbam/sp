'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ShowWithDetails, Artist } from '@/types';

interface TrendingData {
  trending_shows: ShowWithDetails[];
  trending_artists: Artist[];
  lastUpdated: Date;
}

export function useRealtimeTrending(
  initialData?: TrendingData,
  options?: {
    timeframe?: 'day' | 'week' | 'month';
    showsLimit?: number;
    artistsLimit?: number;
    updateInterval?: number;
  }
) {
  const [data, setData] = useState<TrendingData>(
    initialData || {
      trending_shows: [],
      trending_artists: [],
      lastUpdated: new Date()
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const {
    timeframe = 'week',
    showsLimit = 10,
    artistsLimit = 12,
    updateInterval = 60000 // 1 minute
  } = options || {};

  // Fetch trending data
  const fetchTrendingData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [showsResponse, artistsResponse] = await Promise.all([
        fetch(`/api/trending?type=shows&limit=${showsLimit}&timeframe=${timeframe}`),
        fetch(`/api/trending?type=artists&limit=${artistsLimit}&timeframe=${timeframe}`)
      ]);

      const [showsData, artistsData] = await Promise.all([
        showsResponse.json(),
        artistsResponse.json()
      ]);

      if (showsResponse.ok && artistsResponse.ok) {
        setData({
          trending_shows: showsData.trending_shows || [],
          trending_artists: artistsData.trending_artists || [],
          lastUpdated: new Date()
        });
      } else {
        setError('Failed to fetch trending data');
      }
    } catch (err) {
      setError('Network error while fetching trending data');
      console.error('Trending fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showsLimit, artistsLimit, timeframe]);

  // Set up real-time subscriptions
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let votesSubscription: any;
    let showsSubscription: any;
    let artistsSubscription: any;

    const setupSubscriptions = async () => {
      try {
        // Subscribe to vote changes
        votesSubscription = supabase
          .channel('trending-votes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'votes'
            },
            (payload) => {
              console.log('Vote change detected:', payload);
              // Debounce updates to avoid excessive API calls
              clearTimeout(interval);
              interval = setTimeout(fetchTrendingData, 2000);
            }
          )
          .subscribe();

        // Subscribe to show changes
        showsSubscription = supabase
          .channel('trending-shows')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'shows'
            },
            (payload) => {
              console.log('Show change detected:', payload);
              clearTimeout(interval);
              interval = setTimeout(fetchTrendingData, 2000);
            }
          )
          .subscribe();

        // Subscribe to artist changes
        artistsSubscription = supabase
          .channel('trending-artists')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'artists'
            },
            (payload) => {
              console.log('Artist change detected:', payload);
              clearTimeout(interval);
              interval = setTimeout(fetchTrendingData, 2000);
            }
          )
          .subscribe();

        // Set up periodic updates
        interval = setInterval(fetchTrendingData, updateInterval);

      } catch (err) {
        console.error('Error setting up trending subscriptions:', err);
      }
    };

    setupSubscriptions();

    return () => {
      clearInterval(interval);
      if (votesSubscription) {
        supabase.removeChannel(votesSubscription);
      }
      if (showsSubscription) {
        supabase.removeChannel(showsSubscription);
      }
      if (artistsSubscription) {
        supabase.removeChannel(artistsSubscription);
      }
    };
  }, [supabase, fetchTrendingData, updateInterval]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchTrendingData();
  }, [fetchTrendingData]);

  return {
    data,
    isLoading,
    error,
    refresh,
    lastUpdated: data.lastUpdated
  };
}