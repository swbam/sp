'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import { ArtistCard } from '@/components/ArtistCard';
import { Slider } from '@/components/Slider';
import { useRealtimeTrending } from '@/hooks/useRealtimeTrending';
import type { ShowWithDetails, Artist } from '@/types';

interface TrendingSectionProps {
  className?: string;
  initialTrendingShows?: ShowWithDetails[];
  initialTrendingArtists?: Artist[];
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({ 
  className = '',
  initialTrendingShows = [],
  initialTrendingArtists = []
}) => {
  const { data, isLoading, error, lastUpdated } = useRealtimeTrending(
    {
      trending_shows: initialTrendingShows,
      trending_artists: initialTrendingArtists,
      lastUpdated: new Date()
    },
    {
      timeframe: 'week',
      showsLimit: 10,
      artistsLimit: 12,
      updateInterval: 60000 // 1 minute
    }
  );

  const [showLastUpdated, setShowLastUpdated] = useState(false);

  // Show last updated indicator briefly when data changes
  useEffect(() => {
    if (lastUpdated) {
      setShowLastUpdated(true);
      const timer = setTimeout(() => setShowLastUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastUpdated]);

  const LoadingSkeleton = ({ count = 5, type = 'show' }: { count?: number; type?: 'show' | 'artist' }) => (
    <div className="flex gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`
            flex-shrink-0 
            bg-neutral-800 
            rounded-md 
            animate-pulse
            ${type === 'artist' 
              ? 'w-48 h-64' 
              : 'w-80 h-24'
            }
          `}
        />
      ))}
    </div>
  );

  return (
    <div className={`space-y-12 ${className}`}>
      {/* Real-time update indicator */}
      {showLastUpdated && (
        <div className="flex items-center justify-center">
          <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-full px-4 py-2 flex items-center gap-2 text-emerald-400 text-sm">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Trending Shows */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">
            🔥 Trending Shows This Week
          </h2>
          <div className="flex items-center gap-4">
            <a
              href="/trending"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
            >
              View All Trending →
            </a>
          </div>
        </div>
        
        {isLoading ? (
          <LoadingSkeleton count={3} type="show" />
        ) : data.trending_shows.length > 0 ? (
          <Slider
            itemsPerView={{ default: 1, md: 2, lg: 3 }}
            showArrows={true}
            className="w-full"
          >
            {data.trending_shows.map((show: ShowWithDetails) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </Slider>
        ) : (
          <div className="text-center py-12 bg-neutral-800/50 rounded-lg">
            <div className="text-4xl mb-4">🎪</div>
            <p className="text-neutral-400 text-lg mb-2">No trending shows yet</p>
            <p className="text-neutral-500 text-sm">
              Check back soon as we discover more concerts!
            </p>
          </div>
        )}
      </section>

      {/* Trending Artists */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">
            ⭐ Popular Artists
          </h2>
          <a
            href="/search"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
          >
            Browse All Artists →
          </a>
        </div>
        
        {isLoading ? (
          <LoadingSkeleton count={6} type="artist" />
        ) : data.trending_artists.length > 0 ? (
          <Slider
            itemsPerView={{ default: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
            showArrows={true}
            className="w-full"
          >
            {data.trending_artists.map((artist: Artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </Slider>
        ) : (
          <div className="text-center py-12 bg-neutral-800/50 rounded-lg">
            <div className="text-4xl mb-4">🎤</div>
            <p className="text-neutral-400 text-lg mb-2">No artists found</p>
            <p className="text-neutral-500 text-sm">
              Artists will appear here as we build our catalog!
            </p>
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 p-6 rounded-lg border border-emerald-500/20">
          <div className="text-2xl font-bold text-emerald-400 mb-2">
            {data.trending_shows.length}
          </div>
          <div className="text-neutral-300 text-sm">
            Trending Shows This Week
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 p-6 rounded-lg border border-blue-500/20">
          <div className="text-2xl font-bold text-blue-400 mb-2">
            {data.trending_artists.length}
          </div>
          <div className="text-neutral-300 text-sm">
            Popular Artists
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 p-6 rounded-lg border border-purple-500/20">
          <div className="text-2xl font-bold text-purple-400 mb-2">
            Live
          </div>
          <div className="text-neutral-300 text-sm">
            Setlist Voting
          </div>
        </div>
      </section>

      {/* Error indicator */}
      {error && (
        <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>Error loading trending data: {error}</span>
          </div>
        </div>
      )}
    </div>
  );
};