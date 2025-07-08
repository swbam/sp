import { HeroSearch } from '@/components/HeroSearch';
import { TrendingSection } from '@/components/TrendingSection';
import { FeaturedSection } from '@/components/FeaturedSection';

export const revalidate = 0;

export default async function Home() {
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
      <div className="px-6 pb-8 -mt-8 relative z-20 space-y-16">
        {/* Featured Content */}
        <FeaturedSection />
        
        {/* Trending Content */}
        <TrendingSection />
      </div>
    </div>
  );
}
