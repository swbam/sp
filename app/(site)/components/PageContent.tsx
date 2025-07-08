'use client';

import { useState, useEffect } from 'react';
import { ShowCard } from '@/components/ShowCard';
import { Slider } from '@/components/Slider';
import type { ShowWithDetails } from '@/types';

interface PageContentProps {
  limit?: number;
  displayType?: 'list' | 'slider' | 'grid';
  showHeader?: boolean;
}

export const PageContent: React.FC<PageContentProps> = ({ 
  limit = 10,
  displayType = 'list',
  showHeader = false
}) => {
  const [shows, setShows] = useState<ShowWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTrendingShows = async () => {
      try {
        // Use trending API for better content discovery
        const response = await fetch(`/api/trending?type=shows&limit=${limit}&timeframe=week`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load trending shows');
        }
        
        setShows(data.trending_shows || []);
        setIsLoading(false);
        
      } catch (error) {
        console.error('Failed to load trending shows:', error);
        
        // Fallback to regular shows API
        try {
          const fallbackResponse = await fetch(`/api/shows?limit=${limit}&status=upcoming`);
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackResponse.ok) {
            setShows(fallbackData.shows || []);
          }
        } catch (fallbackError) {
          console.error('Fallback API also failed:', fallbackError);
        }
        
        setIsLoading(false);
      }
    };

    loadTrendingShows();
  }, [limit]);

  if (isLoading) {
    return (
      <div className="mt-4 text-neutral-400 text-center py-8">
        <div className="animate-pulse">
          <div className="text-lg mb-2">Loading trending shows...</div>
          <div className="text-sm">Finding the hottest concerts this week</div>
        </div>
      </div>
    );
  }

  if (shows.length === 0) {
    return (
      <div className="mt-4 text-neutral-400 text-center py-8">
        <div className="text-4xl mb-4">🎵</div>
        <p className="text-lg mb-2">No trending shows found</p>
        <p className="text-sm">Check back soon as we add more concerts and trending data!</p>
        <p className="text-xs mt-2 opacity-75">
          Trending shows are calculated based on votes, upcoming dates, and artist popularity
        </p>
      </div>
    );
  }

  const renderContent = () => {
    switch (displayType) {
      case 'slider':
        return (
          <Slider
            itemsPerView={{ default: 1, md: 2, lg: 3 }}
            showArrows={true}
            className="w-full"
          >
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </Slider>
        );
      
      case 'grid':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        );
      
      case 'list':
      default:
        return (
          <div className="flex flex-col gap-4">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">
            Trending Shows This Week
          </h2>
          <a
            href="/shows"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
          >
            View All Shows →
          </a>
        </div>
      )}
      
      <div className="mt-4">
        {renderContent()}
      </div>
    </div>
  );
};
