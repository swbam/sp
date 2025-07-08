'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import { ArtistCard } from '@/components/ArtistCard';
import { ResponsiveGrid } from '@/components/ResponsiveGrid';
import type { ShowWithDetails, Artist } from '@/types';
import { AiOutlineClockCircle } from 'react-icons/ai';
import { HiOutlineLocationMarker, HiOutlineUsers, HiOutlineTrendingUp } from 'react-icons/hi';

interface FeaturedSectionProps {
  className?: string;
}

export const FeaturedSection: React.FC<FeaturedSectionProps> = ({ className = '' }) => {
  const [featuredShows, setFeaturedShows] = useState<ShowWithDetails[]>([]);
  const [featuredArtists, setFeaturedArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState({
    totalShows: 0,
    totalArtists: 0,
    totalVotes: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedContent = async () => {
      try {
        // Load real featured content (top US artists and stadium shows)
        const featuredResponse = await fetch('/api/featured');
        const featuredData = await featuredResponse.json();
        
        if (featuredResponse.ok) {
          setFeaturedShows(featuredData.featured_shows || []);
          setFeaturedArtists(featuredData.featured_artists || []);
          
          console.log('Featured content loaded:', featuredData.sync_stats);
        }

        // Load stats
        const statsResponse = await fetch('/api/stats');
        const statsData = await statsResponse.json();
        
        if (statsResponse.ok) {
          setStats(prevStats => ({
            ...prevStats,
            ...statsData.stats
          }));
        }
        
      } catch (error) {
        console.error('Failed to load featured content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFeaturedContent();
  }, []);

  const LoadingSkeleton = () => (
    <div className="space-y-8">
      {/* Featured Shows Skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
      
      {/* Featured Artists Skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className={`space-y-12 ${className}`}>
      {/* Quick Stats Overview */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-600/10 to-emerald-700/10 p-6 rounded-lg border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <AiOutlineClockCircle className="w-8 h-8 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                {stats.totalShows}
              </div>
              <div className="text-neutral-300 text-sm">
                Upcoming Shows
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-600/10 to-blue-700/10 p-6 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-3">
            <HiOutlineUsers className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {stats.totalArtists}
              </div>
              <div className="text-neutral-300 text-sm">
                Artists Available
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600/10 to-purple-700/10 p-6 rounded-lg border border-purple-500/20">
          <div className="flex items-center gap-3">
            <HiOutlineTrendingUp className="w-8 h-8 text-purple-400" />
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {stats.totalVotes}
              </div>
              <div className="text-neutral-300 text-sm">
                Total Votes Cast
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-600/10 to-yellow-700/10 p-6 rounded-lg border border-yellow-500/20">
          <div className="flex items-center gap-3">
            <HiOutlineLocationMarker className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                Live
              </div>
              <div className="text-neutral-300 text-sm">
                Setlist Voting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Shows */}
      {featuredShows.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-semibold">
              🏟️ Major Venue Shows
            </h2>
            <a
              href="/shows"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
            >
              View All Shows →
            </a>
          </div>
          
          <ResponsiveGrid
            columns={{ default: 1, md: 2, lg: 3 }}
            gap="gap-4"
          >
            {featuredShows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </ResponsiveGrid>
        </section>
      )}

      {/* Featured Artists */}
      {featuredArtists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-semibold">
              🎤 Top US Artists
            </h2>
            <a
              href="/search"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
            >
              Browse All Artists →
            </a>
          </div>
          
          <ResponsiveGrid
            columns={{ default: 2, sm: 3, md: 4, lg: 4, xl: 5, '2xl': 6 }}
            gap="gap-4"
          >
            {featuredArtists.slice(0, 8).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </ResponsiveGrid>
        </section>
      )}

      {/* Call to Action */}
      <section className="text-center py-12 bg-gradient-to-r from-emerald-600/10 to-blue-600/10 rounded-lg border border-emerald-500/20">
        <h3 className="text-white text-2xl font-semibold mb-4">
          Ready to Start Predicting Setlists?
        </h3>
        <p className="text-neutral-300 mb-6 max-w-2xl mx-auto">
          Join thousands of music fans who are already voting on their favorite songs and 
          predicting setlists for upcoming concerts. Discover new shows and make your voice heard!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/search"
            className="
              bg-emerald-600 
              hover:bg-emerald-500 
              text-white 
              px-8 
              py-3 
              rounded-full 
              font-medium 
              transition-colors
              inline-block
            "
          >
            Find Artists
          </a>
          <a
            href="/shows"
            className="
              bg-transparent 
              hover:bg-neutral-700/50 
              text-emerald-400 
              border 
              border-emerald-400 
              hover:border-emerald-300
              hover:text-emerald-300 
              px-8 
              py-3 
              rounded-full 
              font-medium 
              transition-all
              inline-block
            "
          >
            Browse Shows
          </a>
        </div>
      </section>
    </div>
  );
};