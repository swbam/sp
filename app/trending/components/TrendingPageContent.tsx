'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import { ArtistCard } from '@/components/ArtistCard';
import { ResponsiveGrid } from '@/components/ResponsiveGrid';
import { TrendingUpdateNotifier } from '@/components/TrendingUpdateNotifier';
import { useRealtimeTrending } from '@/hooks/useRealtimeTrending';
import type { ShowWithDetails, Artist } from '@/types';

interface TrendingPageContentProps {
  initialTrendingShows: ShowWithDetails[];
  initialTrendingArtists: Artist[];
}

export const TrendingPageContent: React.FC<TrendingPageContentProps> = ({
  initialTrendingShows,
  initialTrendingArtists
}) => {
  const [activeTab, setActiveTab] = useState<'shows' | 'artists'>('shows');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [showLastUpdated, setShowLastUpdated] = useState(false);

  // Use real-time trending hook with dynamic options
  const { data, isLoading, error, lastUpdated, refresh } = useRealtimeTrending(
    {
      trending_shows: initialTrendingShows,
      trending_artists: initialTrendingArtists,
      lastUpdated: new Date()
    },
    {
      timeframe,
      showsLimit: 20,
      artistsLimit: 24,
      updateInterval: 30000 // 30 seconds for trending page
    }
  );

  // Show last updated indicator briefly when data changes
  useEffect(() => {
    if (lastUpdated) {
      setShowLastUpdated(true);
      const timer = setTimeout(() => setShowLastUpdated(false), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastUpdated]);

  const LoadingSkeleton = ({ type }: { type: 'show' | 'artist' }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`
            bg-neutral-800 
            rounded-lg 
            animate-pulse
            ${type === 'artist' ? 'aspect-square' : 'h-32'}
          `}
        />
      ))}
    </div>
  );

  const TabButton = ({ tab, label }: { tab: 'shows' | 'artists', label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`
        px-6 py-3 rounded-lg font-medium transition-all
        ${activeTab === tab 
          ? 'bg-purple-600 text-white' 
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        }
      `}
    >
      {label}
    </button>
  );

  const TimeframeButton = ({ timeframe: tf, label }: { timeframe: 'day' | 'week' | 'month', label: string }) => (
    <button
      onClick={() => setTimeframe(tf)}
      className={`
        px-4 py-2 rounded-md text-sm font-medium transition-all
        ${timeframe === tf 
          ? 'bg-emerald-600 text-white' 
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        }
      `}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Real-time update notifier */}
      <TrendingUpdateNotifier onUpdate={refresh} />
      
      <div className="space-y-8">
        {/* Real-time update indicator */}
        {showLastUpdated && (
          <div className="flex items-center justify-center">
            <div className="bg-purple-600/20 border border-purple-500/30 rounded-full px-4 py-2 flex items-center gap-2 text-purple-400 text-sm">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Tab Navigation */}
        <div className="flex gap-2">
          <TabButton tab="shows" label="🎵 Shows" />
          <TabButton tab="artists" label="⭐ Artists" />
        </div>

        {/* Timeframe Filter */}
        <div className="flex gap-2">
          <TimeframeButton timeframe="day" label="Today" />
          <TimeframeButton timeframe="week" label="This Week" />
          <TimeframeButton timeframe="month" label="This Month" />
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        )}

        {activeTab === 'shows' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                🔥 Trending Shows
              </h2>
              <div className="text-sm text-neutral-400">
                {data.trending_shows.length} shows
              </div>
            </div>

            {data.trending_shows.length > 0 ? (
              <ResponsiveGrid
                columns={{ default: 1, md: 2, lg: 3 }}
                gap="gap-6"
              >
                {data.trending_shows.map((show: ShowWithDetails) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </ResponsiveGrid>
            ) : (
              <div className="text-center py-20 bg-neutral-800/50 rounded-lg">
                <div className="text-6xl mb-4">🎪</div>
                <p className="text-neutral-300 text-xl mb-2">No trending shows yet</p>
                <p className="text-neutral-500">
                  Shows will appear here as they gain votes and popularity
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'artists' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                ⭐ Popular Artists
              </h2>
              <div className="text-sm text-neutral-400">
                {data.trending_artists.length} artists
              </div>
            </div>

            {data.trending_artists.length > 0 ? (
              <ResponsiveGrid
                columns={{ default: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
                gap="gap-6"
              >
                {data.trending_artists.map((artist: Artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </ResponsiveGrid>
            ) : (
              <div className="text-center py-20 bg-neutral-800/50 rounded-lg">
                <div className="text-6xl mb-4">🎤</div>
                <p className="text-neutral-300 text-xl mb-2">No trending artists yet</p>
                <p className="text-neutral-500">
                  Artists will appear here as they gain followers and bookings
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 p-4 rounded-lg border border-purple-500/20">
          <div className="text-xl font-bold text-purple-400 mb-1">
            {data.trending_shows.length}
          </div>
          <div className="text-neutral-300 text-sm">
            Trending Shows
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 p-4 rounded-lg border border-blue-500/20">
          <div className="text-xl font-bold text-blue-400 mb-1">
            {data.trending_artists.length}
          </div>
          <div className="text-neutral-300 text-sm">
            Popular Artists
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 p-4 rounded-lg border border-emerald-500/20">
          <div className="text-xl font-bold text-emerald-400 mb-1">
            Live
          </div>
          <div className="text-neutral-300 text-sm">
            Voting Active
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 p-4 rounded-lg border border-orange-500/20">
          <div className="text-xl font-bold text-orange-400 mb-1">
            {timeframe === 'day' ? '24h' : timeframe === 'week' ? '7d' : '30d'}
          </div>
          <div className="text-neutral-300 text-sm">
            Timeframe
          </div>
        </div>
      </div>

      {/* Error indicator */}
      {error && (
        <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>Error loading trending data: {error}</span>
            </div>
            <button 
              onClick={refresh}
              className="text-red-300 hover:text-red-200 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
};