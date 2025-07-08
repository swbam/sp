'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import { ArtistCard } from '@/components/ArtistCard';
import { Slider } from '@/components/Slider';
import type { ShowWithDetails, Artist } from '@/types';

interface TrendingSectionProps {
  className?: string;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({ className = '' }) => {
  const [trendingShows, setTrendingShows] = useState<ShowWithDetails[]>([]);
  const [trendingArtists, setTrendingArtists] = useState<Artist[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(true);
  const [isLoadingArtists, setIsLoadingArtists] = useState(true);

  useEffect(() => {
    const loadTrendingShows = async () => {
      try {
        const response = await fetch('/api/trending?type=shows&limit=10&timeframe=week');
        const data = await response.json();
        
        if (response.ok) {
          setTrendingShows(data.trending_shows || []);
        } else {
          // Fallback to regular shows
          const fallbackResponse = await fetch('/api/shows?limit=10&status=upcoming');
          const fallbackData = await fallbackResponse.json();
          if (fallbackResponse.ok) {
            setTrendingShows(fallbackData.shows || []);
          }
        }
      } catch (error) {
        console.error('Failed to load trending shows:', error);
      } finally {
        setIsLoadingShows(false);
      }
    };

    const loadTrendingArtists = async () => {
      try {
        const response = await fetch('/api/trending?type=artists&limit=12&timeframe=week');
        const data = await response.json();
        
        if (response.ok) {
          setTrendingArtists(data.trending_artists || []);
        } else {
          // Fallback to regular artists
          const fallbackResponse = await fetch('/api/artists?limit=12&sort=followers');
          const fallbackData = await fallbackResponse.json();
          if (fallbackResponse.ok) {
            setTrendingArtists(fallbackData.artists || []);
          }
        }
      } catch (error) {
        console.error('Failed to load trending artists:', error);
      } finally {
        setIsLoadingArtists(false);
      }
    };

    loadTrendingShows();
    loadTrendingArtists();
  }, []);

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
      {/* Trending Shows */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">
            🔥 Trending Shows This Week
          </h2>
          <a
            href="/shows"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
          >
            View All Shows →
          </a>
        </div>
        
        {isLoadingShows ? (
          <LoadingSkeleton count={3} type="show" />
        ) : trendingShows.length > 0 ? (
          <Slider
            itemsPerView={{ default: 1, md: 2, lg: 3 }}
            showArrows={true}
            className="w-full"
          >
            {trendingShows.map((show) => (
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
        
        {isLoadingArtists ? (
          <LoadingSkeleton count={6} type="artist" />
        ) : trendingArtists.length > 0 ? (
          <Slider
            itemsPerView={{ default: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
            showArrows={true}
            className="w-full"
          >
            {trendingArtists.map((artist) => (
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
            {trendingShows.length}
          </div>
          <div className="text-neutral-300 text-sm">
            Trending Shows This Week
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 p-6 rounded-lg border border-blue-500/20">
          <div className="text-2xl font-bold text-blue-400 mb-2">
            {trendingArtists.length}
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
    </div>
  );
};