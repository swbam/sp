import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TrendingPageContent } from './components/TrendingPageContent';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export const revalidate = 300; // 5 minutes

export default async function TrendingPage() {
  const supabase = createServerComponentClient({ cookies });

  // Pre-fetch trending data on server
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const [trendingShows, trendingArtists] = await Promise.all([
    fetch(`${baseUrl}/api/trending?type=shows&limit=20&timeframe=week`, {
      next: { revalidate: 300 }
    }).then(res => res.json()).catch(() => ({ trending_shows: [] })),
    fetch(`${baseUrl}/api/trending?type=artists&limit=24&timeframe=week`, {
      next: { revalidate: 300 }
    }).then(res => res.json()).catch(() => ({ trending_artists: [] }))
  ]);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      {/* Header */}
      <div className="relative bg-gradient-to-b from-purple-800/40 via-purple-900/20 to-neutral-900 pt-8 pb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
        <div className="relative z-10 px-6">
          <h1 className="text-4xl font-bold text-white mb-2">🔥 Trending</h1>
          <p className="text-neutral-300 text-lg">
            Discover the hottest shows and artists gaining momentum
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        <TrendingPageContent 
          initialTrendingShows={trendingShows.trending_shows || []}
          initialTrendingArtists={trendingArtists.trending_artists || []}
        />
      </div>
    </div>
  );
}