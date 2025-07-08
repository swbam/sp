'use client';

import { useUser } from '@/hooks/useUser';
import { SpotifyDashboard } from './SpotifyDashboard';
import { TrendingSection } from '@/components/TrendingSection';
import { FeaturedSection } from '@/components/FeaturedSection';
import type { ShowWithDetails, Artist } from '@/types';

interface ConditionalContentProps {
  initialTrendingShows?: ShowWithDetails[];
  initialTrendingArtists?: Artist[];
}

export const ConditionalContent: React.FC<ConditionalContentProps> = ({ 
  initialTrendingShows = [],
  initialTrendingArtists = []
}) => {
  const { user } = useUser();

  if (user) {
    return (
      <div className="space-y-16">
        {/* Spotify Dashboard for logged-in users */}
        <div className="mt-8">
          <SpotifyDashboard />
        </div>
        
        {/* Featured Content */}
        <FeaturedSection />
        
        {/* Trending Content */}
        <TrendingSection 
          initialTrendingShows={initialTrendingShows}
          initialTrendingArtists={initialTrendingArtists}
        />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Featured Content */}
      <FeaturedSection />
      
      {/* Trending Content */}
      <TrendingSection 
        initialTrendingShows={initialTrendingShows}
        initialTrendingArtists={initialTrendingArtists}
      />
    </div>
  );
}; 