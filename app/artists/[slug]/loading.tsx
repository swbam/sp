import { Header } from '@/components/Header';

export default function ArtistLoading() {
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-emerald-800">
        <div className="mt-20">
          <div className="flex flex-col md:flex-row items-center gap-x-5">
            {/* Image skeleton */}
            <div className="relative h-32 w-32 lg:h-44 lg:w-44 bg-neutral-800 rounded-full animate-pulse" />
            
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
              {/* Artist type skeleton */}
              <div className="hidden md:block h-4 w-12 bg-neutral-800 rounded animate-pulse" />
              
              {/* Name skeleton */}
              <div className="h-8 lg:h-12 w-64 lg:w-96 bg-neutral-800 rounded animate-pulse" />
              
              {/* Followers skeleton */}
              <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />

              {/* Genres skeleton */}
              <div className="flex gap-2 mt-2">
                <div className="h-6 w-16 bg-neutral-800 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-neutral-800 rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-neutral-800 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 w-40 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse" />
          </div>

          {/* Show skeletons */}
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-x-4 p-4 bg-neutral-800 rounded-md animate-pulse"
              >
                <div className="min-h-[64px] min-w-[64px] bg-neutral-700 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-neutral-700 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-700 rounded" />
                  <div className="h-3 w-2/3 bg-neutral-700 rounded" />
                </div>
                <div className="h-6 w-16 bg-neutral-700 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}