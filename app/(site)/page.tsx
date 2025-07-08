import { HeroSearch } from '@/components/HeroSearch';
import { ConditionalContent } from './components/ConditionalContent';

export const revalidate = 300; // 5 minutes

export default async function Home() {
  // Pre-fetch trending data for better performance
  const [trendingShows, trendingArtists] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/trending?type=shows&limit=8&timeframe=week`, {
      next: { revalidate: 300 }
    }).then(res => res.json()).catch(() => ({ trending_shows: [] })),
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/trending?type=artists&limit=12&timeframe=week`, {
      next: { revalidate: 300 }
    }).then(res => res.json()).catch(() => ({ trending_artists: [] }))
  ]);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      {/* Hero Section with Centered Search */}
      <div className="
        relative
        bg-gradient-to-b 
        from-emerald-800/40 
        via-emerald-900/20 
        to-neutral-900
        pt-24 
        pb-16
      ">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5" />
        <div className="relative z-10">
          <HeroSearch />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-8 -mt-8 relative z-20">
        <ConditionalContent 
          initialTrendingShows={trendingShows.trending_shows || []}
          initialTrendingArtists={trendingArtists.trending_artists || []}
        />
      </div>
    </div>
  );
}
