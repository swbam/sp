import { Header } from '@/components/Header';

export default function ShowLoading() {
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-emerald-800">
        <div className="mt-20">
          <div className="flex flex-col md:flex-row items-center gap-x-5">
            {/* Image skeleton */}
            <div className="relative h-32 w-32 lg:h-44 lg:w-44 bg-neutral-800 rounded animate-pulse" />
            
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
              {/* Concert type skeleton */}
              <div className="hidden md:block h-4 w-16 bg-neutral-800 rounded animate-pulse" />
              
              {/* Show name skeleton */}
              <div className="h-8 lg:h-12 w-80 lg:w-96 bg-neutral-800 rounded animate-pulse" />
              
              {/* Artist name skeleton */}
              <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse" />
              
              {/* Date & venue skeleton */}
              <div className="h-4 w-64 bg-neutral-800 rounded animate-pulse" />
              <div className="h-4 w-56 bg-neutral-800 rounded animate-pulse" />

              {/* Ticket button skeleton */}
              <div className="mt-4 h-12 w-32 bg-neutral-800 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content - Setlist skeleton */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="h-6 w-48 bg-neutral-800 rounded animate-pulse mb-2" />
              <div className="h-4 w-80 bg-neutral-800 rounded animate-pulse" />
            </div>

            {/* Setlist songs skeleton */}
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg animate-pulse"
                >
                  <div className="w-8 h-8 bg-neutral-700 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-neutral-700 rounded" />
                    <div className="h-3 w-1/2 bg-neutral-700 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-neutral-700 rounded-full" />
                    <div className="w-8 h-4 bg-neutral-700 rounded" />
                    <div className="w-8 h-8 bg-neutral-700 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Show info skeleton */}
            <div className="bg-neutral-800 rounded-lg p-6 animate-pulse">
              <div className="h-5 w-32 bg-neutral-700 rounded mb-4" />
              <div className="space-y-3">
                <div>
                  <div className="h-3 w-12 bg-neutral-700 rounded mb-1" />
                  <div className="h-6 w-20 bg-neutral-700 rounded" />
                </div>
                <div>
                  <div className="h-3 w-12 bg-neutral-700 rounded mb-1" />
                  <div className="h-4 w-40 bg-neutral-700 rounded" />
                </div>
                <div>
                  <div className="h-3 w-16 bg-neutral-700 rounded mb-1" />
                  <div className="h-4 w-32 bg-neutral-700 rounded" />
                </div>
              </div>
            </div>

            {/* Voting stats skeleton */}
            <div className="bg-neutral-800 rounded-lg p-6 animate-pulse">
              <div className="h-5 w-28 bg-neutral-700 rounded mb-4" />
              <div className="space-y-3">
                <div>
                  <div className="h-3 w-24 bg-neutral-700 rounded mb-1" />
                  <div className="h-6 w-8 bg-neutral-700 rounded" />
                </div>
                <div>
                  <div className="h-3 w-20 bg-neutral-700 rounded mb-1" />
                  <div className="h-6 w-12 bg-neutral-700 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}